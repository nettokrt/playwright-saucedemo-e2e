#!/usr/bin/env node
/**
 * Automated report review for the Playwright JSON report.
 *
 * Reads the JSON reporter output and turns a raw pass/fail list into a triaged
 * review: every failing attempt is classified (product defect vs. environment
 * vs. test fragility), failures are clustered by error signature, flaky tests
 * are explained by *why* they recovered, and the run gets a verdict that CI can
 * act on.
 *
 * Usage:
 *   node scripts/review-report.mjs [--input test-results/results.json]
 *                                  [--out review.md] [--json review.json]
 *                                  [--fail-on product|any|none] [--quiet]
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

// Built from a char code so the escape sequence stays out of the source as a literal control char.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/**
 * Ordered classification rules — first match wins, so the specific network and
 * infrastructure signatures are checked before the generic timeout catch-alls.
 */
const RULES = [
  {
    id: 'infra-browser',
    label: 'Browser/runner could not start',
    kind: 'environment',
    action: 'Fix the runner image (browser download, missing deps). No product bug here.',
    match: /Executable doesn't exist|browserType\.launch|Host system is missing dependencies|Target page, context or browser has been closed/i,
  },
  {
    id: 'infra-tls',
    label: 'TLS / certificate rejected',
    kind: 'environment',
    action: 'Trust the CA on the runner (proxy MITM, expired cert). Not a product bug.',
    match: /ERR_CERT_|SSL_ERROR|certificate verify failed|self-signed certificate/i,
  },
  {
    id: 'infra-network',
    label: 'Network unreachable / connection failed',
    kind: 'environment',
    action: 'Re-run on a healthy runner. Check egress, proxy and DNS before filing a bug.',
    match: /net::ERR_|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up|connect ETIMEDOUT|getaddrinfo/i,
  },
  {
    id: 'upstream-5xx',
    label: 'Upstream service returned 5xx',
    kind: 'environment',
    action: 'Third-party dependency was down. Confirm service health, then re-run.',
    match: /\b50[0234]\b.*(Gateway|Service Unavailable|Internal Server Error)|Application error|Heroku/i,
  },
  {
    id: 'strict-mode',
    label: 'Selector matched multiple elements (strict mode)',
    kind: 'test-debt',
    action: 'Tighten the locator in the page object — the test is ambiguous, not the app.',
    match: /strict mode violation/i,
  },
  {
    id: 'product-assertion',
    label: 'Assertion failed on real product behavior',
    kind: 'product',
    action: 'Triage as a candidate defect: the app answered, the answer was wrong.',
    match: /expect\(|Expected:|Received:|toBe|toHaveText|toContainText|toHaveURL|toEqual|toHaveCount/i,
  },
  {
    id: 'locator-timeout',
    label: 'Waited for an element that never appeared',
    kind: 'suspect',
    action: 'Could be a UI regression or a stale selector — open the trace before deciding.',
    match: /waiting for locator|locator\.(click|fill|selectOption|textContent|isVisible)/i,
  },
  {
    id: 'hook-timeout',
    label: 'Timed out inside a hook (setup never finished)',
    kind: 'suspect',
    action: 'Setup (login/navigation) stalled — usually environmental when the run also shows network errors.',
    match: /Test timeout .* while running "(beforeEach|beforeAll|afterEach|afterAll)" hook/i,
  },
  {
    id: 'test-timeout',
    label: 'Test exceeded its timeout',
    kind: 'suspect',
    action: 'Check whether the app got slower or the test needs a longer budget.',
    match: /Test timeout of \d+ms exceeded/i,
  },
];

const UNCLASSIFIED = {
  id: 'unclassified',
  label: 'Unrecognized failure',
  kind: 'suspect',
  action: 'No rule matched — read the error and, if it recurs, add a rule to scripts/review-report.mjs.',
};

const KIND_ORDER = ['product', 'suspect', 'test-debt', 'environment'];
const KIND_LABEL = {
  product: 'Product defect',
  suspect: 'Needs a human look',
  'test-debt': 'Test/automation debt',
  environment: 'Environment / infrastructure',
};

function parseArgs(argv) {
  const args = {
    input: 'test-results/results.json',
    out: null,
    json: null,
    failOn: 'product',
    quiet: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inlineValue] = argv[i].split('=');
    const value = inlineValue ?? argv[i + 1];
    const consume = () => {
      if (inlineValue === undefined) i += 1;
    };
    if (flag === '--input' || flag === '-i') { args.input = value; consume(); }
    else if (flag === '--out' || flag === '-o') { args.out = value; consume(); }
    else if (flag === '--json') { args.json = value; consume(); }
    else if (flag === '--fail-on') { args.failOn = value; consume(); }
    else if (flag === '--quiet' || flag === '-q') { args.quiet = true; }
    else if (flag === '--help' || flag === '-h') { args.help = true; }
  }
  return args;
}

const clean = (text) => (text ?? '').replace(ANSI, '').trim();

/** Collapse a raw error into a stable signature so the same failure clusters. */
function signature(message) {
  return clean(message)
    .split('\n')[0]
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\b\d+(\.\d+)?(ms|s)\b/g, '<duration>')
    .replace(/\b\d+\b/g, '<n>')
    .slice(0, 160);
}

export function classify(message) {
  const text = clean(message);
  if (!text) return UNCLASSIFIED;
  return RULES.find((rule) => rule.match.test(text)) ?? UNCLASSIFIED;
}

/** Walk the JSON reporter tree into a flat list of test cases. */
function flatten(report) {
  const cases = [];
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        cases.push({
          title: spec.title,
          file: spec.file ?? suite.file ?? '',
          line: spec.line,
          project: test.projectName || test.projectId || '',
          status: test.status,
          expectedStatus: test.expectedStatus ?? 'passed',
          attempts: (test.results ?? []).map((result) => ({
            status: result.status,
            retry: result.retry ?? 0,
            duration: result.duration ?? 0,
            message: clean(result.error?.message ?? result.errors?.[0]?.message ?? ''),
          })),
        });
      }
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of report.suites ?? []) visit(suite);
  return cases;
}

const area = (file) => (file.split('/').pop() ?? file).replace(/\.spec\.ts$/, '');
const testId = (title) => (title.match(/\b(TC-[A-Z]+\d+)\b/) ?? [])[1] ?? null;
const duration = (testCase) => testCase.attempts.reduce((total, a) => total + a.duration, 0);

export function review(report) {
  const cases = flatten(report);
  const stats = report.stats ?? {};

  const findings = [];
  for (const testCase of cases) {
    if (testCase.status === 'skipped') continue;

    // A test.fail() case that passes means the documented defect is gone.
    if (testCase.expectedStatus === 'failed' && testCase.attempts.some((a) => a.status === 'passed')) {
      findings.push({
        testCase,
        rule: {
          id: 'defect-fixed',
          label: 'Documented defect no longer reproduces',
          kind: 'product',
          action: 'Upstream fixed it: drop the test.fail() annotation so the case guards the fix.',
        },
        message: 'Marked test.fail() but passed.',
        recovered: false,
      });
      continue;
    }

    if (testCase.status === 'expected') continue;

    const failedAttempts = testCase.attempts.filter((a) => a.status !== 'passed' && a.status !== 'skipped');
    if (failedAttempts.length === 0) continue;

    // Judge a test by its first failure: that is the signal the retry hid.
    const first = failedAttempts[0];
    findings.push({
      testCase,
      rule: classify(first.message),
      message: first.message,
      recovered: testCase.status === 'flaky',
      attemptsFailed: failedAttempts.length,
    });
  }

  // Run-wide contagion: when the environment is visibly degraded, ambiguous
  // timeouts are far more likely to be collateral damage than real defects.
  const envFindings = findings.filter((f) => f.rule.kind === 'environment');
  const degraded = envFindings.length >= 2 && envFindings.length / findings.length >= 0.5;
  if (degraded) {
    for (const finding of findings) {
      if (finding.rule.kind === 'suspect' && /timeout/i.test(finding.rule.id)) {
        finding.downgraded = true;
        finding.rule = {
          ...finding.rule,
          kind: 'environment',
          action: `${finding.rule.action} Downgraded automatically: ${envFindings.length} of ${findings.length} failures in this run are network/infrastructure errors.`,
        };
      }
    }
  }

  const clusters = new Map();
  for (const finding of findings) {
    const key = `${finding.rule.id}::${signature(finding.message)}`;
    const cluster = clusters.get(key) ?? {
      rule: finding.rule,
      signature: signature(finding.message) || finding.rule.label,
      tests: [],
    };
    cluster.tests.push(finding);
    clusters.set(key, cluster);
  }

  const areas = new Map();
  for (const testCase of cases) {
    const key = area(testCase.file);
    const bucket = areas.get(key) ?? { total: 0, passed: 0, failed: 0, flaky: 0 };
    bucket.total += 1;
    if (testCase.status === 'expected') bucket.passed += 1;
    else if (testCase.status === 'flaky') { bucket.flaky += 1; bucket.passed += 1; }
    else if (testCase.status === 'unexpected') bucket.failed += 1;
    areas.set(key, bucket);
  }

  const blocking = findings.filter((f) => f.rule.kind === 'product' && !f.recovered);
  const suspects = findings.filter((f) => f.rule.kind === 'suspect' || f.rule.kind === 'test-debt');
  const hardFailures = findings.filter((f) => !f.recovered);

  let verdict;
  if (blocking.length > 0) {
    verdict = { level: 'block', headline: `${blocking.length} product-level failure(s) — do not ship`, };
  } else if (suspects.some((f) => !f.recovered)) {
    verdict = { level: 'review', headline: 'No confirmed product defect, but failures need a human look' };
  } else if (hardFailures.length > 0) {
    verdict = { level: 'infra', headline: 'Every hard failure is environmental — re-run, do not open bugs' };
  } else if (findings.length > 0) {
    verdict = { level: 'flaky', headline: 'Suite is green, but retries hid failures' };
  } else {
    verdict = { level: 'pass', headline: 'Clean run — no failures, no retries' };
  }

  return {
    stats: {
      total: cases.length,
      passed: stats.expected ?? 0,
      failed: stats.unexpected ?? 0,
      flaky: stats.flaky ?? 0,
      skipped: stats.skipped ?? 0,
      durationMs: Math.round(stats.duration ?? 0),
      startedAt: stats.startTime ?? null,
    },
    verdict,
    degraded,
    findings,
    clusters: [...clusters.values()].sort(
      (a, b) => KIND_ORDER.indexOf(a.rule.kind) - KIND_ORDER.indexOf(b.rule.kind) || b.tests.length - a.tests.length,
    ),
    areas,
    slowest: [...cases].sort((a, b) => duration(b) - duration(a)).slice(0, 5),
  };
}

const VERDICT_BADGE = {
  block: '🔴 **BLOCK**',
  review: '🟠 **REVIEW**',
  infra: '🟡 **INFRA**',
  flaky: '🟡 **FLAKY**',
  pass: '🟢 **PASS**',
};

export function toMarkdown(result) {
  const { stats, verdict } = result;
  const seconds = (stats.durationMs / 1000).toFixed(1);
  const passRate = stats.total ? Math.round(((stats.passed + stats.flaky) / stats.total) * 100) : 0;
  const lines = [];

  lines.push('# Regression report review');
  lines.push('');
  lines.push(`${VERDICT_BADGE[verdict.level]} — ${verdict.headline}`);
  lines.push('');
  lines.push(`**${stats.passed + stats.flaky}/${stats.total} passing (${passRate}%)** · ${stats.failed} failed · ${stats.flaky} flaky · ${stats.skipped} skipped · ${seconds}s`);
  lines.push('');

  if (result.findings.length === 0) {
    lines.push('No failing attempts to triage.');
    lines.push('');
  } else {
    lines.push('## Triage');
    lines.push('');
    lines.push('| Verdict | Failure | Tests | What it means |');
    lines.push('|---|---|---|---|');
    for (const cluster of result.clusters) {
      const names = cluster.tests
        .map((f) => `${testId(f.testCase.title) ?? f.testCase.title}${f.recovered ? ' *(recovered)*' : ''}`)
        .join(', ');
      lines.push(`| ${KIND_LABEL[cluster.rule.kind]} | ${cluster.rule.label} | ${names} | ${cluster.rule.action} |`);
    }
    lines.push('');

    lines.push('## Failure clusters');
    lines.push('');
    for (const cluster of result.clusters) {
      lines.push(`### ${cluster.rule.label} — ${cluster.tests.length} test(s)`);
      lines.push('');
      lines.push('```');
      lines.push(cluster.signature);
      lines.push('```');
      for (const finding of cluster.tests) {
        const id = testId(finding.testCase.title);
        const tag = finding.recovered ? ' — passed on retry' : '';
        lines.push(`- \`${finding.testCase.file}:${finding.testCase.line}\` ${id ? `**${id}** ` : ''}${finding.testCase.title}${tag}`);
      }
      lines.push('');
    }
  }

  if (result.degraded) {
    lines.push('> ⚠️ Run-wide environment degradation detected: most failures are network/infrastructure errors, so ambiguous timeouts were downgraded from "product defect" to "environment". Re-run on a healthy runner before filing any bug.');
    lines.push('');
  }

  const recovered = result.findings.filter((f) => f.recovered);
  if (recovered.length > 0) {
    lines.push('## Hidden by retries');
    lines.push('');
    lines.push(`${recovered.length} test(s) failed first and passed on retry. The suite is green, but these are the ones that erode trust:`);
    lines.push('');
    for (const finding of recovered) {
      lines.push(`- **${testId(finding.testCase.title) ?? finding.testCase.title}** — ${finding.rule.label} (${KIND_LABEL[finding.rule.kind]})`);
    }
    lines.push('');
  }

  lines.push('## Coverage by area');
  lines.push('');
  lines.push('| Area | Passed | Failed | Flaky |');
  lines.push('|---|---|---|---|');
  for (const [name, bucket] of [...result.areas].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`| ${name} | ${bucket.passed}/${bucket.total} | ${bucket.failed} | ${bucket.flaky} |`);
  }
  lines.push('');

  lines.push('## Slowest tests');
  lines.push('');
  for (const testCase of result.slowest) {
    lines.push(`- ${(duration(testCase) / 1000).toFixed(1)}s — ${testCase.title}`);
  }
  lines.push('');
  lines.push('<sub>Generated by `npm run review` from the Playwright JSON report.</sub>');

  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/review-report.mjs [--input <results.json>] [--out <review.md>] [--json <review.json>] [--fail-on product|any|none] [--quiet]');
    return 0;
  }

  let report;
  try {
    report = JSON.parse(readFileSync(args.input, 'utf8'));
  } catch (error) {
    console.error(`Could not read the Playwright JSON report at "${args.input}".`);
    console.error('Run `npm test` first — the json reporter writes it automatically.');
    console.error(String(error.message ?? error));
    return 2;
  }

  const result = review(report);
  const markdown = toMarkdown(result);

  const write = (file, contents) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
  };

  if (args.out) write(args.out, `${markdown}\n`);
  if (args.json) {
    write(args.json, `${JSON.stringify({
      stats: result.stats,
      verdict: result.verdict,
      degraded: result.degraded,
      findings: result.findings.map((f) => ({
        test: f.testCase.title,
        id: testId(f.testCase.title),
        file: f.testCase.file,
        line: f.testCase.line,
        project: f.testCase.project,
        recovered: f.recovered,
        kind: f.rule.kind,
        rule: f.rule.id,
        label: f.rule.label,
        action: f.rule.action,
        message: f.message,
      })),
    }, null, 2)}\n`);
  }
  if (args.quiet) {
    const { stats, verdict } = result;
    console.log(`${VERDICT_BADGE[verdict.level].replace(/\*\*/g, '')} — ${verdict.headline}`);
    console.log(`${stats.passed + stats.flaky}/${stats.total} passing · ${stats.failed} failed · ${stats.flaky} flaky`);
  } else {
    console.log(markdown);
  }

  if (args.failOn === 'none') return 0;
  if (args.failOn === 'any') return result.findings.some((f) => !f.recovered) ? 1 : 0;
  return result.verdict.level === 'block' ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}

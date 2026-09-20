import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classify, review, toMarkdown } from './review-report.mjs';

/** Minimal Playwright JSON-reporter shape: one suite, one spec per test. */
function report(tests) {
  return {
    stats: {
      startTime: '2026-01-01T00:00:00.000Z',
      duration: 1000,
      expected: tests.filter((t) => t.status === 'expected').length,
      unexpected: tests.filter((t) => t.status === 'unexpected').length,
      flaky: tests.filter((t) => t.status === 'flaky').length,
      skipped: 0,
    },
    suites: [
      {
        title: 'suite',
        file: 'shop/cart.spec.ts',
        specs: tests.map((t, index) => ({
          title: t.title,
          file: t.file ?? 'shop/cart.spec.ts',
          line: index + 1,
          tests: [
            {
              projectName: 'e2e',
              status: t.status,
              expectedStatus: t.expectedStatus ?? 'passed',
              results: t.attempts,
            },
          ],
        })),
        suites: [],
      },
    ],
  };
}

const pass = { status: 'passed', duration: 10, retry: 0 };
const fail = (message, retry = 0) => ({ status: 'failed', duration: 10, retry, error: { message } });

test('assertion failures are classified as product defects and block the run', () => {
  const result = review(report([
    {
      title: 'TC-C01: add item to cart increments badge',
      status: 'unexpected',
      attempts: [
        fail('Error: expect(received).toBe(expected)\n\nExpected: "1"\nReceived: "0"'),
        fail('Error: expect(received).toBe(expected)\n\nExpected: "1"\nReceived: "0"', 1),
      ],
    },
  ]));

  assert.equal(result.verdict.level, 'block');
  assert.equal(result.findings[0].rule.kind, 'product');
  assert.match(toMarkdown(result), /BLOCK/);
});

test('network errors are classified as environment, never as a product defect', () => {
  const result = review(report([
    {
      title: 'TC-C03: item appears in cart page',
      status: 'unexpected',
      attempts: [fail('Error: page.goto: net::ERR_TOO_MANY_RETRIES at https://www.saucedemo.com/cart.html')],
    },
    {
      title: 'TC-C04: remove item from cart',
      status: 'unexpected',
      attempts: [fail('Error: page.goto: net::ERR_CONNECTION_RESET at https://www.saucedemo.com/')],
    },
  ]));

  assert.equal(result.verdict.level, 'infra');
  assert.ok(result.findings.every((f) => f.rule.kind === 'environment'));
});

test('ambiguous timeouts are downgraded when the whole run is network-degraded', () => {
  const result = review(report([
    { title: 'TC-A', status: 'unexpected', attempts: [fail('Error: page.goto: net::ERR_TOO_MANY_RETRIES at https://x/')] },
    { title: 'TC-B', status: 'unexpected', attempts: [fail('Error: page.goto: net::ERR_TOO_MANY_RETRIES at https://x/')] },
    { title: 'TC-C', status: 'unexpected', attempts: [fail('Test timeout of 30000ms exceeded while running "beforeEach" hook.')] },
  ]));

  assert.equal(result.degraded, true);
  const timeout = result.findings.find((f) => f.testCase.title === 'TC-C');
  assert.equal(timeout.rule.kind, 'environment');
  assert.match(timeout.rule.action, /Downgraded automatically/);
});

test('a lone hook timeout on an otherwise healthy run still needs a human', () => {
  const result = review(report([
    { title: 'TC-A', status: 'expected', attempts: [pass] },
    { title: 'TC-B', status: 'expected', attempts: [pass] },
    { title: 'TC-C', status: 'unexpected', attempts: [fail('Test timeout of 30000ms exceeded while running "beforeEach" hook.')] },
  ]));

  assert.equal(result.degraded, false);
  assert.equal(result.verdict.level, 'review');
});

test('a passing test.fail() case is reported as a defect that got fixed upstream', () => {
  const result = review(report([
    {
      title: 'TC-B02: problem_user shows real product images',
      file: 'defects/bug-users.spec.ts',
      status: 'unexpected',
      expectedStatus: 'failed',
      attempts: [pass],
    },
  ]));

  assert.equal(result.findings[0].rule.id, 'defect-fixed');
  assert.equal(result.verdict.level, 'block');
  assert.match(toMarkdown(result), /drop the test\.fail\(\) annotation/);
});

test('flaky tests are judged by the failure the retry hid, not by the retry', () => {
  const result = review(report([
    {
      title: 'TC-K01: full checkout flow shows order confirmation',
      status: 'flaky',
      attempts: [fail('Error: expect(received).toHaveText(expected)'), { ...pass, retry: 1 }],
    },
  ]));

  assert.equal(result.findings[0].recovered, true);
  assert.equal(result.findings[0].rule.kind, 'product');
  // Recovered failures surface as a warning, they do not block the pipeline.
  assert.equal(result.verdict.level, 'flaky');
  assert.match(toMarkdown(result), /Hidden by retries/);
});

test('a clean run produces a pass verdict with nothing to triage', () => {
  const result = review(report([
    { title: 'TC-A', status: 'expected', attempts: [pass] },
    { title: 'TC-B', status: 'expected', attempts: [pass] },
  ]));

  assert.equal(result.verdict.level, 'pass');
  assert.equal(result.findings.length, 0);
});

test('classify falls back to unclassified for unknown errors', () => {
  assert.equal(classify('Error: something nobody has seen before').id, 'unclassified');
  assert.equal(classify('').id, 'unclassified');
});

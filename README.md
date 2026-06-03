# SauceDemo Playwright E2E

[![CI](https://github.com/nettokrt/playwright-saucedemo-e2e/actions/workflows/playwright.yml/badge.svg)](https://github.com/nettokrt/playwright-saucedemo-e2e/actions/workflows/playwright.yml)

End-to-end test suite for [SauceDemo](https://www.saucedemo.com) built with
[Playwright](https://playwright.dev) and TypeScript, using the Page Object Model.

## Related repositories

This repo is the runnable test suite in a three-part QA portfolio:

| Repo | What it is |
|------|------------|
| **[nettokrt/playwright-saucedemo-e2e](https://github.com/nettokrt/playwright-saucedemo-e2e)** | **(this repo)** The Playwright (TypeScript) E2E suite against SauceDemo — Page Object Model, custom fixtures (`loginAs` / `loginPage`), ESLint quality gate, and GitHub Actions CI. |
| **[nettokrt/personal-knowledge-playwright](https://github.com/nettokrt/personal-knowledge-playwright)** | The QA knowledge vault — an [Obsidian](https://obsidian.md) study vault with the notes, plans, and test-case specs behind this suite. The *why* and the connective tissue between the repos. |
| **[nettokrt/agents](https://github.com/nettokrt/agents)** | The QA Agent Pipeline — a 4-agent system (Anthropic SDK + server-side MCP) that refines a user story, models scenarios, generates self-healing Playwright specs, and triages CI failures into Jira. |

## Stack

- Playwright Test (`@playwright/test`)
- TypeScript
- Page Object Model (`pages/`)
- Custom test fixtures (`fixtures/`) — a typed `loginAs(userKey)` / `loginPage` layer
- API testing via the `request` fixture (separate `api` project — see below)
- ESLint (`typescript-eslint` + `eslint-plugin-playwright`)
- GitHub Actions CI

## Structure

```
pages/                      Page objects (BasePage, LoginPage, ProductPage, CartPage, CheckoutPage)
fixtures/
  users.ts                  USERS catalog + shared PASSWORD, typed UserKey
  test.ts                   Extended test: loginPage (navigated) + loginAs(userKey) fixtures
tests/
  auth/login.spec.ts        Login flows (valid, locked-out, bad credentials, validation)
  search/search.spec.ts     Inventory sorting & listing
  search/filter.spec.ts     Full sorted name/price response verification
  shop/cart.spec.ts         Add / remove / view cart
  shop/checkout.spec.ts     Full checkout flow + required-field validation
  defects/bug-users.spec.ts Known SauceDemo defects, documented via test.fail()
  api/booking.spec.ts       API CRUD against restful-booker (request fixture)
playwright.config.ts        Projects: e2e (saucedemo) + api (restful-booker)
eslint.config.mjs           Flat ESLint config
.github/workflows/          CI pipeline (lint + tests)
```

Specs import `test`/`expect` from `fixtures/test` and authenticate through the
`loginAs(userKey)` fixture, so credentials live in exactly one place
(`fixtures/users.ts`).

## Coverage

| Area     | Tests       | What's verified |
|----------|-------------|-----------------|
| Login    | TC-L01–L05  | Standard login, locked-out user, wrong password, empty username/password |
| Sort     | TC-S01–S05  | Default A→Z, Z→A, price low→high, price high→low, product count |
| Filter   | TC-F01–F05  | Full sorted name/price response, item count stable across re-sorts |
| Cart     | TC-C01–C04  | Add item, add multiple, item shown in cart, remove item |
| Checkout | TC-K01–K04  | Full purchase flow, first/last name & postal code validation |
| Defects  | TC-B01–B08  | Known broken seed users (see [Defect Documentation](#defect-documentation-bug-users)) |
| API      | TC-A01–A09  | restful-booker CRUD: ping, auth, create/read/update/delete, negative auth (see [API Testing](#api-testing)) |

## Running

```bash
npm install
npx playwright install   # download browsers
npm test                 # headed locally; headless in CI (CI env var)
npm run test:ui          # interactive UI mode
npm run report           # open last HTML report
npm run lint             # eslint

npx playwright test --project=e2e   # just the SauceDemo UI suite
npx playwright test --project=api   # just the restful-booker API suite
```

The suite runs **headed locally** for debugging and **headless in CI**
(`headless: !!process.env.CI`).

## Defect Documentation (bug-users)

SauceDemo ships several accounts seeded with intentional, well-known defects.
`tests/defects/bug-users.spec.ts` asserts the **correct** expected behavior for each
and annotates it with [`test.fail()`](https://playwright.dev/docs/api/class-test#test-fail),
so Playwright reports them as **expected failures** — the suite stays green. If Sauce ever
fixes a defect, that test "unexpectedly passes" and turns the suite red, which is the signal
to remove the annotation. `locked_out_user` (TC-B01) is intended behavior, so it's a normal
passing test.

| Test    | User                     | Documented defect |
|---------|--------------------------|-------------------|
| TC-B01  | `locked_out_user`        | Login is blocked (intended — normal passing test) |
| TC-B02  | `problem_user`           | Every product image is the `sl-404` placeholder |
| TC-B03  | `problem_user`           | Sort dropdown does not reorder the inventory |
| TC-B04  | `problem_user`           | Remove button never decrements the cart |
| TC-B05  | `error_user`             | Checkout **Finish** is a no-op; order never completes |
| TC-B06  | `visual_user`            | First product image is the `sl-404` placeholder |
| TC-B07  | `visual_user`            | Prices are randomized per page load, never matching the catalog |
| TC-B08  | `performance_glitch_user`| Inventory load is artificially delayed (~5s vs <100ms) |

Behavior was first observed by driving the live site, then encoded as assertions.

## API Testing

SauceDemo is a client-side-only app with **no backend API**, so API coverage is demonstrated
against [restful-booker](https://restful-booker.herokuapp.com) — a public practice API with
token auth and full CRUD. It runs as a separate Playwright **`api` project** (its own
`baseURL`, no browser) using the built-in `request` fixture, so it stays isolated from the
UI suite:

```bash
npx playwright test --project=api
```

`tests/api/booking.spec.ts` covers a health check, auth token retrieval, a serial
create → read → list → update → patch → delete lifecycle, and a negative-auth case (403).

> restful-booker runs on Heroku's free tier — cold starts can be slow (the `api` project uses
> a 60s timeout) and it's an external dependency in CI, where `retries: 1` absorbs transient blips.

## CI

Every push and pull request runs ESLint and the full suite on `ubuntu-latest` via
[`.github/workflows/playwright.yml`](.github/workflows/playwright.yml) and
uploads the HTML report as an artifact.

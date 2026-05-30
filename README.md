# SauceDemo Playwright E2E

End-to-end test suite for [SauceDemo](https://www.saucedemo.com) built with
[Playwright](https://playwright.dev) and TypeScript, using the Page Object Model.

## Stack

- Playwright Test (`@playwright/test`)
- TypeScript
- Page Object Model (`pages/`)
- GitHub Actions CI

## Structure

```
pages/                 Page objects (BasePage, LoginPage, ProductPage, CartPage)
tests/
  auth/login.spec.ts   Login flows (valid, locked-out, bad credentials, validation)
  search/search.spec.ts Inventory sorting & listing
  shop/cart.spec.ts    Add / remove / view cart
playwright.config.ts   Runs against https://www.saucedemo.com
.github/workflows/     CI pipeline
```

## Coverage

| Area  | Tests | What's verified |
|-------|-------|-----------------|
| Login | TC-L01–L05 | Standard login, locked-out user, wrong password, empty username/password |
| Sort  | TC-S01–S05 | Default A→Z, Z→A, price low→high, price high→low, product count |
| Cart  | TC-C01–C04 | Add item, add multiple, item shown in cart, remove item |

## Running

```bash
npm install
npx playwright install   # download browsers
npm test                 # headed locally; headless in CI (CI env var)
npm run test:ui          # interactive UI mode
npm run report           # open last HTML report
```

The suite runs **headed locally** for debugging and **headless in CI**
(`headless: !!process.env.CI`).

## CI

Every push and pull request runs the full suite on `ubuntu-latest` via
[`.github/workflows/playwright.yml`](.github/workflows/playwright.yml) and
uploads the HTML report as an artifact.

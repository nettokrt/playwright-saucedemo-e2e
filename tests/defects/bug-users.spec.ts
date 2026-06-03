import { test, expect } from '../../fixtures/test';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CheckoutPage } from '../../pages/CheckoutPage';

// SauceDemo seeds several accounts with intentional, well-known defects. Each
// scenario below asserts the CORRECT behavior and is marked test.fail(), so it
// is reported as an *expected* failure. Behavior was observed live via the
// Playwright runner (see commit notes). If Sauce ever fixes one of these, the
// test will "unexpectedly pass" and turn the suite red — that's the signal to
// drop the annotation. locked_out_user is intended behavior, so it's a normal
// passing test.

const CATALOG_PRICES = [29.99, 9.99, 15.99, 49.99, 7.99, 15.99];
const SORT_ZA_FIRST = 'Test.allTheThings() T-Shirt (Red)';

test.describe('Known bug users', () => {
  test('TC-B01: locked_out_user is denied access', async ({ loginAs, loginPage, page }) => {
    await loginAs('lockedOut');
    await expect(loginPage.errorMessage).toContainText('locked out');
    await expect(page).not.toHaveURL(/inventory/);
  });

  test('TC-B02: problem_user shows real product images', async ({ loginAs, page }) => {
    test.fail(); // BUG: every product image is replaced by the sl-404 placeholder.
    await loginAs('problem');
    const productPage = new ProductPage(page);
    const srcs = await productPage.getItemImageSrcs();
    expect(srcs.some((src) => src.includes('sl-404'))).toBe(false);
  });

  test('TC-B03: problem_user sort reorders products', async ({ loginAs, page }) => {
    test.fail(); // BUG: selecting a sort option does not reorder the inventory.
    await loginAs('problem');
    const productPage = new ProductPage(page);
    await productPage.sortBy('za');
    expect((await productPage.getItemNames())[0]).toBe(SORT_ZA_FIRST);
  });

  test('TC-B04: problem_user can remove an item from the cart', async ({ loginAs, page }) => {
    test.fail(); // BUG: the Remove button never decrements the cart.
    await loginAs('problem');
    const productPage = new ProductPage(page);
    await productPage.addToCart('Sauce Labs Backpack');
    await expect(productPage.cartBadge).toHaveText('1');
    await productPage.removeFromCart('Sauce Labs Backpack');
    await expect(productPage.cartBadge).toHaveCount(0);
  });

  test('TC-B05: error_user can complete checkout', async ({ loginAs, page }) => {
    test.fail(); // BUG: Finish on checkout step two is a no-op; order never completes.
    await loginAs('error');
    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);

    await productPage.addToCart('Sauce Labs Backpack');
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    await checkoutPage.fillInformation('John', 'Doe', '12345');
    await checkoutPage.continue();
    await expect(page).toHaveURL(/checkout-step-two/);

    await checkoutPage.finish();
    await expect(page).toHaveURL(/checkout-complete/, { timeout: 5000 });
  });

  test('TC-B06: visual_user backpack image renders correctly', async ({ loginAs, page }) => {
    test.fail(); // BUG: the first product image is the sl-404 placeholder.
    await loginAs('visual');
    const productPage = new ProductPage(page);
    const srcs = await productPage.getItemImageSrcs();
    expect(srcs[0]).not.toContain('sl-404');
  });

  test('TC-B07: visual_user shows the catalog prices', async ({ loginAs, page }) => {
    // CATALOG_PRICES is the standard_user reference set. visual_user renders
    // randomized prices that change on every page load and never match the
    // catalog, so this exact-match assertion fails by design on every run.
    test.fail();
    await loginAs('visual');
    const productPage = new ProductPage(page);
    expect(await productPage.getItemPrices()).toEqual(CATALOG_PRICES);
  });

  test('TC-B08: performance_glitch_user loads inventory promptly', async ({ loginAs, page }) => {
    // The 2000ms threshold sits well above a normal login (~100ms), so it is not
    // network-flaky for healthy users. performance_glitch_user reliably injects a
    // ~5s delay, making this expected-failure deterministic rather than timing-dependent.
    test.fail();
    const start = Date.now();
    await loginAs('performanceGlitch');
    await expect(page).toHaveURL(/inventory/, { timeout: 15000 });
    const elapsed = Date.now() - start;
    expect(elapsed, `inventory took ${elapsed}ms`).toBeLessThan(2000);
  });
});

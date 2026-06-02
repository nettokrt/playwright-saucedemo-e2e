import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CheckoutPage } from '../../pages/CheckoutPage';

test.describe('Checkout', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);

    await loginPage.goto();
    await loginPage.loginAsStandardUser();
    await expect(page).toHaveURL(/inventory/);

    await productPage.addToCart('Sauce Labs Backpack');
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    await expect(page).toHaveURL(/checkout-step-one/);
  });

  test('TC-K01: full checkout flow shows order confirmation', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.fillInformation('John', 'Doe', '12345');
    await checkoutPage.continue();
    await expect(page).toHaveURL(/checkout-step-two/);
    await expect(checkoutPage.totalLabel).toHaveText('Total: $32.39');

    await checkoutPage.finish();
    await expect(page).toHaveURL(/checkout-complete/);
    await expect(checkoutPage.completeHeader).toHaveText('Thank you for your order!');
  });

  test('TC-K02: checkout requires first name', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.fillInformation('', 'Doe', '12345');
    await checkoutPage.continue();
    await expect(checkoutPage.errorMessage).toContainText('First Name is required');
  });

  test('TC-K03: checkout requires last name', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.fillInformation('John', '', '12345');
    await checkoutPage.continue();
    await expect(checkoutPage.errorMessage).toContainText('Last Name is required');
  });

  test('TC-K04: checkout requires postal code', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.fillInformation('John', 'Doe', '');
    await checkoutPage.continue();
    await expect(checkoutPage.errorMessage).toContainText('Postal Code is required');
  });
});

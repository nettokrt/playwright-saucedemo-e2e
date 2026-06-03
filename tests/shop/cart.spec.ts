import { test, expect } from '../../fixtures/test';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';

test.describe('Cart', () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs('standard');
    await expect(page).toHaveURL(/inventory/);
  });

  test('TC-C01: add item to cart increments badge', async ({ page }) => {
    const productPage = new ProductPage(page);
    await productPage.addToCart('Sauce Labs Backpack');
    await expect(productPage.cartBadge).toHaveText('1');
  });

  test('TC-C02: add multiple items updates badge count', async ({ page }) => {
    const productPage = new ProductPage(page);
    await productPage.addToCart('Sauce Labs Backpack');
    await productPage.addToCart('Sauce Labs Bike Light');
    await expect(productPage.cartBadge).toHaveText('2');
  });

  test('TC-C03: item appears in cart page', async ({ page }) => {
    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);
    await productPage.addToCart('Sauce Labs Backpack');
    await cartPage.goto();
    await expect(page.locator('.cart_item')).toContainText('Sauce Labs Backpack');
  });

  test('TC-C04: remove item from cart', async ({ page }) => {
    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);
    await productPage.addToCart('Sauce Labs Backpack');
    await cartPage.goto();
    await cartPage.removeItem('Sauce Labs Backpack');
    await expect(page.locator('.cart_item')).toHaveCount(0);
  });
});

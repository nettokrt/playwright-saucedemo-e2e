import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { ProductPage } from '../../pages/ProductPage';

test.describe('Inventory Sort', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsStandardUser();
  });

  test('TC-S01: default sort is A to Z', async ({ page }) => {
    const firstItem = page.locator('.inventory_item_name').first();
    await expect(firstItem).toHaveText('Sauce Labs Backpack');
  });

  test('TC-S02: sort by name Z to A', async ({ page }) => {
    const productPage = new ProductPage(page);
    await productPage.sortBy('za');
    const firstItem = page.locator('.inventory_item_name').first();
    await expect(firstItem).toHaveText('Test.allTheThings() T-Shirt (Red)');
  });

  test('TC-S03: sort by price low to high', async ({ page }) => {
    const productPage = new ProductPage(page);
    await productPage.sortBy('lohi');
    const firstPrice = page.locator('.inventory_item_price').first();
    await expect(firstPrice).toHaveText('$7.99');
  });

  test('TC-S04: sort by price high to low', async ({ page }) => {
    const productPage = new ProductPage(page);
    await productPage.sortBy('hilo');
    const firstPrice = page.locator('.inventory_item_price').first();
    await expect(firstPrice).toHaveText('$49.99');
  });

  test('TC-S05: all 6 products are shown on inventory page', async ({ page }) => {
    await expect(page.locator('.inventory_item')).toHaveCount(6);
  });
});

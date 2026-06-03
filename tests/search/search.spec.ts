import { test, expect } from '../../fixtures/test';
import { ProductPage } from '../../pages/ProductPage';

test.describe('Inventory Sort', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('standard');
  });

  test('TC-S01: default sort is A to Z', async ({ page }) => {
    const productPage = new ProductPage(page);
    expect((await productPage.getItemNames())[0]).toBe('Sauce Labs Backpack');
  });

  test('TC-S02: sort by name Z to A', async ({ page }) => {
    const productPage = new ProductPage(page);
    await productPage.sortBy('za');
    expect((await productPage.getItemNames())[0]).toBe('Test.allTheThings() T-Shirt (Red)');
  });

  test('TC-S03: sort by price low to high', async ({ page }) => {
    const productPage = new ProductPage(page);
    await productPage.sortBy('lohi');
    expect((await productPage.getItemPrices())[0]).toBe(7.99);
  });

  test('TC-S04: sort by price high to low', async ({ page }) => {
    const productPage = new ProductPage(page);
    await productPage.sortBy('hilo');
    expect((await productPage.getItemPrices())[0]).toBe(49.99);
  });

  test('TC-S05: all 6 products are shown on inventory page', async ({ page }) => {
    const productPage = new ProductPage(page);
    await expect(productPage.getItems()).toHaveCount(6);
  });
});

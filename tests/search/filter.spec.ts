import { test, expect } from '../../fixtures/test';
import { ProductPage } from '../../pages/ProductPage';

// These scenarios verify the *full response* of the sort filter — the complete
// ordered list it returns — not just the first item. Selectors and the exact
// expected orderings were harvested from the live SauceDemo DOM.

const NAMES_AZ = [
  'Sauce Labs Backpack',
  'Sauce Labs Bike Light',
  'Sauce Labs Bolt T-Shirt',
  'Sauce Labs Fleece Jacket',
  'Sauce Labs Onesie',
  'Test.allTheThings() T-Shirt (Red)',
];

test.describe('Inventory Filter Response', () => {
  let productPage: ProductPage;

  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs('standard');
    productPage = new ProductPage(page);
  });

  test('TC-F01: Name (A to Z) returns all 6 products in alphabetical order', async () => {
    await productPage.sortBy('az');
    expect(await productPage.getItemNames()).toEqual(NAMES_AZ);
  });

  test('TC-F02: Name (Z to A) returns all 6 products in reverse-alphabetical order', async () => {
    await productPage.sortBy('za');
    expect(await productPage.getItemNames()).toEqual([...NAMES_AZ].reverse());
  });

  test('TC-F03: Price (low to high) returns prices in non-decreasing order', async () => {
    await productPage.sortBy('lohi');
    const prices = await productPage.getItemPrices();
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test('TC-F04: Price (high to low) returns prices in non-increasing order', async () => {
    await productPage.sortBy('hilo');
    const prices = await productPage.getItemPrices();
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  test('TC-F05: changing the filter never drops or adds items (always 6)', async ({ page }) => {
    for (const option of ['za', 'lohi', 'hilo', 'az'] as const) {
      await productPage.sortBy(option);
      await expect(page.locator('.inventory_item')).toHaveCount(6);
    }
  });
});

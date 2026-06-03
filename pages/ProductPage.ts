import { BasePage } from './BasePage';

export class ProductPage extends BasePage {
  private sortDropdown = this.page.locator('[data-test="product-sort-container"]');

  async goto() {
    await this.page.goto('/inventory.html');
  }

  cartBadge = this.page.locator('.shopping_cart_badge');

  async addToCart(productName: string) {
    const item = this.page.locator('.inventory_item').filter({ hasText: productName });
    await item.getByRole('button', { name: 'Add to cart' }).click();
  }

  async removeFromCart(productName: string) {
    const item = this.page.locator('.inventory_item').filter({ hasText: productName });
    await item.getByRole('button', { name: 'Remove' }).click();
  }

  async getItemImageSrcs() {
    return this.page
      .locator('.inventory_item img')
      .evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).getAttribute('src') ?? ''));
  }

  async sortBy(option: 'az' | 'za' | 'lohi' | 'hilo') {
    await this.sortDropdown.selectOption(option);
  }

  getItems() {
    return this.page.locator('.inventory_item');
  }

  async getItemNames() {
    return this.page.locator('.inventory_item_name').allTextContents();
  }

  async getItemPrices() {
    const raw = await this.page.locator('.inventory_item_price').allTextContents();
    return raw.map((p) => parseFloat(p.replace('$', '')));
  }
}

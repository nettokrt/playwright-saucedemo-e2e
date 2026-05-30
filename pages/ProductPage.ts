import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProductPage extends BasePage {
  private sortDropdown = this.page.locator('[data-test="product-sort-container"]');

  async goto() {
    await this.page.goto('/inventory.html');
  }

  async addToCart(productName: string) {
    const item = this.page.locator('.inventory_item').filter({ hasText: productName });
    await item.getByRole('button', { name: 'Add to cart' }).click();
  }

  async sortBy(option: 'az' | 'za' | 'lohi' | 'hilo') {
    await this.sortDropdown.selectOption(option);
  }

  getItems() {
    return this.page.locator('.inventory_item');
  }
}

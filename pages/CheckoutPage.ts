import { BasePage } from './BasePage';

export class CheckoutPage extends BasePage {
  private firstNameInput = this.page.locator('[data-test="firstName"]');
  private lastNameInput = this.page.locator('[data-test="lastName"]');
  private postalCodeInput = this.page.locator('[data-test="postalCode"]');
  private continueButton = this.page.locator('[data-test="continue"]');
  private finishButton = this.page.locator('[data-test="finish"]');

  errorMessage = this.page.locator('[data-test="error"]');
  completeHeader = this.page.locator('[data-test="complete-header"]');
  subtotalLabel = this.page.locator('[data-test="subtotal-label"]');
  taxLabel = this.page.locator('[data-test="tax-label"]');
  totalLabel = this.page.locator('[data-test="total-label"]');

  async fillInformation(firstName: string, lastName: string, postalCode: string) {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.postalCodeInput.fill(postalCode);
  }

  async continue() {
    await this.continueButton.click();
  }

  async finish() {
    await this.finishButton.click();
  }
}

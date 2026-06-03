import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  private usernameInput = this.page.locator('#user-name');
  private passwordInput = this.page.locator('#password');
  private loginButton = this.page.locator('#login-button');
  errorMessage = this.page.locator('[data-test="error"]');

  async goto() {
    await this.page.goto('/');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}

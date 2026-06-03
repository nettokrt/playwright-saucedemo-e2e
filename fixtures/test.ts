import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { PASSWORD, USERS, UserKey } from './users';

type Fixtures = {
  /** LoginPage already navigated to the login screen, ready to act on. */
  loginPage: LoginPage;
  /** Log in as one of the known SauceDemo users by role key. */
  loginAs: (user: UserKey) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await use(loginPage);
  },

  loginAs: async ({ loginPage }, use) => {
    await use((user: UserKey) => loginPage.login(USERS[user], PASSWORD));
  },
});

export { expect } from '@playwright/test';

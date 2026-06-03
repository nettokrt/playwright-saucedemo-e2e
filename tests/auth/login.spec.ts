import { test, expect } from '../../fixtures/test';
import { USERS, PASSWORD } from '../../fixtures/users';

test.describe('Login', () => {
  test('TC-L01: standard user can log in', async ({ loginAs, page }) => {
    await loginAs('standard');
    await expect(page).toHaveURL(/inventory/);
  });

  test('TC-L02: locked out user sees error', async ({ loginAs, loginPage }) => {
    await loginAs('lockedOut');
    await expect(loginPage.errorMessage).toContainText('locked out');
  });

  test('TC-L03: wrong password shows error', async ({ loginPage }) => {
    await loginPage.login(USERS.standard, 'wrongpassword');
    await expect(loginPage.errorMessage).toBeVisible();
  });

  test('TC-L04: empty username shows validation error', async ({ loginPage }) => {
    await loginPage.login('', PASSWORD);
    await expect(loginPage.errorMessage).toContainText('Username is required');
  });

  test('TC-L05: empty password shows validation error', async ({ loginPage }) => {
    await loginPage.login(USERS.standard, '');
    await expect(loginPage.errorMessage).toContainText('Password is required');
  });
});

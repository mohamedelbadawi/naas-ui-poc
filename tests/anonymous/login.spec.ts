import { getTestUser } from '../../src/config/env.js';
import { expect, test } from '../../src/fixtures/app-fixtures.js';

test.describe('Login', () => {
  test('signs in a valid user', async ({ page, loginPage }) => {
    await loginPage.login(getTestUser());

    await expect(page).toHaveURL(/orders/);
  });

  test('keeps a user with a wrong password on the login screen', async ({ loginPage }) => {
    await loginPage.login({ email: getTestUser().email, password: 'wrong-password' });

    await expect(loginPage.invalidCredentialsError).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });
});

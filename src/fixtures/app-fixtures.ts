import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { OrdersPage } from '../pages/orders.page.js';

/**
 * Fixtures hand each test a screen that is already open and past Flutter's startup
 * reloads, so no test has to know about splash screens or semantics.
 *
 * Only the fixtures a test names in its arguments are built, so asking for `ordersPage`
 * costs one app open, not two.
 */
interface AppFixtures {
  /** Login screen, open and settled. */
  loginPage: LoginPage;
  /** Orders list, open and settled. This is the app's landing screen once signed in. */
  ordersPage: OrdersPage;
}

export const test = base.extend<AppFixtures>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();
    await use(loginPage);
  },

  ordersPage: async ({ page }, use) => {
    const ordersPage = new OrdersPage(page);
    await ordersPage.open();
    await use(ordersPage);
  },
});

export { expect } from '@playwright/test';

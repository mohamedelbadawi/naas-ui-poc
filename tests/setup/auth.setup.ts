import { getTestUser } from '../../src/config/env.js';
import { AUTH_STORAGE_STATE } from '../../src/config/paths.js';
import { expect, test as setup } from '../../src/fixtures/app-fixtures.js';
import { OrdersPage } from '../../src/pages/orders.page.js';

/** Signs in once per run so the rest of the suite never pays for the splash screens. */
setup('save a signed-in session', async ({ page, loginPage }) => {
  await loginPage.login(getTestUser());

  // Signing in lands on the orders list, not a dashboard.
  await new OrdersPage(page).expectLoaded({ timeout: 30_000 });

  // The app is on Firebase and stores its session outside cookies, so the snapshot has to
  // reach into IndexedDB as well -- the default capture would come back signed out.
  const savedState = await page.context().storageState({ path: AUTH_STORAGE_STATE, indexedDB: true });

  // Without this, a token kept only in memory would produce an empty state file and every
  // authenticated test would fail later, on the orders list, with a misleading timeout.
  expect(savedState.origins, 'Signed in, but no session was persisted to browser storage').not.toHaveLength(0);
});

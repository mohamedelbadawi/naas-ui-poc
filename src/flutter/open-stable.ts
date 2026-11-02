import { expect, type Locator, type Page } from '@playwright/test';
import { getStabilityWindowMs } from '../config/env.js';
import { enableSemantics } from './semantics.js';

/**
 * The app reloads itself an unpredictable number of times during startup: splash ->
 * login screen -> reload -> splash -> login screen. Fixed sleeps cannot cover that,
 * so instead we retry until a screen proves it is the final one by staying put.
 */

/** Short enough that a reload fails the attempt fast instead of stalling the retry loop. */
const READY_TIMEOUT_MS = 3_000;
const RETRY_INTERVAL_MS = 1_000;
/** Budget for the whole retry loop, covering every startup reload. */
const OPEN_TIMEOUT_MS = 120_000;

/**
 * Navigates to `url` and resolves once `readyLocator` is visible on a screen that
 * survives a full stability window without the page reloading underneath it.
 *
 * Anything done before the final reload is lost, so no test may touch the UI until
 * this resolves.
 */
export async function openStable(page: Page, url: string, readyLocator: Locator): Promise<void> {
  const stabilityWindowMs = getStabilityWindowMs();

  let loadCount = 0;
  const countLoad = (): void => {
    loadCount += 1;
  };
  page.on('load', countLoad);

  try {
    await page.goto(url);

    await expect(async () => {
      await enableSemantics(page);
      await expect(readyLocator).toBeVisible({ timeout: READY_TIMEOUT_MS });

      const loadsBeforeWindow = loadCount;
      await page.waitForTimeout(stabilityWindowMs);
      expect(loadCount, 'App reloaded while settling').toBe(loadsBeforeWindow);

      await expect(readyLocator).toBeVisible({ timeout: READY_TIMEOUT_MS });
    }).toPass({ timeout: OPEN_TIMEOUT_MS, intervals: [RETRY_INTERVAL_MS] });
  } finally {
    page.off('load', countLoad);
  }
}

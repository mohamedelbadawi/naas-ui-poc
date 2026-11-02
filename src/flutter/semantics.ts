import type { Page } from '@playwright/test';

/**
 * Flutter web paints to a canvas. The only DOM Playwright can locate is the semantics
 * tree, and Flutter builds it lazily -- this module turns it on and reads from it.
 */

const SEMANTICS_TIMEOUT_MS = 5_000;

const FLUTTER_ROOT = 'flutter-view, flt-glass-pane';
const SEMANTICS_PLACEHOLDER = 'flt-semantics-placeholder';
const SEMANTICS_NODE = 'flt-semantics';

/**
 * Clicks the hidden "Enable accessibility" button that ships in every Flutter web build,
 * making Flutter mirror its widgets into locatable DOM nodes.
 *
 * Every reload wipes the semantics tree, so this has to run again after each one.
 */
export async function enableSemantics(page: Page): Promise<void> {
  await page.locator(FLUTTER_ROOT).first().waitFor({ state: 'attached', timeout: SEMANTICS_TIMEOUT_MS });

  const placeholder = page.locator(SEMANTICS_PLACEHOLDER);
  if ((await placeholder.count()) > 0) {
    // A real click misses: the placeholder is off-screen and zero-sized by design.
    await placeholder.first().dispatchEvent('click');
  }

  await page.locator(SEMANTICS_NODE).first().waitFor({ state: 'attached', timeout: SEMANTICS_TIMEOUT_MS });
}

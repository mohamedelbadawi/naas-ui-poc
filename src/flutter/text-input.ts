import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Typing into a Flutter text field.
 *
 * Flutter does not own the field's DOM until the field takes focus: only then does it
 * mount the real hidden `<input>` that keystrokes land in. Anything typed before that
 * input exists goes nowhere, and typing at full speed can outrun Flutter's own handling
 * mid-word -- which is why a 6-character password arrives as 4, or 5, a different count
 * each run.
 *
 * So the helper clicks, waits for a focused input to actually exist, types at a human
 * pace, then reads the value back and starts over if characters still went missing.
 */

const FOCUS_TIMEOUT_MS = 5_000;
const KEYSTROKE_DELAY_MS = 50;
const TYPING_TIMEOUT_MS = 20_000;
const RETRY_INTERVAL_MS = 500;

export async function typeInto(field: Locator, text: string): Promise<void> {
  const page = field.page();

  await expect(async () => {
    await field.click();
    await waitForFocusedInput(page);
    await clearFocusedInput(page);

    await page.keyboard.type(text, { delay: KEYSTROKE_DELAY_MS });

    expect(await readFocusedInput(page), 'Flutter dropped keystrokes').toBe(text);
  }).toPass({ timeout: TYPING_TIMEOUT_MS, intervals: [RETRY_INTERVAL_MS] });
}

/** Flutter mounts its `<input>` only once the widget has focus, so the click has to land first. */
async function waitForFocusedInput(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const focused = document.activeElement;
      return focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement;
    },
    undefined,
    { timeout: FOCUS_TIMEOUT_MS },
  );
}

/**
 * Backspaces over the current contents. A retry starts from a half-filled field, and
 * select-all would route through Flutter's own key handling -- the thing being worked
 * around here -- so this counts characters instead.
 */
async function clearFocusedInput(page: Page): Promise<void> {
  const existing = await readFocusedInput(page);
  if (existing.length === 0) {
    return;
  }

  await page.keyboard.press('End');
  for (let remaining = existing.length; remaining > 0; remaining -= 1) {
    await page.keyboard.press('Backspace');
  }
}

/** Reads the value Flutter currently holds. Throws if focus has moved off the field. */
function readFocusedInput(page: Page): Promise<string> {
  return page.evaluate(() => {
    const focused = document.activeElement;
    if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) {
      return focused.value;
    }
    throw new Error(`Expected a focused Flutter text input, found ${focused?.tagName ?? 'nothing'}`);
  });
}

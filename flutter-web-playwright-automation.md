# Flutter Web Automation with Playwright — Summary

## The Problem

- Flutter web renders the UI on a **canvas**, so normal DOM locators can't find elements.
- The app **reloads twice on open**: splash + progress bar → login screen appears → reload → splash again → login screen (final).
- Splash/reload timing is **unknown and variable**, so fixed sleeps are unreliable.

## Key Concepts

| Concept | Why it matters |
|---|---|
| **Semantics tree** | Flutter creates real DOM nodes (`flt-semantics`) with roles and labels that Playwright can locate. |
| **`flt-semantics-placeholder`** | Hidden "Enable accessibility" button in every Flutter web build. Clicking it turns semantics on **without dev changes**. |
| **Reloads wipe semantics** | Anything done before the final reload (including enabling semantics) is lost. |
| **Web-first assertions** | `expect(...).toBeVisible()` auto-waits; never use `waitForTimeout` to wait for elements. |

## Solution Overview

1. Block the service worker (may remove the reloads entirely).
2. Use one helper, `openStable`, that retries until the target screen is visible **and** no reload happens during a short stability window.
3. Wrap it in a **fixture** so every test starts on a stable, semantics-enabled screen.
4. Use **`storageState`** so most tests skip the login UI.

---

## 1. Config

```ts
// playwright.config.ts
use: {
  baseURL: 'https://your-app.com',
  serviceWorkers: 'block',   // may stop the extra reloads
  actionTimeout: 15_000,
  navigationTimeout: 60_000,
  trace: 'retain-on-failure',
},
expect: { timeout: 10_000 },
```

## 2. Helper: Open the App and Wait Until Stable

```ts
// helpers/flutter.ts
import { Page, Locator, expect } from '@playwright/test';

async function enableSemantics(page: Page) {
  await page.locator('flutter-view, flt-glass-pane').first()
    .waitFor({ state: 'attached', timeout: 5_000 });
  const placeholder = page.locator('flt-semantics-placeholder');
  if (await placeholder.count()) await placeholder.dispatchEvent('click');
  await page.locator('flt-semantics').first()
    .waitFor({ state: 'attached', timeout: 5_000 });
}

export async function openStable(
  page: Page,
  url: string,
  readyEl: (p: Page) => Locator,
  stableMs = 4_000,
) {
  let loads = 0;
  const onLoad = () => loads++;
  page.on('load', onLoad);

  await page.goto(url);

  await expect(async () => {
    await enableSemantics(page);
    await expect(readyEl(page)).toBeVisible({ timeout: 3_000 });

    const before = loads;
    await page.waitForTimeout(stableMs);          // stability window
    expect(loads, 'Page reloaded, retrying').toBe(before);

    await expect(readyEl(page)).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 120_000, intervals: [1_000] });

  page.off('load', onLoad);
}
```

### How it handles the double reload

| Phase | Result |
|---|---|
| First splash | Target not found → retry |
| First login screen | Reload happens during stability window → load count changes → retry |
| Second splash | Target not found → retry |
| Final login screen | Stays stable for `stableMs` → test continues |
| No reload (cached) | Passes on first login screen |

**Short inner timeouts (3–5s)** make each attempt fail fast so the loop recovers after a reload. The **120s outer timeout** covers slow loads.

### Choosing `stableMs`

Must be longer than the gap between the **first** login appearance and the reload. Measure it:

```ts
page.on('load', () => console.log('load', Date.now()));
page.on('framenavigated', () => console.log('nav', Date.now()));
```

Take the largest gap over several runs and add margin (e.g. 2s gap → `stableMs = 4_000`–`5_000`).

## 3. Fixture

```ts
// fixtures.ts
import { test as base, Page } from '@playwright/test';
import { openStable } from './helpers/flutter';

export const test = base.extend<{ loginPage: Page }>({
  loginPage: async ({ page }, use) => {
    await openStable(page, '/', p => p.getByRole('button', { name: 'Login' }));
    await use(page);
  },
});
export { expect } from '@playwright/test';
```

## 4. Example Test

```ts
import { test, expect } from '../fixtures';

test('login works', async ({ loginPage: page }) => {
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.keyboard.type('qa@test.com');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.keyboard.type('Pass@123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

> Flutter creates the real `<input>` on focus, so **click the field first, then type**. Use `fill()` only if it works reliably for that field.

## 5. Skip Login for Other Tests

- Log in once in a **setup project** and save `storageState`.
- Other tests reuse it and call `openStable` with a **home screen element** as `readyEl`.
- Cuts most splash/reload time from the suite.

---

## Locator Strategy (No Dev Changes)

| Locator | Use for |
|---|---|
| `getByRole('button', { name })` | Buttons with text or tooltip |
| `getByRole('textbox', { name })` | `TextField` with `labelText` / `hintText` |
| `getByText(...)` | Static text / screen checks |
| `.nth(i)` / `page.mouse.click(x, y)` | Last resort for icon-only buttons (fragile) |
| `toHaveScreenshot()` | Custom-painted widgets (charts) that expose nothing |

**Discover what's exposed:** run `npx playwright codegen <url>` or inspect `flt-semantics-host` in DevTools for `role` and `aria-label`.

## Optional: Stable IDs (With Dev Help)

```dart
Semantics(
  identifier: 'login_button',
  child: ElevatedButton(onPressed: login, child: Text('Login')),
)
// In main(), behind a --dart-define test flag:
SemanticsBinding.instance.ensureSemantics();
```

```ts
const byId = (page: Page, id: string) =>
  page.locator(`[flt-semantics-identifier="${id}"]`);
```

---

## Rules & Tips

- **Never use `waitForTimeout` to wait for elements.** The only exception is the stability window, which confirms nothing changes.
- **Don't type into the login form before `openStable` finishes**: a late reload wipes input.
- **Wait for an element on the new screen** after navigation or animations, not for the click.
- **Pin the app language** in tests (text locators break between Arabic and English), or keep a label map.
- **Recheck selectors after Flutter upgrades**, since semantics output can change.
- **Debug with traces**: inspect the `flt-semantics-host` DOM for what Flutter exposed.

## Limitations

- Icon-only buttons without tooltips have no accessible name.
- Text-based locators break when copy or language changes.
- The stability window adds a few seconds per app open.

## Priority Order

1. `serviceWorkers: 'block'`: free, may remove reloads.
2. `openStable` in a fixture: handles any number of reloads and unknown timing.
3. `storageState`: keeps slow startup out of most tests.
4. **Long term:** report the double reload as a bug and request `Semantics` identifiers for hard-to-locate widgets.

## Bug to Report

**Title:** Login screen appears, then the app reloads and shows the splash screen again before the final login screen.

**Impact:** Users see the login screen flash. Anyone who starts typing quickly loses their input.

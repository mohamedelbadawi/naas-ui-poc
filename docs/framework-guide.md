# NaaS UI — Playwright E2E

Page-Object test framework for the NaaS **Flutter web** app.

Flutter paints to a canvas, so ordinary DOM locators find nothing, and the app reloads
itself during startup. Two pieces deal with that; the rest is plain Playwright:

- [`src/flutter/semantics.ts`](../src/flutter/semantics.ts) turns on Flutter's semantics tree,
  which is the only locatable DOM the app produces.
- [`src/flutter/open-stable.ts`](../src/flutter/open-stable.ts) retries opening the app until
  the target screen survives a stability window without reloading.

## Setup

```bash
npm install
```

Then copy `.env.example` to `.env` and fill in `BASE_URL` and the test account.

## Running

```bash
npm test
```

Tests run **headed** — a real browser window opens, so you can watch the Flutter canvas
and its startup reloads. A headless CI runner would need xvfb, or `headless` flipped in
`playwright.config.ts`.

| Command | What it runs |
| --- | --- |
| `npm test` | Everything: sign-in setup, then both suites |
| `npm run test:anonymous` | Login screen tests only (no stored session) |
| `npm run test:authenticated` | Signed-in tests, reusing the saved session |
| `npm run test:ui` | Playwright UI mode |
| `npm run report` | Open the last HTML report |
| `npm run typecheck` | Type-check without running tests |

## Layout

```
src/
  config/     env vars and shared paths
  flutter/    semantics + startup-reload handling (the Flutter-specific part)
  pages/      page objects, one per screen
  fixtures/   test fixtures that hand tests an already-open screen
tests/
  setup/          signs in once, saves storageState
  anonymous/      tests that need the login screen
  authenticated/  tests that start signed in
```

## The saved login state

`tests/setup/auth.setup.ts` signs in once per run and writes the session to
`playwright/.auth/user.json`. The `authenticated` project declares `dependencies: ['setup']`
and loads that file as its `storageState`, so those tests open straight onto the orders list —
no login screen, and one trip through the startup reloads instead of one per test.

The snapshot is taken with `indexedDB: true`. This app runs on Firebase, which keeps its
session in IndexedDB rather than cookies, and the default capture would come back signed
out. The setup also asserts the saved state is non-empty, so a token that never reached
browser storage fails loudly there instead of as a puzzling timeout on the orders list later.

To put a test on the signed-in path, put the file in `tests/authenticated/` and ask for the
`ordersPage` fixture. To force a fresh sign-in, delete `playwright/.auth/user.json`.

## Writing a test

Ask for the screen you need. The fixture has already opened the app and waited out the
startup reloads, so the first line of the test can act:

```ts
import { expect, test } from '../../src/fixtures/app-fixtures.js';

test('shows the orders list', async ({ ordersPage }) => {
  await expect(ordersPage.heading).toBeVisible();
});
```

## Adding a page object

```ts
export class DevicesPage extends BasePage {
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByText('Devices');
  }

  protected override get readyIndicator(): Locator {
    return this.heading;
  }
}
```

`readyIndicator` is the widget that proves the screen rendered. `open()` and
`expectLoaded()` come from `BasePage`.

## Locators

Flutter exposes widgets through the semantics tree, in this order of preference:

| Locator | Use for |
| --- | --- |
| `page.locator('[flt-semantics-identifier="login_button"]')` | Widgets with a `Semantics(identifier:)` — most stable, but needs a dev change |
| `getByRole('button', { name })` | Buttons with text or a tooltip |
| `getByRole('textbox', { name })` | `TextField` with `labelText` / `hintText` |
| `getByText(...)` | Static text and screen checks |
| `toHaveScreenshot()` | Custom-painted widgets (charts) that expose nothing |

To see what the app actually exposes:

```bash
npm run codegen -- $BASE_URL
```

Or open DevTools and inspect `flt-semantics-host`.

**Text-based locators are the app's own copy**, so the suite pins `locale: 'en-US'`. Each
page object keeps its labels in one `LABEL` map at the top of the file — the place to swap
for another language, and the place to fix after a Flutter upgrade changes the semantics
output.

## Typing into fields

Use `typeInto(field, value)` from [`src/flutter/text-input.ts`](../src/flutter/text-input.ts).
Never use `fill()`, and never call `keyboard.type()` directly.

Flutter mounts the real `<input>` only once a field takes focus, and keystrokes that
arrive before it exists — or faster than Flutter handles them — are silently dropped. The
symptom is a 6-character password arriving as 4 or 5, a different count each run. So
`typeInto` clicks, waits for a focused input to exist, types at a human pace, reads the
value back, and starts over if characters went missing.

If a field still comes out short, raise `KEYSTROKE_DELAY_MS` in that file.

## Tuning the stability window

`FLUTTER_STABILITY_WINDOW_MS` (default 4000) is how long a screen must stay put before
`openStable` accepts it. It has to be **longer than the gap between the first login screen
and the app's self-reload**, or a test can start typing into a screen that is about to
vanish.

To measure the gap, log page events against a real run:

```ts
page.on('load', () => console.log('load', Date.now()));
page.on('framenavigated', () => console.log('nav', Date.now()));
```

Take the largest gap across several runs and add margin — a 2s gap wants 4000–5000.

## Rules

- **Never `waitForTimeout` to wait for an element.** The only sleep in the suite is the
  stability window in `openStable`, which asserts nothing changes.
- **Never touch the UI before `openStable` resolves** — a late reload discards the input.
- After navigation or an animation, wait for an element on the *new* screen, not for the click.
- Page objects hold locators and actions. Assertions live in tests.
- Recheck locators after a Flutter upgrade; semantics output can change between versions.

## Known gaps

- Icon-only buttons with no tooltip have no accessible name. Falling back to `.nth(i)` or
  mouse coordinates is fragile; ask for a `Semantics(identifier:)` instead.
- The stability window costs a few seconds on every app open. It disappears if the
  double-reload is fixed in the app — worth reporting as a bug:
  *"Login screen appears, then the app reloads and shows the splash screen again. Users see
  the login screen flash, and anyone who starts typing quickly loses their input."*
- The `LABEL` maps in the page objects are placeholders until verified against a real build.

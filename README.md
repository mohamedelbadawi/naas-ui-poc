# NaaS UI — How the Framework Works

Playwright + TypeScript tests for the NaaS **Flutter web** app, built with the Page Object pattern.

## The big picture

```
npm test
   │
   ├─ 1. setup project ........ logs in once, saves the session to playwright/.auth/user.json
   │
   ├─ 2. anonymous project .... tests that need the login screen (start signed out)
   │
   └─ 3. authenticated project  tests that reuse the saved session (start signed in)
```

Every test then follows the same path:

```
test asks for a screen  →  fixture opens the app  →  openStable waits until the screen is final
                                                              │
                         test uses the page object  ←─────────┘
                         (typeInto for fields, click for buttons)
```

## The building blocks

### 1. Flutter helpers — `src/flutter/`

Flutter web is not normal HTML, so these three files make it testable:

| File | What it does |
| --- | --- |
| `semantics.ts` | Flutter draws on a canvas, so there's nothing to locate. `enableSemantics()` clicks Flutter's hidden "Enable accessibility" button, which creates real DOM elements (`flt-semantics`) with roles and labels. |
| `open-stable.ts` | The app reloads itself on startup, so the login screen shows up twice. `openStable()` opens the app and keeps retrying until the screen stays on screen for the **stability window** (4 s by default) with no reload. Only then can the test start. |
| `text-input.ts` | Flutter drops keystrokes if you type too fast. `typeInto()` clicks the field, waits for the real input, types slowly, reads the value back, and retries if any characters are missing. |

### 2. Page objects — `src/pages/`

One class per screen. Each one holds:

- **Locators** for the screen's widgets (`emailField`, `submitButton`, …)
- **Actions** a user can do (`login()`, `startNewOrder()`, …)
- A **`readyIndicator`**: one widget that proves the screen has loaded

All pages extend `BasePage`, which gives them:

- `open()`: opens the app with `openStable` and waits for `readyIndicator`
- `expectLoaded()`: waits for `readyIndicator` without reopening (after in-app navigation)

| Page | Ready when you see |
| --- | --- |
| `LoginPage` | Login button |
| `OrdersPage` | Create New Order button |
| `CreateOrderPage` | Next button |

### 3. Fixtures — `src/fixtures/app-fixtures.ts`

A fixture hands the test a screen that is **already open and stable**:

- `loginPage`: the login screen
- `ordersPage`: the orders list (the landing screen after login)

The test just names what it needs, and the fixture does the opening and waiting:

```ts
test('...', async ({ ordersPage }) => { /* ordersPage is ready to use */ });
```

### 4. Config — `src/config/` and `playwright.config.ts`

- `env.ts` reads `.env`: `BASE_URL`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `FLUTTER_STABILITY_WINDOW_MS`
- `paths.ts` sets where the saved session is stored
- `playwright.config.ts` defines the 3 projects, blocks the service worker (it can cause reloads),
  pins the language to English (locators use the app's text), and runs the browser headed

### 5. Saved login session — `tests/setup/auth.setup.ts`

Logging in is slow (the startup reloads happen every time), so it's done **once**:

1. Open the login screen and sign in
2. Wait for the orders list
3. Save the session, **including IndexedDB**, because the app uses Firebase, which keeps the token there and not in cookies
4. Check the saved file isn't empty

The `authenticated` project depends on `setup` and loads this file, so its tests open straight onto the orders list.

## What happens in one test

Example: `orders.spec.ts`

1. Playwright runs `setup` first, which saves the session
2. The test starts with the saved session loaded
3. It asks for `ordersPage`, so the fixture calls `ordersPage.open()`
4. `openStable` goes to `/`, turns on semantics, and waits for "Create New Order" to stay visible for 4 s without a reload
5. The test body runs: `expect(ordersPage.heading).toBeVisible()`

## Adding things

**A new test:** put it in `tests/authenticated/` (signed in) or `tests/anonymous/` (signed out) and ask for a fixture:

```ts
import { expect, test } from '../../src/fixtures/app-fixtures.js';

test('shows the orders list', async ({ ordersPage }) => {
  await expect(ordersPage.heading).toBeVisible();
});
```

**A new page:** extend `BasePage`, add locators, and set `readyIndicator`:

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

## Rules

- Type with `typeInto()`. Never use `fill()` or `keyboard.type()`.
- Don't touch the UI before `openStable` finishes, because a late reload wipes it.
- No `waitForTimeout` to wait for elements. The stability window is the only sleep.
- Page objects hold locators and actions. Assertions go in tests.
- Prefer `getByRole(...)` locators. Avoid `#flt-semantic-node-…` IDs, which change when the UI changes.

## Run

```bash
npm install
npm test                     # everything
npm run test:anonymous       # login tests only
npm run test:authenticated   # signed-in tests only
npm run report               # open the HTML report
```

You need a `.env` in the project root with `BASE_URL`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`
and optionally `FLUTTER_STABILITY_WINDOW_MS`.

More detail: [docs/framework-guide.md](docs/framework-guide.md)

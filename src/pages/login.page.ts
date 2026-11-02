import type { Locator, Page } from '@playwright/test';
import type { Credentials } from '../config/env.js';
import { typeInto } from '../flutter/text-input.js';
import { BasePage } from './base.page.js';

/**
 * Accessible names Flutter exposes for this screen. They are the app's visible copy,
 * so they change with the UI language -- tests pin the locale in playwright.config.ts.
 *
 * Verify against the real build with `npm run codegen -- <url>` before trusting them.
 */
const LABEL = {
  submit: 'Login',
  invalidCredentials: 'Incorrect username or password',
} as const;

export class LoginPage extends BasePage {
  readonly emailField: Locator;
  readonly passwordField: Locator;
  readonly submitButton: Locator;
  readonly invalidCredentialsError: Locator;

  constructor(page: Page) {
    super(page);
    this.emailField = page.locator('#flt-semantic-node-14');
    this.passwordField = page.locator('#flt-semantic-node-16');
    this.submitButton = page.getByRole('button', { name: LABEL.submit });
    this.invalidCredentialsError = page.getByText(LABEL.invalidCredentials);
  }

  protected override get readyIndicator(): Locator {
    return this.submitButton;
  }

  async login(credentials: Credentials): Promise<void> {
    await typeInto(this.emailField, credentials.email);
    await typeInto(this.passwordField, credentials.password);
    await this.submitButton.click();
  }
}

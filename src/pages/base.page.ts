import { expect, type Locator, type Page } from '@playwright/test';
import { openStable } from '../flutter/open-stable.js';

/**
 * Shared behaviour for every screen: how to reach it and how to know it is there.
 *
 * Subclasses expose their widgets as locators and their user-facing actions as methods.
 * Assertions belong in the tests, not here -- the only exception is `expectLoaded`,
 * which is part of knowing where we are.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** A widget that exists only once this screen has finished rendering. */
  protected abstract get readyIndicator(): Locator;

  /**
   * Opens the app and waits out Flutter's startup reloads until this screen is stable.
   * Nothing may be typed or clicked before this resolves; a late reload discards it.
   */
  async open(): Promise<void> {
    await openStable(this.page, '/', this.readyIndicator);
  }

  /** Waits for this screen without re-opening the app, e.g. after in-app navigation. */
  async expectLoaded(options: { timeout?: number } = {}): Promise<void> {
    await expect(this.readyIndicator).toBeVisible(options);
  }
}

import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page.js';

const LABEL = {
  heading: 'Orders',
  newOrder: 'Create New Order',
} as const;

export class OrdersPage extends BasePage {
  readonly heading: Locator;
  readonly newOrderButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('banner', { name: LABEL.heading });
    this.newOrderButton = page.getByRole('button', { name: LABEL.newOrder });
  }

  protected override get readyIndicator(): Locator {
    return this.newOrderButton;
  }

  async startNewOrder(): Promise<void> {
    await this.newOrderButton.click();
  }
}

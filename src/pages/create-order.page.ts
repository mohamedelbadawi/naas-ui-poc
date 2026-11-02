import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page.js';

export class CreateOrderPage extends BasePage {
  readonly companyDropdown: Locator;
  readonly firstCompanyOption: Locator;
  readonly branchDropdown: Locator;
  readonly firstBranchOption: Locator;
  readonly carDropdown: Locator;
  readonly firstCarOption: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    super(page);
    this.companyDropdown = page.locator('#flt-semantic-node-1883');
    this.firstCompanyOption = page.getByRole('button', { name: 'Ramadan Other' });
    this.branchDropdown = page.locator('#flt-semantic-node-1914');
    this.firstBranchOption = page.getByRole('button', { name: 'Main Branch' });
    this.carDropdown = page.locator('#flt-semantic-node-2272');
    this.firstCarOption = page.getByRole('button', { name: 'MG | One [ 1111-AAA ]' });
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  protected override get readyIndicator(): Locator {
    return this.nextButton;
  }

  async chooseCompanyBranchAndCar(): Promise<void> {
    await this.companyDropdown.click();
    await this.firstCompanyOption.click();
    await this.branchDropdown.click();
    await this.firstBranchOption.click();
    await this.carDropdown.click();
    await this.firstCarOption.click();
    await this.nextButton.click();
  }
}

import { browser, $ } from '@wdio/globals';
import locators from '../../object-repository/validate-account-screen.json';

export default class ValidateAccountScreenPage {
  async open() {
    // TODO: open the app / deep link or landing screen if required
  }

  // example method using locators JSON
  async clickLogin() {
    const selector = this.getLocator('loginButton');
    const el = await browser.$(selector);
    await el.click();
  }

  getLocator(key: string): string {
    // adapt platform selection if needed
    const platform = (process.env.PLATFORM || 'android').toLowerCase();
    const node = (locators as any)[key];
    if (!node) throw new Error(`Locator "${key}" not found in validate-account-screen.json`);
    return node[platform] || node['android'] || node['ios'];
  }

  async isVisible(xpath: string, timeout = 5000) {
    try {
      const el = await browser.$(xpath);
      return await el.waitForDisplayed({ timeout, reverse: false });
    } catch {
      return false;
    }
  }
}

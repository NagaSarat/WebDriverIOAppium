import { browser, $, $$ } from '@wdio/globals';

export default class BasePage {
  async waitUntilVisible(xpath: string, timeout = 20000) {
    const el = await browser.$(xpath);
    await el.waitForDisplayed({ timeout });
    return el;
  }

  async click(xpath: string, timeout = 10000) {
    const el = await this.waitUntilVisible(xpath, timeout);
    await el.click();
  }

  async sendKeys(xpath: string, text: string, timeout = 30000) {
    const el = await this.waitUntilVisible(xpath, timeout);
    await el.clearValue();
    await el.setValue(text);
  }

  async getText(xpath: string, timeout = 10000) {
    const el = await this.waitUntilVisible(xpath, timeout);
    return el.getText();
  }

  async isVisible(xpath: string, timeout = 5000) {
    try {
      const el = await browser.$(xpath);
      return await el.waitForDisplayed({ timeout, reverse: false });
    } catch {
      return false;
    }
  }

  async takeScreenshot(name = 'screenshot') {
    const path = `./reports/${name}.png`;
    await browser.saveScreenshot(path);
    return path;
  }
}

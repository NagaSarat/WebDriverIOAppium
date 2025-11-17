import { browser, $, $$ } from '@wdio/globals';

export default class BasePage {
  async waitUntilVisible(xpath: string) {
    const el = await browser.$(xpath);
    await el.waitForDisplayed();
    return el;
  }

  async click(xpath: string) {
    const el = await this.waitUntilVisible(xpath);
    await el.click();
  }

  async sendKeys(xpath: string, text: string) {
    const el = await this.waitUntilVisible(xpath);
    await el.clearValue();
    await el.setValue(text);
  }

  async getText(xpath: string) {
    const el = await this.waitUntilVisible(xpath);
    return el.getText();
  }

  async isVisible(xpath: string) {
    try {
      const el = await browser.$(xpath);
      return await el.waitForDisplayed({ reverse: false });
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

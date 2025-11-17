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

   async waitForClickable(xpath: string, timeout = 10000) {
    const el = await browser.$(xpath);
    await el.waitForClickable({ timeout });
    return el;
  }

  async swipe(startX: number, startY: number, endX: number, endY: number) {
    await browser.performActions([{
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: startX, y: startY },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerMove', duration: 700, x: endX, y: endY },
        { type: 'pointerUp', button: 0 }
      ]
    }]);
    await browser.releaseActions();
  }

   async swipeUp() {
    const { width, height } = await browser.getWindowSize();
    await this.swipe(width / 2, height * 0.8, width / 2, height * 0.2);
  }

  async swipeDown() {
    const { width, height } = await browser.getWindowSize();
    await this.swipe(width / 2, height * 0.2, width / 2, height * 0.8);
  }

  async swipeLeft() {
    const { width, height } = await browser.getWindowSize();
    await this.swipe(width * 0.8, height / 2, width * 0.2, height / 2);
  }

  async swipeRight() {
    const { width, height } = await browser.getWindowSize();
    await this.swipe(width * 0.2, height / 2, width * 0.8, height / 2);
  }

  // Scroll until element is visible
  async scrollToElement(xpath: string, maxScrolls = 6) {
    let count = 0;
    while (!(await this.isVisible(xpath, 1500)) && count < maxScrolls) {
      await this.swipeUp();
      count++;
    }
    return await browser.$(xpath);
  }

  // Tap by coordinates
  async tapByCoordinates(x: number, y: number) {
    await browser.performActions([{
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x, y },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerUp', button: 0 }
      ]
    }]);
  }

  // Hide keyboard (Android/iOS)
  async hideKeyboard() {
    try {
      await browser.hideKeyboard();
    } catch (e) {
      // ignore if keyboard not present
    }
  }

  async pause(ms: number) {
    await browser.pause(ms);
  }
}

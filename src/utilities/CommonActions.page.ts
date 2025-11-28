import fs from 'fs';
import path from 'path';
import allure from '@wdio/allure-reporter';

//
// ---------------------------------------------------------
// Load all locator JSON files ONCE (no WebDriver used here)
// ---------------------------------------------------------
const repoPath = path.join(process.cwd(), 'src', 'object-repository');   // <-- Correct folder path

if (!fs.existsSync(repoPath)) {
  throw new Error(`object-repository folder not found at: ${repoPath}`);
}

const locatorFiles = fs.readdirSync(repoPath)
  .filter(f => f.endsWith('.json'))
  .map(f => path.join(repoPath, f));

const LOCATORS: any = {};

for (const file of locatorFiles) {
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  Object.assign(LOCATORS, data); // merge all JSON files
}

//
// ---------------------------------------------------------
//  BasePage Class
// ---------------------------------------------------------
export default class CommonActionsPage {

  //
  // Detect platform dynamically AFTER WebDriver session starts
  //
  get platform(): "android" | "ios" {
    if (driver.isAndroid) return "android";
    if (driver.isIOS) return "ios";
    throw new Error("Unable to detect platform. Is WebDriver session started?");
  }

  //
  // Locator Resolver (Android/iOS)
  //
  getLocator(key: string): string {
    const group = LOCATORS[key];
    if (!group) {
      throw new Error(`Locator key '${key}' not found in any JSON file.`);
    }

    const locator = group[this.platform];
    if (!locator) {
      throw new Error(
        `Locator '${key}' does not have a selector for platform '${this.platform}'.`
      );
    }

    return locator;
  }

  //
  // ---------------------------------------------------------
  // Element Actions
  // ---------------------------------------------------------
  async waitUntilVisible(key: string) {
    const locator = this.getLocator(key);
    const element = await $(locator);
    await element.waitForDisplayed(); // uses default waitforTimeout
    return element;
  }

  async waitForClickable(key: string) {
    const locator = this.getLocator(key);
    const element = await $(locator);
    await element.waitForClickable(); // uses default timeout
    return element;
  }


  async click(key: string) {
    const el = await this.waitUntilVisible(key);
    await el.click();
    this.addStep("clicked on "+key,true);
  }

  async setValue(key: string, value: string) {
    const el = await this.waitUntilVisible(key);
    await el.setValue(value);
    this.addStep("Entered '"+value+"' in "+key,true);
  }

  async isVisible(key: string): Promise<boolean> {
    try {
      const locator = this.getLocator(key);
      return await $(locator).waitForDisplayed(); // uses WDIO default timeout
    } catch {
      return false;
    }
  }

  async takeScreenshot(name = 'screenshot') {
    const filePath = `./reports/${name}.png`;
    await browser.saveScreenshot(filePath);
    return filePath;
  }

  //
  // ---------------------------------------------------------
  // Swiping / Gestures
  // ---------------------------------------------------------
  async swipe(startX: number, startY: number, endX: number, endY: number) {
    await browser.performActions([
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: startX, y: startY },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration: 600, x: endX, y: endY },
          { type: 'pointerUp', button: 0 }
        ]
      }
    ]);

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

  //
  // ---------------------------------------------------------
  // Scroll to an element using locators
  // ---------------------------------------------------------
  async scrollToElement(key: string, maxScrolls = 6) {
    const locator = this.getLocator(key);

    for (let i = 0; i < maxScrolls; i++) {
      try {
        const el = await $(locator);
        if (await el.isDisplayed()) return el;
      } catch { }

      await this.swipeUp();
    }

    throw new Error(`Element '${key}' NOT found after ${maxScrolls} scroll attempts`);
  }

  //
  // ---------------------------------------------------------
  // Misc Utils
  // ---------------------------------------------------------
  async tapByCoordinates(x: number, y: number) {
    await browser.performActions([
      {
        type: 'pointer',
        id: 'touch',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x, y },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerUp', button: 0 }
        ]
      }
    ]);
  }

  async hideKeyboard() {
    try { await browser.hideKeyboard(); } catch { }
  }

  async pause(ms: number) {
    await browser.pause(ms);
  }

  async addStep(stepMessage: string, takeScreenshot: boolean = false) {
    // log step in allure
    allure.addStep(stepMessage);

    if (!takeScreenshot) return;

    const screenshot = await browser.takeScreenshot();

    // attach screenshot to that step
    allure.addAttachment(
      `${stepMessage} - screenshot`,
      Buffer.from(screenshot, 'base64'),
      'image/png'
    );
  }
}
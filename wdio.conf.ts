import path from 'path';
import { execSync } from 'child_process';
import fs from "fs";
import allure from '@wdio/allure-reporter';

/**
 * ==============================
 * KILL APPIUM SERVER ON PORT 4723
 * ==============================
 */
function killAppium() {
  try {
    console.log('Checking if Appium is running on port 4723.');

    if (process.platform === 'win32') {
      // Windows kill
      execSync(
        `for /f "tokens=5" %a in ('netstat -aon ^| find ":4723" ^| find "LISTENING"') do taskkill /PID %a /F`,
        { stdio: 'ignore' }
      );
    } else {
      // macOS/Linux kill
      execSync(`kill -9 $(lsof -t -i:4723)`, { stdio: 'ignore' });
    }

    console.log('Old Appium server stopped successfully.');
  } catch {
    console.log('No Appium server running, safe to start.');
  }
}

function cleanAllureResults() {
  const resultsPath = path.join(process.cwd(), "allure-results");

  if (fs.existsSync(resultsPath)) {
    fs.rmSync(resultsPath, { recursive: true, force: true });
    console.log("🧹 Deleted old Allure results.");
  }
}

/**
 * ==============================
 * CAPABILITIES
 * ==============================
 */
const androidCaps = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'emulator-5554',
  'appium:platformVersion': '16.0',
  'appium:noReset': false,
  'appium:app': path.join(process.cwd(), 'apps/Android-NativeDemoApp-0.4.0.apk'),
  'appium:appPackage': 'com.wdiodemoapp',
  'appium:appActivity': 'com.wdiodemoapp.MainActivity',
  'appium:appWaitActivity': 'com.wdiodemoapp.*',
  'appium:autoGrantPermissions': true,
  'appium:shouldTerminateApp': true
};

const iosCaps = {
  platformName: 'iOS',
  'appium:automationName': 'XCUITest',
  'appium:deviceName': 'iPhone 14',
  'appium:platformVersion': '16.0',
  'appium:app': path.join(process.cwd(), 'apps/Cogmento.ipa'),
  'appium:noReset': true
};

// ─────────────────────────────
// PLATFORM SELECTION
// ─────────────────────────────
const platform = (process.env.PLATFORM || 'android').toLowerCase();

/**
 * ==============================
 * FINAL WDIO CONFIG
 * ==============================
 */
export const config: WebdriverIO.Config = {
  runner: 'local',

  specs: ['./test/specs/**/*.ts'],
  maxInstances: 1,
  waitforTimeout: 60000,

  hostname: '127.0.0.1',
  port: 4723,
  path: '/', // Required for Appium v2/v3

  capabilities: [platform === 'android' ? androidCaps : iosCaps],

  logLevel: 'info',

  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: 'allure-results',
        disableWebdriverStepsReporting: true,
        disableWebdriverScreenshotsReporting: true
      }
    ]
  ],

  /**
   * ==============================
   * AUTO-START APPIUM SERVICE
   * ==============================
   */
  services: [
    [
      'appium',
      {
        command: 'appium',
        logPath: './appium-logs',
        args: {
          basePath: '/',
          relaxedSecurity: true,
          allowInsecure: 'chromedriver_autodownload'
        },
        launchTimeout: 120000
      }
    ]
  ],

  /**
   * ==============================
   * KILL SERVER BEFORE RUN
   * ==============================
   */
  onPrepare: function () {
    killAppium();
    cleanAllureResults();
  },

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000
  },

  tsConfigPath: './tsconfig.json',

  /**
   * ==============================
   * 📸 Screenshot on Failure
   * ==============================
   */
  afterTest: async function (test, context, { error, passed }) {
    try {
      // Take screenshot ALWAYS
      const screenshot = await browser.takeScreenshot();

      const name = passed
        ? `STEP COMPLETED - ${test.title}`
        : `STEP FAILED - ${test.title}`;

      allure.addAttachment(
        name,
        Buffer.from(screenshot, 'base64'),
        'image/png'
      );
    } catch (err) {
      console.warn("Failed to take step screenshot:", err);
    }
  },

  /**
   * ==============================
   *  KILL SERVER AFTER RUN
   * ==============================
   */
  onComplete: function () {
    killAppium();
  },

  
  /**
   * Custom Global Config Flag
   * Pass SCREENSHOT_STEPS=true to enable screenshots
   */
  screenshotSteps: process.env.SCREENSHOT_STEPS === 'true'
  
};

export default config;

import type { Options } from '@wdio/types';
import path from 'path';
import { execSync } from 'child_process';

/**
 * ==============================
 * KILL APPIUM SERVER ON PORT 4723
 * ==============================
 */
function killAppium() {
  try {
    console.log('Checking if Appium is running on port 4723...');

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

/**
 * ==============================
 * CAPABILITIES
 * ==============================
 */
const androidCaps = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'emulator-5554',
  'appium:platformVersion': '15.0',
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
export const config: Options.Testrunner = {
  runner: 'local',

  specs: ['./test/specs/**/*.ts'],
  maxInstances: 1,
  waitforTimeout: 20000,

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
        disableWebdriverScreenshotsReporting: false
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
        launchTimeout: 60000
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
  },

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000
  },

  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: './tsconfig.json'
    }
  },

  /**
   * ==============================
   * 📸 Screenshot on Failure
   * ==============================
   */
  afterTest: async function (test, context, { error }) {
    if (error) {
      await browser.takeScreenshot();
    }
  },

  /**
   * ==============================
   *  KILL SERVER AFTER RUN
   * ==============================
   */
  onComplete: function () {
    killAppium();
  }
};

export default config;

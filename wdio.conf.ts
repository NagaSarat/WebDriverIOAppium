import type { Options } from '@wdio/types';
import path from 'path';



const androidCaps = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'emulator-5554', // or your real device name
  'appium:platformVersion': '12.0',
  //'appium:app': path.join(process.cwd(), 'apps/Cogmento.apk'),
  'appium:noReset': false,
  'appium:appPackage': 'com.wdiodemoapp',
  'appium:appActivity': 'com.wdiodemoapp.MainActivity',
  'appium:appWaitActivity': 'com.wdiodemoapp.*',
  "appium:autoGrantPermissions": true,
    "appium:shouldTerminateApp": true,
};

const iosCaps = {
  platformName: 'iOS',
  'appium:automationName': 'XCUITest',
  'appium:deviceName': 'iPhone 14', // adjust to your simulator name
  'appium:platformVersion': '16.0',
  'appium:app': path.join(process.cwd(), 'apps/Cogmento.ipa'),
  'appium:noReset': true,
};

const platform = process.env.PLATFORM || 'android';

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./test/specs/**/*.ts'],
  maxInstances: 1,

  //
  // ✅ Point WebdriverIO to the manually started Appium server
  //
  hostname: '127.0.0.1',
  port: 4723,
  path: '/', // ❗ must NOT be '/wd/hub' for Appium v3+

  //
  // ✅ Dynamically set Android or iOS capabilities
  //
  capabilities: [platform === 'android' ? androidCaps : iosCaps],

  logLevel: 'info',

  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: 'allure-results',
        disableWebdriverStepsReporting: true,
        disableWebdriverScreenshotsReporting: false,
      },
    ],
  ],

  //
  // ❌ Remove automatic Appium service start since we start Appium manually
  //
  services: [],

  framework: 'mocha',

  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  //
  // ✅ Compile TypeScript automatically
  //
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: './tsconfig.json',
    },
  },

  //
  // 📸 Take screenshot on failure (shown in Allure)
  //
  afterTest: async function (test, context, { error }) {
    if (error) {
      await browser.takeScreenshot();
    }
  },
};

export default config;

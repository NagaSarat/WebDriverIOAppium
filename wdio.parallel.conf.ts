import type { Options } from '@wdio/types';
import { distributeSpecs } from './spec-distributor';
import path from 'path';

const capabilitiesList: any[] = [
  {
    platformName: 'Android',
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    'appium:automationName': 'UiAutomator2',
    'appium:udid': 'emulator-5554',
    'appium:systemPort': 8200,
    'appium:platformVersion': '16.0',
    'appium:app': path.join(process.cwd(), 'apps/Android-NativeDemoApp-0.4.0.apk'),
    'appium:appPackage': 'com.wdiodemoapp',
    'appium:appActivity': 'com.wdiodemoapp.MainActivity',
    maxInstances: 1,
  },
  {
    platformName: 'Android',
    hostname: '127.0.0.1',
    port: 4725,
    path: '/',
    'appium:automationName': 'UiAutomator2',
    'appium:udid': 'emulator-5556',
    'appium:systemPort': 8201,
    'appium:platformVersion': '16.0',
    'appium:app': path.join(process.cwd(), 'apps/Android-NativeDemoApp-0.4.0.apk'),
    'appium:appPackage': 'com.wdiodemoapp',
    'appium:appActivity': 'com.wdiodemoapp.MainActivity',
    maxInstances: 1,
  }
];

const totalDevices = capabilitiesList.length;

capabilitiesList.forEach((cap, index) => {
  (cap as any).specs = distributeSpecs(index, totalDevices);
});

export const config: Options.Testrunner = {
  runner: 'local',
  specs: [],
  maxInstances: totalDevices,
  capabilities: capabilitiesList,

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

 onWorkerStart(worker, caps) {
    if (caps && caps['appium:udid']) {
      process.env.CURRENT_DEVICE_UDID = caps['appium:udid'];
    }
  },

  reporters: [
    'spec',

    [
      'allure',
      {
        outputDir: `allure-results/${process.env.CURRENT_DEVICE_UDID || 'unknown-device'}`,
        disableWebdriverStepsReporting: true,
        disableWebdriverScreenshotsReporting: false,
      },
    ],
  ],

  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: { transpileOnly: true, project: './tsconfig.json' }
  },
};

export default config;

import type { Options } from '@wdio/types';
import path from 'path';

// ✅ Import hooks
import {
  beforeCommandHook,
  afterCommandHook,
  beforeTestHook,
  afterTestHook,
  cleanAllureReports
} from './Hooks/index';

const pCloudyUsername = 'nagasharath.akula@qualizeal.com';
const pCloudyApiKey = 'yvrxchqymnh45rdgr6dd7zsr';

/* -------------------------------------------------------------------------- */
/*                                WDIO CONFIG                                 */
/* -------------------------------------------------------------------------- */
export const config: Options.Testrunner = {
  runner: 'local',

  specs: ['./test/specs/**/*.ts'],
  maxInstances: 1,

  protocol: 'https',
  hostname: 'qualizeal.pcloudy.com',
  port: 443,
  path: '/appiumcloud/wd/hub',

  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator1',
      'appium:newCommandTimeout': 600,
      'appium:launchTimeout': 90000,
      'appium:app': path.join(process.cwd(), 'apps/Android-NativeDemoApp-0.4.0.apk'),

      'pcloudy:options': {
        pCloudy_Username: pCloudyUsername,
        pCloudy_ApiKey: pCloudyApiKey,
        pCloudy_WildNet: false,
        pCloudy_EnableVideo: true,
        pCloudy_EnablePerformanceData: false,
        pCloudy_EnableDeviceLogs: true,
        pCloudy_ApplicationName: 'AndroidNativeDemoApp.apk',
        pCloudy_apppackage: 'com.wdiodemoapp',
        pCloudy_appActivity: 'com.wdiodemoapp.MainActivity',
        pCloudy_DeviceManufacturer: 'SAMSUNG',
        pCloudy_DeviceModel: 'Galaxy A10s',
        pCloudy_DeviceVersion: '11.0.0',
        appiumVersion: '2.0.0'
      }
    } as any
  ],

  framework: 'mocha',
  mochaOpts: { ui: 'bdd', timeout: 120000 },

  /* ---------------------------------------------------------------------- */
  /*                                REPORTERS                               */
  /* ---------------------------------------------------------------------- */
  reporters: [
    'spec',
    ['allure', {
      outputDir: path.join(process.cwd(), 'allure-results'),
      disableWebdriverStepsReporting: false,
      disableWebdriverScreenshotsReporting: false
    }]
  ],

  /* ---------------------------------------------------------------------- */
  /*                                HOOKS                                    */
  /* ---------------------------------------------------------------------- */
  beforeCommand: beforeCommandHook,
  afterCommand: afterCommandHook,
  beforeTest: beforeTestHook,
  afterTest: afterTestHook,

  /* ---------------------------------------------------------------------- */
  /*                         CLEAN REPORTS BEFORE RUN                        */
  /* ---------------------------------------------------------------------- */
  onPrepare: async () => {
    console.log('▶️  Cleaning Allure Reports');
    await cleanAllureReports();
  }
};

export default config;

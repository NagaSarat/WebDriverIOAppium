import type { Options } from '@wdio/types';
import path from 'path';

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

    // Correct app path usage
    'appium:app': path.join(process.cwd(), 'apps/android/Android-NativeDemoApp-0.4.0.apk'),

      'pcloudy:options': {
        pCloudy_Username: 'nagasharath.akula@qualizeal.com',
        pCloudy_ApiKey: 'yvrxchqymnh45rdgr6dd7zsr',
        pCloudy_WildNet: false,
        pCloudy_EnableVideo: true,
        pCloudy_EnablePerformanceData: false,
        pCloudy_EnableDeviceLogs: true,
        pCloudy_ApplicationName: 'AndroidNativeDemoApp.apk',
        pCloudy_apppackage: 'com.wdiodemoapp',
        pCloudy_appActivity: 'com.wdiodemoapp.MainActivity',
        pCloudy_DeviceManufacturer: "SAMSUNG",
        pCloudy_DeviceModel: "Galaxy A10s",
        pCloudy_DeviceVersion: "11.0.0",
        appiumVersion: '2.0.0'       
      }
    } as any  
  ],

  framework: 'mocha',
  mochaOpts: { timeout: 120000 },
  reporters: ['spec']
};

export default config;

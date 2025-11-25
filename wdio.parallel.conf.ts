import type { Options } from '@wdio/types';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import kill from 'tree-kill';
import waitPort from 'wait-port';
import { getManualSpecMap, autoDistribute } from './spec-distributor';
import { browser } from '@wdio/globals';

// Import hooks
import {
    startAppiumServers,
    stopAppiumServers,
    cleanAllureReports,
    beforeCommandHook,
    afterCommandHook,
    beforeTestHook,
    afterTestHook
} from './Hooks';

// ---------------------------------------------
// DEVICE CONFIG
// ---------------------------------------------
const devices = [
    {
        udid: 'emulator-5554',
        port: 4723,
        systemPort: 8200,
        platform: 'android',
        appPath: path.join(process.cwd(), 'apps/Android-NativeDemoApp-0.4.0.apk'),
        platformVersion: '16.0',
        appPackage: 'com.wdiodemoapp',
        appActivity: 'com.wdiodemoapp.MainActivity'
    },
    {
        udid: 'emulator-5556',
        port: 4725,
        systemPort: 8100,
        platform: 'android',
        appPath: path.join(process.cwd(), 'apps/Android-NativeDemoApp-0.4.0.apk'),
        platformVersion: '16.0',
        appPackage: 'com.wdiodemoapp',
        appActivity: 'com.wdiodemoapp.MainActivity'
    }
];

// ---------------------------------------------
// CAPABILITIES
// ---------------------------------------------
const manualMap = getManualSpecMap();
const capabilitiesList: any[] = devices.map((dev, index) => {
    let cap: any = {
        hostname: '127.0.0.1',
        port: dev.port,
        path: '/',
        maxInstances: 1,
        specs: manualMap && manualMap[dev.udid]
            ? manualMap[dev.udid]
            : autoDistribute(index, devices.length),
        'wdio:options': {
            outputDir: `allure-results/${dev.udid}`
        }
    };

    if (dev.platform === 'android') {
        Object.assign(cap, {
            platformName: 'Android',
            'appium:automationName': 'UiAutomator2',
            'appium:udid': dev.udid,
            'appium:systemPort': dev.systemPort,
            'appium:platformVersion': dev.platformVersion,
            'appium:appPackage': dev.appPackage,
            'appium:appActivity': dev.appActivity,
            'appium:app': dev.appPath,
            'appium:autoGrantPermissions': true,
            'appium:noReset': false,
            'appium:shouldTerminateApp': true
        });
    }

    return cap;
});

const startedServers: ChildProcess[] = [];

// ---------------------------------------------
// WDIO CONFIG
// ---------------------------------------------
export const config: Options.Testrunner = {
    runner: 'local',
    specs: [],
    maxInstances: devices.length,
    capabilities: capabilitiesList,
    framework: 'mocha',
    mochaOpts: { ui: 'bdd', timeout: 60000 },

    reporters: [
        'spec',
        ['allure', {
            disableWebdriverStepsReporting: true,
            disableWebdriverScreenshotsReporting: false
        }]
    ],

    // ---------------------------------------------
    // HOOKS
    // ---------------------------------------------
    beforeCommand: beforeCommandHook,
    afterCommand: afterCommandHook,
    beforeTest: beforeTestHook,
    afterTest: afterTestHook,

    // ---------------------------------------------
    // APP/REPORT SETUP
    // ---------------------------------------------
    onPrepare: async () => {
        await cleanAllureReports();

        console.log('Starting Appium servers...');
        for (const dev of devices) {
            await startAppiumServers(dev.port);
            const open = await waitPort({ host: '127.0.0.1', port: dev.port, timeout: 20000 });
            if (!open) throw new Error(`Appium server failed to start on port ${dev.port}`);
            startedServers.push(null as any); // placeholder, handled by startAppiumServers internally
        }
        console.log('All Appium servers started.');
    },

    onWorkerStart: (worker, caps) => {
        if (caps['appium:udid']) {
            process.env.CURRENT_DEVICE = caps['appium:udid'];
            console.log(`📂 Reports: allure-results/${process.env.CURRENT_DEVICE}`);
        }
    },

    onComplete: async () => {
        console.log('Stopping Appium servers...');
        await stopAppiumServers();
    },

    autoCompileOpts: {
        autoCompile: true,
        tsNodeOpts: { transpileOnly: true, project: './tsconfig.json' }
    }
};

export default config;

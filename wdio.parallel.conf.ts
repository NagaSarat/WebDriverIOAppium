import type { Options } from '@wdio/types'
import path from 'path'
import { spawn } from 'child_process'
import kill from 'tree-kill'
import { distributeSpecs } from './spec-distributor'
import waitPort from 'wait-port';


// ---------------------------------------------
// DEVICE SETUP — ANDROID + iOS
// ---------------------------------------------
const devices = [
    // ANDROID DEVICE
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

    // iOS DEVICE
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
]

// ---------------------------------------------
// BUILD CAPABILITIES
// ---------------------------------------------
const capabilitiesList: any[] = devices.map((dev, index) => {
    let cap: any = {
        hostname: '127.0.0.1',
        port: dev.port,
        path: '/',
        maxInstances: 1,
        specs: distributeSpecs(index, devices.length) // per-capability unique specs
    }

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
        })
    }

    if (dev.platform === 'ios') {
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
        })
    }

    return cap
})

// Track started Appium servers
const startedServers: any[] = [];

// ---------------------------------------------
// WDIO CONFIG
// ---------------------------------------------
export const config: Options.Testrunner = {
    runner: 'local',
    specs: [], // specs are provided per-capability
    maxInstances: devices.length,
    capabilities: capabilitiesList,
    framework: 'mocha',
    mochaOpts: { ui: 'bdd', timeout: 60000 },

    // ---------------------------------------------
    // AUTO START APPUM SERVERS
    // ---------------------------------------------
    onPrepare: async () => {
    console.log('Starting Appium servers...');

    for (const dev of devices) {
        console.log(`Appium starting for UDID=${dev.udid} PORT=${dev.port}`);
        const args =
            dev.platform === 'android'
                ? ['--port', dev.port.toString(), '--base-path', '/', '--relaxed-security']
                : ['--port', dev.port.toString(), '--base-path', '/', '--relaxed-security', '--use-prebuilt-wda'];

        const server = spawn('npx', ['appium', ...args], { shell: true });
        server.stdout.on('data', data => console.log(`[Appium-${dev.port}]: ${data}`));
        server.stderr.on('data', err => console.error(`[Appium-${dev.port} ERROR]: ${err}`));
        startedServers.push(server);

        // Wait until the server is ready
        const open = await waitPort({ host: '127.0.0.1', port: dev.port, timeout: 20000 });
        if (!open) throw new Error(`Appium server failed to start on port ${dev.port}`);
    }
    console.log('All Appium servers started.');},

    // ---------------------------------------------
    // PER-DEVICE REPORT FOLDER
    // ---------------------------------------------
    onWorkerStart: (worker, caps) => {
    if (caps['appium:udid']) {
        process.env.CURRENT_DEVICE = caps['appium:udid'];
        console.log(`📂 Reports will go into: allure-results/${process.env.CURRENT_DEVICE}`);
    }
},

    reporters: [
    'spec',
    ['allure', {
        outputDir: process.env.CURRENT_DEVICE
            ? `allure-results/${process.env.CURRENT_DEVICE}`
            : 'allure-results/unknown',
        disableWebdriverStepsReporting: true,
        disableWebdriverScreenshotsReporting: false,
    }],
],

    // ---------------------------------------------
    // KILL APPUM SERVERS AFTER RUN
    // ---------------------------------------------
    onComplete: () => {
        console.log('Killing Appium servers...');
        startedServers.forEach((server, index) => {
            const port = devices[index].port;
            console.log(`Killing Appium for port ${port}`);
            kill(server.pid, 'SIGKILL', err => {
                if (err) console.error(`Failed to kill Appium on port ${port}`, err);
                else console.log(`Appium stopped on port ${port}`);
            });
        });
    },

    autoCompileOpts: {
        autoCompile: true,
        tsNodeOpts: { transpileOnly: true, project: './tsconfig.json' }
    }
};

export default config;
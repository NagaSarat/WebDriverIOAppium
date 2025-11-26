import path from 'path'
import { spawn } from 'child_process'
import kill from 'tree-kill'
import { getManualSpecMap, autoDistribute } from './spec-distributor';
import waitPort from 'wait-port';
import fs from "fs";
import allure from '@wdio/allure-reporter';
import { browser } from '@wdio/globals';


// ---------------------------------------------
// DELETE OLD ALLURE RESULTS BEFORE RUN
// ---------------------------------------------
function cleanAllure() {
    const folder = path.join(process.cwd(), 'allure-results');
    if (fs.existsSync(folder)) {
        fs.rmSync(folder, { recursive: true, force: true });
        console.log("🧹 OLD ALLURE RESULTS DELETED");
    }
}

// ---------------------------------------------
// DEVICE SETUP — ANDROID + iOS
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
]

// ---------------------------------------------
// BUILD CAPABILITIES
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

    return cap
})

// Track started Appium servers
const startedServers: any[] = [];

// ---------------------------------------------
// WDIO CONFIG
// ---------------------------------------------
export const config: WebdriverIO.Config = {
    runner: 'local',
    specs: [],
    maxInstances: devices.length,
    capabilities: capabilitiesList,
    framework: 'mocha',
    mochaOpts: { ui: 'bdd', timeout: 60000 },

    // ---------------------------------------------
    // AUTO START APPIUM SERVERS + CLEAN REPORTS
    // ---------------------------------------------
    onPrepare: async () => {
        cleanAllure(); // 🧹 DELETE OLD ALLURE RESULTS BEFORE RUN

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

            const open = await waitPort({ host: '127.0.0.1', port: dev.port, timeout: 20000 });
            if (!open) throw new Error(`Appium server failed to start on port ${dev.port}`);
        }
        console.log('All Appium servers started.');
    },

    onWorkerStart: (worker, caps) => {
        if (caps['appium:udid']) {
            process.env.CURRENT_DEVICE = caps['appium:udid'];
            console.log(`📂 Reports: allure-results/${process.env.CURRENT_DEVICE}`);
        }
    },

    reporters: [
        'spec',
        ['allure', {
            disableWebdriverStepsReporting: true,
            disableWebdriverScreenshotsReporting: false
        }]
    ],

    // ---------------------------------------------
    // SCREENSHOT AFTER EVERY STEP (PASS + FAIL)
    // ---------------------------------------------
    afterTest: async (test, context, { error, passed }) => {
        try {
            const screenshot = await (browser as any).takeScreenshot();

            const name = passed
                ? `STEP PASSED - ${test.title}`
                : `STEP FAILED - ${test.title}`;

            allure.addAttachment(
                name,
                Buffer.from(screenshot, 'base64'),
                'image/png'
            );
        } catch (err) {
            console.warn("❗ Failed to capture screenshot:", err);
        }
    },

    // ---------------------------------------------
    // STOP APPIUM SERVERS
    // ---------------------------------------------
    onComplete: () => {
        console.log('Killing Appium servers...');
        startedServers.forEach((server, index) => {
            const port = devices[index].port;
            console.log(`Killing Appium on port ${port}`);
            kill(server.pid, 'SIGKILL', err => {
                if (err) console.error(`Failed to kill Appium on port ${port}`, err);
                else console.log(`Appium stopped on port ${port}`);
            });
        });
    },

tsConfigPath: './tsconfig.json'
};

export default config;

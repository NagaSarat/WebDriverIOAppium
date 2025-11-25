import type { Options } from "@wdio/types";
import path from "path";

// ✅ Imports from Hooks/index.ts
import {
  startAppiumServers,
  stopAppiumServers,
  cleanAllureReports,
  beforeCommandHook,
  afterCommandHook,
  beforeTestHook,
  afterTestHook
} from "./Hooks/index";

/* -------------------------------------------------------------------------- */
/*                               CAPABILITIES                                 */
/* -------------------------------------------------------------------------- */
const androidCaps = {
  platformName: "Android",
  "appium:automationName": "UiAutomator2",
  "appium:deviceName": "emulator-5554",
  "appium:platformVersion": "16.0",
  "appium:noReset": false,
  "appium:appPackage": "com.wdiodemoapp",
  "appium:appActivity": "com.wdiodemoapp.MainActivity",
  "appium:autoGrantPermissions": true,
};

const iosCaps = {
  platformName: "iOS",
  "appium:automationName": "XCUITest",
  "appium:deviceName": "iPhone 14",
  "appium:platformVersion": "16.0",
  "appium:app": path.join(process.cwd(), "apps/Cogmento.ipa"),
  "appium:noReset": true,
};

const platform = (process.env.PLATFORM || "android").toLowerCase();

/* -------------------------------------------------------------------------- */
/*                                WDIO CONFIG                                 */
/* -------------------------------------------------------------------------- */
export const config: Options.Testrunner = {
  runner: "local",

  specs: ["./test/specs/**/*.ts"],
  maxInstances: 1,

  hostname: "127.0.0.1",
  port: 4723,
  path: "/",

  capabilities: [platform === "android" ? androidCaps : iosCaps],

  logLevel: "info",

  reporters: [
    "spec",
    [
      "allure",
      {
        outputDir: path.join(process.cwd(), "allure-results"),
        disableWebdriverStepsReporting: false,
        disableWebdriverScreenshotsReporting: false,
      },
    ],
  ],

  /* ---------------------------------------------------------------------- */
  /*                                 SERVICES                               */
  /* ---------------------------------------------------------------------- */
  services: [
    [
      "appium",
      {
        command: "appium",
        args: {
          basePath: "/",
          relaxedSecurity: true,
        },
        logPath: "./appium-logs",
      },
    ],
  ],

  /* ---------------------------------------------------------------------- */
  /*                        BEFORE TEST EXECUTION                           */
  /* ---------------------------------------------------------------------- */
  onPrepare: async () => {
    console.log("▶️  Cleaning Allure Reports");
    await cleanAllureReports();

    console.log("▶️  Stopping old Appium servers (if any)");
    await stopAppiumServers();

    console.log("▶️  Starting Appium server");
    // startAppiumServers can take port as optional argument; default 4723
    await startAppiumServers(4723);
  },

  /* ---------------------------------------------------------------------- */
  /*                                  HOOKS                                 */
  /* ---------------------------------------------------------------------- */
  beforeTest: beforeTestHook,
  afterTest: afterTestHook,

  beforeCommand: beforeCommandHook,
  afterCommand: afterCommandHook,

  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },

  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: "./tsconfig.json",
    },
  },

  /* ---------------------------------------------------------------------- */
  /*                           AFTER TEST SUITE                             */
  /* ---------------------------------------------------------------------- */
  onComplete: async () => {
    console.log("🛑 Stopping Appium server after execution");
    await stopAppiumServers();
  },
};

export default config;

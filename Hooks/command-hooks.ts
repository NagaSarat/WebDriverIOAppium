import allure from "@wdio/allure-reporter";
import { Status } from "allure-js-commons";

/**
 * Before every WebdriverIO Command
 * Logs the command name and arguments in Allure
 */
export function beforeCommandHook(commandName: string, args: any[]) {
  const argsStr = args && args.length ? JSON.stringify(args) : "No arguments";
  allure.startStep(`COMMAND STARTED: ${commandName} | Arguments: ${argsStr}`);
}

/**
 * After every WebdriverIO Command
 * Logs the command result or error in Allure
 */
export async function afterCommandHook(
  commandName: string,
  args: any[],
  result: any,
  error?: Error
) {
  try {
    if (error) {
      const errorMessage = error.message || "Unknown error";
      allure.addStep(
        `COMMAND FAILED: ${commandName}`,
        { content: `Error: ${errorMessage}\nArguments: ${JSON.stringify(args)}\nResult: ${JSON.stringify(result)}` },
        Status.FAILED
      );
    } else {
      allure.addStep(
        `COMMAND PASSED: ${commandName}`,
        { content: `Arguments: ${JSON.stringify(args)}\nResult: ${JSON.stringify(result)}` },
        Status.PASSED
      );
    }
  } finally {
    // Always end the step to avoid hanging steps in Allure
    allure.endStep();
  }
}

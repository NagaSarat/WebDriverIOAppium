import allure from "@wdio/allure-reporter";
import { Status } from "allure-js-commons";

/**
 * Minimal Test interface for typing
 */
interface WebdriverIOTest {
    title: string;
    fullName?: string;
}

/**
 * Before each test
 */
export async function beforeTestHook(test: WebdriverIOTest) {
    allure.startStep(`Test Started: ${test.title}`);
}

/**
 * After each test
 */
export async function afterTestHook(
    test: WebdriverIOTest,
    context: any,
    result: { error?: Error }
) {
    try {
        const shot = await browser.takeScreenshot();
        allure.addAttachment(
            `Test Screenshot - ${test.title}`,
            Buffer.from(shot, "base64"),
            "image/png"
        );

        if (result.error) {
            allure.endStep(Status.FAILED);
        } else {
            allure.endStep(Status.PASSED);
        }
    } catch (err) {
        console.error("Error in afterTestHook:", err);
        allure.endStep(Status.BROKEN);
    }
}

import fs from "fs";
import path from "path";

export async function cleanAllureReports() {
    const dir = path.join(process.cwd(), "allure-results");

    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log("🧹 Cleaned Allure Results folder");
    }
}

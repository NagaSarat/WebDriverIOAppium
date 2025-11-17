import fs from "fs";
import path from "path";

/**
 * Auto-distribute test cases across available devices
 */
export function distributeSpecs(capabilityIndex: number, totalDevices: number): string[] {
  const testDir = path.join(process.cwd(), "test/specs");

  const allSpecs: string[] = fs
    .readdirSync(testDir)
    .filter(file => file.endsWith(".ts"))
    .map(file => path.join(testDir, file));

  // Round-robin: device gets test files based on index % totalDevices
  return allSpecs.filter((_, index) => index % totalDevices === capabilityIndex);
}

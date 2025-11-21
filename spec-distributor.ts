import fs from "fs";
import path from "path";

export interface ManualSpecMap {
  [udid: string]: string[];
}

/**
 * Read user-provided manual spec assignment
 */
export function getManualSpecMap(): ManualSpecMap | null {
  const arg = process.argv.find(a => a.startsWith("--specMap="));
  if (!arg) return null;

  const value = arg.replace("--specMap=", "");
  const map: ManualSpecMap = {};

  value.split(" ").forEach(entry => {
    const [udid, files] = entry.split(":");
    if (udid && files) {
      map[udid] = files.split(",").map(f =>
        path.join(process.cwd(), "test/specs", f.trim())
      );
    }
  });

  return map;
}

/**
 * Auto-distribute test cases across available devices (round-robin)
 */
export function autoDistribute(capabilityIndex: number, totalDevices: number): string[] {
  const testDir = path.join(process.cwd(), "test/specs");

  const allSpecs: string[] = fs
    .readdirSync(testDir)
    .filter(file => file.endsWith(".ts"))
    .map(file => path.join(testDir, file));

  return allSpecs.filter((_, index) => index % totalDevices === capabilityIndex);
}

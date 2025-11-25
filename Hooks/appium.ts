import { spawn, ChildProcess } from 'child_process';
import treeKill from 'tree-kill';

let appiumProcess: ChildProcess | null = null;

export async function startAppiumServers(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log(`🚀 Starting Appium Server on port ${port}...`);
        appiumProcess = spawn('npx', ['appium', '--port', port.toString(), '--relaxed-security'], { shell: true });

        appiumProcess.stdout?.on('data', (data) => {
            const msg = data.toString();
            console.log(`Appium[${port}]: ${msg}`);
            if (msg.includes('Appium REST http interface listener started')) {
                console.log(`✔️ Appium ready on port ${port}`);
                resolve();
            }
        });

        appiumProcess.stderr?.on('data', (data) => console.error(`Appium Error[${port}]: ${data}`));

        appiumProcess.on('exit', (code) => console.log(`Appium process on port ${port} exited with code ${code}`));
    });
}

export async function stopAppiumServers(): Promise<void> {
    return new Promise((resolve) => {
        if (appiumProcess) {
            console.log(`🛑 Stopping Appium server...`);
            treeKill(appiumProcess.pid!, 'SIGTERM', () => {
                console.log('✔️ Appium stopped.');
                appiumProcess = null;
                resolve();
            });
        } else {
            resolve();
        }
    });
}

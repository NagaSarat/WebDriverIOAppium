// scripts/generate-test.ts
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { remote } from 'webdriverio';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config({ override: true });
console.log("Loaded from .env:", process.env.OPENAI_API_KEY);

type LlmResponse = {
  specPath: string;
  specContent: string;
  pagePath: string;
  pageContent: string;
  locatorsPath: string;
  locatorsContent: string;
};

// -------------------- Utilities --------------------
function slugify(text: string) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function pascalCase(text: string) {
  return (text || '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/**
 * Make a safe basename WITHOUT hashing.
 * - Replaces invalid Windows characters
 * - Collapses runs of non-allowed chars into single hyphen
 * - Trims leading/trailing hyphens/dots
 * - Truncates only if extremely long (maxLen)
 */
function makeSafeBasename(raw: string, maxLen = 120) {
  let s = (raw || '').trim();

  // Replace characters that are invalid on Windows filesystems
  s = s.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');

  // Allow letters, numbers, dot, underscore and hyphen. Replace other runs with hyphen
  s = s.replace(/[^a-zA-Z0-9._-]+/g, '-');

  // Collapse multiple hyphens
  s = s.replace(/-+/g, '-');

  // Trim leading/trailing hyphens or dots
  s = s.replace(/^[-.]+|[-.]+$/g, '');

  // Truncate only if too long to be safe
  if (s.length > maxLen) s = s.slice(0, maxLen);

  // Ensure something remains
  if (!s) s = 'file';

  return s;
}

function resolveSafePath(repoRoot: string, maybeRelative: string, fallbackDir: string, fallbackName: string) {
  if (!maybeRelative || typeof maybeRelative !== 'string') {
    return path.join(repoRoot, fallbackDir, fallbackName);
  }

  // Normalize
  let normalized = maybeRelative.replace(/\\/g, '/').trim();
  // Remove drive letter or leading slashes
  normalized = normalized.replace(/^[a-zA-Z]:/, '');
  normalized = normalized.replace(/^\/+/, '');

  const candidate = path.join(repoRoot, normalized);
  const relative = path.relative(repoRoot, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return path.join(repoRoot, fallbackDir, fallbackName);
  }
  return candidate;
}

/** Parse actions from testcase.txt (format: action(locatorName, param1, param2))
 * Returns array of {action, locators, params}
 */
function parseActionsFromTestcase(content: string) {
  const actionsMatch = content.match(/Actions\s*\n([\s\S]*?)(?=Steps|Expected|Preconditions|$)/i);
  if (!actionsMatch) return [];

  const actionLines = actionsMatch[1]
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  const actions: any[] = [];
  const actionRegex = /^(\w+)\s*\(\s*(.+?)\s*\)$/;

  for (const line of actionLines) {
    const match = line.match(actionRegex);
    if (!match) continue;

    const action = match[1].toLowerCase();
    const argsStr = match[2];
    // Split by comma, but respect quoted strings
    const args = argsStr.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(a => a.trim().replace(/^["']|["']$/g, ''));

    const locatorName = args[0];
    const params = args.slice(1);

    actions.push({ action, locatorName, params });
  }

  return actions;
}

/** Parse keys from testcase.txt (flexible). Returns map of key->value */
function parseMetadataFromTestcase(content: string) {
  const lines = (content || '').split(/\r?\n/);
  const meta: Record<string, string> = {};
  // search first 40 lines for key: value pairs
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Allow dots in keys (e.g. appium.deviceName) and keep flexible key syntax
    const m = line.match(/^([A-Za-z0-9 _\-\.]+)\s*[:=]\s*(.+)$/);
    if (m) {
      const key = m[1].trim().toLowerCase();
      const val = m[2].trim();
      meta[key] = val;
    }
  }
  return meta;
}

/**
 * Convert a human phrase into a locator key in camelCase with optional role suffix.
 * Examples: 'Forms icon' -> 'formsIcon', 'Form components' -> 'formComponentsScreen'
 */
function makeLocatorKeyFromPhrase(phrase: string) {
  if (!phrase) return 'elem';
  const raw = String(phrase).trim();
  // detect role words
  const lower = raw.toLowerCase();
  let suffix = '';
  if (lower.includes('icon')) suffix = 'Icon';
  else if (lower.includes('button')) suffix = 'Button';
  else if (lower.includes('option')) suffix = 'Option';
  else if (lower.includes('screen') || lower.includes('components') || lower.includes('form')) suffix = 'Screen';
  else if (lower.includes('header') || lower.includes('title')) suffix = 'Header';

  // remove role words from base phrase
  const base = raw.replace(/icon|button|option|screen|components|form|header|title/ig, '').trim();
  const parts = (base || raw).replace(/[^a-zA-Z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ('elem' + suffix) || 'elem';
  const camel = parts.map((p, i) => i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return camel + suffix;
}

/**
 * Generate structured action lines from freeform Steps text using basic heuristics.
 * Returns array of action strings like `click(formsIcon)`
 */
function generateActionsFromSteps(stepsText: string) {
  if (!stepsText) return [];
  const lines = stepsText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out: string[] = [];
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    
    // Extract quoted text (like: Click on "Search Bar" or Enter "flipkart.com")
    const quoted = line.match(/"([^"]+)"/) || line.match(/'([^']+)'/);
    const phrase = quoted ? quoted[1] : line.replace(/[^a-zA-Z0-9 ]+/g, ' ').trim();

    // Skip empty lines
    if (!phrase) continue;

    if (/(click|tap|press|open|touch)\b/i.test(lower)) {
      // Extract the element name - usually the quoted part or the phrase after "on/at"
      let elementName = phrase;
      if (quoted) {
        elementName = quoted[1];
      } else {
        // Extract from pattern: "Click on XYZ" -> "XYZ"
        const match = line.match(/(?:click|tap|press|open|touch)\s+(?:on|at|the)?\s*(.+?)(?:\.|$)/i);
        if (match) elementName = match[1].trim();
      }
      
      const key = makeLocatorKeyFromPhrase(elementName);
      out.push(`click(${key})`);
      continue;
    }

    if (/wait\b|wait for|waiting for|waituntil|should appear|should load/i.test(lower)) {
      let screenName = phrase;
      if (quoted) {
        screenName = quoted[1];
      } else {
        // Extract from pattern: "Wait for XYZ" -> "XYZ"
        const match = line.match(/wait(?:\s+for)?\s+(.+?)(?:\.|$)/i);
        if (match) screenName = match[1].trim();
      }
      const key = makeLocatorKeyFromPhrase(screenName);
      out.push(`waitUntilVisible(${key}, 20000)`);
      continue;
    }

    if (/(validate|verify|check|should|is visible|visible|appears|displayed)\b/i.test(lower)) {
      let elementName = phrase;
      if (quoted) {
        elementName = quoted[1];
      } else {
        const match = line.match(/(?:validate|verify|check|should|is)\s+(.+?)(?:\.|$)/i);
        if (match) elementName = match[1].trim();
      }
      const key = makeLocatorKeyFromPhrase(elementName);
      out.push(`isVisible(${key})`);
      continue;
    }

    if (/(enter|type|input|fill|set value|send keys|sendkeys)\b/i.test(lower)) {
      // Extract field name and value
      let fieldName = 'field';
      let value = '<value>';
      
      if (quoted) {
        // Could be: Enter "flipkart.com" in "Search Bar" or just Enter "flipkart.com"
        const allQuoted = line.match(/"([^"]+)"/g) || [];
        if (allQuoted.length >= 2) {
          fieldName = allQuoted[1].slice(1, -1); // second quoted part
          value = allQuoted[0]?.slice(1, -1) || '<value>'; // first quoted part
        } else if (allQuoted.length === 1) {
          value = allQuoted[0]?.slice(1, -1) || '<value>';
          // Try to extract field name from context
          const fieldMatch = line.match(/(?:in|into|on)\s+["']?([^"']+)["']?/i);
          if (fieldMatch) fieldName = fieldMatch[1].trim();
        }
      }
      
      const key = makeLocatorKeyFromPhrase(fieldName);
      out.push(`setValue(${key}, ${JSON.stringify(value)})`);
      continue;
    }

    if (/(press|hit|submit)\s+(?:the\s+)?"(.+?)"\s+key/i.test(lower)) {
      // Press "Enter" Key
      const keyMatch = line.match(/"(.+?)"/);
      if (keyMatch) {
        const keyName = keyMatch[1].toLowerCase();
        out.push(`pause(500)`); // Simulate key press
      }
      continue;
    }

    // Fallback: if it looks like an action, try to extract element name
    if (/\b(?:click|tap|enter|press|wait|verify|validate|check)\b/i.test(lower)) {
      let elementName = phrase;
      if (quoted) {
        elementName = quoted[1];
      }
      const fallbackKey = makeLocatorKeyFromPhrase(elementName);
      out.push(`click(${fallbackKey})`);
    }
  }
  
  // Remove duplicates and return
  return out.filter((v, i, a) => i === 0 || v !== a[i-1]);
}

async function callOpenAI(prompt: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY in env');

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  console.log('> Sending request to OpenAI with model:', model);
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a code generation assistant that returns ONLY parseable JSON as specified.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.0,
      max_tokens: 2000
    })
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${txt}`);
  }

 const j: any = await resp.json();   // <-- FIX HERE
 const content = j.choices?.[0]?.message?.content;

  if (!content) throw new Error('No content from model');

  // Log a trimmed preview of the response (avoid dumping huge content)
  const preview = content.length > 1000 ? content.slice(0, 1000) + '... [truncated]' : content;
  console.log('> Received model response (preview):\n', preview);

  try {
    return JSON.parse(content) as LlmResponse;
  } catch (e) {
    const cleaned = content.replace(/(^```json|^```|```$)/g, '').trim();
    try {
      return JSON.parse(cleaned) as LlmResponse;
    } catch (e2) {
      throw new Error('Failed to parse JSON response from model. Response (trimmed):\n' + cleaned.slice(0, 2000));
    }
  }
}

function ensureAndroidDeviceIsRunning() {
  try {
    const output = execSync("adb devices", { encoding: "utf8" });
    const lines = output.split("\n").map(l => l.trim()).filter(Boolean);

    // Filter device lines excluding header
    const deviceLines = lines.filter(l => !l.startsWith("List of devices attached"));

    // Match real devices/emulators that show as "device"
    const onlineDevices = deviceLines.filter(l => l.endsWith("device"));

    if (onlineDevices.length === 0) {
      console.error("❌ No Android device/emulator detected.");
      console.error("   Start an emulator from Android Studio or connect a real device to fetch the locators automatically.\n");
      process.exit(1);  // 🔥 STOP SCRIPT IMMEDIATELY
    }

    console.log("✔ Android device detected:", onlineDevices.join(", "));
  } catch (err) {
    console.error("\n❌ ADB execution failed — ensure ANDROID_HOME/platform-tools is installed & adb is in PATH.");
    console.error(String(err));
    process.exit(1);   // 🔥 STOP SCRIPT IMMEDIATELY
  }
}

async function ensureAppiumServerRunning() {
  try {
    const res = await fetch("http://localhost:4723/wd/hub/status");
    const json = await res.json();

    if (!json || !json.value) {
      throw new Error("Invalid Appium response");
    }

    console.log("✔ Appium Server Running");
  } catch (err) {
    console.error("❌ Appium server is NOT running on port 4723.");
    console.error("   Please start Appium before running this script to generate locators and add it to locators json file automatically.\n");
    process.exit(1); // 🔥 FORCE-STOP SCRIPT
  }
}

/** Capture locators from a live device via Appium + WebdriverIO
 * meta must include: appiumUrl, platformName (Android|iOS), and capability keys as needed
 */
async function captureLocatorsFromDevice(meta: Record<string,string>, repoRoot: string, targetBasename: string, testcaseContent: string) {
  await ensureAppiumServerRunning();
  await ensureAndroidDeviceIsRunning();
  const appiumUrl = meta['appiumurl'] || meta['appium url'] || process.env.APPIUM_URL || 'http://localhost:4723/wd/hub';
  const platformName = (meta['platformname'] || meta['platform'] || process.env.PLATFORM_NAME || '').toLowerCase();
  if (!platformName) throw new Error('captureLocators requested but platformName not provided in testcase metadata (platformName)');

  // Build minimal capabilities from metadata (common keys).
  // Accept keys in `testcase.txt` as either plain (deviceName) or prefixed `appium.<key>` (lowercased by parser).
  const caps: any = { platformName: platformName.charAt(0).toUpperCase() + platformName.slice(1) };
  const capKeys = [
    'deviceName', 'udid', 'app', 'appPackage', 'appActivity', 'appWaitActivity', 'bundleId', 'automationName',
    'platformVersion', 'noReset', 'autoGrantPermissions', 'shouldTerminateApp'
  ];

  for (const k of capKeys) {
    const lower = k.toLowerCase();
    // meta keys are lowercased by parseMetadataFromTestcase
    const v = meta[lower] || meta[`appium.${lower}`] || meta[`appium:${lower}`] || meta[`appium.${k.toLowerCase()}`];
    if (v === undefined) continue;

    // Special handling for the app path: resolve relative -> absolute and only set if file exists
    if (lower === 'app') {
      let appPath = String(v);
      if (!path.isAbsolute(appPath)) appPath = path.join(repoRoot, appPath);
      if (fs.existsSync(appPath)) {
        caps[`appium:${k}`] = appPath;
      } else {
        console.warn(`App path '${appPath}' does not exist or is not accessible. Will attempt to start by package/activity if provided.`);
        // don't set app capability; rely on appPackage/appActivity if available
      }
      continue;
    }

    // For other keys set vendor-prefixed capability
    caps[`appium:${k}`] = v;
  }

  // If app capability was not provided but appPackage+appActivity exist, that's fine — Appium can launch by package/activity
  if (!caps['appium:app'] && (meta['apppackage'] || meta['appium.apppackage'] || meta['appium:apppackage']) && (meta['appactivity'] || meta['appium.appactivity'] || meta['appium:appactivity'])) {
    console.log('No APK provided — will attempt to start app using package/activity on device.');
  }

  const parsed = new URL(appiumUrl);
  const opts: any = {
     path: parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/',
     port: Number(parsed.port || 4723),
     protocol: parsed.protocol.replace(':',''),
     hostname: parsed.hostname,
     capabilities: caps
   } as any;

  // We'll first create a lightweight management session (no 'app' capability) so we can
  // check whether the app is already installed on the device. If not installed and an APK
  // exists in the repo `apps/` folder, we'll install it, then start the app by package/activity.

  const mgmtCaps: any = { platformName: caps.platformName };
  // ensure automationName and deviceName are provided for session creation
  mgmtCaps['appium:automationName'] = caps['appium:automationName'] || caps['appium:AutomationName'] || 'UiAutomator2';
  if (caps['appium:deviceName']) mgmtCaps['appium:deviceName'] = caps['appium:deviceName'];

  const mgmtOpts: any = {
     path: opts.path,
     port: opts.port,
     protocol: opts.protocol,
     hostname: opts.hostname,
     capabilities: mgmtCaps
   } as any;

  console.log('Starting management Appium session for device checks with options:', { hostname: mgmtOpts.hostname, port: mgmtOpts.port, path: mgmtOpts.path });
  let client: any;
  try {
    client = await remote(mgmtOpts);
  } catch (err) {
    const msg = (err as any)?.message || String(err);
    if (msg.includes('404') || msg.includes('The requested resource could not be found') || msg.includes('unknown command')) {
      console.log('Management session path failed, retrying with root path "/"');
      try {
        mgmtOpts.path = '/';
        client = await remote(mgmtOpts);
      } catch (err2) {
        throw new Error('Failed to create management session. ' + ((err2 as any)?.message || String(err2)));
      }
    } else {
      throw new Error('Failed to create management session. ' + msg);
    }
  }

  try {
    // give device a moment
    await client.pause(500);

    // Platform-specific install/start logic
    if (platformName === 'android') {
      const pkg = meta['apppackage'] || meta['appium.apppackage'] || meta['appium:apppackage'];
      const activity = meta['appactivity'] || meta['appium.appactivity'] || meta['appium:appactivity'];
      const apkMeta = meta['appium.app'] || meta['app'];
      const apkPath = apkMeta ? (path.isAbsolute(String(apkMeta)) ? String(apkMeta) : path.join(repoRoot, String(apkMeta))) : null;

      if (!pkg) console.warn('No appPackage provided; cannot check or start installed app by package.');

      let installed = false;
      if (pkg) {
        try {
          installed = await (client as any).isAppInstalled(pkg);
        } catch (e) {
          console.warn('isAppInstalled check failed:', (e as any)?.message || String(e));
        }
      }

      if (installed) {
        console.log(`App ${pkg} is installed on device — starting activity ${activity || '<unspecified>'}`);
        try {
          if (activity) await (client as any).startActivity(pkg, activity);
          else await (client as any).activateApp(pkg);
        } catch (e) {
          console.warn('Could not start app by package/activity:', (e as any)?.message || String(e));
        }
      } else {
        // Not installed — try to install from apkPath if provided
        if (apkPath && fs.existsSync(apkPath)) {
          console.log('Installing app from:', apkPath);
          try {
            await (client as any).installApp(apkPath);
            // start app after install
            if (pkg && activity) {
              await (client as any).startActivity(pkg, activity);
            }
          } catch (e) {
            console.warn('Failed to install/start app from APK:', (e as any)?.message || String(e));
          }
        } else {
          console.warn('APK not provided or not found; and app is not installed. Capture will continue but may not show app UI.');
        }
      }
    } else if (platformName === 'ios') {
      const bundle = meta['bundleid'] || meta['appium.bundleid'] || meta['appium:bundleid'];
      const ipaMeta = meta['appium.app'] || meta['app'];
      const ipaPath = ipaMeta ? (path.isAbsolute(String(ipaMeta)) ? String(ipaMeta) : path.join(repoRoot, String(ipaMeta))) : null;

      let installed = false;
      if (bundle) {
        try {
          installed = await (client as any).isAppInstalled(bundle);
        } catch (e) {
          console.warn('isAppInstalled check failed:', (e as any)?.message || String(e));
        }
      }

      if (installed) {
        console.log(`App ${bundle} is installed on device — activating it`);
        try { await (client as any).activateApp(bundle); } catch (e) { console.warn('activateApp failed:', (e as any)?.message || String(e)); }
      } else if (ipaPath && fs.existsSync(ipaPath)) {
        console.log('Installing app from:', ipaPath);
        try { await (client as any).installApp(ipaPath); if (bundle) await (client as any).activateApp(bundle); } catch (e) { console.warn('Failed to install/start app from IPA:', (e as any)?.message || String(e)); }
      } else {
        console.warn('IPA not provided or not found; and app is not installed. Capture will continue but may not show app UI.');
      }
    }

    // Wait a bit for app to be in foreground
    await client.pause(1500);

    // ===== FULLY AUTOMATED CAPTURE MODE: NO USER INTERACTION NEEDED =====
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║       FULLY AUTOMATED CAPTURE MODE - ZERO INTERACTION       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log('🤖 Automated Mode:');
    console.log('  - Reading test actions from testcase.txt');
    console.log('  - Executing actions automatically on the device');
    console.log('  - Capturing REAL xpaths for each action');
    console.log('  - Generating all files without any user interaction\n');

    // Parse actions from testcase - these will be executed automatically
    const parsedActions = parseActionsFromTestcase(testcaseContent);
    
    if (parsedActions.length === 0) {
      console.warn('⚠️  WARNING: No Actions found in testcase.txt');
      console.log('Please define Actions block in testcase.txt:');
      console.log('  Actions');
      console.log('  click(searchBar)');
      console.log('  setValue(searchBar, "test")');
      console.log('  click(searchButton)\n');
    }

    // Track all interactions - execute each action and capture xpath
    const interactedElements: Array<{ xpath: string; key: string; stepNum: number; action: string }> = [];
    const capturedSteps: string[] = [];

    // Helper to build precise xpath from element
    const buildXpathFromElement = async (el: any): Promise<string> => {
      try {
        const cls = await el.getAttribute('class').catch(() => null);
        if (!cls) return '//*'; // fallback

        // Try to find identifying attributes in order of preference
        for (const attr of ['resource-id', 'content-desc', 'text', 'name']) {
          const val = await el.getAttribute(attr).catch(() => null);
          if (val && val.trim()) {
            return `//${cls}[@${attr}='${val}']`;
          }
        }

        // If no identifying attributes, use class alone as fallback
        return `//${cls}`;
      } catch (e) {
        return '//*';
      }
    };

    // Helper to find element by various strategies
    const findElementByLocatorStrategies = async (locatorName: string): Promise<any> => {
      const cleanName = locatorName.toLowerCase().trim();
      
      console.log(`  Trying exact match strategies...`);
      
      const strategies = [
        { attr: 'content-desc', xpath: `//*[@content-desc='${locatorName}']` },
        { attr: 'resource-id', xpath: `//*[@resource-id='${locatorName}']` },
        { attr: 'text', xpath: `//*[@text='${locatorName}']` },
        { attr: 'text-contains', xpath: `//*[contains(@text, '${locatorName}')]` },
        { attr: 'content-desc-contains', xpath: `//*[contains(@content-desc, '${locatorName}')]` },
        // Try common element types with the locator name
        { attr: 'button-text', xpath: `//android.widget.Button[@text='${locatorName}']` },
        { attr: 'button-hint', xpath: `//android.widget.Button[@hint='${locatorName}']` },
        { attr: 'edittext-hint', xpath: `//android.widget.EditText[@hint='${locatorName}']` },
        { attr: 'edittext-text', xpath: `//android.widget.EditText[@text='${locatorName}']` },
        { attr: 'textview-text', xpath: `//android.widget.TextView[@text='${locatorName}']` }
      ];

      for (const strategy of strategies) {
        try {
          const el = await client.$(strategy.xpath).catch(() => null);
          if (el) {
            const displayed = await el.isDisplayed().catch(() => false);
            if (displayed) {
              console.log(`  ✓ Found by strategy: ${strategy.attr}`);
              return el;
            }
          }
        } catch (e) {
          // continue to next strategy
        }
      }

      // If exact match failed, search by partial text matching across ALL elements
      console.log(`  Trying broad search...`);
      try {
        const allElements = await client.$$('//*[@clickable="true"] | //*[@long-clickable="true"] | //android.widget.EditText').catch(() => []);
        
        for (const el of allElements) {
          try {
            const text = await el.getText().catch(() => '').toLowerCase();
            const hint = await el.getAttribute('hint').catch(() => '').toLowerCase();
            const contentDesc = await el.getAttribute('content-desc').catch(() => '').toLowerCase();
            const resId = await el.getAttribute('resource-id').catch(() => '').toLowerCase();
            const displayed = await el.isDisplayed().catch(() => false);
            
            if (!displayed) continue;
            
            // Check for matches
            if (text.includes(cleanName) || text === cleanName ||
                hint.includes(cleanName) || hint === cleanName ||
                contentDesc.includes(cleanName) || contentDesc === cleanName ||
                resId.includes(cleanName.replace(/\s+/g, '').replace('_', '')) ||
                resId.includes(cleanName)) {
              console.log(`  ✓ Found by broad search (text/hint/desc: "${text || hint || contentDesc}"`);
              return el;
            }
          } catch (e) {
            // continue
          }
        }
      } catch (e) {
        console.log(`  Broad search failed`);
      }

      return null;
    };

    console.log(`📋 Executing ${parsedActions.length} automated actions from testcase...\n`);

    let stepCounter = 0;

    // Execute each action and capture xpath
    for (const action of parsedActions) {
      stepCounter++;
      const { action: actionType, locatorName, params } = action;

      console.log(`\n✓ Step ${stepCounter}: ${actionType}('${locatorName}'${params.length ? ', ' + params.join(', ') : ''})`);

      try {
        // Find element by various strategies
        console.log(`  🔍 Searching for element: ${locatorName}`);
        let element = await findElementByLocatorStrategies(locatorName);

        // If not found, try more aggressive search strategies
        if (!element) {
          console.log(`  📱 First search failed, trying expanded strategies...`);
          
          // Try to find by partial matching all visible elements
          try {
            const allClickable = await client.$$('//android.widget.Button | //android.widget.EditText | //android.widget.ImageButton').catch(() => []);
            for (const el of allClickable) {
              const text = await el.getText().catch(() => '');
              const hint = await el.getAttribute('hint').catch(() => '');
              const resId = await el.getAttribute('resource-id').catch(() => '');
              
              if (text.toLowerCase().includes(locatorName.toLowerCase()) || 
                  hint.toLowerCase().includes(locatorName.toLowerCase()) ||
                  resId.toLowerCase().includes(locatorName.toLowerCase())) {
                element = el;
                console.log(`  ✓ Found by expanded search: ${text || hint || resId}`);
                break;
              }
            }
          } catch (e) {
            // silent
          }
        }

        if (!element) {
          console.warn(`  ⚠️  Could not find element: ${locatorName}`);
          console.log(`  💡 Tip: Element name should match visible text or hint in app`);
          continue;
        }

        // Get element details BEFORE action
        const text = await element.getText().catch(() => '');
        const contentDesc = await element.getAttribute('content-desc').catch(() => '');
        const resourceId = await element.getAttribute('resource-id').catch(() => '');
        const cls = await element.getAttribute('class').catch(() => '');
        const xpath = await buildXpathFromElement(element);

        // Determine element type for display
        let elementType = 'Element';
        if (cls?.includes('EditText')) elementType = 'Input';
        else if (cls?.includes('Button')) elementType = 'Button';
        else if (cls?.includes('Switch')) elementType = 'Switch';
        else if (cls?.includes('CheckBox')) elementType = 'Checkbox';
        else if (cls?.includes('ImageView') || cls?.includes('ImageButton')) elementType = 'Icon';
        else if (cls?.includes('TextView')) elementType = 'Text';

        console.log(`  ✓ Found ${elementType}: ${locatorName}`);
        console.log(`    XPath: ${xpath}`);
        if (text) console.log(`    Text: "${text}"`);
        if (contentDesc) console.log(`    Content-Desc: "${contentDesc}"`);
        if (resourceId) console.log(`    Resource-ID: "${resourceId}"`);

        // Execute the action
        try {
          if (actionType.toLowerCase() === 'click' || actionType.toLowerCase() === 'tap') {
            console.log(`  → Executing: click`);
            await element.click();
          } else if (actionType.toLowerCase() === 'setvalue' || actionType.toLowerCase() === 'enter' || actionType.toLowerCase() === 'type') {
            const value = params[0] || '<value>';
            console.log(`  → Executing: setValue("${value}")`);
            await element.clearValue();
            await element.setValue(value);
          } else if (actionType.toLowerCase() === 'waituntilvisible' || actionType.toLowerCase() === 'wait') {
            const timeout = params[0] ? Number(params[0]) : 20000;
            console.log(`  → Executing: waitUntilVisible(${timeout}ms)`);
            await element.waitForDisplayed({ timeout });
          } else if (actionType.toLowerCase() === 'isvisible' || actionType.toLowerCase() === 'validate') {
            console.log(`  → Executing: isVisible (validation)`);
            const visible = await element.isDisplayed();
            console.log(`    Result: ${visible}`);
          } else {
            console.log(`  → Executing: ${actionType}`);
            // Try to click as default
            await element.click();
          }

          // Small pause after action
          await client.pause(500);
        } catch (e) {
          console.warn(`  ⚠️  Action failed: ${(e as any)?.message || String(e)}`);
        }

        // Record captured element
        interactedElements.push({
          xpath,
          key: locatorName,
          stepNum: stepCounter,
          action: actionType
        });
        capturedSteps.push(locatorName);

        console.log(`  ✓ STEP ${stepCounter} captured`);
      } catch (e) {
        console.warn(`  ✗ Error in step ${stepCounter}:`, (e as any)?.message || String(e));
        // Continue to next action even if this one fails
      }
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         CAPTURE COMPLETED - GENERATING FILES              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`📊 Captured ${stepCounter} steps\n`);

    // Ensure session is closed
    try {
      await client.deleteSession();
    } catch (e) {
      // silent
    }

    // Build locators from captured xpaths
    const locators: Record<string, any> = {};
    let counter = 1;

    console.log(`Processing ${interactedElements.length} captured interactions...\n`);

    for (const { xpath, key } of interactedElements) {
      try {
        if (!xpath) {
          console.warn(`⚠ Could not generate xpath for key: ${key}`);
          continue;
        }

        // Use the key as the locator key
        let locKey = key;
        if (locators[locKey]) {
          // If key exists, append counter
          locKey = `${key}_${counter++}`;
        }

        if (!locators[locKey]) {
          locators[locKey] = {};
        }
        
        // Add xpath for the detected platform
        if (platformName === 'android') {
          locators[locKey]['android'] = xpath;
          console.log(`✓ Captured [${locKey}]: ${xpath}`);
        } else if (platformName === 'ios') {
          locators[locKey]['ios'] = xpath;
          console.log(`✓ Captured [${locKey}]: ${xpath}`);
        }
      } catch (e) {
        console.warn(`Error processing locator for ${key}:`, (e as any)?.message);
      }
    }

    // Load existing locators if file exists and merge (to preserve previously captured platforms)
    const targetPath = path.join(repoRoot,'src', 'object-repository', targetBasename);
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    let finalLocators: Record<string, any> = { ...locators };
    
    // Preserve iOS xpaths from existing file for keys that we just captured
    if (fs.existsSync(targetPath)) {
      try {
        const existingContent = fs.readFileSync(targetPath, 'utf8');
        const existing = JSON.parse(existingContent);
        
        // For each key we just captured on Android, try to preserve its iOS xpath
        for (const [key] of Object.entries(finalLocators)) {
          if (existing[key] && typeof existing[key] === 'object') {
            // If iOS exists in old file, keep it
            if (existing[key].ios && !finalLocators[key].ios) {
              finalLocators[key].ios = existing[key].ios;
            }
          }
        }
      } catch (e) {
        console.warn('Could not merge existing locators:', e);
      }
    }
    
    // Write clean format (no _meta, only interacted elements)
    const cleanLocators: Record<string, any> = {};
    for (const [key, entry] of Object.entries(finalLocators)) {
      cleanLocators[key] = {};
      if (typeof entry === 'object' && entry !== null) {
        // Only copy platform keys (android, ios)
        if (entry.android) cleanLocators[key].android = entry.android;
        if (entry.ios) cleanLocators[key].ios = entry.ios;
      }
    }
    
    fs.writeFileSync(targetPath, JSON.stringify(cleanLocators, null, 2), 'utf8');
    console.log('Captured locators written to:', targetPath);
    console.log(`Total locators: ${Object.keys(cleanLocators).length} (only interacted elements)`);

    // Close session
    await client.deleteSession();
    return targetPath;
  } catch (e) {
    try { await client.deleteSession(); } catch (err) {}
    throw e;
  }
}

// -------------------- Main --------------------
async function main() {
  const repoRoot = process.cwd();
  console.log('Working directory (repo root):', repoRoot);

  const testcasePath = path.join(repoRoot, 'testcase.txt');
  console.log('Looking for testcase file at:', testcasePath);

  if (!fs.existsSync(testcasePath)) {
    console.error('ERROR: Please create testcase.txt in repo root with the test case title and optional file names.');
    process.exit(1);
  }

  const raw = fs.readFileSync(testcasePath, 'utf8');
  console.log('Loaded testcase.txt — size:', raw.length, 'characters');

  if (!raw.trim()) {
    console.error('ERROR: testcase.txt is empty');
    process.exit(1);
  }

  // Parse metadata keys from the file (flexible)
  const meta = parseMetadataFromTestcase(raw);
  console.log('Parsed metadata keys from testcase.txt:', Object.keys(meta).length ? meta : '(none found)');

  // Determine platform early (needed for LLM prompt)
  const platformName = (meta['platformname'] || meta['platform'] || process.env.PLATFORM_NAME || 'android').toLowerCase();
  console.log('Detected platform:', platformName);

  // Determine TestCaseTitle
  const titleCandidates = [
    meta['testcasetitle'],
    meta['test case title'],
    meta['testcase'],
    meta['test case'],
    meta['testcase title']
  ];
  const testcaseTitle = titleCandidates.find(Boolean) || (() => {
    // fallback: take first non-empty line that isn't a key:value
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const l of lines) {
      if (!/^[A-Za-z0-9 _\-]+[:=]/.test(l)) return l;
    }
    return '';
  })();

  if (!testcaseTitle) {
    console.error('ERROR: Could not determine TestCase title from testcase.txt (please include a TestCaseTitle: ... line).');
    process.exit(1);
  }
  console.log('Determined TestCase title:', testcaseTitle);

  // Defaults derived from title
  const baseSlug = slugify(testcaseTitle) || 'test-case';
  const defaultPageClass = pascalCase(testcaseTitle) + 'Page';
  const defaultSpecClass = pascalCase(testcaseTitle) + 'Spec';
  const defaultSpecFilename = `${baseSlug}.spec.ts`;
  const defaultPageFilename = `${pascalCase(testcaseTitle)}.page.ts`;
  const defaultLocatorsFilename = `${baseSlug}.json`;

  console.log('Defaults derived from title:');
  console.log(' - baseSlug:', baseSlug);
  console.log(' - defaultSpecFilename:', defaultSpecFilename);
  console.log(' - defaultPageFilename:', defaultPageFilename);
  console.log(' - defaultLocatorsFilename:', defaultLocatorsFilename);

  // Read user-provided values (if any)
  const rawSpecFile = meta['specfile'] || meta['spec file'] || meta['spec'] || '';
  const rawPageClass = meta['pageclass'] || meta['page class'] || meta['page'] || '';
  const rawLocatorsFile = meta['locatorsfile'] || meta['locators file'] || meta['locators'] || meta['locatorfile'] || '';

  if (rawSpecFile) console.log('User provided SpecFile:', rawSpecFile);
  if (rawPageClass) console.log('User provided PageClass:', rawPageClass);
  if (rawLocatorsFile) console.log('User provided LocatorsFile:', rawLocatorsFile);

  // SPEC filename: ensure .spec.ts extension
  let specFilename = rawSpecFile ? rawSpecFile.trim() : defaultSpecFilename;
  if (specFilename && path.extname(specFilename) === '') specFilename += '.spec.ts';
  if (specFilename && !specFilename.endsWith('.spec.ts')) {
    if (!specFilename.endsWith('.ts')) specFilename += '.spec.ts';
    else if (!specFilename.endsWith('.spec.ts')) specFilename = specFilename.replace(/\.ts$/, '.spec.ts');
  }
  console.log('Final spec filename (before sanitization):', specFilename);

  // PAGE class: user might provide a class name or a filename. Normalize.
  let pageClassName = rawPageClass ? rawPageClass.trim() : defaultPageClass;
  if (pageClassName.includes('.') || pageClassName.toLowerCase().endsWith('.ts')) {
    pageClassName = path.basename(pageClassName, path.extname(pageClassName));
    console.log('Extracted page class name from filename input:', pageClassName);
  }
  pageClassName = pascalCase(pageClassName) || defaultPageClass;
  const pageFilename = `${pageClassName}.page.ts`;
  console.log('Final page class name:', pageClassName);
  console.log('Final page filename (before sanitization):', pageFilename);

  // LOCATORS filename: ensure .json extension
  let locatorsFilename = rawLocatorsFile ? rawLocatorsFile.trim() : defaultLocatorsFilename;
  if (locatorsFilename && path.extname(locatorsFilename) === '') locatorsFilename += '.json';
  if (!locatorsFilename) locatorsFilename = defaultLocatorsFilename;
  console.log('Final locators filename (before sanitization):', locatorsFilename);

  // Example files for LLM style guidance
  const exampleLocatorPath = path.join(repoRoot, 'src','object-repository', 'loginpage.json');
  const examplePagePath = path.join(repoRoot, 'src', 'pages', 'login.page.ts');
  const exampleSpecPath = path.join(repoRoot, 'test', 'specs', 'login.spec.ts');
  // If user requested live capture, perform it and use the captured file as the example locator
  // Optionally perform live capture and keep the captured locators path
  let capturedLocatorsPath: string | null = null;
  if (meta['capturelocators'] === 'true' || meta['capturelocators'] === '1' || meta['capturelocators'] === 'yes') {
    try {
      console.log('captureLocators flag detected in testcase metadata — attempting live capture from device...');
      capturedLocatorsPath = await captureLocatorsFromDevice(meta, repoRoot, locatorsFilename, raw);
      console.log('Live capture completed. Using captured locators as example.');
    } catch (e) {
      console.warn('Live capture failed:', (e as any)?.message || String(e));
      capturedLocatorsPath = null;
    }
  }

  const exampleLocator = fs.existsSync(exampleLocatorPath) ? fs.readFileSync(exampleLocatorPath, 'utf8') : null;
  const examplePage = fs.existsSync(examplePagePath) ? fs.readFileSync(examplePagePath, 'utf8') : null;
  const exampleSpec = fs.existsSync(exampleSpecPath) ? fs.readFileSync(exampleSpecPath, 'utf8') : null;

  if (exampleLocator) console.log('Using example locators for prompt (loginpage.json)');
  if (examplePage) console.log('Using example page for prompt (login.page.ts)');
  if (exampleSpec) console.log('Using example spec for prompt (login.spec.ts)');

  // Extract test steps, expected results, preconditions, and ACTIONS from testcase.txt for the LLM prompt
  const testStepsMatch = raw.match(/Steps\s*\n([\s\S]*?)(?=Expected Results|Preconditions|Actions|$)/i);
  const testSteps = testStepsMatch ? testStepsMatch[1].trim() : '';
  const expectedMatch = raw.match(/Expected Results\s*\n([\s\S]*?)(?=Preconditions|Actions|$)/i);
  const expectedResults = expectedMatch ? expectedMatch[1].trim() : '';
  const preMatch = raw.match(/Preconditions\s*\n([\s\S]*?)(?=Steps|Actions|$)/i);
  const preconditions = preMatch ? preMatch[1].trim() : '';
  
  // Parse structured actions from Actions block if present
  let parsedActionsFromTestcase = parseActionsFromTestcase(raw);
  
  // If no explicit Actions block, auto-generate from Steps
  if (parsedActionsFromTestcase.length === 0 && testSteps) {
    console.log('No explicit Actions block found - auto-generating from Steps...');
    const generatedActionLines = generateActionsFromSteps(testSteps);
    
    // Parse the generated actions back into structured format
    const actionRegex = /^(\w+)\s*\(\s*(.+?)\s*\)$/;
    for (const line of generatedActionLines) {
      const match = line.match(actionRegex);
      if (match) {
        const action = match[1].toLowerCase();
        const argsStr = match[2];
        const args = argsStr.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(a => a.trim().replace(/^["']|["']$/g, ''));
        const locatorName = args[0];
        const params = args.slice(1);
        parsedActionsFromTestcase.push({ action, locatorName, params });
      }
    }
  }
  
  const actionsDescription = parsedActionsFromTestcase.length > 0 
    ? parsedActionsFromTestcase.map((a, i) => `${i + 1}. ${a.action}('${a.locatorName}'${a.params.length ? ', ' + a.params.join(', ') : ''})`).join('\n')
    : '(no actions defined)';

  // Auto-generate Actions section from natural language Steps and update testcase.txt if changed
  try {
    const generatedActions = generateActionsFromSteps(testSteps);
    const generatedActionsBlock = generatedActions.length ? ('Actions\n' + generatedActions.join('\n') + '\n') : '';

    const actionsSectionRegex = /Actions\s*\n([\s\S]*?)(?=Steps|Expected|Preconditions|$)/i;
    const existingActionsMatch = raw.match(actionsSectionRegex);
    const existingActionsBody = existingActionsMatch ? existingActionsMatch[1].trim() : null;

    const normalizedExisting = existingActionsBody ? existingActionsBody.replace(/\r?\n/g, '\n').trim() : '';
    const normalizedGenerated = generatedActions.join('\n').trim();

    if (normalizedGenerated && normalizedGenerated !== normalizedExisting) {
      let newRaw: string;
      if (existingActionsMatch) {
        newRaw = raw.replace(actionsSectionRegex, 'Actions\n' + generatedActions.join('\n') + '\n');
      } else {
        // Insert Actions block before Steps if present, otherwise append after metadata
        const stepsRegex = /\r?\n?Steps\s*\n/ig;
        const m = stepsRegex.exec(raw);
        if (m && m.index !== undefined) {
          const insertPos = m.index;
          newRaw = raw.slice(0, insertPos) + '\nActions\n' + generatedActions.join('\n') + '\n\n' + raw.slice(insertPos);
        } else {
          newRaw = raw + '\n\nActions\n' + generatedActions.join('\n') + '\n';
        }
      }

      // Write updated testcase.txt
      fs.writeFileSync(testcasePath, newRaw, 'utf8');
      console.log('Updated Actions section in testcase.txt based on Steps.');
      // refresh raw variable to reflect changes
      // (so later logic that reads raw will operate on the updated file if needed)
      // Note: not re-parsing metadata here because metadata didn't change
    }
  } catch (e) {
    console.warn('Could not auto-generate Actions from Steps:', (e as any)?.message || e);
  }

  // === Inspect Utilities/CommonActions.page.ts for available methods ===
  const commonActionsPath = path.join(repoRoot, 'Utilities', 'CommonActions.page.ts');
  let availableCommonMethods: string[] = [];
  try {
    if (fs.existsSync(commonActionsPath)) {
      const ca = fs.readFileSync(commonActionsPath, 'utf8');
      const matches = Array.from(ca.matchAll(/async\s+([a-zA-Z0-9_]+)\s*\(/g));
      availableCommonMethods = matches.map(m => m[1]);
      // Also include non-async helper names if needed (rare)
      const nonAsyncMatches = Array.from(ca.matchAll(/\n\s*([a-zA-Z0-9_]+)\s*\(.*?\)\s*\{/g));
      for (const m of nonAsyncMatches) {
        const name = m[1];
        if (!availableCommonMethods.includes(name)) availableCommonMethods.push(name);
      }
    } else {
      console.warn('Warning: CommonActions file not found at', commonActionsPath);
    }
  } catch (e) {
    console.warn('Could not read CommonActions.page.ts to extract methods:', (e as any)?.message || e);
  }

  // If parsed actions contain names not present in CommonActions, create simple stubs
  const neededActions = Array.from(new Set(parsedActionsFromTestcase.map((a: any) => a.action)));
  const missingActions = neededActions.filter((a: string) => a && !availableCommonMethods.includes(a));
  if (missingActions.length && fs.existsSync(commonActionsPath)) {
    console.log('The following actions are referenced but missing in CommonActions.page.ts:', missingActions.join(', '));
    let caContent = fs.readFileSync(commonActionsPath, 'utf8');
    // Insert stubs before the final closing brace of the class
    const insertPos = caContent.lastIndexOf('\n}');
    let stubText = '';
    for (const a of missingActions) {
      if (a === 'tap') {
        stubText += `\n  async tap(key: string) {\n    // convenience alias -> click (preserves existing behaviour)\n    await this.click(key);\n  }\n`;
      } else if (a === 'click') {
        // already handled typically
      } else if (a === 'sendkeys' || a === 'sendKeys' || a === 'type') {
        stubText += `\n  async setValue(key: string, value: string) {\n    await this.setValue(key, value);\n  }\n`;
      } else {
        // generic stub: try to map to existing primitives where possible
        stubText += `\n  async ${a}(key: string, ...args: any[]) {\n    // Auto-generated stub: try clicking or setting value depending on args\n    if (args && args.length) {\n      try { return await this.setValue(key, String(args[0])); } catch {}\n    }\n    return await this.click(key);\n  }\n`;
      }
    }

    if (stubText) {
      if (insertPos > -1) {
        const newContent = caContent.slice(0, insertPos) + stubText + caContent.slice(insertPos);
        fs.writeFileSync(commonActionsPath, newContent, 'utf8');
        console.log('Appended missing method stubs to CommonActions.page.ts for:', missingActions.join(', '));
        // refresh availableCommonMethods
        const matches2 = Array.from(newContent.matchAll(/async\s+([a-zA-Z0-9_]+)\s*\(/g));
        availableCommonMethods = matches2.map(m => m[1]);
      } else {
        console.warn('Could not locate class end to insert stubs into CommonActions.page.ts');
      }
    }
  }

  // Build a human-readable list for the prompt
  const methodsList = availableCommonMethods.length ? availableCommonMethods.map(m => `- ${m}`).join('\n') : '(no common methods detected)';

  // Build the exact locator names that will be used (from parsed actions)
  const locatorNamesFromActions = Array.from(new Set(parsedActionsFromTestcase.map((a: any) => a.locatorName))).join(', ');

  // Build prompt, pass explicit desired names so LLM uses them
  const prompt = `
I will give you a test case with structured actions and desired filenames/names. Generate three files for a WebDriverIO + Appium + TypeScript framework:

1) A test spec (.spec.ts) to live under test/specs/
2) A Page object (.page.ts) to live under src/pages/
3) A locators JSON to live under src/object-repository/

Constraints:
- Return ONLY a single JSON object (no extra text) with keys:
  specPath, specContent, pagePath, pageContent, locatorsPath, locatorsContent
- Paths should be relative to repo root and use forward slashes
- Content values must be the full file content to write (TypeScript/JSON)
- Use Mocha style test (describe/it)
- Use this exact Page class name: ${pageClassName}
- Use this exact Spec top-level describe name: ${defaultSpecClass}
- Use this exact locators filename (basename): ${locatorsFilename}
- Name the spec file basename: ${specFilename} (place under test/specs/)
- Name the page file basename: ${pageFilename} (place under src/pages/)
- Name the locators file basename: ${locatorsFilename} (place under src/object-repository/)
- **CRITICAL**: The spec MUST import pageObj (import pageObj from '../../src/pages/${pascalCase(pageClassName)}.page';)
- **CRITICAL**: The spec MUST NEVER instantiate new CommonActionsPage() or any other class
- **CRITICAL**: The spec MUST use ONLY 'await pageObj.method(...)' for all test calls
- **CRITICAL**: The page object MUST be: class ${pageClassName} extends CommonActionsPage {} with NO custom methods
- **CRITICAL**: The page object MUST export as: export default new ${pageClassName}();

AVAILABLE COMMONACTIONSPAGE METHODS (use ONLY these in spec):
${methodsList}

EXACT LOCATOR NAMES TO USE IN TEST (from Actions block):
${locatorNamesFromActions || '(none defined)'}

TEST CASE: ${testcaseTitle}

${preconditions ? `PRECONDITIONS:\n${preconditions}\n` : ''}

STRUCTURED TEST ACTIONS (translate these EXACTLY - each line maps to one spec call using ONLY pageObj):
${actionsDescription}

${testSteps ? `STEPS (context only):\n${testSteps}\n` : ''}

EXPECTED RESULTS:
${expectedResults || '(no expected results provided)'}

PLATFORM: ${platformName.charAt(0).toUpperCase() + platformName.slice(1)}

${exampleLocator ? `Example locators JSON (FOLLOW THIS STYLE - ONLY ${platformName} key per entry):\n${exampleLocator}\n` : ''}
${examplePage ? `Example page class:\n${examplePage}\n` : ''}
${exampleSpec ? `Example spec (FOLLOW THIS PATTERN - ONLY uses pageObj, NEVER instantiates anything):\n${exampleSpec}\n` : ''}

================ GENERATION RULES (STRICT - DO NOT VIOLATE) ================

1. **SPEC FILE RULES**:
   - MUST import pageObj (do NOT import CommonActionsPage directly)
   - MUST NEVER use: new CommonActionsPage(), new ${pageClassName}(), or any constructor instantiation
   - MUST ONLY use: await pageObj.click(...), await pageObj.waitUntilVisible(...), etc.
   - Each action from the Actions block becomes ONE await pageObj.method(...) call
   - Locator names MUST match EXACTLY the names from Actions block

2. **PAGE CLASS RULES**:
   - MUST be: class ${pageClassName} extends CommonActionsPage {}
   - MUST have NO custom methods (empty class body except inheritance)
   - MUST export default: export default new ${pageClassName}();

3. **LOCATORS RULES**:
   - MUST use ONLY locator names from Actions block
   - MUST have structure: { "locatorName": { "${platformName}": "xpath" } }
   - MUST NOT include any other keys or metadata

4. **ACTION MAPPING RULES**:
   - click(name) -> await pageObj.click('name');
   - waitUntilVisible(name, timeout) -> await pageObj.waitUntilVisible('name', timeout);
   - setValue(name, value) -> await pageObj.setValue('name', value);
   - isVisible(name) -> const visible = await pageObj.isVisible('name'); expect(visible).toBe(true);
   - Any other action maps to the available method with same name

5. **XPATH RULES** (Android example):
   - For button: //android.widget.Button[@resource-id='android:id/button1']
   - For text field: //android.widget.EditText[@content-desc='email']
   - For any element: //<ElementClass>[@<attribute>='<value>']
   - NEVER use: //*[@...] or generic non-class-qualified xpaths

================ CRITICAL EXAMPLE ================
If Actions block says:
  click(formsIcon)
  waitUntilVisible(formScreen, 20000)
  click(activeButton)

Then spec MUST be:
  describe('MySpec', () => {
    it('should perform actions', async () => {
      await pageObj.click('formsIcon');
      await pageObj.waitUntilVisible('formScreen', 20000);
      await pageObj.click('activeButton');
    });
  });

And locators MUST be:
  {
    "formsIcon": { "android": "//android.widget.FrameLayout[@content-desc='Forms']" },
    "formScreen": { "android": "//android.widget.TextView[@text='Form components']" },
    "activeButton": { "android": "//android.widget.Button[@text='Active']" }
  }

Return ONLY the JSON object now. Do not add explanations or code blocks.
`.trim();

  console.log('Prompt prepared. Length:', prompt.length);

  console.log('Calling LLM to generate files...');
  const llmResult = await callOpenAI(prompt);

  // Validate LLM response keys
  const requiredKeys: (keyof LlmResponse)[] = ['specPath','specContent','pagePath','pageContent','locatorsPath','locatorsContent'];
  for (const k of requiredKeys) {
    if (!llmResult[k] || typeof llmResult[k] !== 'string') {
      throw new Error(`LLM result missing or invalid key: ${k}`);
    }
  }
  console.log('LLM returned all required keys.');

  // Prepare safe basenames from desired names (no hashing)
  const safeSpecBasename = makeSafeBasename(path.basename(specFilename, path.extname(specFilename))) + path.extname(specFilename || '.spec.ts');
  const safePageBasename = makeSafeBasename(path.basename(pageFilename, path.extname(pageFilename))) + path.extname(pageFilename || '.page.ts');
  const safeLocatorsBasename = makeSafeBasename(path.basename(locatorsFilename, path.extname(locatorsFilename))) + path.extname(locatorsFilename || '.json');

  console.log('Sanitized basenames:');
  console.log(' - spec:', safeSpecBasename);
  console.log(' - page:', safePageBasename);
  console.log(' - locators:', safeLocatorsBasename);

  // Determine target directories (we will ignore LLM-provided paths for placement, but keep contents from LLM)
  const specTarget = path.join(repoRoot, 'test', 'specs', safeSpecBasename);
  const pageTarget = path.join(repoRoot, 'src', 'pages', safePageBasename);
  const locatorsTarget = path.join(repoRoot, 'src','object-repository', safeLocatorsBasename);

  // Ensure directories exist
  [specTarget, pageTarget, locatorsTarget].forEach(p => {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    } else {
      console.log(`Directory exists: ${dir}`);
    }
  });

  // Write files
  console.log('Writing files to disk...');
  fs.writeFileSync(specTarget, llmResult.specContent, 'utf8');
  console.log('Wrote spec:', specTarget);
  fs.writeFileSync(pageTarget, llmResult.pageContent, 'utf8');
  console.log('Wrote page:', pageTarget);
  // If we performed a live capture, prefer the captured locators (they are authoritative)
  if (capturedLocatorsPath && fs.existsSync(capturedLocatorsPath)) {
    const capturedContent = fs.readFileSync(capturedLocatorsPath, 'utf8');
    fs.writeFileSync(locatorsTarget, capturedContent, 'utf8');
    console.log('Wrote locators (from captured device):', locatorsTarget);
  } else {
    fs.writeFileSync(locatorsTarget, llmResult.locatorsContent, 'utf8');
    console.log('Wrote locators (from LLM):', locatorsTarget);
  }

  console.log('Files generated:');
  console.log(' -', path.relative(repoRoot, specTarget));
  console.log(' -', path.relative(repoRoot, pageTarget));
  console.log(' -', path.relative(repoRoot, locatorsTarget));
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Error:', err.message || err);
  if ((err as any).stack) console.error((err as any).stack);
  process.exit(1);
});

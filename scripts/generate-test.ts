// scripts/generate-test.ts
import fs from 'fs';
import path from 'path';

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function pascalCase(name: string) {
  return name
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .split(' ')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

const arg = process.argv[2]; // either direct text or a path to a .txt file
if (!arg) {
  console.error('Usage: ts-node scripts/generate-test.ts "Validate Account Screen"  OR pass path to a .txt file');
  process.exit(1);
}

let testCaseName = arg;
if (fs.existsSync(arg) && fs.statSync(arg).isFile()) {
  testCaseName = fs.readFileSync(arg, 'utf8').trim();
}

if (!testCaseName) {
  console.error('Test case name is empty');
  process.exit(1);
}

const slug = slugify(testCaseName); // e.g. validate-account-screen
const classBase = pascalCase(testCaseName); // e.g. ValidateAccountScreen
const pageClassName = `${classBase}Page`;
const specFileName = `${slug}.spec.ts`;
const pageFileName = `${slug}.page.ts`;
const locatorsFileName = `${slug}.json`;

// target directories (relative to project root)
const root = process.cwd();
const specsDir = path.join(root, 'test', 'specs');
const pagesDir = path.join(root, 'src', 'pages');
const repoDir = path.join(root, 'object-repository');

[specsDir, pagesDir, repoDir].forEach(d => fs.mkdirSync(d, { recursive: true }));

// --- templates (adjust to match your project's coding style) ---
const specTemplate = `import { expect } from 'chai';
import ${pageClassName} from '../../src/pages/${pageFileName.replace('.ts','')}';

describe('${testCaseName}', () => {
  const page = new ${pageClassName}();

  it('should validate ${testCaseName}', async () => {
    // TODO: replace with real steps
    await page.open();
    const isVisible = await page.isVisible('some-element-xpath');
    expect(isVisible).to.equal(true);
  });
});
`;

const pageTemplate = `import { browser, $ } from '@wdio/globals';
import locators from '../../object-repository/${locatorsFileName}';

export default class ${pageClassName} {
  async open() {
    // TODO: open the app / deep link or landing screen if required
  }

  // example method using locators JSON
  async clickLogin() {
    const selector = this.getLocator('loginButton');
    const el = await browser.$(selector);
    await el.click();
  }

  getLocator(key: string): string {
    // adapt platform selection if needed
    const platform = (process.env.PLATFORM || 'android').toLowerCase();
    const node = (locators as any)[key];
    if (!node) throw new Error(\`Locator "\${key}" not found in ${locatorsFileName}\`);
    return node[platform] || node['android'] || node['ios'];
  }

  async isVisible(xpath: string, timeout = 5000) {
    try {
      const el = await browser.$(xpath);
      return await el.waitForDisplayed({ timeout, reverse: false });
    } catch {
      return false;
    }
  }
}
`;

const locatorsTemplate = {
  // small starter based on pattern in your loginpage.json; add keys required by the test
  "loginButton": {
    "android": "//android.view.ViewGroup[@content-desc='button-LOGIN']/android.view.ViewGroup",
    "ios": "//XCUIElementTypeButton[@name='LOGIN']"
  },
  "accountHeader": {
    "android": "//android.widget.TextView[@text='Account']",
    "ios": "//XCUIElementTypeStaticText[contains(@name,'Account')]"
  },
  "someField": {
    "android": "//android.widget.EditText[@content-desc='some-field']",
    "ios": "//XCUIElementTypeTextField[@name='someField']"
  }
};

// --- write files ---
fs.writeFileSync(path.join(specsDir, specFileName), specTemplate, 'utf8');
fs.writeFileSync(path.join(pagesDir, pageFileName), pageTemplate, 'utf8');
fs.writeFileSync(path.join(repoDir, locatorsFileName), JSON.stringify(locatorsTemplate, null, 2), 'utf8');

console.log('Generated files:');
console.log(' -', path.join('test','specs', specFileName));
console.log(' -', path.join('src','pages', pageFileName));
console.log(' -', path.join('object-repository', locatorsFileName));

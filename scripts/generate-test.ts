// scripts/generate-test.ts
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

type LlmResponse = {
  specPath: string;
  specContent: string;
  pagePath: string;
  pageContent: string;
  locatorsPath: string;
  locatorsContent: string;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function pascalCase(text: string) {
  return text
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

async function callOpenAI(prompt: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY in env');

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  console.log('Calling the OpenAI API: https://api.openai.com/v1/chat/completions');
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

  const j = await resp.json();
  const content = j.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content from model');

  // Expect model to return valid JSON. Attempt to parse.
  try {
    return JSON.parse(content) as LlmResponse;
  } catch (e) {
    // If the model returns code block or backticks, strip them then parse
    const cleaned = content.replace(/(^```json|```$|^```)/g, '').trim();
    return JSON.parse(cleaned) as LlmResponse;
  }
}

async function main() {
  const repoRoot = process.cwd(); // run from repo root
  const testcasePath = path.join(repoRoot, 'testcase.txt');

  if (!fs.existsSync(testcasePath)) {
    console.error('Please create testcase.txt in repo root with the test case title (e.g. "Validate Account Screen")');
    process.exit(1);
  }

  const testcase = fs.readFileSync(testcasePath, 'utf8').trim();
  if (!testcase) {
    console.error('testcase.txt is empty');
    process.exit(1);
  }

  // Build naming
  const baseSlug = slugify(testcase);                 // validate-account-screen
  const className = pascalCase(testcase) + 'Page';    // ValidateAccountScreenPage
  const specClassName = pascalCase(testcase) + 'Spec';// ValidateAccountScreenSpec

  // Try to include example files if present to help the LLM follow style
  const exampleLocatorPath = path.join(repoRoot, 'object-repository', 'loginpage.json');
  const examplePagePath = path.join(repoRoot, 'src', 'pages', 'login.page.ts');
  const exampleSpecPath = path.join(repoRoot, 'test', 'specs', 'login.spec.ts');

  const exampleLocator = fs.existsSync(exampleLocatorPath) ? fs.readFileSync(exampleLocatorPath, 'utf8') : null;
  const examplePage = fs.existsSync(examplePagePath) ? fs.readFileSync(examplePagePath, 'utf8') : null;
  const exampleSpec = fs.existsSync(exampleSpecPath) ? fs.readFileSync(exampleSpecPath, 'utf8') : null;

  // Compose a clear instruction prompt for the LLM. We ask for EXACT JSON
  const prompt = `
I will give you a single test-case title. Generate three files for a WebDriverIO + Appium + TypeScript framework:

1) A test spec (.spec.ts) to live under test/specs/
2) A Page object (.page.ts) to live under src/pages/
3) A locators JSON to live under object-repository/

Constraints:
- Return ONLY a single JSON object (no extra text) with these keys:
  specPath, specContent, pagePath, pageContent, locatorsPath, locatorsContent
- Paths should be relative to the repo root and use forward slashes
- Content values must be the full file content to write (TypeScript/JSON)
- Use Mocha style test (describe/it) and the project's typical patterns (try to follow examples if provided)
- Make the page class named: ${className}
- Name spec file using the testcase slug: ${baseSlug}.spec.ts
- Name locators file using the testcase slug: ${baseSlug}.json

Testcase title:
${testcase}

${exampleLocator ? `Example locators (for style):\n${exampleLocator}\n` : ''}
${examplePage ? `Example page (for style):\n${examplePage}\n` : ''}
${exampleSpec ? `Example spec (for style):\n${exampleSpec}\n` : ''}

Return the JSON now.
  `.trim();

  console.log('Calling LLM to generate files...');
  const llmResult = await callOpenAI(prompt);

  // Paths returned by model (relative)
  const specPath = path.join(repoRoot, llmResult.specPath);
  const pagePath = path.join(repoRoot, llmResult.pagePath);
  const locatorsPath = path.join(repoRoot, llmResult.locatorsPath);

  // Ensure folders
  [specPath, pagePath, locatorsPath].forEach(p => {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Write files
  fs.writeFileSync(specPath, llmResult.specContent, 'utf8');
  fs.writeFileSync(pagePath, llmResult.pageContent, 'utf8');
  fs.writeFileSync(locatorsPath, llmResult.locatorsContent, 'utf8');

  console.log('Files generated:');
  console.log(' -', path.relative(repoRoot, specPath));
  console.log(' -', path.relative(repoRoot, pagePath));
  console.log(' -', path.relative(repoRoot, locatorsPath));
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

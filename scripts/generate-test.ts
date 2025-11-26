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

/** Parse keys from testcase.txt (flexible). Returns map of key->value */
function parseMetadataFromTestcase(content: string) {
  const lines = (content || '').split(/\r?\n/);
  const meta: Record<string, string> = {};
  // search first 40 lines for key: value pairs
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z0-9 _\-]+)\s*[:=]\s*(.+)$/);
    if (m) {
      const key = m[1].trim().toLowerCase();
      const val = m[2].trim();
      meta[key] = val;
    }
  }
  return meta;
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

  const j = await resp.json();
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
  const exampleLocatorPath = path.join(repoRoot,'src', 'object-repository', 'loginpage.json');
  const examplePagePath = path.join(repoRoot, 'src', 'pages', 'login.page.ts');
  const exampleSpecPath = path.join(repoRoot, 'test', 'specs', 'login.spec.ts');

  const exampleLocator = fs.existsSync(exampleLocatorPath) ? fs.readFileSync(exampleLocatorPath, 'utf8') : null;
  const examplePage = fs.existsSync(examplePagePath) ? fs.readFileSync(examplePagePath, 'utf8') : null;
  const exampleSpec = fs.existsSync(exampleSpecPath) ? fs.readFileSync(exampleSpecPath, 'utf8') : null;

  if (exampleLocator) console.log('Using example locators for prompt (loginpage.json)');
  if (examplePage) console.log('Using example page for prompt (login.page.ts)');
  if (exampleSpec) console.log('Using example spec for prompt (login.spec.ts)');

  // Build prompt, pass explicit desired names so LLM uses them
  const prompt = `
I will give you a single test-case title and desired filenames/names. Generate three files for a WebDriverIO + Appium + TypeScript framework:

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

Testcase title:
${testcaseTitle}

${exampleLocator ? `Example locators (for style):\n${exampleLocator}\n` : ''}
${examplePage ? `Example page (for style):\n${examplePage}\n` : ''}
${exampleSpec ? `Example spec (for style):\n${exampleSpec}\n` : ''}

Return the JSON now.
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
  fs.writeFileSync(locatorsTarget, llmResult.locatorsContent, 'utf8');
  console.log('Wrote locators:', locatorsTarget);

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

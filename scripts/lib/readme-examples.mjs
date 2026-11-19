// Run the TypeScript and JavaScript examples in a Markdown file against an
// installed package, offline. Each block is typechecked and compiled with the
// repository's TypeScript, then run with fetch answered from recorded OSV.dev
// responses (scripts/fixtures/osv.json). A line such as
//   console.log(report.verdict); // fail
// must print what its comment says, in order. A block after
// <!-- illustrative --> is skipped; other languages are never run.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXTURES = join(ROOT, 'scripts', 'fixtures', 'osv.json');
const BLOCK = /(<!--\s*illustrative\s*-->\s*)?^```(ts|js)\n([\s\S]*?)^```$/gm;
const EXPECT = /^\s*console\.log\(.*\);\s*\/\/ ?(.*)$/;
// Preloaded before each example: fetch answers OSV.dev queries from the
// fixtures and refuses everything else
const OFFLINE = `import { readFileSync } from 'node:fs';
const fixtures = JSON.parse(readFileSync(${JSON.stringify(FIXTURES)}, 'utf8'));
globalThis.fetch = async (url, init) => {
  if (String(url) !== 'https://api.osv.dev/v1/query') {
    throw new Error(\`README examples run offline: no fixture for \${url}\`);
  }
  const { package: p, version } = JSON.parse(init.body);
  const key = \`\${p.ecosystem}/\${p.name}@\${version}\`;
  if (!(key in fixtures)) {
    throw new Error(\`No recorded OSV.dev answer for \${key} in scripts/fixtures/osv.json\`);
  }
  return new Response(JSON.stringify(fixtures[key]), {
    headers: { 'content-type': 'application/json' }
  });
};
`;

/** The runnable examples in a Markdown file, with what each must print. */
export const examples = (markdown) =>
  [...markdown.matchAll(BLOCK)]
    .filter(([, illustrative]) => !illustrative)
    .map(([, , language, code]) => ({
      language,
      code,
      expected: code
        .split('\n')
        .map((line) => EXPECT.exec(line)?.[1])
        .filter((value) => value !== undefined)
    }));

/**
 * Run every runnable example in `markdown` from the project in `app`, which
 * has the package installed. Returns the problems found, empty when all pass.
 */
export const checkExamples = (markdown, app) => {
  const problems = [];
  const found = examples(markdown);

  writeFileSync(join(app, 'offline.mjs'), OFFLINE);

  for (const [index, { language, code, expected }] of found.entries()) {
    const name = `example-${index + 1}`;
    const label = `example ${index + 1} (${language})`;

    writeFileSync(join(app, `${name}.m${language}`), code);

    // TypeScript checks JavaScript examples too, against the package's types
    const tsc = spawnSync(
      process.execPath,
      [
        join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'),
        `${name}.m${language}`,
        '--outDir',
        'out',
        '--module',
        'nodenext',
        '--target',
        'es2023',
        '--strict',
        '--allowJs',
        '--checkJs',
        '--skipLibCheck',
        '--noEmitOnError',
        '--typeRoots',
        join(ROOT, 'node_modules', '@types'),
        '--types',
        'node'
      ],
      { cwd: app, encoding: 'utf8' }
    );

    if (tsc.status !== 0) {
      problems.push(`${label} does not compile:\n${tsc.stdout}${tsc.stderr}`);
      continue;
    }

    const run = spawnSync(
      process.execPath,
      ['--import', './offline.mjs', join('out', `${name}.mjs`)],
      { cwd: app, encoding: 'utf8', timeout: 30_000 }
    );

    if (run.status !== 0) {
      problems.push(`${label} failed:\n${run.stderr}`);
      continue;
    }

    const printed = run.stdout.replace(/\n$/, '').split('\n');

    if (
      expected.length > 0 &&
      JSON.stringify(printed) !== JSON.stringify(expected)
    ) {
      problems.push(
        `${label} printed what its comments don't say:\n  printed:  ${JSON.stringify(printed)}\n  expected: ${JSON.stringify(expected)}`
      );
    }
  }

  if (found.length === 0) problems.push('no runnable examples found');

  return problems;
};

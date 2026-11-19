import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after, describe } from 'node:test';

import { checkExamples, examples } from '../lib/readme-examples.mjs';

const app = mkdtempSync(join(tmpdir(), 'readme-examples-'));
const fake = join(app, 'node_modules', 'evidence-report-mcp');

after(() => rmSync(app, { recursive: true, force: true }));

// A stand-in for the package: verify asks OSV.dev, through fetch, and counts
mkdirSync(fake, { recursive: true });
writeFileSync(
  join(fake, 'package.json'),
  JSON.stringify({
    name: 'evidence-report-mcp',
    type: 'module',
    exports: { '.': { types: './index.d.ts', default: './index.js' } }
  })
);
writeFileSync(
  join(fake, 'index.js'),
  `export const verify = async ({ ecosystem, name, version }) => {
  const response = await fetch('https://api.osv.dev/v1/query', {
    method: 'POST',
    body: JSON.stringify({ package: { ecosystem, name }, version })
  });
  const { vulns = [] } = await response.json();
  return { verdict: vulns.length ? 'fail' : 'pass', findings: vulns.length };
};
`
);
writeFileSync(
  join(fake, 'index.d.ts'),
  `export declare const verify: (target: { ecosystem: string; name: string; version: string }) => Promise<{ verdict: 'pass' | 'fail'; findings: number }>;
`
);

/** A README with one TypeScript example that verifies a package. */
const readme = (version, prints) => `# Example

\`\`\`ts
import { verify } from 'evidence-report-mcp';

const report = await verify({ ecosystem: 'npm', name: 'lodash', version: ${version} });

${prints}
\`\`\`
`;

describe('scripts/lib/readme-examples.mjs', () => {
  test('passes an example that prints what its comments say', () => {
    assert.deepEqual(
      checkExamples(
        readme(
          "'4.17.20'",
          'console.log(report.verdict); // fail\nconsole.log(report.findings); // 4'
        ),
        app
      ),
      []
    );
  });

  const broken = {
    'a wrong comment': [
      readme("'4.17.20'", 'console.log(report.findings); // 3'),
      /printed what its comments don't say/
    ],
    'a type error': [
      readme('4.17', 'console.log(report.verdict); // fail'),
      /does not compile[\s\S]*TS2322/
    ],
    'a package with no recorded OSV.dev answer': [
      readme("'1.0.0'", 'console.log(report.verdict); // pass'),
      /failed:[\s\S]*No recorded OSV\.dev answer for npm\/lodash@1\.0\.0/
    ],
    'a request to anywhere else': [
      "```js\nawait fetch('https://example.com');\n```\n",
      /failed:[\s\S]*run offline: no fixture for https:\/\/example\.com/
    ],
    'no runnable example': [
      '```sh\nnpx evidence-report-mcp\n```\n',
      /no runnable examples found/
    ]
  };

  for (const [name, [markdown, problem]] of Object.entries(broken)) {
    test(`fails on ${name}`, () => {
      const problems = checkExamples(markdown, app);

      assert.equal(problems.length, 1, problems.join('\n'));
      assert.match(problems[0], problem);
    });
  }

  test('skips a block marked illustrative, and other languages', () => {
    const found = examples(
      "<!-- illustrative -->\n\n```ts\nthrow new Error('never run');\n```\n\n```json\n{}\n```\n\n```js\nconsole.log(1); // 1\n```\n"
    );

    assert.deepEqual(
      found.map(({ language, expected }) => ({ language, expected })),
      [{ language: 'js', expected: ['1'] }]
    );
  });
});

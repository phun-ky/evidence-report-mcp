// Check what npm would publish: pack the package, check the tarball holds the
// files package.json points at, its LICENSE, README and CHANGELOG, and no
// tests, lint it with publint and @arethetypeswrong/cli, then install it in an
// empty project, check every source map resolves, import every export, require
// it, run the bin through an MCP initialize and tools/list over stdio, and run
// the README's examples against it (scripts/lib/readme-examples.mjs). It
// also checks the dependency rule: the build imports only declared
// dependencies, runtime dependencies use caret ranges and devDependencies
// exact versions. Adapted from angle. Run after `npm run build`.
import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import { checkExamples } from './lib/readme-examples.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BIN = join(ROOT, 'node_modules', '.bin');
/** Run a linter; return its output if it fails. */
const lint = (command, args) => {
  try {
    execFileSync(join(BIN, command), args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    return undefined;
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}`.trim();
  }
};
// A bare package name after from, import( or require(
const IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"'.][^"']*)["']/g;
/** Every file under dir with the given ending. */
const filesIn = (dir, ending) =>
  readdirSync(dir, { recursive: true })
    .filter((file) => file.endsWith(ending))
    .map((file) => join(dir, file));
const npm = (args, cwd) =>
  execFileSync('npm', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  });
/** Every file path a package.json points at, without the leading ./ */
const entryPoints = (pkg) => {
  const paths = [];
  const collect = (value) => {
    if (typeof value === 'string') paths.push(value);
    else if (value && typeof value === 'object')
      Object.values(value).forEach(collect);
  };

  collect(pkg.exports);
  collect(pkg.main);
  collect(pkg.types);
  collect(pkg.bin);

  // Subpath patterns such as ./dist/* are not files
  return paths
    .filter((path) => !path.includes('*'))
    .map((path) => path.replace(/^\.\//, ''));
};
/**
 * Start the bin, send each message as a line of JSON-RPC, and return the
 * responses by id. Fails after 15 seconds.
 */
const talkTo = (bin, cwd, messages) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin], {
      cwd,
      stdio: ['pipe', 'pipe', 'inherit']
    });
    const waiting = new Set(
      messages.filter((m) => m.id !== undefined).map((m) => m.id)
    );
    const responses = new Map();
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`no answer to ${[...waiting].join(', ')} in 15 s`));
    }, 15_000);

    child.on('error', reject);
    child.on('exit', (code) => {
      clearTimeout(timer);

      if (waiting.size)
        reject(new Error(`exited with ${code} before answering`));
      else resolve(responses);
    });
    createInterface({ input: child.stdout }).on('line', (line) => {
      const message = JSON.parse(line);

      responses.set(message.id, message);
      waiting.delete(message.id);

      if (!waiting.size) child.stdin.end();
    });

    for (const message of messages)
      child.stdin.write(`${JSON.stringify(message)}\n`);
  });
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const work = mkdtempSync(join(tmpdir(), 'evidence-report-mcp-pack-'));
const problems = [];

try {
  const output = JSON.parse(
    npm(
      ['pack', '--json', '--ignore-scripts', '--pack-destination', work],
      ROOT
    )
  );
  // An array in npm 11, an object keyed by package name in npm 12
  const packed = Array.isArray(output) ? output[0] : Object.values(output)[0];
  const files = new Set(packed.files.map((file) => file.path));

  // npm adds LICENSE and README.md on its own; CHANGELOG.md once it exists
  for (const path of new Set([
    ...entryPoints(pkg),
    'LICENSE',
    'README.md',
    ...(existsSync(join(ROOT, 'CHANGELOG.md')) ? ['CHANGELOG.md'] : [])
  ])) {
    if (!files.has(path)) problems.push(`${path} is not in the tarball`);
  }

  for (const path of files) {
    if (/(^|\/)(__tests__|test)\/|\.spec\.|\.tsbuildinfo$/.test(path)) {
      problems.push(`${path} should not be published`);
    }
  }

  const tarball = join(work, packed.filename);
  const types = lint('attw', ['--profile', 'esm-only', tarball]);
  const publint = lint('publint', ['--strict', tarball]);

  if (types) problems.push(`@arethetypeswrong/cli:\n${types}`);

  if (publint) problems.push(`publint:\n${publint}`);

  console.log(
    `${pkg.name}@${pkg.version}: ${files.size} files, ${packed.size} bytes`
  );

  if (problems.length === 0) {
    const app = join(work, 'app');
    const installed = join(app, 'node_modules', pkg.name);

    mkdirSync(app);
    writeFileSync(
      join(app, 'package.json'),
      '{ "name": "app", "private": true }\n'
    );
    npm(
      [
        'install',
        '--no-audit',
        '--no-fund',
        '--ignore-scripts',
        // The dependencies come from the registry, preferably the cache
        '--prefer-offline',
        tarball
      ],
      app
    );

    // Every package the build imports must be a dependency
    const declared = new Set(Object.keys(pkg.dependencies ?? {}));

    for (const file of filesIn(join(installed, 'dist'), '.js')) {
      const code = readFileSync(file, 'utf8');
      const imported = [...code.matchAll(IMPORT)]
        .map(([, specifier]) => specifier)
        .filter((specifier) => !specifier.startsWith('node:'))
        .map((specifier) =>
          specifier
            .split('/')
            .slice(0, specifier.startsWith('@') ? 2 : 1)
            .join('/')
        );

      for (const name of new Set(imported)) {
        if (!declared.has(name))
          problems.push(
            `${relative(installed, file)} imports ${name}, which isn't in dependencies`
          );
      }
    }

    // Our own sources must be published next to the maps
    for (const map of filesIn(installed, '.map')) {
      const { sources } = JSON.parse(readFileSync(map, 'utf8'));

      for (const source of sources) {
        if (!existsSync(join(dirname(map), source)))
          problems.push(
            `${relative(installed, map)} points at ${source}, which isn't published`
          );
      }
    }

    const name = JSON.stringify(pkg.name);
    const expect = `
      const check = (how, m) => {
        for (const fn of ['verify', 'aggregate', 'createServer'])
          if (typeof m[fn] !== 'function') throw new Error(how + ': ' + fn + ' is ' + typeof m[fn]);
        console.log(how + ': verify, aggregate and createServer');
      };
    `;
    const smokes = {
      'ES module import': [
        '--input-type=module',
        '-e',
        `${expect} check('import', await import(${name}));`
      ],
      // require(esm), unflagged from Node 22.12.0 (engines)
      'CommonJS require': [
        '--input-type=commonjs',
        '--no-warnings',
        '-e',
        `${expect} check('require', require(${name}));`
      ],
      'package.json export': [
        '--input-type=module',
        '-e',
        `const { default: p } = await import(${JSON.stringify(`${pkg.name}/package.json`)}, { with: { type: 'json' } }); if (p.name !== ${name}) throw new Error(p.name); console.log('package.json: ' + p.name + '@' + p.version);`
      ]
    };

    for (const [how, args] of Object.entries(smokes)) {
      try {
        execFileSync(process.execPath, args, { cwd: app, stdio: 'inherit' });
      } catch {
        problems.push(`${how} of the installed tarball failed`);
      }
    }

    // The bin, as an MCP client starts it
    for (const [command, target] of Object.entries(pkg.bin ?? {})) {
      const bin = join(installed, target);

      if (!readFileSync(bin, 'utf8').startsWith('#!/usr/bin/env node\n')) {
        problems.push(`bin ${command} (${target}) has no node shebang`);
        continue;
      }

      try {
        const responses = await talkTo(
          join(app, 'node_modules', '.bin', command),
          app,
          [
            {
              jsonrpc: '2.0',
              id: 1,
              method: 'initialize',
              params: {
                protocolVersion: '2025-06-18',
                capabilities: {},
                clientInfo: { name: 'check-pack', version: '0.0.0' }
              }
            },
            { jsonrpc: '2.0', method: 'notifications/initialized' },
            { jsonrpc: '2.0', id: 2, method: 'tools/list' }
          ]
        );
        const server = responses.get(1)?.result?.serverInfo;
        const tools = responses.get(2)?.result?.tools?.map((t) => t.name);

        if (server?.name !== pkg.name || server?.version !== pkg.version)
          throw new Error(`initialize gave ${JSON.stringify(server)}`);

        if (tools?.join() !== 'verify')
          throw new Error(`tools/list gave ${JSON.stringify(tools)}`);

        console.log(
          `bin ${command}: ${server.name}@${server.version}, tools ${tools.join(', ')}`
        );
      } catch (error) {
        problems.push(`bin ${command} failed over stdio: ${error.message}`);
      }
    }

    // The README's examples, as published, against the installed package
    const readme = checkExamples(
      readFileSync(join(installed, 'README.md'), 'utf8'),
      app
    );

    problems.push(...readme.map((problem) => `README.md: ${problem}`));

    if (readme.length === 0) console.log('README.md: examples run as shown');
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

// The dependency rule: caret ranges reach consumers, exact versions pin development
for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
  if (!/^\^\d+\.\d+\.\d+$/.test(range))
    problems.push(`dependency ${name}@${range} is not a caret range`);
}

for (const [name, range] of Object.entries(pkg.devDependencies ?? {})) {
  if (!/^\d+\.\d+\.\d+$/.test(range))
    problems.push(`devDependency ${name}@${range} is not an exact version`);
}

if (problems.length > 0) {
  console.error('\nThe package would not publish correctly:\n');

  for (const problem of problems) console.error(`  - ${problem}`);

  console.error(
    '\nCheck "files" in package.json, and run npm run build first.'
  );
  process.exit(1);
}

console.log(
  `\n${pkg.name} packs, installs, and works from every entry point and its bin.`
);

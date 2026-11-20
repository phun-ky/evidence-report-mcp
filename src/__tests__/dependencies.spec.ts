import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readDependencies } from '../dependencies.js';

const read = (doc: unknown) => readDependencies(JSON.stringify(doc));
const lock = (lockfileVersion: number, packages: Record<string, unknown>) => ({
  name: 'app',
  lockfileVersion,
  packages: { '': { name: 'app', version: '1.0.0' }, ...packages }
});
const registry = (name: string, version: string) => ({
  version,
  resolved: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`
});

test('readDependencies: package-lock v3, nested and scoped packages, duplicates once', () => {
  const r = read(
    lock(3, {
      'node_modules/lodash': registry('lodash', '4.17.20'),
      'node_modules/@scope/pkg': registry('pkg', '1.0.0'),
      'node_modules/a/node_modules/lodash': registry('lodash', '4.17.20'),
      'node_modules/a/node_modules/lodash-es': registry('lodash-es', '4.0.0'),
      'node_modules/bundled': { version: '2.0.0', inBundle: true }
    })
  );

  assert.deepEqual(r.unresolved, []);
  assert.deepEqual(
    r.resolved.map((d) => d.label),
    ['lodash@4.17.20', '@scope/pkg@1.0.0', 'lodash-es@4.0.0', 'bundled@2.0.0']
  );
  assert.deepEqual(r.resolved[1]!.query, {
    package: { name: '@scope/pkg', ecosystem: 'npm' },
    version: '1.0.0'
  });
});

test('readDependencies: package-lock v2 reads packages, and an alias by its real name', () => {
  const r = read({
    ...lock(2, {
      'node_modules/alias': { ...registry('real', '1.0.0'), name: 'real' }
    }),
    dependencies: { alias: { version: 'npm:real@1.0.0' } }
  });

  assert.deepEqual(
    r.resolved.map((d) => d.label),
    ['real@1.0.0']
  );
});

test('readDependencies: workspaces skipped; links, git, file and versionless entries unresolved', () => {
  const r = read(
    lock(3, {
      'packages/a': { name: 'a', version: '0.0.1' },
      'node_modules/a': { resolved: 'packages/a', link: true },
      'node_modules/g': {
        version: '1.0.0',
        resolved: 'git+ssh://git@github.com/x/g.git#abc'
      },
      'node_modules/f': { version: '1.0.0', resolved: 'file:../f' },
      'node_modules/v': {}
    })
  );

  assert.deepEqual(r.resolved, []);
  assert.deepEqual(r.unresolved, [
    { label: 'a', why: 'link to packages/a' },
    {
      label: 'g@1.0.0',
      why: 'not from a registry: git+ssh://git@github.com/x/g.git#abc'
    },
    { label: 'f@1.0.0', why: 'not from a registry: file:../f' },
    { label: 'v', why: 'no version' }
  ]);
});

test('readDependencies: links to workspace folders are the project itself; other links stay unresolved', () => {
  const ws = (workspaces: unknown) =>
    read({
      lockfileVersion: 3,
      packages: {
        '': { name: 'mono', workspaces },
        'packages/a': { name: 'a', version: '1.0.0' },
        'apps/web/ui': { name: 'ui', version: '1.0.0' },
        'node_modules/a': { resolved: 'packages/a', link: true },
        'node_modules/ui': { resolved: 'apps/web/ui', link: true },
        'node_modules/x': { resolved: '../x', link: true },
        'node_modules/ms': registry('ms', '2.1.3')
      }
    });
  const both = ws(['./packages/*', 'apps/**/']);

  assert.deepEqual(
    both.resolved.map((d) => d.label),
    ['ms@2.1.3']
  );
  assert.deepEqual(both.unresolved, [{ label: 'x', why: 'link to ../x' }]);

  // One star stays inside one folder: apps/web/ui is not apps/*
  assert.deepEqual(
    ws(['packages/*', 'apps/*']).unresolved.map((u) => u.label),
    ['ui', 'x']
  );

  // Negated patterns are not read, so nothing is skipped by them (fail closed)
  for (const patterns of [
    undefined,
    { packages: ['packages/*'] },
    ['!packages/a']
  ])
    assert.deepEqual(
      ws(patterns).unresolved.map((u) => u.label),
      ['a', 'ui', 'x'],
      JSON.stringify(patterns)
    );
});

test('readDependencies: package-lock v1 has no packages -> throws, naming the fix', () => {
  assert.throws(
    () => read({ lockfileVersion: 1, dependencies: {} }),
    /lockfileVersion 1.*npm 7 or later/
  );
});

for (const specVersion of ['1.5', '1.6']) {
  test(`readDependencies: CycloneDX ${specVersion}, nested components, by purl`, () => {
    const r = read({
      bomFormat: 'CycloneDX',
      specVersion,
      metadata: { component: { name: 'app', purl: 'pkg:npm/app@1.0.0' } },
      components: [
        {
          name: 'pkg',
          version: '1.0.0',
          purl: 'pkg:npm/%40scope/pkg@1.0.0',
          components: [{ name: 'requests', purl: 'pkg:pypi/requests@2.31.0' }]
        },
        { name: 'dup', purl: 'pkg:npm/%40scope/pkg@1.0.0' },
        { name: 'nopurl', version: '1.0.0' },
        { name: 'noversion', purl: 'pkg:npm/noversion?arch=x64' },
        { type: 'file' }
      ]
    });

    assert.deepEqual(
      r.resolved.map((d) => d.query),
      [
        { package: { purl: 'pkg:npm/%40scope/pkg@1.0.0' } },
        { package: { purl: 'pkg:pypi/requests@2.31.0' } }
      ]
    );
    assert.deepEqual(r.unresolved, [
      { label: 'nopurl@1.0.0', why: 'no purl' },
      { label: 'pkg:npm/noversion?arch=x64', why: 'no version in the purl' },
      { label: '(unnamed)', why: 'no purl' }
    ]);
  });
}

test('readDependencies: a CycloneDX file without components has nothing to look up', () => {
  assert.deepEqual(read({ bomFormat: 'CycloneDX', specVersion: '1.6' }), {
    resolved: [],
    unresolved: []
  });
});

test('readDependencies: any other JSON, or not JSON -> throws', () => {
  for (const doc of [{ name: 'x' }, [1], 5, null])
    assert.throws(() => read(doc), /Not a package-lock.json or a CycloneDX/);

  assert.throws(() => readDependencies('{'), SyntaxError);
});

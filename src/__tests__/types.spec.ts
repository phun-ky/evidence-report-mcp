import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TargetSchema } from '../types.js';

const ok = (target: unknown) =>
  assert.equal(TargetSchema.safeParse(target).success, true);
const rejected = (target: unknown) =>
  assert.equal(TargetSchema.safeParse(target).success, false);
/** An object nested `n` deep: { a: { a: ... 1 } }. */
const nested = (n: number): unknown => {
  let v: unknown = 1;

  for (let i = 0; i < n; i++) v = { a: v };

  return v;
};
const pkg = (name: string, version = '1.0.0') => ({
  kind: 'package',
  ecosystem: 'npm',
  name,
  version
});
const dataset = (schema: unknown, records: unknown[] = [{}]) => ({
  kind: 'dataset',
  schema,
  records
});
const claim = (text: string, sources: string[] = []) => ({
  kind: 'claim',
  text,
  sources
});

test('limits: package name and version at most 256 characters', () => {
  ok(pkg('a'.repeat(256), '1'.repeat(256)));
  rejected(pkg('a'.repeat(257)));
  rejected(pkg('a', '1'.repeat(257)));
});

test('limits: file path at most 4096 characters', () => {
  ok({ kind: 'file', path: 'a'.repeat(4096) });
  rejected({ kind: 'file', path: 'a'.repeat(4097) });
});

test('limits: claim text at most 10 000 characters', () => {
  ok(claim('a'.repeat(10_000)));
  rejected(claim('a'.repeat(10_001)));
});

test('limits: at most 20 claim sources, each at most 2048 characters', () => {
  const url = (i: number) => `https://s${i}.example/`;

  ok(
    claim(
      'x',
      Array.from({ length: 20 }, (_, i) => url(i))
    )
  );
  rejected(
    claim(
      'x',
      Array.from({ length: 21 }, (_, i) => url(i))
    )
  );

  const long = 'https://a.example/' + 'p'.repeat(2048 - 18);

  ok(claim('x', [long]));
  rejected(claim('x', [long + 'p']));
});

test('limits: assetId at most 256 characters', () => {
  ok({ ...dataset({}), assetId: 'a'.repeat(256) });
  rejected({ ...dataset({}), assetId: 'a'.repeat(257) });
});

test('limits: schema nests at most 32 deep', () => {
  ok(dataset(nested(32)));
  rejected(dataset(nested(33)));
});

test('limits: a schema nested 10 000 deep is rejected without a stack overflow', () => {
  rejected(dataset(nested(10_000)));
  rejected(dataset({}, [nested(10_000)]));
});

test('limits: schema at most 100 KB as JSON', () => {
  // {"d":"…"} is 8 bytes around the string
  ok(dataset({ d: 'a'.repeat(100 * 1024 - 8) }));
  rejected(dataset({ d: 'a'.repeat(100 * 1024 - 7) }));
});

test('limits: each record nests at most 32 deep', () => {
  ok(dataset({}, [nested(32), nested(32)]));
  rejected(dataset({}, [nested(1), nested(33)]));
});

test('limits: records at most 1 MB as JSON, and at most 1000 of them', () => {
  // ["…"] is 4 bytes around the string
  ok(dataset({}, ['a'.repeat(1024 * 1024 - 4)]));
  rejected(dataset({}, ['a'.repeat(1024 * 1024 - 3)]));
  ok(
    dataset(
      {},
      Array.from({ length: 1000 }, () => ({}))
    )
  );
  rejected(
    dataset(
      {},
      Array.from({ length: 1001 }, () => ({}))
    )
  );
});

test('dependencies: exactly one of path or content, content at most 10 MB', () => {
  ok({ kind: 'dependencies', path: 'package-lock.json' });
  ok({ kind: 'dependencies', content: 'a'.repeat(10 * 1024 * 1024) });
  rejected({ kind: 'dependencies' });
  rejected({ kind: 'dependencies', path: 'a', content: '{}' });
  rejected({ kind: 'dependencies', content: 'a'.repeat(10 * 1024 * 1024 + 1) });
  rejected({ kind: 'dependencies', path: 'a'.repeat(4097) });
});

test('claim sources: a URL, or a URL and a quote of 1 to 1000 characters', () => {
  const url = 'https://a.example/';

  ok(claim('x', [url, { url, quote: 'q' } as never]));
  ok(claim('x', [{ url, quote: 'q'.repeat(1000) } as never]));
  rejected(claim('x', [{ url, quote: '' } as never]));
  rejected(claim('x', [{ url, quote: 'q'.repeat(1001) } as never]));
  rejected(claim('x', [{ url } as never]));
  rejected(claim('x', [{ url: 'not a url', quote: 'q' } as never]));
});

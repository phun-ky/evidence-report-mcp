import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';

import {
  checkC2pa,
  checkCorroboration,
  checkObservability,
  checkOsv,
  checkSchema,
  plan
} from '../checkers.js';
import type { Target } from '../types.js';

// No network in tests: any fetch not explicitly mocked fails the test loudly.
beforeEach(() => {
  mock.method(globalThis, 'fetch', async () => {
    throw new Error('unexpected network call in test');
  });
});
afterEach(() => mock.restoreAll());

const mockFetch = (
  impl: (url: string, init?: RequestInit) => Promise<Response>
) => mock.method(globalThis, 'fetch', impl);
const pkg = {
  kind: 'package',
  ecosystem: 'npm',
  name: 'lodash',
  version: '4.17.20'
} as const;
const dataset = (schema: Record<string, unknown>, records: unknown[]) =>
  checkSchema({ kind: 'dataset', schema, records });

/* ---------------- schema ---------------- */

test('checkSchema: conforming records -> pass', async () => {
  const r = await dataset(
    { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] },
    [{ n: 1 }, { n: 2 }]
  );

  assert.equal(r.status, 'pass');
  assert.equal(r.kind, 'deterministic');
  assert.deepEqual(r.findings, []);
});

test('checkSchema: violations -> fail with one finding per error, pointing at the record', async () => {
  const r = await dataset(
    { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] },
    [{ n: 1 }, { n: 'one' }, {}]
  );

  assert.equal(r.status, 'fail');
  assert.deepEqual(
    r.findings.map((f) => f.ref),
    ['/1/n', '/2']
  );
});

test('checkSchema: invalid schema -> error, not crash or pass', async () => {
  const r = await dataset({ type: 'not-a-type' }, [{}]);

  assert.equal(r.status, 'error');
  assert.ok(r.reason);
  assert.deepEqual(r.findings, []);
});

test('checkSchema: misspelled keyword -> error (strict), not a silent pass', async () => {
  const r = await dataset({ type: 'object', requird: ['n'] }, [{}]);

  assert.equal(r.status, 'error');
  assert.match(r.reason ?? '', /requird/);
});

test('checkSchema: x-* extension keys are allowed as annotations', async () => {
  const r = await dataset(
    { type: 'object', 'x-owner': 'team-a', properties: { n: { 'x-note': 1 } } },
    [{ n: 1 }]
  );

  assert.equal(r.status, 'pass');
});

test('checkSchema: the same $id can be checked twice', async () => {
  const schema = { $id: 'https://example.test/s', type: 'object' };

  assert.equal((await dataset(schema, [{}])).status, 'pass');
  assert.equal((await dataset(schema, [{}])).status, 'pass');
});

/* ---------------- x-unit ---------------- */

const impulse = {
  type: 'object',
  properties: { impulse: { 'x-unit': 'N*s' } }
};

test('x-unit: matching unit passes, with separator spelling normalised', async () => {
  const r = await dataset(impulse, [
    { impulse: { value: 4.45, unit: 'N*s' } },
    { impulse: { value: 4.45, unit: 'N·s' } },
    { impulse: { value: 4.45, unit: 'N s' } }
  ]);

  assert.equal(r.status, 'pass');
});

test('x-unit: Mars Climate Orbiter (lbf·s where N·s is required) -> high finding', async () => {
  const r = await dataset(impulse, [{ impulse: { value: 1, unit: 'lbf·s' } }]);

  assert.equal(r.status, 'fail');
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0]!.severity, 'high');
  assert.equal(r.findings[0]!.ref, '/0/impulse');
  assert.match(
    r.findings[0]!.message,
    /"lbf·s" does not match required "N\*s"/
  );
});

test("x-unit: bare number or missing unit -> fail, unit can't be checked", async () => {
  const r = await dataset(impulse, [
    { impulse: 4.45 },
    { impulse: { value: 4.45 } }
  ]);

  assert.equal(r.status, 'fail');
  assert.equal(r.findings.length, 2);
  for (const f of r.findings) assert.match(f.message, /no declared unit/);
});

test('x-unit: units are case-sensitive (mN is not MN)', async () => {
  const r = await dataset({ properties: { f: { 'x-unit': 'mN' } } }, [
    { f: { value: 1, unit: 'MN' } }
  ]);

  assert.equal(r.status, 'fail');
});

/* ---------------- OSV (fetch mocked) ---------------- */

test('checkOsv: no advisories -> pass, and queries the right package', async () => {
  const f = mockFetch(async () => Response.json({}));
  const r = await checkOsv(pkg);

  assert.equal(r.status, 'pass');

  const [url, init] = f.mock.calls[0]!.arguments;

  assert.equal(url, 'https://api.osv.dev/v1/query');
  assert.deepEqual(JSON.parse(String(init?.body)), {
    package: { name: 'lodash', ecosystem: 'npm' },
    version: '4.17.20'
  });
});

test('checkOsv: advisories -> fail, severity parsed, unrated ones assumed high and labelled', async () => {
  mockFetch(async () =>
    Response.json({
      vulns: [
        {
          id: 'GHSA-1',
          summary: 'Prototype pollution',
          database_specific: { severity: 'MODERATE' }
        },
        {
          id: 'GHSA-2',
          severity: [
            {
              type: 'CVSS_V3',
              score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'
            }
          ]
        },
        { id: 'GHSA-3' }
      ]
    })
  );

  const r = await checkOsv(pkg);

  assert.equal(r.status, 'fail');
  assert.deepEqual(
    r.findings.map((f) => [f.ref, f.severity, f.message]),
    [
      ['GHSA-1', 'medium', 'Prototype pollution'],
      ['GHSA-2', 'critical', 'Known vulnerability'],
      [
        'GHSA-3',
        'high',
        'Known vulnerability (severity not provided; assumed high)'
      ]
    ]
  );
});

test('checkOsv: follows next_page_token', async () => {
  const f = mockFetch(async (_url, init) =>
    JSON.parse(String(init?.body)).page_token === 'p2'
      ? Response.json({ vulns: [{ id: 'B' }] })
      : Response.json({ vulns: [{ id: 'A' }], next_page_token: 'p2' })
  );
  const r = await checkOsv(pkg);

  assert.equal(f.mock.callCount(), 2);
  assert.deepEqual(
    r.findings.map((x) => x.ref),
    ['A', 'B']
  );
});

test('checkOsv: endless pagination -> error, never a partial pass or fail', async () => {
  mockFetch(async () => Response.json({ vulns: [], next_page_token: 'again' }));

  const r = await checkOsv(pkg);

  assert.equal(r.status, 'error');
  assert.match(r.reason ?? '', /more than 10 pages/);
});

test('checkOsv: HTTP error -> error with reason', async () => {
  mockFetch(async () => new Response('down', { status: 503 }));

  const r = await checkOsv(pkg);

  assert.equal(r.status, 'error');
  assert.match(r.reason ?? '', /503/);
});

test('checkOsv: network failure -> error, source still timestamped', async () => {
  mockFetch(async () => {
    throw new TypeError('fetch failed');
  });

  const r = await checkOsv(pkg);

  assert.equal(r.status, 'error');
  assert.equal(r.reason, 'fetch failed');
  assert.ok(!Number.isNaN(Date.parse(r.source.retrievedAt)));
});

test('checkOsv: malformed JSON -> error', async () => {
  mockFetch(async () => new Response('not json', { status: 200 }));
  assert.equal((await checkOsv(pkg)).status, 'error');
});

/* ---------------- C2PA (fake c2patool, shapes taken from c2patool 0.27.23) ---------------- */

let dir: string;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'verify-mcp-c2pa-'));
});
after(() => rm(dir, { recursive: true, force: true }));
afterEach(() => {
  delete process.env.VERIFY_MCP_C2PATOOL;
});

/** Installs a fake c2patool that records its argv and runs `body`. */
async function fakeC2patool(body: string): Promise<void> {
  const path = join(dir, 'c2patool');

  await writeFile(
    path,
    `#!/bin/sh\nprintf '%s\\n' "$@" > "${dir}/args"\n${body}\n`,
    { mode: 0o755 }
  );
  process.env.VERIFY_MCP_C2PATOOL = path;
}

const printJson = (j: unknown) => `cat <<'EOF'\n${JSON.stringify(j)}\nEOF`;
const untrusted = {
  code: 'signingCredential.untrusted',
  url: 'self#jumbf=/c2pa/x/c2pa.signature',
  explanation: 'signing certificate untrusted'
};

test('checkC2pa: not configured -> skipped', async () => {
  const r = await checkC2pa({ kind: 'file', path: '/tmp/x.jpg' });

  assert.equal(r.status, 'skipped');
  assert.match(r.reason ?? '', /VERIFY_MCP_C2PATOOL/);
});

test('checkC2pa: Trusted -> pass; runs read-only with an absolute path and the trust subcommand', async () => {
  await fakeC2patool(
    printJson({ validation_state: 'Trusted', validation_status: [] })
  );

  const r = await checkC2pa({ kind: 'file', path: '-o/evil.jpg' });

  assert.equal(r.status, 'pass');
  assert.equal(r.source.name, 'c2patool');

  const args = (await readFile(join(dir, 'args'), 'utf8')).trim().split('\n');

  assert.equal(args.length, 2);
  assert.ok(args[0]!.startsWith('/'), args[0]);
  assert.equal(args[1], 'trust');
});

test('checkC2pa: Invalid (tampered) -> fail with one finding per status code', async () => {
  await fakeC2patool(
    printJson({
      validation_state: 'Invalid',
      validation_status: [
        untrusted,
        {
          code: 'assertion.dataHash.mismatch',
          url: 'self#jumbf=/c2pa/x/c2pa.assertions/c2pa.hash.data',
          explanation: 'asset hash error'
        },
        { code: 'claimSignature.missing' }
      ]
    })
  );

  const r = await checkC2pa({ kind: 'file', path: '/tmp/x.jpg' });

  assert.equal(r.status, 'fail');
  assert.deepEqual(
    r.findings.map((f) => [f.severity, f.message.split(':')[0]]),
    [
      ['medium', 'signingCredential.untrusted'],
      ['high', 'assertion.dataHash.mismatch'],
      ['high', 'claimSignature.missing']
    ]
  );
  assert.equal(r.findings[2]!.message, 'claimSignature.missing');
});

test('checkC2pa: Valid but untrusted signer -> skipped, never pass', async () => {
  await fakeC2patool(
    printJson({ validation_state: 'Valid', validation_status: [untrusted] })
  );

  const r = await checkC2pa({ kind: 'file', path: '/tmp/x.jpg' });

  assert.equal(r.status, 'skipped');
  assert.match(r.reason ?? '', /not trusted/);
  assert.equal(r.findings.length, 1);
});

test('checkC2pa: no manifest -> skipped, not fail', async () => {
  await fakeC2patool('echo "Error: No claim found" >&2; exit 1');

  const r = await checkC2pa({ kind: 'file', path: '/tmp/x.jpg' });

  assert.equal(r.status, 'skipped');
  assert.match(r.reason ?? '', /No C2PA manifest/);
});

test('checkC2pa: tool crash, unknown state, or a missing binary -> error', async () => {
  await fakeC2patool('echo "Error: file not found" >&2; exit 1');
  assert.equal(
    (await checkC2pa({ kind: 'file', path: '/tmp/x.jpg' })).status,
    'error'
  );
  await fakeC2patool(printJson({ validation_state: 'Wellformed' }));
  assert.equal(
    (await checkC2pa({ kind: 'file', path: '/tmp/x.jpg' })).status,
    'error'
  );
  process.env.VERIFY_MCP_C2PATOOL = join(dir, 'does-not-exist');
  assert.equal(
    (await checkC2pa({ kind: 'file', path: '/tmp/x.jpg' })).status,
    'error'
  );
});

/* ---------------- stubs and heuristics ---------------- */

test('observability stub reports skipped with a reason', async () => {
  for (const r of [
    await checkObservability({
      kind: 'dataset',
      schema: {},
      records: [{}],
      assetId: 'x'
    }),
    await checkObservability({ kind: 'dataset', schema: {}, records: [{}] })
  ]) {
    assert.equal(r.status, 'skipped');
    assert.ok(r.reason);
  }
});

test('checkCorroboration: one distinct domain (www. ignored) -> heuristic fail', async () => {
  const r = await checkCorroboration({
    kind: 'claim',
    text: 'x',
    sources: ['https://example.com/a', 'https://www.example.com/b']
  });

  assert.equal(r.kind, 'heuristic');
  assert.equal(r.status, 'fail');
});

test('checkCorroboration: two domains -> skipped, never pass', async () => {
  const r = await checkCorroboration({
    kind: 'claim',
    text: 'x',
    sources: ['https://a.example/1', 'https://b.example/2']
  });

  assert.equal(r.status, 'skipped');
});

/* ---------------- plan ---------------- */

test('plan: every target kind has required checks and a non-empty notChecked', async () => {
  mockFetch(async () => Response.json({}));

  const targets: Target[] = [
    pkg,
    { kind: 'dataset', schema: {}, records: [{}] },
    { kind: 'file', path: '/tmp/x.jpg' },
    { kind: 'claim', text: 'x', sources: [] }
  ];

  for (const t of targets) {
    const p = plan(t);

    await Promise.all(p.checks);
    assert.ok(p.required.length > 0, t.kind);
    assert.ok(p.notChecked.length > 0, t.kind);
  }
});

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, truncate, writeFile } from 'node:fs/promises';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';

import {
  checkC2pa,
  checkCorroboration,
  checkDependencies,
  checkObservability,
  checkOsv,
  checkSchema,
  plan
} from '../checkers.js';
import { mockHttps } from '../test/https.js';
import type { Target } from '../types.js';

// No network in tests: any fetch or https.get not explicitly mocked fails the test loudly.
beforeEach(() => {
  mock.method(globalThis, 'fetch', async () => {
    throw new Error('unexpected network call in test');
  });
  mock.method(https, 'get', () => {
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
  dir = await mkdtemp(join(tmpdir(), 'evidence-report-mcp-c2pa-'));
});
after(() => rm(dir, { recursive: true, force: true }));
afterEach(() => {
  delete process.env.EVIDENCE_REPORT_MCP_C2PATOOL;
});

/** Installs a fake c2patool that records its argv and runs `body`. */
async function fakeC2patool(body: string): Promise<void> {
  const path = join(dir, 'c2patool');

  await writeFile(
    path,
    `#!/bin/sh\nprintf '%s\\n' "$@" > "${dir}/args"\n${body}\n`,
    { mode: 0o755 }
  );
  process.env.EVIDENCE_REPORT_MCP_C2PATOOL = path;
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
  assert.match(r.reason ?? '', /EVIDENCE_REPORT_MCP_C2PATOOL/);
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
  process.env.EVIDENCE_REPORT_MCP_C2PATOOL = join(dir, 'does-not-exist');
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

/* ---------------- dependencies (fetch mocked) ---------------- */

const lockfile = (...pkgs: [string, string][]) =>
  JSON.stringify({
    lockfileVersion: 3,
    packages: {
      '': { name: 'app' },
      ...Object.fromEntries(
        pkgs.map(([name, version]) => [
          `node_modules/${name}`,
          { version, resolved: `https://registry.npmjs.org/${name}.tgz` }
        ])
      )
    }
  });
const deps = (content: string) =>
  checkDependencies({ kind: 'dependencies', content });
/** OSV mock: querybatch answers from `vulnsFor` per package name, /vulns/{id} from `details`. */
const mockOsv = (
  vulnsFor: Record<string, string[]>,
  details: Record<string, object> = {}
) =>
  mockFetch(async (url, init) => {
    if (url.endsWith('/v1/querybatch')) {
      const { queries } = JSON.parse(String(init?.body)) as {
        queries: { package: { name: string } }[];
      };

      return Response.json({
        // OSV leaves out `vulns` for a clean package
        results: queries.map((q) => {
          const ids = vulnsFor[q.package.name];

          return ids ? { vulns: ids.map((id) => ({ id })) } : {};
        })
      });
    }

    const id = decodeURIComponent(url.split('/').pop()!);

    return Response.json({ id, ...details[id] });
  });

test('checkDependencies: no advisories -> pass, one batch query, no advisory lookups', async () => {
  const f = mockOsv({});
  const r = await deps(lockfile(['lodash', '4.17.21'], ['ms', '2.1.3']));

  assert.equal(r.status, 'pass');
  assert.equal(r.id, 'osv.vulnerabilities');
  assert.equal(f.mock.callCount(), 1);

  const [url, init] = f.mock.calls[0]!.arguments;

  assert.equal(url, 'https://api.osv.dev/v1/querybatch');
  assert.deepEqual(JSON.parse(String(init?.body)).queries[0], {
    package: { name: 'lodash', ecosystem: 'npm' },
    version: '4.17.21'
  });
});

test('checkDependencies: advisories -> fail, each advisory fetched once, findings name the package', async () => {
  const f = mockOsv(
    { a: ['GHSA-1'], b: ['GHSA-1', 'GHSA-2'] },
    {
      'GHSA-1': { summary: 'Bad', database_specific: { severity: 'LOW' } },
      'GHSA-2': {}
    }
  );
  const r = await deps(
    lockfile(['a', '1.0.0'], ['b', '2.0.0'], ['c', '3.0.0'])
  );

  assert.equal(r.status, 'fail');
  assert.equal(f.mock.callCount(), 3);
  assert.deepEqual(
    r.findings.map((x) => [x.ref, x.severity, x.message]),
    [
      ['GHSA-1', 'low', 'a@1.0.0: Bad'],
      ['GHSA-1', 'low', 'b@2.0.0: Bad'],
      [
        'GHSA-2',
        'high',
        'b@2.0.0: Known vulnerability (severity not provided; assumed high)'
      ]
    ]
  );
});

test('checkDependencies: an entry OSV cannot look up -> skipped with an info finding, never pass', async () => {
  mockOsv({});

  const lock = JSON.parse(lockfile(['a', '1.0.0'])) as {
    packages: Record<string, object>;
  };

  lock.packages['node_modules/g'] = {
    version: '1.0.0',
    resolved: 'git+https://x/g.git'
  };

  const r = await deps(JSON.stringify(lock));

  assert.equal(r.status, 'skipped');
  assert.equal(r.reason, '1 of 2 entries could not be looked up on OSV');
  assert.deepEqual(r.findings, [
    {
      severity: 'info',
      message:
        'g@1.0.0: not looked up (not from a registry: git+https://x/g.git)'
    }
  ]);
});

test('checkDependencies: unresolved entries do not hide a known vulnerability -> fail', async () => {
  mockOsv({ a: ['GHSA-1'] });

  const r = await deps(
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        'node_modules/a': { version: '1.0.0' },
        'node_modules/v': {}
      }
    })
  );

  assert.equal(r.status, 'fail');
  assert.deepEqual(
    r.findings.map((x) => x.severity),
    ['high', 'info']
  );
});

test('checkDependencies: no packages -> skipped', async () => {
  const r = await deps(lockfile());

  assert.equal(r.status, 'skipped');
  assert.equal(r.reason, 'No packages found');
});

test('checkDependencies: more than 1000 packages -> batches of 1000', async () => {
  const f = mockOsv({});
  const many = Array.from(
    { length: 1001 },
    (_, i) => [`p${i}`, '1.0.0'] as [string, string]
  );
  const r = await deps(lockfile(...many));

  assert.equal(r.status, 'pass');
  assert.deepEqual(
    f.mock.calls.map(
      (c) => JSON.parse(String(c.arguments[1]?.body)).queries.length
    ),
    [1000, 1]
  );
});

test('checkDependencies: a paginated batch result -> error, never a partial list', async () => {
  mockFetch(async () =>
    Response.json({ results: [{ vulns: [{ id: 'A' }], next_page_token: 't' }] })
  );

  const r = await deps(lockfile(['a', '1.0.0']));

  assert.equal(r.status, 'error');
  assert.match(r.reason ?? '', /more results for a@1.0.0/);
});

test('checkDependencies: fewer results than queries -> error', async () => {
  mockFetch(async () => Response.json({}));

  const r = await deps(lockfile(['a', '1.0.0']));

  assert.equal(r.status, 'error');
  assert.equal(r.reason, 'OSV returned 0 results for 1 queries');
});

test('checkDependencies: an advisory lookup failing -> error', async () => {
  mockFetch(async (url) =>
    url.endsWith('/querybatch')
      ? Response.json({ results: [{ vulns: [{ id: 'A' }] }] })
      : new Response('gone', { status: 404 })
  );

  const r = await deps(lockfile(['a', '1.0.0']));

  assert.equal(r.status, 'error');
  assert.equal(r.reason, 'OSV responded 404');
});

test('checkDependencies: not a lockfile or an SBOM -> error', async () => {
  const r = await deps('{"name":"x"}');

  assert.equal(r.status, 'error');
  assert.match(r.reason ?? '', /Not a package-lock.json or a CycloneDX/);
});

test('checkDependencies: reads a path read-only; missing or over 10 MB -> error', async () => {
  mockOsv({});

  const path = join(dir, 'package-lock.json');

  await writeFile(path, lockfile(['a', '1.0.0']));
  assert.equal(
    (await checkDependencies({ kind: 'dependencies', path })).status,
    'pass'
  );

  const missing = await checkDependencies({
    kind: 'dependencies',
    path: join(dir, 'nope.json')
  });

  assert.equal(missing.status, 'error');
  assert.match(missing.reason ?? '', /ENOENT/);

  const big = join(dir, 'big.json');

  await writeFile(big, '');
  await truncate(big, 10 * 1024 * 1024 + 1);

  const r = await checkDependencies({ kind: 'dependencies', path: big });

  assert.equal(r.status, 'error');
  assert.match(r.reason ?? '', /larger than 10 MB/);
});

/* ---------------- claim quotes (https.get mocked) ---------------- */

const claim = (
  sources: (string | { url: string; quote: string })[]
): Parameters<typeof checkCorroboration>[0] => ({
  kind: 'claim',
  text: 'The bridge opened in 1894.',
  sources
});
const pages = {
  'https://a.example/': {
    body: '<p>The bridge  <b>opened</b> to traffic in 1894.</p>'
  },
  'https://b.example/': {
    body: '<p>It opened in 1894, after eight years&rsquo; work.</p>'
  }
};

test('checkCorroboration: quotes found on two domains -> heuristic pass, findings name each page', async () => {
  mockHttps(pages);

  const r = await checkCorroboration(
    claim([
      { url: 'https://a.example/', quote: 'opened to traffic in 1894' },
      { url: 'https://b.example/', quote: 'after eight years\u2019 work' }
    ])
  );

  assert.equal(r.kind, 'heuristic');
  assert.equal(r.status, 'pass');
  assert.deepEqual(r.findings, [
    { severity: 'info', message: 'Quote found', ref: 'https://a.example/' },
    { severity: 'info', message: 'Quote found', ref: 'https://b.example/' }
  ]);
});

test('checkCorroboration: a quote not on its page -> fail, whatever else was found', async () => {
  mockHttps(pages);

  const r = await checkCorroboration(
    claim([
      { url: 'https://a.example/', quote: 'opened to traffic in 1894' },
      { url: 'https://b.example/', quote: 'opened in 1895' }
    ])
  );

  assert.equal(r.status, 'fail');
  assert.equal(r.reason, '1 quote(s) not found on their pages');
  assert.deepEqual(r.findings[1], {
    severity: 'medium',
    message:
      'Quote not found in the page text. The page may also build its text with JavaScript, or be behind a paywall',
    ref: 'https://b.example/'
  });
});

test('checkCorroboration: a page that cannot be fetched -> skipped, never pass', async () => {
  mockHttps({ ...pages, 'https://b.example/': new Error('ECONNRESET') });

  const r = await checkCorroboration(
    claim([
      { url: 'https://a.example/', quote: 'opened to traffic in 1894' },
      { url: 'https://b.example/', quote: 'opened in 1894' }
    ])
  );

  assert.equal(r.status, 'skipped');
  assert.equal(r.reason, '1 source(s) could not be fetched');
  assert.deepEqual(r.findings[1], {
    severity: 'info',
    message: 'Not fetched: ECONNRESET',
    ref: 'https://b.example/'
  });
});

test('checkCorroboration: quotes found on only one domain -> skipped; unquoted sources are not fetched', async () => {
  const get = mockHttps(pages);
  const r = await checkCorroboration(
    claim([
      { url: 'https://a.example/', quote: 'opened to traffic in 1894' },
      'https://b.example/'
    ])
  );

  assert.equal(r.status, 'skipped');
  assert.equal(r.reason, 'Quotes found on fewer than two independent domains');
  assert.equal(get.mock.callCount(), 1);
});

test('verify: a claim whose quotes are all found is still unknown, never pass', async () => {
  mockHttps(pages);

  const { verify } = await import('../server.js');
  const report = await verify(
    claim([
      { url: 'https://a.example/', quote: 'opened to traffic in 1894' },
      { url: 'https://b.example/', quote: 'opened in 1894' }
    ])
  );

  assert.equal(report.checks[0]!.status, 'pass');
  assert.equal(report.verdict, 'unknown');
});

/* ---------------- plan ---------------- */

test('plan: every target kind has required checks and a non-empty notChecked', async () => {
  mockFetch(async () => Response.json({}));

  const targets: Target[] = [
    pkg,
    { kind: 'dataset', schema: {}, records: [{}] },
    { kind: 'file', path: '/tmp/x.jpg' },
    { kind: 'claim', text: 'x', sources: [] },
    { kind: 'dependencies', content: '{"lockfileVersion":3,"packages":{}}' }
  ];

  for (const t of targets) {
    const p = plan(t);

    await Promise.all(p.checks);
    assert.ok(p.required.length > 0, t.kind);
    assert.ok(p.notChecked.length > 0, t.kind);
  }
});

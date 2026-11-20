import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { checkObservability } from '../checkers.js';
import { dbtHealth } from '../dbt.js';

const NOW = Date.parse('2026-11-20T12:00:00Z');
// dbt writes microseconds; Date.parse must still read them
const AT = '2026-11-20T10:00:00.123456Z';
const ORDERS = 'model.shop.orders';
const RAW = 'source.shop.raw.orders';
const dirs: string[] = [];

after(() =>
  Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })))
);

const meta = (generated_at: string | undefined = AT) => ({
  metadata: { generated_at }
});
/** orders <- stg_orders <- raw.orders; two generic tests and one singular test on orders. */
const manifest = () => ({
  ...meta(),
  nodes: {
    [ORDERS]: {
      resource_type: 'model',
      depends_on: { nodes: ['model.shop.stg_orders'] }
    },
    'model.shop.stg_orders': {
      resource_type: 'model',
      depends_on: { nodes: [RAW] }
    },
    'test.shop.not_null_orders_id': {
      resource_type: 'test',
      attached_node: ORDERS,
      depends_on: { nodes: [ORDERS] }
    },
    // Attached to stg_orders, though it also reads orders: not one of orders' tests
    'test.shop.relationships_stg': {
      resource_type: 'test',
      attached_node: 'model.shop.stg_orders',
      depends_on: { nodes: ['model.shop.stg_orders', ORDERS] }
    },
    'test.shop.assert_positive_total': {
      resource_type: 'test',
      attached_node: null,
      depends_on: { nodes: [ORDERS] }
    },
    'test.shop.source_not_null': {
      resource_type: 'test',
      attached_node: RAW,
      depends_on: { nodes: [RAW] }
    }
  },
  sources: { [RAW]: {} }
});

type Row = { unique_id: string; status: string; message?: string };

const passing = (...ids: string[]): Row[] =>
  ids.map((unique_id) => ({ unique_id, status: 'pass' }));
const runResults = (
  results = passing(
    'test.shop.not_null_orders_id',
    'test.shop.assert_positive_total',
    'test.shop.source_not_null'
  )
) => ({ ...meta(), results });
const freshness = (status = 'pass') => ({
  ...meta(),
  results: [{ unique_id: RAW, status, max_loaded_at: '2026-11-20T09:00:00Z' }]
});

/** Writes the artifacts to a new folder; null leaves a file out. */
async function target(files: {
  manifest?: object | null;
  run?: object | string | null;
  sources?: object | string | null;
}) {
  const dir = await mkdtemp(join(tmpdir(), 'evidence-report-mcp-dbt-'));
  const all = {
    'manifest.json': files.manifest === undefined ? manifest() : files.manifest,
    'run_results.json': files.run === undefined ? runResults() : files.run,
    'sources.json': files.sources === undefined ? freshness() : files.sources
  };

  dirs.push(dir);

  for (const [name, body] of Object.entries(all))
    if (body !== null)
      await writeFile(
        join(dir, name),
        typeof body === 'string' ? body : JSON.stringify(body)
      );

  return dir;
}

const health = async (files: Parameters<typeof target>[0], asset = ORDERS) =>
  dbtHealth(await target(files), asset, NOW);

test('dbtHealth: every test passed and every upstream source fresh -> pass, with each artifact time', async () => {
  const r = await health({});

  assert.equal(r.status, 'pass');
  assert.deepEqual(r.findings, [
    {
      severity: 'info',
      message: `manifest.json generated at ${AT}`,
      ref: 'manifest.json'
    },
    {
      severity: 'info',
      message: `run_results.json generated at ${AT}`,
      ref: 'run_results.json'
    },
    {
      severity: 'info',
      message: `sources.json generated at ${AT}`,
      ref: 'sources.json'
    }
  ]);
});

test('dbtHealth: a failed test -> fail with a high finding; a warning only adds a medium one', async () => {
  const r = await health({
    run: runResults([
      {
        unique_id: 'test.shop.not_null_orders_id',
        status: 'fail',
        message: 'Got 3 results'
      },
      { unique_id: 'test.shop.assert_positive_total', status: 'warn' }
    ]),
    sources: freshness('warn')
  });

  assert.equal(r.status, 'fail');
  assert.deepEqual(
    r.findings.filter((f) => f.severity !== 'info'),
    [
      {
        severity: 'high',
        message: 'Test failed: Got 3 results',
        ref: 'test.shop.not_null_orders_id'
      },
      {
        severity: 'medium',
        message: 'Test warned',
        ref: 'test.shop.assert_positive_total'
      },
      {
        severity: 'medium',
        message: 'Source is getting stale, last loaded 2026-11-20T09:00:00Z',
        ref: RAW
      }
    ]
  );

  const warned = await health({
    run: runResults([
      ...passing('test.shop.not_null_orders_id'),
      { unique_id: 'test.shop.assert_positive_total', status: 'warn' }
    ])
  });

  assert.equal(warned.status, 'pass');
});

test('dbtHealth: the node failing to build -> fail', async () => {
  const r = await health({
    run: runResults([
      { unique_id: ORDERS, status: 'error', message: 'Database Error' },
      ...runResults().results
    ])
  });

  assert.equal(r.status, 'fail');
  assert.deepEqual(r.findings[0], {
    severity: 'high',
    message: `${ORDERS} failed to build: Database Error`,
    ref: ORDERS
  });
});

test('dbtHealth: a stale upstream source -> fail', async () => {
  const r = await health({ sources: freshness('error') });

  assert.equal(r.status, 'fail');
  assert.equal(
    r.findings[0]!.message,
    'Source is stale, last loaded 2026-11-20T09:00:00Z'
  );
});

test('dbtHealth: a test that errored, was skipped or has no result -> skipped, never pass', async () => {
  for (const results of [
    [
      {
        unique_id: 'test.shop.not_null_orders_id',
        status: 'error',
        message: 'compile error'
      }
    ],
    [{ unique_id: 'test.shop.not_null_orders_id', status: 'skipped' }],
    []
  ]) {
    const r = await health({
      run: runResults([
        ...results,
        ...passing('test.shop.assert_positive_total')
      ])
    });

    assert.equal(r.status, 'skipped');
    assert.equal(r.reason, '1 test(s) or source(s) without a passing result');
  }

  const r = await health({ run: runResults([]) });

  assert.deepEqual(
    r.findings
      .filter((f) => f.severity !== 'info' || f.ref?.startsWith('test.'))
      .map((f) => f.message),
    [
      'Test has no result in run_results.json',
      'Test has no result in run_results.json'
    ]
  );
});

test('dbtHealth: freshness not run, or a runtime error -> skipped', async () => {
  const none = await health({ sources: null });

  assert.equal(none.status, 'skipped');
  assert.ok(
    none.findings.some(
      (f) =>
        f.ref === RAW &&
        f.message === 'No freshness result (run dbt source freshness)'
    )
  );

  const broken = await health({
    sources: {
      ...meta(),
      results: [
        { unique_id: RAW, status: 'runtime error', message: 'no such table' }
      ]
    }
  });

  assert.equal(broken.status, 'skipped');
  assert.ok(
    broken.findings.some(
      (f) =>
        f.message === 'Freshness not checked (runtime error): no such table'
    )
  );
});

test('dbtHealth: a node with no tests -> skipped', async () => {
  const r = await health({}, 'model.shop.stg_orders');

  // stg_orders' only test is attached to it but has no result here
  assert.equal(r.status, 'skipped');

  const m = {
    ...manifest(),
    nodes: { [ORDERS]: { resource_type: 'model', depends_on: { nodes: [] } } }
  };
  const bare = await health({ manifest: m });

  assert.equal(bare.status, 'skipped');
  assert.ok(
    bare.findings.some((f) => f.message === `No dbt tests on ${ORDERS}`)
  );
});

test('dbtHealth: a source as the asset is checked by its own tests and freshness', async () => {
  assert.equal((await health({}, RAW)).status, 'pass');
  assert.equal(
    (await health({ sources: freshness('error') }, RAW)).status,
    'fail'
  );
});

test('dbtHealth: an asset dbt does not know -> skipped', async () => {
  const r = await health({}, 'model.shop.nope');

  assert.equal(r.status, 'skipped');
  assert.equal(r.reason, 'model.shop.nope is not in the dbt manifest');

  // A manifest with neither nodes nor sources knows nothing
  const empty = await health({ manifest: meta() }, ORDERS);

  assert.equal(empty.reason, `${ORDERS} is not in the dbt manifest`);
});

test('dbtHealth: artifacts older than 24 hours, or without a time -> skipped as stale', async () => {
  const old = await health({
    run: { ...runResults(), ...meta('2026-11-19T11:59:59Z') }
  });

  assert.equal(old.status, 'skipped');
  assert.equal(
    old.reason,
    'Stale evidence: run_results.json was generated at 2026-11-19T11:59:59Z, more than 24 hours ago'
  );

  const untimed = await health({ sources: { results: [] } });

  assert.equal(untimed.status, 'skipped');
  assert.match(
    untimed.reason ?? '',
    /sources.json was generated at an unknown time/
  );
});

test('dbtHealth: a missing manifest or run_results, or unreadable sources.json, throws', async () => {
  await assert.rejects(health({ manifest: null }), /ENOENT/);
  await assert.rejects(health({ run: null }), /ENOENT/);
  await assert.rejects(health({ sources: '{' }), SyntaxError);
});

test('checkObservability: reads EVIDENCE_REPORT_MCP_DBT_TARGET; a broken target -> error', async (t) => {
  const recent = new Date(Date.now() - 60_000).toISOString();
  const fresh = (o: object) => ({ ...o, metadata: { generated_at: recent } });
  const dir = await target({
    manifest: fresh(manifest()),
    run: fresh(runResults()),
    sources: fresh(freshness())
  });
  const dataset = {
    kind: 'dataset' as const,
    schema: {},
    records: [{}],
    assetId: ORDERS
  };

  t.after(() => delete process.env.EVIDENCE_REPORT_MCP_DBT_TARGET);
  process.env.EVIDENCE_REPORT_MCP_DBT_TARGET = dir;

  const ok = await checkObservability(dataset);

  assert.equal(ok.status, 'pass');
  assert.equal(ok.source.name, 'dbt artifacts');

  process.env.EVIDENCE_REPORT_MCP_DBT_TARGET = join(dir, 'missing');

  const broken = await checkObservability(dataset);

  assert.equal(broken.status, 'error');
  assert.match(broken.reason ?? '', /ENOENT/);
});

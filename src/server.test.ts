import assert from 'node:assert/strict';
import { test } from 'node:test';

import { aggregate, verify } from './server.js';
import type { CheckKind, CheckResult, CheckStatus } from './types.js';

const check = (
  id: string,
  status: CheckStatus,
  kind: CheckKind = 'deterministic'
): CheckResult => ({
  id,
  kind,
  status,
  source: { name: 'test', retrievedAt: new Date().toISOString() },
  findings: [],
  durationMs: 0
});

test('aggregate: deterministic required check passes -> pass', () => {
  assert.equal(aggregate([check('a', 'pass')], ['a']), 'pass');
});

test('aggregate: deterministic + heuristic both pass -> pass', () => {
  assert.equal(
    aggregate(
      [check('a', 'pass'), check('h', 'pass', 'heuristic')],
      ['a', 'h']
    ),
    'pass'
  );
});

test('aggregate: any fail -> fail, even a heuristic or non-required one', () => {
  assert.equal(
    aggregate([check('a', 'pass'), check('h', 'fail', 'heuristic')], ['a']),
    'fail'
  );
  assert.equal(
    aggregate([check('a', 'error'), check('b', 'fail')], ['a', 'b']),
    'fail'
  );
});

test('aggregate: required check errored -> unknown', () => {
  assert.equal(aggregate([check('a', 'error')], ['a']), 'unknown');
});

test('aggregate: required check skipped -> unknown', () => {
  assert.equal(
    aggregate([check('a', 'pass'), check('b', 'skipped')], ['a', 'b']),
    'unknown'
  );
});

test('aggregate: required check missing from results -> unknown', () => {
  assert.equal(aggregate([check('a', 'pass')], ['a', 'b']), 'unknown');
});

test("aggregate: only heuristics passed -> unknown (judgment can't certify)", () => {
  assert.equal(aggregate([check('h', 'pass', 'heuristic')], ['h']), 'unknown');
});

test('aggregate: nothing required, nothing run -> unknown, never pass', () => {
  assert.equal(aggregate([], []), 'unknown');
});

test('verify: report always carries non-empty notChecked and sourced checks', async () => {
  const report = await verify({
    kind: 'dataset',
    schema: { type: 'object', required: ['id'] },
    records: [{ id: 1 }]
  });

  // schema passes, observability is a stub that skips -> fail closed
  assert.equal(report.verdict, 'unknown');
  assert.ok(report.notChecked.length > 0);
  assert.equal(report.verifier.name, 'verify-mcp');
  for (const c of report.checks) {
    assert.ok(c.source.name);
    assert.ok(!Number.isNaN(Date.parse(c.source.retrievedAt)));
  }
});

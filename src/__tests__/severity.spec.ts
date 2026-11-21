import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cvss3BaseScore, fromScore, osvSeverity } from '../severity.js';

test('cvss3BaseScore: known vectors match the FIRST calculator', () => {
  const cases: [string, number][] = [
    ['CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', 9.8],
    ['CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H', 10.0],
    ['CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N', 7.5],
    ['CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N', 6.1],
    ['CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N', 0]
  ];

  for (const [v, score] of cases) assert.equal(cvss3BaseScore(v), score, v);
});

test('cvss3BaseScore: CVSS 4, CVSS 2 and malformed vectors -> undefined', () => {
  for (const v of [
    'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N',
    'AV:N/AC:L/Au:N/C:P/I:P/A:P',
    'CVSS:3.1/AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/C:H/I:H/A:H',
    'CVSS:3.1/S:U',
    // Names inherited from Object.prototype are not metric values
    'CVSS:3.0/AV:P/AC:H/PR:H/UI:R/C:N/I:N/A:valueOf/S:U',
    'CVSS:3.1/AV:toString/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    'CVSS:3.1/AV:N/AC:L/PR:constructor/UI:N/S:C/C:H/I:H/A:H',
    ''
  ]) {
    assert.equal(cvss3BaseScore(v), undefined, v);
  }
});

test('fromScore: CVSS qualitative rating boundaries', () => {
  assert.deepEqual([0, 0.1, 3.9, 4, 6.9, 7, 8.9, 9, 10].map(fromScore), [
    'info',
    'low',
    'low',
    'medium',
    'medium',
    'high',
    'high',
    'critical',
    'critical'
  ]);
});

test('osvSeverity: takes the worst rating across all sources', () => {
  assert.equal(
    osvSeverity({
      id: 'X',
      database_specific: { severity: 'LOW' },
      severity: [
        {
          type: 'CVSS_V3',
          score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N'
        }
      ],
      affected: [{ ecosystem_specific: { severity: 'high' } }]
    }),
    'high'
  );
});

test('osvSeverity: label-typed severity entries (e.g. Ubuntu) are read', () => {
  assert.equal(
    osvSeverity({ id: 'U', severity: [{ type: 'Ubuntu', score: 'medium' }] }),
    'medium'
  );
});

test('osvSeverity: per-package database_specific severity is read', () => {
  assert.equal(
    osvSeverity({
      id: 'D',
      affected: [{ database_specific: { severity: 'CRITICAL' } }]
    }),
    'critical'
  );
});

test('osvSeverity: nothing usable -> undefined (caller decides the fallback)', () => {
  assert.equal(osvSeverity({ id: 'N' }), undefined);
  assert.equal(
    osvSeverity({
      id: 'V4',
      severity: [
        {
          type: 'CVSS_V4',
          score:
            'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N'
        }
      ]
    }),
    undefined
  );
});

test('osvSeverity: labels inherited from Object.prototype are ignored', () => {
  for (const severity of ['__proto__', 'constructor', 'toString']) {
    assert.equal(
      osvSeverity({ id: 'x', affected: [{ database_specific: { severity } }] }),
      undefined,
      severity
    );
  }
});

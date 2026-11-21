import fc from 'fast-check';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cvss3BaseScore } from '../severity.js';

/** Each base metric's values, from least to most severe. Scope is not ordered. */
const METRICS = {
  AV: ['P', 'L', 'A', 'N'],
  AC: ['H', 'L'],
  PR: ['H', 'L', 'N'],
  UI: ['R', 'N'],
  C: ['N', 'L', 'H'],
  I: ['N', 'L', 'H'],
  A: ['N', 'L', 'H']
};

type Metric = keyof typeof METRICS;
type Vector = { version: string; scope: string } & Record<Metric, number>;

const NAMES = Object.keys(METRICS) as Metric[];
const vector = fc.record({
  version: fc.constantFrom('3.0', '3.1'),
  scope: fc.constantFrom('U', 'C'),
  ...(Object.fromEntries(
    NAMES.map((name) => [name, fc.nat({ max: METRICS[name].length - 1 })])
  ) as Record<Metric, fc.Arbitrary<number>>)
});
const parts = (v: Vector) => [
  `CVSS:${v.version}`,
  ...NAMES.map((name) => `${name}:${METRICS[name][v[name]]}`),
  `S:${v.scope}`
];
const score = (v: Vector) => cvss3BaseScore(parts(v).join('/'));

describe('cvss3BaseScore properties', () => {
  it('scores any valid vector from 0 to 10, to one decimal', () => {
    fc.assert(
      fc.property(vector, (v) => {
        const value = score(v);

        assert.ok(value !== undefined && value >= 0 && value <= 10, `${value}`);
        assert.equal(Math.round(value * 10) / 10, value);
      })
    );
  });

  it('gives the same score whatever order the metrics come in', () => {
    fc.assert(
      fc.property(
        vector.chain((v) =>
          fc.tuple(
            fc.constant(v),
            fc.shuffledSubarray(parts(v), { minLength: 9 })
          )
        ),
        ([v, shuffled]) => {
          assert.equal(cvss3BaseScore(shuffled.join('/')), score(v));
        }
      )
    );
  });

  it('never scores lower when one metric gets worse', () => {
    fc.assert(
      fc.property(vector, fc.constantFrom(...NAMES), (v, name) => {
        fc.pre(v[name] < METRICS[name].length - 1);

        const worse = score({ ...v, [name]: v[name] + 1 })!;

        assert.ok(worse >= score(v)!, `${worse} < ${score(v)}`);
      })
    );
  });
});

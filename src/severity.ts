import type { Finding } from './types.js';

type Severity = Finding['severity'];

const RANK: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];
/** Labels used by GHSA, Ubuntu, Debian and others in OSV records. */
const LABELS: Record<string, Severity | undefined> = {
  none: 'info',
  negligible: 'info',
  unimportant: 'info',
  low: 'low',
  moderate: 'medium',
  medium: 'medium',
  important: 'high',
  high: 'high',
  critical: 'critical'
};
const fromLabel = (label: unknown): Severity | undefined =>
  typeof label === 'string' ? LABELS[label.toLowerCase()] : undefined;

/** CVSS qualitative rating scale. */
export const fromScore = (score: number): Severity =>
  score === 0
    ? 'info'
    : score < 4
      ? 'low'
      : score < 7
        ? 'medium'
        : score < 9
          ? 'high'
          : 'critical';

type Weights = Record<string, number | undefined>;

const AV: Weights = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const AC: Weights = { L: 0.77, H: 0.44 };
const UI: Weights = { N: 0.85, R: 0.62 };
const CIA: Weights = { H: 0.56, L: 0.22, N: 0 };
/** CVSS 3.1 "Roundup": smallest 1-decimal number >= x, robust to float error. */
const roundup = (x: number) => {
  const n = Math.round(x * 100_000);

  return n % 10_000 === 0 ? n / 100_000 : (Math.floor(n / 10_000) + 1) / 10;
};

/**
 * CVSS 3.0/3.1 base score from a vector string (FIRST CVSS v3.1 spec, section 7.1).
 * Returns undefined for anything else, including CVSS 4 (scored by lookup table, not formula).
 */
export function cvss3BaseScore(vector: string): number | undefined {
  const m: Record<string, string | undefined> = Object.fromEntries(
    vector.split('/').map((p) => p.split(':'))
  );

  if (m.CVSS !== '3.0' && m.CVSS !== '3.1') return undefined;

  if (m.S !== 'U' && m.S !== 'C') return undefined;

  const changed = m.S === 'C';
  const pr = (
    { N: 0.85, L: changed ? 0.68 : 0.62, H: changed ? 0.5 : 0.27 } as Weights
  )[m.PR ?? ''];
  const w = [
    AV[m.AV ?? ''],
    AC[m.AC ?? ''],
    pr,
    UI[m.UI ?? ''],
    CIA[m.C ?? ''],
    CIA[m.I ?? ''],
    CIA[m.A ?? '']
  ];

  if (w.some((x) => x === undefined)) return undefined;

  const [av, ac, prw, ui, c, i, a] = w as number[];
  const iss = 1 - (1 - c) * (1 - i) * (1 - a);
  const impact = changed
    ? 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15
    : 6.42 * iss;

  if (impact <= 0) return 0;

  const exploitability = 8.22 * av * ac * prw * ui;

  return roundup(
    Math.min((changed ? 1.08 : 1) * (impact + exploitability), 10)
  );
}

export interface OsvVuln {
  id: string;
  summary?: string;
  severity?: { type: string; score: string }[];
  database_specific?: { severity?: unknown };
  affected?: {
    ecosystem_specific?: { severity?: unknown };
    database_specific?: { severity?: unknown };
  }[];
}

/** Worst severity any source in the OSV record gives, or undefined if none is usable. */
export function osvSeverity(v: OsvVuln): Severity | undefined {
  const found = [
    fromLabel(v.database_specific?.severity),
    ...(v.affected ?? []).flatMap((a) => [
      fromLabel(a.ecosystem_specific?.severity),
      fromLabel(a.database_specific?.severity)
    ]),
    ...(v.severity ?? []).map((s) => {
      const score = cvss3BaseScore(s.score);

      return score === undefined ? fromLabel(s.score) : fromScore(score);
    })
  ].filter((s): s is Severity => s !== undefined);

  return found.length
    ? found.reduce((a, b) => (RANK.indexOf(a) >= RANK.indexOf(b) ? a : b))
    : undefined;
}

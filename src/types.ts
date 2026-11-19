import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Input: what the agent asks us to verify                            */
/* ------------------------------------------------------------------ */

export const PackageTarget = z.object({
  kind: z.literal('package'),
  ecosystem: z.enum([
    'npm',
    'PyPI',
    'Go',
    'Maven',
    'crates.io',
    'NuGet',
    'RubyGems'
  ]),
  name: z.string().min(1),
  version: z.string().min(1)
});

export const DatasetTarget = z.object({
  kind: z.literal('dataset'),
  /** Inline JSON Schema the data must satisfy (the "contract"). */
  schema: z.record(z.string(), z.unknown()),
  /** Records to validate. Keep samples small; this is not a warehouse scan. */
  records: z.array(z.unknown()).min(1).max(1000),
  /** Optional asset id in an observability tool (freshness, volume, lineage). */
  assetId: z.string().optional()
});

export const FileTarget = z.object({
  kind: z.literal('file'),
  /** Local path of an image/video/audio file to check for C2PA credentials. */
  path: z.string().min(1)
});

export const ClaimTarget = z.object({
  kind: z.literal('claim'),
  text: z.string().min(1),
  /** Sources the agent is relying on. Never verified against the agent's own output. */
  sources: z.array(z.string().url()).default([])
});

/** The zod schema for a target: the `verify` tool's input. */
export const TargetSchema = z.discriminatedUnion('kind', [
  PackageTarget,
  DatasetTarget,
  FileTarget,
  ClaimTarget
]);

/**
 * What to verify, by `kind`: a `package` (ecosystem, name and version), a
 * `dataset` (a JSON Schema and records), a `file` (a path) or a `claim` (text
 * and the sources it relies on).
 */
export type Target = z.infer<typeof TargetSchema>;

/* ------------------------------------------------------------------ */
/* Output: evidence, not verdicts                                     */
/* ------------------------------------------------------------------ */

/**
 * How a check reaches its result.
 *
 * - `deterministic`: reproducible given the same input and source state, such
 *   as schema validation, signature checks and advisory lookups.
 * - `heuristic`: a judgement, such as corroboration. It can fail a target but
 *   never make it pass on its own.
 */
export type CheckKind = 'deterministic' | 'heuristic';

/**
 * The outcome of one check. `error` and `skipped` mean the check did not run
 * to completion, so a required check with either makes the verdict `unknown`.
 */
export type CheckStatus = 'pass' | 'fail' | 'error' | 'skipped';

/** One thing a check found. */
export interface Finding {
  /** How serious it is, on the CVSS qualitative scale. */
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  /** What was found, in words. */
  message: string;
  /** Where the finding points: JSON pointer, advisory id, manifest field. */
  ref?: string;
}

/** The evidence from one check. */
export interface CheckResult {
  /** The check, for example `osv.vulnerabilities`. */
  id: string;
  kind: CheckKind;
  status: CheckStatus;
  /** Where the evidence came from, and when. */
  source: {
    /** For example `OSV.dev`. */
    name: string;
    url?: string;
    /** ISO 8601 time of the lookup: evidence goes stale. */
    retrievedAt: string;
  };
  findings: Finding[];
  /** Why a check errored or was skipped. Required for those statuses. */
  reason?: string;
  /** How long the check took, in milliseconds. */
  durationMs: number;
}

/** The overall answer. `unknown` means not verified, never safe. */
export type Verdict = 'pass' | 'fail' | 'unknown';

/** What `verify` returns: the verdict and the evidence behind it. */
export interface EvidenceReport {
  verdict: Verdict;
  /** One line a human can read. The checks array is the actual answer. */
  summary: string;
  /** The target as it was checked. */
  target: Target;
  /** One result for each check that was planned for this kind of target. */
  checks: CheckResult[];
  /** Things this verifier cannot or did not check. Always present, never empty. */
  notChecked: string[];
  /** ISO 8601 time the report was made. */
  generatedAt: string;
  /** The package and version that made the report. */
  verifier: { name: string; version: string };
}

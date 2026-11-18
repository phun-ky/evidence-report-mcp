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

export const Target = z.discriminatedUnion('kind', [
  PackageTarget,
  DatasetTarget,
  FileTarget,
  ClaimTarget
]);

export type Target = z.infer<typeof Target>;

/* ------------------------------------------------------------------ */
/* Output: evidence, not verdicts                                     */
/* ------------------------------------------------------------------ */

/**
 * deterministic: reproducible given the same input and source state
 *                (schema validation, signature checks, CVE lookups).
 * heuristic:     judgment-based (corroboration, model scoring). Can lower
 *                a verdict, never raise it to "pass" on its own.
 */
export type CheckKind = 'deterministic' | 'heuristic';

/** "error" and "skipped" mean the check did NOT run to completion. */
export type CheckStatus = 'pass' | 'fail' | 'error' | 'skipped';

export interface Finding {
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  message: string;
  /** Where the finding points: JSON pointer, advisory id, manifest field. */
  ref?: string;
}

export interface CheckResult {
  id: string; // e.g. "osv.vulnerabilities"
  kind: CheckKind;
  status: CheckStatus;
  source: {
    name: string; // e.g. "OSV.dev"
    url?: string;
    retrievedAt: string; // ISO timestamp: evidence goes stale
  };
  findings: Finding[];
  /** Why a check errored or was skipped. Required for those statuses. */
  reason?: string;
  durationMs: number;
}

export type Verdict = 'pass' | 'fail' | 'unknown';

export interface EvidenceReport {
  verdict: Verdict;
  /** One line a human can read. The checks array is the actual answer. */
  summary: string;
  target: Target;
  checks: CheckResult[];
  /** Things this verifier cannot or did not check. Always present, never empty. */
  notChecked: string[];
  generatedAt: string;
  verifier: { name: string; version: string };
}

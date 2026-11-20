import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Input: what the agent asks us to verify                            */
/* ------------------------------------------------------------------ */

/* Limits, so one call can't hold the server for long (#61). */
const MAX_DEPTH = 32;
const KB = 1024;

/** Whether a JSON value nests objects and arrays at most `max` deep. Stops early, so deep input can't overflow the stack. */
function withinDepth(v: unknown, max: number): boolean {
  if (typeof v !== 'object' || v === null) return true;

  return max > 0 && Object.values(v).every((c) => withinDepth(c, max - 1));
}

const jsonBytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v));

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
  name: z.string().min(1).max(256),
  version: z.string().min(1).max(256)
});

export const DatasetTarget = z.object({
  kind: z.literal('dataset'),
  /** Inline JSON Schema the data must satisfy (the "contract"). */
  schema: z
    .record(z.string(), z.unknown())
    .refine((s) => withinDepth(s, MAX_DEPTH) && jsonBytes(s) <= 100 * KB, {
      message: `must nest at most ${MAX_DEPTH} deep and be at most 100 KB as JSON`
    }),
  /** Records to validate. Keep samples small; this is not a warehouse scan. */
  records: z
    .array(z.unknown())
    .min(1)
    .max(1000)
    .refine(
      (r) =>
        r.every((rec) => withinDepth(rec, MAX_DEPTH)) &&
        jsonBytes(r) <= 1024 * KB,
      {
        message: `each record must nest at most ${MAX_DEPTH} deep, and all records be at most 1 MB as JSON`
      }
    ),
  /** Optional asset id in an observability tool (freshness, volume, lineage). */
  assetId: z.string().max(256).optional()
});

export const FileTarget = z.object({
  kind: z.literal('file'),
  /** Local path of an image/video/audio file to check for C2PA credentials. */
  path: z.string().min(1).max(4096)
});

export const ClaimTarget = z.object({
  kind: z.literal('claim'),
  text: z.string().min(1).max(10_000),
  /** Sources the agent is relying on. Never verified against the agent's own output. */
  sources: z.array(z.string().url().max(2048)).max(20).default([])
});

export const DependenciesTarget = z
  .object({
    kind: z.literal('dependencies'),
    /** Local path of a package-lock.json or a CycloneDX JSON file, read-only. */
    path: z.string().min(1).max(4096).optional(),
    /** The file's content, instead of a path. */
    content: z
      .string()
      .min(1)
      .max(10 * KB * KB)
      .optional()
  })
  .refine((t) => (t.path === undefined) !== (t.content === undefined), {
    message: 'Give exactly one of path or content'
  });

/** The zod schema for a target: the `verify` tool's input. */
export const TargetSchema = z.discriminatedUnion('kind', [
  PackageTarget,
  DatasetTarget,
  FileTarget,
  ClaimTarget,
  DependenciesTarget
]);

/**
 * What to verify, by `kind`: a `package` (ecosystem, name and version), a
 * `dataset` (a JSON Schema and records), a `file` (a path) or a `claim` (text
 * and the sources it relies on) or `dependencies` (a package-lock.json or a
 * CycloneDX file, by `path` or `content`).
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

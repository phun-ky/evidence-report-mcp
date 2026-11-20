import { Ajv, type SchemaValidateFunction } from 'ajv';

import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import { readDependencies, type Dependency } from './dependencies.js';
import { osvSeverity, type OsvVuln } from './severity.js';
import type { CheckResult, Finding, Target } from './types.js';

const execFileP = promisify(execFile);

type Of<K extends Target['kind']> = Extract<Target, { kind: K }>;

const now = () => new Date().toISOString();

/** Wrap a check so exceptions become status "error" instead of crashing (fail closed). */
async function timed(
  base: Omit<CheckResult, 'status' | 'findings' | 'durationMs' | 'source'> & {
    source: Omit<CheckResult['source'], 'retrievedAt'>;
  },
  run: () => Promise<{
    status: CheckResult['status'];
    findings?: Finding[];
    reason?: string;
  }>
): Promise<CheckResult> {
  const t0 = Date.now();

  try {
    const r = await run();

    return {
      ...base,
      source: { ...base.source, retrievedAt: now() },
      status: r.status,
      findings: r.findings ?? [],
      reason: r.reason,
      durationMs: Date.now() - t0
    };
  } catch (err) {
    return {
      ...base,
      source: { ...base.source, retrievedAt: now() },
      status: 'error',
      findings: [],
      reason: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t0
    };
  }
}

/* ---------------- package: known vulnerabilities (OSV.dev) ---------------- */

const OSV_SOURCE = { name: 'OSV.dev', url: 'https://osv.dev' };

/** One OSV.dev API call: POST with a body, GET without. Errors throw (fail closed). */
async function osv<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(
    `https://api.osv.dev/v1${path}`,
    body === undefined
      ? { signal: AbortSignal.timeout(10_000) }
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10_000)
        }
  );

  if (!res.ok) throw new Error(`OSV responded ${res.status}`);

  return (await res.json()) as T;
}

function vulnFinding(v: OsvVuln, prefix = ''): Finding {
  const severity = osvSeverity(v);

  return {
    severity: severity ?? 'high',
    message:
      prefix +
      (v.summary ?? 'Known vulnerability') +
      (severity ? '' : ' (severity not provided; assumed high)'),
    ref: v.id
  };
}

export function checkOsv(t: Of<'package'>): Promise<CheckResult> {
  return timed(
    { id: 'osv.vulnerabilities', kind: 'deterministic', source: OSV_SOURCE },
    async () => {
      const vulns: OsvVuln[] = [];

      let pageToken: string | undefined;

      for (let page = 0; ; page++) {
        // Fail closed rather than report a partial list as complete.
        if (page === 10)
          throw new Error('OSV returned more than 10 pages of results');

        const body = await osv<{
          vulns?: OsvVuln[];
          next_page_token?: string;
        }>('/query', {
          package: { name: t.name, ecosystem: t.ecosystem },
          version: t.version,
          ...(pageToken ? { page_token: pageToken } : {})
        });

        vulns.push(...(body.vulns ?? []));
        pageToken = body.next_page_token;

        if (!pageToken) break;
      }

      return {
        status: vulns.length ? 'fail' : 'pass',
        findings: vulns.map((v) => vulnFinding(v))
      };
    }
  );
}

/* ---------------- dependencies: a lockfile or an SBOM (OSV.dev batch) ---------------- */

const MAX_FILE = 10 * 1024 * 1024;
const BATCH = 1000;

async function readDependencyFile(t: Of<'dependencies'>): Promise<string> {
  if (t.content !== undefined) return t.content;

  const path = resolve(t.path!);

  if ((await stat(path)).size > MAX_FILE)
    throw new Error(`${t.path} is larger than 10 MB`);

  return readFile(path, 'utf8');
}

/** Fetches each advisory's full record (the batch API returns only ids), eight at a time. */
async function getVulns(ids: string[]): Promise<Map<string, OsvVuln>> {
  const out = new Map<string, OsvVuln>();

  let next = 0;

  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++]!;

      out.set(id, await osv<OsvVuln>(`/vulns/${encodeURIComponent(id)}`));
    }
  };

  await Promise.all(Array.from({ length: Math.min(8, ids.length) }, worker));

  return out;
}

/**
 * Every package in a package-lock.json or a CycloneDX file, looked up on
 * OSV.dev in batches. An entry OSV can't look up (a link outside the workspaces, a git or file
 * dependency, a component without a purl or version) is an `info` finding and
 * keeps the check from passing.
 */
export function checkDependencies(t: Of<'dependencies'>): Promise<CheckResult> {
  return timed(
    { id: 'osv.vulnerabilities', kind: 'deterministic', source: OSV_SOURCE },
    async () => {
      const { resolved, unresolved } = readDependencies(
        await readDependencyFile(t)
      );
      const hits: { dep: Dependency; id: string }[] = [];

      for (let i = 0; i < resolved.length; i += BATCH) {
        const batch = resolved.slice(i, i + BATCH);
        const { results = [] } = await osv<{
          results?: { vulns?: { id: string }[]; next_page_token?: string }[];
        }>('/querybatch', { queries: batch.map((d) => d.query) });

        if (results.length !== batch.length)
          throw new Error(
            `OSV returned ${results.length} results for ${batch.length} queries`
          );

        results.forEach((r, j) => {
          const dep = batch[j]!;

          // Fail closed rather than report a partial list as complete.
          if (r.next_page_token)
            throw new Error(
              `OSV has more results for ${dep.label} than one page`
            );

          for (const v of r.vulns ?? []) hits.push({ dep, id: v.id });
        });
      }

      const vulns = await getVulns([...new Set(hits.map((h) => h.id))]);
      const findings: Finding[] = [
        ...hits.map((h) => vulnFinding(vulns.get(h.id)!, `${h.dep.label}: `)),
        ...unresolved.map((u) => ({
          severity: 'info' as const,
          message: `${u.label}: not looked up (${u.why})`
        }))
      ];
      const total = resolved.length + unresolved.length;

      if (hits.length) return { status: 'fail', findings };

      if (unresolved.length)
        return {
          status: 'skipped',
          reason: `${unresolved.length} of ${total} entries could not be looked up on OSV`,
          findings
        };

      if (!total) return { status: 'skipped', reason: 'No packages found' };

      return { status: 'pass', findings };
    }
  );
}

/* ---------------- dataset: contract conformance (JSON Schema) ---------------- */

// strictSchema: unknown or misspelled keywords make the check error instead of silently passing.
const ajv = new Ajv({
  allErrors: true,
  strictSchema: true,
  strictTypes: false,
  strictTuples: false
});
/** "N·s", "N*s" and "N s" are the same unit. Case matters: mN is not MN. */
// shortcut: separator normalisation only, no aliases ("newton-second") or conversion; add a unit table if agents need it.
const canonicalUnit = (u: string) => u.trim().replace(/\s*[·⋅*\s]\s*/g, '*');

/**
 * `"x-unit": "N*s"` requires the value to be `{ value: number, unit: "N*s" }`.
 * A bare number has no unit to check, so it fails too (Mars Climate Orbiter: lbf·s sent where N·s was expected).
 */
function unitError(expected: string, data: unknown): string | undefined {
  const d = data as { value?: unknown; unit?: unknown } | null;

  if (
    typeof d !== 'object' ||
    d === null ||
    typeof d.value !== 'number' ||
    typeof d.unit !== 'string'
  )
    return `has no declared unit (expected { value: number, unit: "${expected}" })`;

  if (canonicalUnit(d.unit) !== canonicalUnit(expected))
    return `unit "${d.unit}" does not match required "${expected}"`;

  return undefined;
}

const xUnit: SchemaValidateFunction = (expected: string, data: unknown) => {
  const message = unitError(expected, data);

  xUnit.errors = message
    ? [{ keyword: 'x-unit', message, params: { unit: expected } }]
    : [];

  return message === undefined;
};

ajv.addKeyword({
  keyword: 'x-unit',
  schemaType: 'string',
  errors: true,
  validate: xUnit
});

/** Strict mode still allows "x-*" extension keys: register each unknown one as a no-op annotation. */
function allowExtensions(schema: unknown): void {
  if (typeof schema !== 'object' || schema === null) return;

  for (const [k, v] of Object.entries(schema)) {
    if (k.startsWith('x-') && !ajv.getKeyword(k)) ajv.addKeyword(k);

    allowExtensions(v);
  }
}

export function checkSchema(t: Of<'dataset'>): Promise<CheckResult> {
  return timed(
    {
      id: 'schema.conformance',
      kind: 'deterministic',
      source: { name: 'JSON Schema (ajv)' }
    },
    async () => {
      allowExtensions(t.schema);

      const validate = ajv.compile(t.schema);
      const findings: Finding[] = [];

      try {
        t.records.forEach((rec, i) => {
          if (!validate(rec)) {
            for (const e of validate.errors ?? []) {
              findings.push({
                severity: e.keyword === 'x-unit' ? 'high' : 'medium',
                message: `record ${i}: ${e.instancePath || '/'} ${e.message ?? 'invalid'}`,
                ref: `/${i}${e.instancePath}`
              });
            }
          }
        });
      } finally {
        // Ajv caches every compiled schema: without this the cache grows per call and a repeated $id throws.
        ajv.removeSchema(t.schema);
      }

      return { status: findings.length ? 'fail' : 'pass', findings };
    }
  );
}

/* ---------------- dataset: freshness/volume/lineage (observability) ---------------- */

/**
 * Adapter point for Monte Carlo, Soda, Elementary, etc. Either call their
 * API directly, or have this server act as an MCP *client* to their server.
 * Until configured, this reports "skipped" (which keeps the verdict "unknown").
 */
export function checkObservability(t: Of<'dataset'>): Promise<CheckResult> {
  return timed(
    {
      id: 'observability.health',
      kind: 'deterministic',
      source: { name: 'observability adapter' }
    },
    async () =>
      t.assetId
        ? { status: 'skipped', reason: 'No observability provider configured' }
        : { status: 'skipped', reason: 'No assetId given' }
  );
}

/* ---------------- file: content provenance (C2PA) ---------------- */

interface C2paStatus {
  code: string;
  url?: string;
  explanation?: string;
}

/**
 * Runs c2patool (from c2pa-rs) read-only. EVIDENCE_REPORT_MCP_C2PATOOL is the binary's path. Trust
 * anchors come from c2patool's own env (C2PATOOL_TRUST_ANCHORS, C2PATOOL_TRUST_CONFIG,
 * C2PATOOL_ALLOWED_LIST), which it only reads under the `trust` subcommand.
 *
 * Only a trusted signer passes. A missing manifest is NOT a fail (absence of credentials
 * proves nothing) and a valid manifest from an untrusted signer proves only that someone
 * signed it, so both stay "skipped" and keep the verdict "unknown".
 */
export function checkC2pa(t: Of<'file'>): Promise<CheckResult> {
  const tool = process.env.EVIDENCE_REPORT_MCP_C2PATOOL;

  return timed(
    {
      id: 'c2pa.manifest',
      kind: 'deterministic',
      source: { name: tool ? 'c2patool' : 'C2PA validator' }
    },
    async () => {
      if (!tool)
        return {
          status: 'skipped',
          reason:
            'C2PA validator not configured (set EVIDENCE_REPORT_MCP_C2PATOOL)'
        };

      let stdout: string;

      try {
        // Absolute path, so a target like "-o/x" can never be parsed as a c2patool flag.
        ({ stdout } = await execFileP(tool, [resolve(t.path), 'trust'], {
          timeout: 30_000,
          maxBuffer: 16 * 1024 * 1024
        }));
      } catch (err) {
        if (
          /No claim found/.test(String((err as { stderr?: unknown }).stderr))
        ) {
          return {
            status: 'skipped',
            reason:
              'No C2PA manifest found; absence of credentials proves nothing'
          };
        }

        throw err;
      }

      const report = JSON.parse(stdout) as {
        validation_state?: string;
        validation_status?: C2paStatus[];
      };
      const findings: Finding[] = (report.validation_status ?? []).map((s) => ({
        severity: s.code === 'signingCredential.untrusted' ? 'medium' : 'high',
        message: s.explanation ? `${s.code}: ${s.explanation}` : s.code,
        ref: s.url
      }));

      switch (report.validation_state) {
        case 'Trusted':
          return { status: 'pass', findings };
        case 'Invalid':
          return { status: 'fail', findings };
        case 'Valid':
          return {
            status: 'skipped',
            reason:
              'Manifest is intact but its signer is not trusted (configure C2PATOOL_TRUST_ANCHORS)',
            findings
          };
        default:
          throw new Error(
            `Unexpected c2patool validation_state: ${String(report.validation_state)}`
          );
      }
    }
  );
}

/* ---------------- claim: independent corroboration ---------------- */

/**
 * Heuristic by design. Deliberately does not ask an LLM whether the claim is
 * "plausible": that is the generator grading its own homework.
 * A real version would fetch each source and check it independently.
 */
export function checkCorroboration(t: Of<'claim'>): Promise<CheckResult> {
  return timed(
    {
      id: 'claim.corroboration',
      kind: 'heuristic',
      source: { name: 'provided sources' }
    },
    async () => {
      const domains = new Set(
        t.sources.map((s) => new URL(s).hostname.replace(/^www\./, ''))
      );

      if (domains.size < 2) {
        return {
          status: 'fail',
          reason: 'Fewer than two independent source domains',
          findings: [
            {
              severity: 'medium',
              message: `Only ${domains.size} distinct source domain(s)`
            }
          ]
        };
      }

      return {
        status: 'skipped',
        reason: 'Source fetching and matching not implemented'
      };
    }
  );
}

/* ---------------- routing ---------------- */

export interface Plan {
  checks: Promise<CheckResult>[];
  /** Ids that must pass for an overall "pass". */
  required: string[];
  /** Honest limits for this kind of target. */
  notChecked: string[];
}

export function plan(t: Target): Plan {
  switch (t.kind) {
    case 'package':
      return {
        checks: [checkOsv(t)],
        required: ['osv.vulnerabilities'],
        notChecked: [
          'Unpublished or zero-day vulnerabilities',
          'Malicious behaviour without an advisory (typosquats, install scripts)',
          'Whether this package is the right one for the job'
        ]
      };
    case 'dependencies':
      return {
        checks: [checkDependencies(t)],
        required: ['osv.vulnerabilities'],
        notChecked: [
          'Unpublished or zero-day vulnerabilities',
          'Malicious behaviour without an advisory (typosquats, install scripts)',
          'Whether the file matches what is or will be installed',
          'Which registry a package-lock entry came from: each is looked up as an npm package'
        ]
      };
    case 'dataset':
      return {
        checks: [checkSchema(t), checkObservability(t)],
        required: ['schema.conformance', 'observability.health'],
        notChecked: [
          'Whether values are true, only whether they are well-formed',
          'Meaning of units and labels beyond what the schema encodes',
          'Records outside the provided sample'
        ]
      };
    case 'file':
      return {
        checks: [checkC2pa(t)],
        required: ['c2pa.manifest'],
        notChecked: [
          'Whether the depicted content is true or in context',
          'Files whose credentials were stripped in transit',
          'Signers outside the configured trust anchors',
          'Ingredient manifests (earlier edits), only the active manifest'
        ]
      };
    case 'claim':
      return {
        checks: [checkCorroboration(t)],
        required: ['claim.corroboration'],
        notChecked: [
          'Interpretation: what the claim means to its audience',
          'Whether the cited sources are themselves reliable'
        ]
      };
  }
}

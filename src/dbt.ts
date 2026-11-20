import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { CheckStatus, Finding } from './types.js';

/** Artifacts older than this are stale evidence (decided on #63). */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface Metadata {
  metadata?: { generated_at?: string };
}

interface ManifestNode {
  resource_type?: string;
  /** The node a generic test is attached to; null for singular tests. */
  attached_node?: string | null;
  depends_on?: { nodes?: string[] };
}

interface Manifest extends Metadata {
  nodes?: Record<string, ManifestNode>;
  sources?: Record<string, unknown>;
}

interface Result {
  unique_id: string;
  /** run_results: pass, fail, warn, error, skipped (tests); success, error, skipped, ... (models). sources: pass, warn, error, runtime error. */
  status: string;
  message?: string | null;
  max_loaded_at?: string;
}

interface Results extends Metadata {
  results?: Result[];
}

export interface Health {
  status: CheckStatus;
  findings: Finding[];
  reason?: string;
}

// shortcut: reads and parses the artifacts on every call; cache by mtime if large manifests make calls slow.
const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf8')) as T;

/** sources.json only exists after `dbt source freshness`; missing is not an error. */
async function readOptional<T>(path: string): Promise<T | undefined> {
  try {
    return await readJson<T>(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;

    throw err;
  }
}

/** Every source `id` reads from, through any number of models, without recursion. */
function upstreamSources(
  nodes: Record<string, ManifestNode>,
  sources: Record<string, unknown>,
  id: string
): string[] {
  const seen = new Set([id]);
  const queue = [id];
  const found: string[] = [];

  while (queue.length) {
    const current = queue.shift()!;

    if (current in sources) found.push(current);

    for (const next of nodes[current]?.depends_on?.nodes ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  return found;
}

const said = (r: Result) => (r.message ? `: ${r.message}` : '');

/**
 * The health of one dbt node (model, seed, snapshot or source) from a dbt
 * target folder: its tests in run_results.json and the freshness of every
 * source upstream of it in sources.json.
 *
 * - `fail`: a test failed, the node failed to build, or a source is past its
 *   freshness error threshold.
 * - `skipped`: anything that did not run or has no result, stale artifacts, or
 *   a node dbt does not know. Never `pass` on missing evidence.
 * - `pass`: every test passed and every upstream source is fresh. A `warn` is a
 *   medium finding, not a fail.
 */
export async function dbtHealth(
  dir: string,
  assetId: string,
  now = Date.now()
): Promise<Health> {
  const manifest = await readJson<Manifest>(join(dir, 'manifest.json'));
  const runResults = await readJson<Results>(join(dir, 'run_results.json'));
  const freshness = await readOptional<Results>(join(dir, 'sources.json'));
  const artifacts: [string, Metadata | undefined][] = [
    ['manifest.json', manifest],
    ['run_results.json', runResults],
    ['sources.json', freshness]
  ];
  const evidence: Finding[] = [];

  for (const [file, a] of artifacts) {
    if (!a) continue;

    const at = a.metadata?.generated_at;
    const age = now - Date.parse(at ?? '');

    // NaN (no or unreadable time) fails this test too: unknown age is stale
    if (!(age <= MAX_AGE_MS))
      return {
        status: 'skipped',
        reason: `Stale evidence: ${file} was generated at ${at ?? 'an unknown time'}, more than 24 hours ago`,
        findings: []
      };

    evidence.push({
      severity: 'info',
      message: `${file} generated at ${at}`,
      ref: file
    });
  }

  const nodes = manifest.nodes ?? {};
  const sources = manifest.sources ?? {};

  if (!(assetId in nodes) && !(assetId in sources))
    return {
      status: 'skipped',
      reason: `${assetId} is not in the dbt manifest`,
      findings: evidence
    };

  const results = new Map(runResults.results?.map((r) => [r.unique_id, r]));
  const fresh = new Map(freshness?.results?.map((r) => [r.unique_id, r]));
  const fails: Finding[] = [];
  const warns: Finding[] = [];
  const gaps: Finding[] = [];
  const tests = Object.entries(nodes).filter(
    ([, n]) =>
      n.resource_type === 'test' &&
      (n.attached_node
        ? n.attached_node === assetId
        : n.depends_on?.nodes?.includes(assetId))
  );

  if (results.get(assetId)?.status === 'error')
    fails.push({
      severity: 'high',
      message: `${assetId} failed to build${said(results.get(assetId)!)}`,
      ref: assetId
    });

  if (!tests.length)
    gaps.push({ severity: 'info', message: `No dbt tests on ${assetId}` });

  for (const [id] of tests) {
    const r = results.get(id);

    if (r?.status === 'fail')
      fails.push({
        severity: 'high',
        message: `Test failed${said(r)}`,
        ref: id
      });
    else if (r?.status === 'warn')
      warns.push({
        severity: 'medium',
        message: `Test warned${said(r)}`,
        ref: id
      });
    else if (r?.status !== 'pass')
      gaps.push({
        severity: 'info',
        message: r
          ? `Test did not complete (${r.status})${said(r)}`
          : 'Test has no result in run_results.json',
        ref: id
      });
  }

  for (const id of upstreamSources(nodes, sources, assetId)) {
    const r = fresh.get(id);
    const loaded = r?.max_loaded_at ? `, last loaded ${r.max_loaded_at}` : '';

    if (r?.status === 'error')
      fails.push({
        severity: 'high',
        message: `Source is stale${loaded}`,
        ref: id
      });
    else if (r?.status === 'warn')
      warns.push({
        severity: 'medium',
        message: `Source is getting stale${loaded}`,
        ref: id
      });
    else if (r?.status !== 'pass')
      gaps.push({
        severity: 'info',
        message: r
          ? `Freshness not checked (${r.status})${said(r)}`
          : 'No freshness result (run dbt source freshness)',
        ref: id
      });
  }

  const findings = [...fails, ...warns, ...gaps, ...evidence];

  if (fails.length) return { status: 'fail', findings };

  if (gaps.length)
    return {
      status: 'skipped',
      reason: `${gaps.length} test(s) or source(s) without a passing result`,
      findings
    };

  return { status: 'pass', findings };
}

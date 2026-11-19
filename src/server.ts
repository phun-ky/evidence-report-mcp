import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { readFileSync } from 'node:fs';

import { plan } from './checkers.js';
import {
  TargetSchema,
  type CheckResult,
  type EvidenceReport,
  type Target,
  type Verdict
} from './types.js';

// The report and target types, for consumers that read or build them
export type {
  CheckKind,
  CheckResult,
  CheckStatus,
  EvidenceReport,
  Finding,
  Target,
  Verdict
} from './types.js';

const { name, version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as {
  name: string;
  version: string;
};
const VERIFIER = { name, version };

/**
 * Combines check results into one verdict, failing closed, in this order:
 *
 * 1. Any check that failed makes the verdict `fail`, even a heuristic one or
 *    one that is not required.
 * 2. A required check that is missing, errored or was skipped makes it
 *    `unknown`: unknown is not zero.
 * 3. If only heuristic checks are required and passed, it is `unknown`:
 *    judgement can't certify.
 * 4. Otherwise it is `pass`.
 *
 * @param checks - The results of the checks that ran.
 * @param required - The ids of the checks that must pass for a `pass`.
 * @returns The verdict.
 */
export function aggregate(checks: CheckResult[], required: string[]): Verdict {
  if (checks.some((c) => c.status === 'fail')) return 'fail';

  const req = checks.filter((c) => required.includes(c.id));

  if (req.length < required.length || req.some((c) => c.status !== 'pass'))
    return 'unknown';

  if (req.every((c) => c.kind === 'heuristic')) return 'unknown';

  return 'pass';
}

function summarise(verdict: Verdict, checks: CheckResult[]): string {
  const ran = checks.filter(
    (c) => c.status === 'pass' || c.status === 'fail'
  ).length;
  const findings = checks.reduce((n, c) => n + c.findings.length, 0);
  const label = { pass: 'Passed', fail: 'Failed', unknown: 'Could not verify' }[
    verdict
  ];

  return `${label}: ${ran}/${checks.length} checks completed, ${findings} finding(s).`;
}

/**
 * Runs every check for a target and returns the evidence report. Checks never
 * throw: a check that fails to run is reported with status `error`.
 *
 * @param target - What to verify: a package, a dataset, a file or a claim.
 * @returns The report, with the verdict, each check's evidence and what was
 *   not checked.
 */
export async function verify(target: Target): Promise<EvidenceReport> {
  const p = plan(target);
  const checks = await Promise.all(p.checks);
  const verdict = aggregate(checks, p.required);

  return {
    verdict,
    summary: summarise(verdict, checks),
    target,
    checks,
    notChecked: p.notChecked,
    generatedAt: new Date().toISOString(),
    verifier: VERIFIER
  };
}

/**
 * Creates the MCP server with its one tool, `verify`, which is read-only. It
 * is not connected to a transport; the `evidence-report-mcp` command connects
 * it to stdio.
 *
 * @returns The server, ready to connect.
 */
export function createServer(): McpServer {
  const server = new McpServer(VERIFIER);

  server.registerTool(
    'verify',
    {
      title: 'Verify before acting',
      description: [
        'Run independent checks on a package, dataset, media file, or claim and return an evidence report.',
        'Call this BEFORE acting on data you did not produce.',
        "Treat verdict 'unknown' as 'not verified'. Read 'notChecked' before telling a user something is safe or true."
      ].join(' '),
      inputSchema: { target: TargetSchema },
      annotations: { readOnlyHint: true, openWorldHint: true }
    },
    async ({ target }) => {
      const report = await verify(target);

      return {
        content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
        structuredContent: report as unknown as Record<string, unknown>
      };
    }
  );

  return server;
}

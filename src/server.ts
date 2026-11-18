import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { readFileSync } from 'node:fs';

import { plan } from './checkers.js';
import {
  Target,
  type CheckResult,
  type EvidenceReport,
  type Verdict
} from './types.js';

const { name, version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as {
  name: string;
  version: string;
};
const VERIFIER = { name, version };

/**
 * Fail closed:
 *  1. Any failed check            -> "fail"
 *  2. Any required check not run  -> "unknown"  (unknown is not zero)
 *  3. Only heuristics passed      -> "unknown"  (judgment can't certify)
 *  4. Otherwise                   -> "pass"
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
      inputSchema: { target: Target },
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

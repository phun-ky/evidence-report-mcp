import { Ajv, type SchemaValidateFunction } from "ajv";
import { osvSeverity, type OsvVuln } from "./severity.js";
import type { CheckResult, Finding, Target } from "./types.js";

type Of<K extends Target["kind"]> = Extract<Target, { kind: K }>;

const now = () => new Date().toISOString();

/** Wrap a check so exceptions become status "error" instead of crashing (fail closed). */
async function timed(
  base: Omit<CheckResult, "status" | "findings" | "durationMs" | "source"> & {
    source: Omit<CheckResult["source"], "retrievedAt">;
  },
  run: () => Promise<{ status: CheckResult["status"]; findings?: Finding[]; reason?: string }>,
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
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      ...base,
      source: { ...base.source, retrievedAt: now() },
      status: "error",
      findings: [],
      reason: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t0,
    };
  }
}

/* ---------------- package: known vulnerabilities (OSV.dev) ---------------- */

export function checkOsv(t: Of<"package">): Promise<CheckResult> {
  return timed(
    { id: "osv.vulnerabilities", kind: "deterministic", source: { name: "OSV.dev", url: "https://osv.dev" } },
    async () => {
      const vulns: OsvVuln[] = [];
      let pageToken: string | undefined;
      for (let page = 0; ; page++) {
        // Fail closed rather than report a partial list as complete.
        if (page === 10) throw new Error("OSV returned more than 10 pages of results");
        const res = await fetch("https://api.osv.dev/v1/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            package: { name: t.name, ecosystem: t.ecosystem },
            version: t.version,
            ...(pageToken ? { page_token: pageToken } : {}),
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`OSV responded ${res.status}`);
        const body = (await res.json()) as { vulns?: OsvVuln[]; next_page_token?: string };
        vulns.push(...(body.vulns ?? []));
        pageToken = body.next_page_token;
        if (!pageToken) break;
      }
      return {
        status: vulns.length ? "fail" : "pass",
        findings: vulns.map((v) => {
          const severity = osvSeverity(v);
          return {
            severity: severity ?? "high",
            message: (v.summary ?? "Known vulnerability") + (severity ? "" : " (severity not provided; assumed high)"),
            ref: v.id,
          };
        }),
      };
    },
  );
}

/* ---------------- dataset: contract conformance (JSON Schema) ---------------- */

// strictSchema: unknown or misspelled keywords make the check error instead of silently passing.
const ajv = new Ajv({ allErrors: true, strictSchema: true, strictTypes: false, strictTuples: false });

/** "N·s", "N*s" and "N s" are the same unit. Case matters: mN is not MN. */
// shortcut: separator normalisation only, no aliases ("newton-second") or conversion; add a unit table if agents need it.
const canonicalUnit = (u: string) => u.trim().replace(/\s*[·⋅*\s]\s*/g, "*");

/**
 * `"x-unit": "N*s"` requires the value to be `{ value: number, unit: "N*s" }`.
 * A bare number has no unit to check, so it fails too (Mars Climate Orbiter: lbf·s sent where N·s was expected).
 */
const xUnit: SchemaValidateFunction = (expected: string, data: unknown) => {
  const d = data as { value?: unknown; unit?: unknown } | null;
  const message =
    typeof d !== "object" || d === null || typeof d.value !== "number" || typeof d.unit !== "string"
      ? `has no declared unit (expected { value: number, unit: "${expected}" })`
      : canonicalUnit(d.unit) !== canonicalUnit(expected)
        ? `unit "${d.unit}" does not match required "${expected}"`
        : undefined;
  xUnit.errors = message ? [{ keyword: "x-unit", message, params: { unit: expected } }] : [];
  return message === undefined;
};
ajv.addKeyword({ keyword: "x-unit", schemaType: "string", errors: true, validate: xUnit });

/** Strict mode still allows "x-*" extension keys: register each unknown one as a no-op annotation. */
function allowExtensions(schema: unknown): void {
  if (typeof schema !== "object" || schema === null) return;
  for (const [k, v] of Object.entries(schema)) {
    if (k.startsWith("x-") && !ajv.getKeyword(k)) ajv.addKeyword(k);
    allowExtensions(v);
  }
}

export function checkSchema(t: Of<"dataset">): Promise<CheckResult> {
  return timed(
    { id: "schema.conformance", kind: "deterministic", source: { name: "JSON Schema (ajv)" } },
    async () => {
      allowExtensions(t.schema);
      const validate = ajv.compile(t.schema);
      const findings: Finding[] = [];
      try {
        t.records.forEach((rec, i) => {
          if (!validate(rec)) {
            for (const e of validate.errors ?? []) {
              findings.push({
                severity: e.keyword === "x-unit" ? "high" : "medium",
                message: `record ${i}: ${e.instancePath || "/"} ${e.message ?? "invalid"}`,
                ref: `/${i}${e.instancePath}`,
              });
            }
          }
        });
      } finally {
        // Ajv caches every compiled schema: without this the cache grows per call and a repeated $id throws.
        ajv.removeSchema(t.schema);
      }
      return { status: findings.length ? "fail" : "pass", findings };
    },
  );
}

/* ---------------- dataset: freshness/volume/lineage (observability) ---------------- */

/**
 * Adapter point for Monte Carlo, Soda, Elementary, etc. Either call their
 * API directly, or have this server act as an MCP *client* to their server.
 * Until configured, this reports "skipped" (which keeps the verdict "unknown").
 */
export function checkObservability(t: Of<"dataset">): Promise<CheckResult> {
  return timed(
    { id: "observability.health", kind: "deterministic", source: { name: "observability adapter" } },
    async () =>
      t.assetId
        ? { status: "skipped", reason: "No observability provider configured" }
        : { status: "skipped", reason: "No assetId given" },
  );
}

/* ---------------- file: content provenance (C2PA) ---------------- */

/**
 * Adapter point for a C2PA validator (e.g. the Content Authenticity
 * Initiative's c2pa-node / c2pa-rs). A missing manifest is NOT a fail:
 * absence of credentials proves nothing either way.
 */
export function checkC2pa(_t: Of<"file">): Promise<CheckResult> {
  return timed(
    { id: "c2pa.manifest", kind: "deterministic", source: { name: "C2PA validator" } },
    async () => ({ status: "skipped", reason: "C2PA validator not configured" }),
  );
}

/* ---------------- claim: independent corroboration ---------------- */

/**
 * Heuristic by design. Deliberately does not ask an LLM whether the claim is
 * "plausible": that is the generator grading its own homework.
 * A real version would fetch each source and check it independently.
 */
export function checkCorroboration(t: Of<"claim">): Promise<CheckResult> {
  return timed(
    { id: "claim.corroboration", kind: "heuristic", source: { name: "provided sources" } },
    async () => {
      const domains = new Set(t.sources.map((s) => new URL(s).hostname.replace(/^www\./, "")));
      if (domains.size < 2) {
        return {
          status: "fail",
          reason: "Fewer than two independent source domains",
          findings: [{ severity: "medium", message: `Only ${domains.size} distinct source domain(s)` }],
        };
      }
      return { status: "skipped", reason: "Source fetching and matching not implemented" };
    },
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
    case "package":
      return {
        checks: [checkOsv(t)],
        required: ["osv.vulnerabilities"],
        notChecked: [
          "Unpublished or zero-day vulnerabilities",
          "Malicious behaviour without an advisory (typosquats, install scripts)",
          "Whether this package is the right one for the job",
        ],
      };
    case "dataset":
      return {
        checks: [checkSchema(t), checkObservability(t)],
        required: ["schema.conformance", "observability.health"],
        notChecked: [
          "Whether values are true, only whether they are well-formed",
          "Meaning of units and labels beyond what the schema encodes",
          "Records outside the provided sample",
        ],
      };
    case "file":
      return {
        checks: [checkC2pa(t)],
        required: ["c2pa.manifest"],
        notChecked: [
          "Whether the depicted content is true or in context",
          "Files whose credentials were stripped in transit",
        ],
      };
    case "claim":
      return {
        checks: [checkCorroboration(t)],
        required: ["claim.corroboration"],
        notChecked: [
          "Interpretation: what the claim means to its audience",
          "Whether the cited sources are themselves reliable",
        ],
      };
  }
}

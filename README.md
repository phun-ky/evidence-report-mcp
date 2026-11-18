# verify-mcp

A sketch of a "trust layer" MCP server: one `verify` tool an agent calls
*before* acting on data it did not produce. It returns an evidence report,
not a checkmark.

Companion to the talk *Invisible Data: Building Trust in the Age of AI*.

## Run

```sh
npm install
npm run build
claude mcp add verify -- node /path/to/verify-mcp/dist/cli.js
```

## The tool

```ts
verify({ target })
```

`target` is one of:

| kind      | example input                                   | checks                          |
| --------- | ----------------------------------------------- | ------------------------------- |
| `package` | `{ ecosystem: "npm", name, version }`           | OSV.dev advisories              |
| `dataset` | `{ schema, records, assetId? }`                 | JSON Schema contract (incl. `x-unit`), observability adapter |
| `file`    | `{ path }`                                      | C2PA manifest (c2patool)        |
| `claim`   | `{ text, sources: [url, …] }`                   | independent-source corroboration (heuristic) |

### Units: `x-unit`

A property with `"x-unit": "N*s"` must be sent as `{ "value": 4.45, "unit": "N*s" }`.
A different unit (`lbf*s`) or a bare number is a `high` finding. Only separators are
normalised (`N·s` = `N*s` = `N s`); there are no aliases and no conversion.

Schemas are compiled in Ajv strict mode: an unknown or misspelled keyword makes the
check `error` instead of silently passing. `x-*` keys are allowed as annotations.

### C2PA: `c2patool`

Install [c2patool](https://github.com/contentauth/c2pa-rs/releases) (tested with
0.27.23, verify the release checksum) and point the server at it:

```sh
claude mcp add verify \
  -e VERIFY_MCP_C2PATOOL=/path/to/c2patool \
  -e C2PATOOL_TRUST_ANCHORS=/path/to/anchors.pem \
  -- node /path/to/verify-mcp/dist/cli.js
```

`C2PATOOL_TRUST_ANCHORS`, `C2PATOOL_TRUST_CONFIG` and `C2PATOOL_ALLOWED_LIST` are
c2patool's own settings. Only a `Trusted` manifest passes; `Invalid` fails; a
manifest from an untrusted signer, or no manifest at all, is `skipped`, so the
verdict stays `unknown`.

## The report

```jsonc
{
  "verdict": "pass" | "fail" | "unknown",
  "summary": "Failed: 1/2 checks completed, 2 finding(s).",
  "checks": [{ "id", "kind", "status", "source": { "name", "retrievedAt" }, "findings", "reason" }],
  "notChecked": ["Whether values are true, only whether they are well-formed", "…"],
  "generatedAt": "…",
  "verifier": { "name": "verify-mcp", "version": "0.1.0" }
}
```

## Rules baked in

1. **Evidence, not verdicts.** Every check lists its source and timestamp.
   `notChecked` is always present, so limits are never silent.
2. **Deterministic first.** Checks are labelled `deterministic` or
   `heuristic`. Heuristics can fail a target but can never pass it alone.
3. **Independent checks.** No LLM "plausibility" scoring. The verifier never
   asks the generator to grade itself.
4. **Unknown ≠ verified.** A required check that errors or is skipped makes
   the verdict `unknown`. Exceptions become `error`, never a crash or a pass.
5. **Verify the verifier.** This server is a dependency too: pin it, scan it,
   and keep it read-only (`readOnlyHint: true`).

## What's stubbed

- `checkObservability`: wire to Monte Carlo, Soda, Elementary, etc. (their
  API, or act as an MCP client to their MCP server).
- `checkCorroboration`: fetches nothing yet; only enforces two distinct
  source domains.

## Ideas for v0.2

- `verify` over a lockfile or SBOM (OSV batch API).
- A signed report (Sigstore) so downstream systems can trust the verifier's
  output, not just the agent's summary of it.

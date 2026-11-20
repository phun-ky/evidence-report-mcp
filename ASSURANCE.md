# Assurance Case

Why the [security expectations](SECURITY.md#security-expectations) of
`evidence-report-mcp` hold, what they rest on, and where they don't hold yet.
The server is small: one tool, four kinds of target, three runtime dependencies,
and a build and release pipeline.

## What is being protected

- **Agents and the people relying on them:** a report must say what was checked,
  against which source and when, and what wasn't. It must never say `pass` when
  a required check didn't run.
- **The machine the server runs on:** the server must read only what a target
  names, write nothing, start nothing but `c2patool`, and send nothing anywhere
  but the package lookup on OSV.dev.
- **The published package:** what users install from npm must be exactly what
  this repository built, with nothing added on the way.
- **The repository and its release pipeline:** the source, the workflows and the
  credentials that publish releases.

## Threat model

| Threat                               | Where                                                          | How it is countered                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A report that overstates             | The verdict                                                    | `aggregate()` fails closed: a failed check means `fail`; a required check that is missing, errored or skipped means `unknown`; heuristic checks alone can't pass. Every check is wrapped so an exception becomes `error`. `notChecked` is never empty. Tests cover each rule                                                                                                                               |
| Hostile tool input                   | The `verify` tool's `target`                                   | zod validates every call against `TargetSchema` before any check runs. Unknown kinds and missing fields are rejected, and so are strings, schemas and records over the size limits                                                                                                                                                                                                                         |
| Reading or running more than asked   | `file` and `dependencies` targets, `c2patool`, dbt artifacts   | `c2patool` is started without a shell, from a configured path, with the file as an absolute path so it is never read as an option, a 30 second timeout and a 16 MiB output limit. A lockfile or SBOM is read only up to 10 MB, and dbt artifacts only from the configured folder. The server writes no files                                                                                               |
| Leaking data or reaching out         | The network                                                    | One destination, OSV.dev (`/v1/query`, `/v1/querybatch` and `/v1/vulns/{id}` under `https://api.osv.dev`), over HTTPS with Node's certificate checks, a 10 second timeout per request, at most 10 pages for a package, and no partial batch results. Claim source URLs are parsed for their host name and never fetched; JSON Schema `$ref`s are never loaded. No listening port: stdio only. No telemetry |
| A tampered or substituted release    | npm                                                            | Releases are built and published only from GitHub Actions with npm trusted publishing (no long-lived npm token) and carry Sigstore-signed provenance, verifiable with `npm audit signatures`. Each GitHub release has a CycloneDX SBOM. `check:pack` installs and runs the packed package before every release                                                                                             |
| A malicious or vulnerable dependency | Runtime dependencies, development dependencies, GitHub Actions | Three runtime dependencies, each widely used; `npm audit` blocks releases on high or critical runtime advisories; dependency review blocks pull requests; Dependabot proposes updates weekly, held 14 days; `check:pack` fails when the build imports anything undeclared; Actions are pinned to commit SHAs                                                                                               |
| A malicious change to the source     | Pull requests                                                  | Pull requests only, with required checks (lint, typecheck, tests with coverage, build, packaging, dependency review, the DCO) and no high or critical CodeQL alerts on `main`; no force pushes or deletion of `main`                                                                                                                                                                                       |
| Abuse of CI credentials              | Workflows                                                      | Read-only default permissions in every workflow, write only per job; pull requests from forks get no secrets; no untrusted value is interpolated into a script; one repository secret (`GH_TOKEN`), used only by the publish workflow; secret scanning with push protection                                                                                                                                |

## Trust boundaries

1. **Agent to server:** the MCP client sends a `target`, which may come from a
   prompt or from data the agent is reading. zod checks its shape; each check
   then treats it as data, never as code, a command or a URL to fetch.
2. **Server to its sources:** OSV.dev answers over HTTPS and is reported as it
   answers, with its name and the time. `c2patool` and its trust settings are
   trusted as configured by whoever runs the server. A JSON Schema comes from
   the agent, and Ajv treats schemas as trusted code; see
   [known gaps](#known-gaps).
3. **Repository to npm:** only the publish workflow, after a merge to `main` and
   the release guard, can publish, through npm trusted publishing.
4. **npm to the user:** the package manager fetches the package; provenance and
   the registry's integrity hashes link it to this repository and build.

## Secure design principles

- **Fail-safe defaults:** a check that can't decide is `skipped` or `error`, and
  either keeps a required check from passing. No configuration means the C2PA
  check is `skipped`, and no trust anchors means an intact manifest is still not
  a `pass`.
- **Least privilege:** the server is read-only, opens no port, reaches one host
  and starts one process. CI tokens are read-only by default and write only
  where a job needs it.
- **Economy of mechanism:** one tool, one function per check, and one function
  that works out the verdict.
- **Complete mediation:** every call goes through `TargetSchema` before any
  check runs.
- **Open design:** everything is public, including the release pipeline, the
  checks and this document.
- **Separation of judgement:** no language model scores anything in the
  verifier, and heuristic checks are labelled and can't pass a target alone.
- **Minimal dependencies:** three runtime dependencies, with caret ranges so
  users get fixes, checked in CI against what the build imports.

## Common weaknesses countered

| Weakness                                           | Status                                                                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| CWE-20 improper input validation                   | zod checks every call against `TargetSchema`                                                                           |
| CWE-78 OS command injection                        | `c2patool` is started without a shell, with arguments as an array and the file as an absolute path                     |
| CWE-88 argument injection                          | The file path is made absolute, so it can't start with `-` and be read as an option                                    |
| CWE-94 code injection                              | No `eval` or `new Function` in the server's code; Ajv generates validators from schemas, see [known gaps](#known-gaps) |
| CWE-918 server-side request forgery                | The only URL fetched is fixed in the code; claim sources and schema `$ref`s are never fetched                          |
| CWE-400 uncontrolled resource consumption          | Timeouts on OSV.dev (10 seconds, 10 pages) and `c2patool` (30 seconds, 16 MiB); none on schema validation, see below   |
| CWE-829 inclusion from an untrusted control sphere | Declared runtime dependencies, provenance on releases, Actions pinned to SHAs                                          |
| CWE-494 download of code without integrity check   | npm verifies integrity hashes; releases carry signed provenance                                                        |

## Known gaps

- **Hostile schemas:** Ajv treats a schema as trusted code, but here it comes
  from the agent. A very deep or large schema can be slow to compile or overflow
  the stack, a `pattern` can make validation slow, and there are no limits on
  records or schema size. Limits are considered in the
  [roadmap](ROADMAP.md#considered-not-scheduled).
- **File paths:** a `file` target can name any file the server process can read.
  Run the server with no more rights than it needs.
- **Stub checks:** the dataset observability check and claim corroboration are
  `skipped` today, so datasets and claims are never verified as `pass`.
- **No fuzzing:** the input schema and the checks are tested with examples, not
  fuzzed.
- **One maintainer:** pull requests by the maintainer get no second review, and
  access to the repository and the package rests on one person; see
  [governance](GOVERNANCE.md#continuity).
- **Tags are not signed;** releases are verified through npm provenance instead.

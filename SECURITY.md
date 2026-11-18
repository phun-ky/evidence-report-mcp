# Security Policy

`evidence-report-mcp` is a read-only MCP server with three runtime dependencies:
`@modelcontextprotocol/sdk`, `ajv` and `zod`. How dependencies are chosen,
tracked and kept clear of known vulnerabilities is described under
[Dependencies](#dependencies).

## Supported Versions

No version has been published yet.

| Release              | Supported                |
| -------------------- | ------------------------ |
| Newest `0.x` release | ✅                       |
| Older `0.x` releases | ❌ upgrade to the newest |
| Unreleased `main`    | ✅ fixes land here first |

- **Until 1.0, only the newest release gets fixes.** A fix is released as a new
  version. While the version starts with `0.`, a minor release may change the
  API, and the release notes say what changed.
- **Security comes first.** If a vulnerability can't be fixed without changing
  the API or the `EvidenceReport` shape, the fix changes it, and the advisory
  and the release notes say what changed and why.

## Reporting a Vulnerability

Report vulnerabilities privately, either with GitHub's
[private vulnerability reporting](https://github.com/phun-ky/evidence-report-mcp/security/advisories/new)
or by email to <security@phun-ky.net>. Please don't open a public issue for a
security problem.

A report is in scope when the server does something this policy says it doesn't,
for example writing a file, contacting a host other than OSV.dev, running code
from its input, or reporting `pass` when a required check errored or was
skipped.

## How Reports Are Handled

1. **Acknowledgement:** you'll get a reply within 7 days confirming the report
   was received.
2. **Assessment:** the maintainer reproduces the issue and judges its severity,
   and may ask you for details.
3. **Fix:** a fix is developed in a private GitHub security advisory and
   released as a new version. The aim is a fix within 30 days for serious
   issues.
4. **Disclosure:** the advisory is published when the fix is released, with a
   CVE where one applies. Please keep the issue private until then.
5. **Credit:** reporters are credited in the advisory and the release notes,
   unless they ask to stay anonymous.

## Security Expectations

`evidence-report-mcp` gathers evidence about a target and reports it. It does
not make a target safe, and a report is only as good as the checks behind it.

What you can rely on:

- **Read-only.** The server writes no files and changes nothing. The only
  process it starts is `c2patool`, with the `trust` subcommand, which reads the
  file and writes nothing.
- **One network destination.** For a `package` target the server sends the
  package name, ecosystem and version to `https://api.osv.dev/v1/query`, with a
  10 second timeout per request and at most 10 pages of results. Nothing else is
  sent anywhere: the source URLs of a `claim` target are parsed for their host
  name and never fetched, and JSON Schema `$ref`s are never loaded from the
  network.
- **No listening port.** The server talks to its client over stdio only.
- **No data collection.** There is no telemetry.
- **Fail closed.** A check that throws is reported as `error`, and a required
  check that errors or is skipped makes the verdict `unknown`, never `pass`.
  Heuristic checks can fail a target but can never make it pass.
- **No shell.** `c2patool` is started directly, without a shell, from the path
  in `EVIDENCE_REPORT_MCP_C2PATOOL`. The file path is passed as an absolute
  path, so it is never read as an option, and the run has a 30 second timeout
  and a 16 MiB output limit.
- **No `eval` in the server's own code.** The only generated code is Ajv's: Ajv
  compiles each JSON Schema into a JavaScript validation function, which is how
  Ajv works.

What you can't rely on:

- **A `pass` as proof.** A `pass` means the named checks passed against their
  sources at the time in `retrievedAt`. Each report lists what it did not check
  in `notChecked`; read it before acting.
- **Limits on file paths.** A `file` target can name any file the server process
  can read, and `c2patool` reads it. When `c2patool` fails, its error message,
  which can name the file, is returned in the check's `reason`. Run the server
  with no more rights than it needs.
- **Safety with hostile schemas.** Ajv's
  [security model](https://ajv.js.org/security.html) treats schemas as trusted
  as application code, and here the schema comes from the agent. A very deep or
  large schema can be slow to compile or overflow the stack, and a `pattern`
  runs as a JavaScript regular expression, so it can make validation slow. There
  are no limits on the number of records or the size of a schema, schema
  validation has no timeout, and there are no rate limits.
- **The sources themselves.** OSV.dev results are reported as OSV.dev returns
  them, over HTTPS. The `c2patool` binary and its trust settings
  (`C2PATOOL_TRUST_ANCHORS`, `C2PATOOL_TRUST_CONFIG`, `C2PATOOL_ALLOWED_LIST`)
  are trusted as configured by whoever runs the server.
- **Privacy of package names.** Package names and versions checked are sent to
  OSV.dev.

## Verifying Releases

No release has been published yet. This section will describe how to verify one
when the first release is published.

## Dependencies

**Choosing them.** The fewer runtime dependencies, the better. A new one is
discussed in an issue first, and must be widely used, actively maintained and
under an OSI-approved licence compatible with MIT; strong copyleft licences
(GPL, AGPL) are not accepted for runtime dependencies. Development dependencies
follow the same rules, judged more loosely.

**Obtaining them.** Packages come only from the npm registry. Runtime
dependencies use caret ranges, so projects that install this one get their
security fixes; development dependencies use exact versions. CI installs exact
versions from `package-lock.json` with `npm ci`. GitHub Actions are pinned to
commit SHAs.

**Tracking them.** Dependabot proposes version updates weekly, held back until a
version is 14 days old, and security updates as soon as an advisory is
published. Every pull request runs
[dependency review](https://github.com/phun-ky/evidence-report-mcp/blob/main/.github/workflows/dependency-review.yml),
which fails when a change adds a dependency with a known vulnerability of any
severity.

**Fixing known vulnerabilities.** Findings are checked against the GitHub
Advisory Database:

| Finding          | Where                  | What happens                               |
| ---------------- | ---------------------- | ------------------------------------------ |
| Any severity     | New dependency         | Blocks merging (dependency review)         |
| Critical or high | Runtime dependency     | Fixed and released within 7 days           |
| Critical or high | Development dependency | Fixed within 30 days                       |
| Moderate or low  | Any dependency         | Fixed with the next update, within 90 days |

**Accepted exceptions.** A vulnerability that can't be fixed yet and can't be
exploited through this project is allowed in dependency review. Each one is
listed here and removed as soon as a fixed release reaches the tree:

| Advisory                                                                 | Package            | Why it is accepted                                                                                                                                                                |
| ------------------------------------------------------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) | `picomatch` (high) | Development only, through `eslint-config-phun-ky`. A ReDoS in glob matching, reached only by this repository's own lint glob patterns, never by input. No patched version exists. |
| [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7) | `katex` (low)      | Development only, through `eslint-config-phun-ky` > `@eslint/markdown` > `micromark-extension-math`, which holds it at 0.16. Linting parses Markdown and never renders math.      |

## Code Scanning

CodeQL (GitHub default setup) analyses the JavaScript and TypeScript code and
the GitHub Actions workflows on every pull request and every push to `main`. The
ruleset on `main` blocks merging while CodeQL reports an error, or a security
alert of high or critical severity. OpenSSF Scorecard runs on every push to
`main`.

## Secrets

The repository has no secrets. Workflows use only the short-lived `GITHUB_TOKEN`
GitHub gives each run, with read-only permissions unless a job needs more.
Secret scanning with push protection blocks commits that contain a secret.

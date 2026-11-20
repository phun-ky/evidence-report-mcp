# Security Policy

`evidence-report-mcp` is a read-only MCP server with three runtime dependencies:
`@modelcontextprotocol/sdk`, `ajv` and `zod`. How dependencies are chosen,
tracked and kept clear of known vulnerabilities is described under
[Dependencies](#dependencies).

## Supported Versions

Releases are published to npm as
[`evidence-report-mcp`](https://www.npmjs.com/package/evidence-report-mcp); the
[changelog](CHANGELOG.md) lists each one.

| Release              | Supported                |
| -------------------- | ------------------------ |
| Newest `0.x` release | ✅                       |
| Older `0.x` releases | ❌ upgrade to the newest |
| Unreleased `main`    | ✅ fixes land here first |

- **Until 1.0, only the newest release gets fixes.** A fix is released as a new
  version. Releases follow semantic versioning: a change that breaks the API or
  the `EvidenceReport` shape is a new major version, so the first one releases
  1.0.0, and the release notes say what changed.
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

- **Read-only.** The server writes no files and changes nothing. It reads the
  file at a `dependencies` target's `path`, and the dbt artifacts in
  `EVIDENCE_REPORT_MCP_DBT_TARGET`. The only process it starts is `c2patool`,
  with the `trust` subcommand, which reads the file and writes nothing.
- **One network destination.** For a `package` target the server sends the
  package name, ecosystem and version to `https://api.osv.dev/v1/query`, with at
  most 10 pages of results. For a `dependencies` target it sends each package's
  name and version, or its purl, to `https://api.osv.dev/v1/querybatch`, and the
  id of each advisory found to `https://api.osv.dev/v1/vulns/{id}`. Every
  request has a 10 second timeout. Nothing else is sent anywhere: the source
  URLs of a `claim` target are parsed for their host name and never fetched, and
  JSON Schema `$ref`s are never loaded from the network.
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
  can read, and `c2patool` reads it; so can a `dependencies` target's `path`,
  which the server reads (up to 10 MB). When reading fails, the error message,
  which can name the file, is returned in the check's `reason`. Run the server
  with no more rights than it needs.
- **Safety with hostile schemas.** Ajv's
  [security model](https://ajv.js.org/security.html) treats schemas as trusted
  as application code, and here the schema comes from the agent. A very deep or
  large schema can be slow to compile or overflow the stack, and a `pattern`
  runs as a JavaScript regular expression, so it can make validation slow. The
  input is limited (a schema nested at most 32 deep and at most 100 KB, at most
  1000 records and 1 MB of them; see the guide), but schema validation has no
  timeout, and there are no rate limits.
- **The sources themselves.** OSV.dev results are reported as OSV.dev returns
  them, over HTTPS. The `c2patool` binary and its trust settings
  (`C2PATOOL_TRUST_ANCHORS`, `C2PATOOL_TRUST_CONFIG`, `C2PATOOL_ALLOWED_LIST`)
  are trusted as configured by whoever runs the server, and so are the dbt
  artifacts in `EVIDENCE_REPORT_MCP_DBT_TARGET`.
- **Privacy of package names.** Package names and versions checked, including
  every package in a lockfile or SBOM, are sent to OSV.dev.

## Verifying Releases

The first release, 0.1.0, is published by hand and has no provenance. Every
later release is published from GitHub Actions with npm trusted publishing, and
carries a signed provenance attestation (Sigstore) that links it to the commit
and workflow run that built it. To verify the packages you've installed:

```shell
npm audit signatures
```

The provenance must name the repository `phun-ky/evidence-report-mcp` and the
workflow `.github/workflows/publish.yml`. The package's page on npm shows this
under "Provenance", and
`npm view evidence-report-mcp@<version> dist.attestations` lists the
attestations.

Each of those GitHub releases also has a software bill of materials attached, in
CycloneDX format (`evidence-report-mcp-<version>.cdx.json`), listing the runtime
dependencies.

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
severity, and every automated release runs `npm audit` on runtime dependencies
first.

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
listed here, and in
[`vex.openvex.json`](https://github.com/phun-ky/evidence-report-mcp/blob/main/vex.openvex.json)
as OpenVEX statements, and removed as soon as a fixed release reaches the tree:

| Advisory                                                                 | Package              | Why it is accepted                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) | `picomatch` (high)   | Development only, through `eslint-config-phun-ky`. A ReDoS in glob matching, reached only by this repository's own lint glob patterns, never by input. No patched version exists.                                                                                                                                         |
| [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7) | `katex` (low)        | Development only, through `eslint-config-phun-ky` > `@eslint/markdown` > `micromark-extension-math`, which holds it at 0.16. Linting parses Markdown and never renders math.                                                                                                                                              |
| [GHSA-c475-qrg2-pj4r](https://github.com/advisories/GHSA-c475-qrg2-pj4r) | `basic-ftp` (high)   | Development only, through `release-it` > `proxy-agent` > `pac-proxy-agent` > `get-uri`, each pinned to an exact version. A slow directory-listing parser, reached only when a proxy auto-config file is fetched over `ftp://`; releases never do that. Fixed in `proxy-agent` 8.0.3, which `release-it` does not use yet. |
| [GHSA-5pm8-86m8-9m6r](https://github.com/advisories/GHSA-5pm8-86m8-9m6r) | `basic-ftp` (medium) | As above: a crash in the directory-listing parser, reached only over `ftp://`.                                                                                                                                                                                                                                            |
| [GHSA-r4jh-29pc-gfqr](https://github.com/advisories/GHSA-r4jh-29pc-gfqr) | `basic-ftp` (medium) | As above: a crash on a password or path with a line break, reached only over `ftp://`.                                                                                                                                                                                                                                    |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | `minimatch` (medium) | Development only, through `typedoc`, which builds the API docs. A slow glob pattern match, reached only by this repository's own entry point and exclude patterns, never by input. Fixed in `minimatch` 11.0.1, which `typedoc` 0.28 does not allow.                                                                      |

## Code Scanning

CodeQL (GitHub default setup) analyses the JavaScript and TypeScript code and
the GitHub Actions workflows on every pull request and every push to `main`. The
ruleset on `main` blocks merging while CodeQL reports an error, or a security
alert of high or critical severity. OpenSSF Scorecard runs on every push to
`main`.

## Secrets

The project keeps as few secrets as possible:

| Secret          | Used by       | For                                                   |
| --------------- | ------------- | ----------------------------------------------------- |
| `GH_TOKEN`      | `publish.yml` | Pushing release commits and tags, and GitHub releases |
| `CODECOV_TOKEN` | `check.yml`   | Uploading test coverage to Codecov                    |

Publishing to npm needs no secret: it uses short-lived OIDC tokens from GitHub.
Beyond these, workflows use only the `GITHUB_TOKEN` GitHub gives each run, with
read-only permissions unless a job needs more.

- **Storage:** secrets are kept only as encrypted GitHub Actions secrets, never
  in the repository. Secret scanning with push protection blocks commits that
  contain one.
- **Access:** only the maintainer can view or change them, and they are not
  available to workflows run from forks.
- **Rotation:** at least once a year, and immediately if one may have been
  exposed.

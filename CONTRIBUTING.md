# Contributing to evidence-report-mcp

Thanks for taking the time to contribute. Bug reports, ideas, documentation and
code are all welcome. This guide says how each is handled, so please read the
part that fits before you start.

## Contents

- [Code of Conduct](#code-of-conduct)
- [Questions](#questions)
- [Reporting bugs](#reporting-bugs)
- [Suggesting changes](#suggesting-changes)
- [Contributing code](#contributing-code)
  - [Design rules](#design-rules)
  - [Architecture](#architecture)
  - [Development](#development)
  - [Coding style](#coding-style)
  - [Tests](#tests)
  - [Documentation](#documentation)
  - [Dependencies](#dependencies)
  - [Developer Certificate of Origin](#developer-certificate-of-origin)
  - [Commits and pull requests](#commits-and-pull-requests)
  - [Deprecations](#deprecations)
  - [Releases](#releases)

## Code of Conduct

Everyone taking part in this project is expected to follow the
[Code of Conduct](CODE_OF_CONDUCT.md). Report unacceptable behaviour to
<code-of-conduct@phun-ky.net>.

## Questions

Read the [documentation](https://phun-ky.net/evidence-report-mcp/) first, then
search the [issues](https://github.com/phun-ky/evidence-report-mcp/issues). If
neither answers your question, open an issue and say what you're trying to do,
with the versions of the package, Node.js and your MCP client.

## Reporting bugs

> Never report a security problem in a public issue. Report it privately, as the
> [security policy](SECURITY.md#reporting-a-vulnerability) describes.

Before you report a bug, check that you're on the newest version and search the
issues for it. A good report holds:

- the target you passed to `verify`, or the MCP call your client made;
- the report you got back, and what you expected instead;
- the versions of the package, Node.js and your MCP client, and of `c2patool`
  for media files;
- whether it happens every time.

The maintainer labels each report and tries to reproduce it. A report that can't
be reproduced is marked `pending: need repro` until it can; a reproduced bug is
marked `🐛 needs fix`.

## Suggesting changes

Suggestions are GitHub issues too. Check the [roadmap](ROADMAP.md) first,
including what is not planned, and add to an existing suggestion before opening
a new one. Say what happens today, what you'd like instead, and why it would
help most users.

Discuss these in an issue before writing code:

- any change to the shape of the `EvidenceReport`, which agents depend on;
- a new check, or a new kind of target;
- a new runtime dependency.

## Contributing code

### Design rules

Every change keeps the five rules the verifier is built on. The
[evidence report guide](https://phun-ky.net/evidence-report-mcp/guide/report#rules-baked-in)
explains them for users.

1. **Evidence, not verdicts.** Every check records its source, a `retrievedAt`
   time and its findings. `notChecked` is always present and never empty.
2. **Deterministic first.** Every check is labelled `deterministic` or
   `heuristic`. A heuristic check can fail a target but never make it pass on
   its own.
3. **Independent checks.** No language model scores anything inside the
   verifier.
4. **Fail closed.** A required check that errors or is skipped makes the verdict
   `unknown`, never `pass`. A check never throws: wrap it in `timed()`, which
   turns an exception into status `error`.
5. **Verify the verifier.** The server stays read-only, with as few dependencies
   as possible.

### Architecture

- **`src/types.ts`:** the input schema (`TargetSchema`, in zod) and the
  `EvidenceReport` types.
- **`src/checkers.ts`:** one function per check, and `plan()`, which gives each
  kind of target its checks, the ones that must pass, and its `notChecked` list.
  A new check is a function here and an entry in `plan()`.
- **`src/severity.ts`:** turns OSV.dev severities (labels and CVSS 3.x scores)
  into a finding's `severity`.
- **`src/server.ts`:** `aggregate()` works out the verdict, `verify()` runs a
  plan into a report, and `createServer()` exposes `verify` as an MCP tool. It
  can be imported without side effects.
- **`src/cli.ts`:** the `evidence-report-mcp` bin, which connects the server to
  stdio.
- **`scripts/`:** the checks that run in CI on the package, the README and the
  docs site, and the logo renderer.
- **`docs/`:** the [docs site](https://phun-ky.net/evidence-report-mcp/), built
  with VitePress.

### Development

You need Node.js 24 and npm 11. The package runs on Node.js 22.12.0 or later,
and CI also tests and builds it on 22.12.0.

```sh
npm ci
npm run build
npm test
npm run check:pack
```

`npm ci` also sets `core.hooksPath` to `.githooks`, which turns on the commit
hooks described under
[Developer Certificate of Origin](#developer-certificate-of-origin).

| Command                       | What it does                                                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`               | Compiles `src` to `dist`: JavaScript, declarations and source maps, without the tests                                                                      |
| `npm start`                   | Starts the MCP server over stdio, from `dist`                                                                                                              |
| `npm test`                    | Runs the tests                                                                                                                                             |
| `npm run test:ci`             | Runs the tests with coverage, as CI does                                                                                                                   |
| `npm run typecheck`           | Type-checks the source and the tests                                                                                                                       |
| `npm run lint`                | Lints TypeScript, JavaScript and Markdown with ESLint; `lint:fix` fixes what it can                                                                        |
| `npm run format:check`        | Checks formatting with Prettier, JSON and YAML included; `format` fixes it                                                                                 |
| `npm run check:pack`          | After `build`: packs the package, lints it, installs it in an empty project, imports it, runs the bin and the README's examples, and checks dependencies   |
| `npm run check:bestpractices` | Checks `.bestpractices.json`: every answer has a valid status and a justification, and every repository link in it and in `security-insights.yml` resolves |
| `npm run bestpractices:url`   | Prints bestpractices.dev links that propose the answers that differ from the saved project; `--level passing` or `silver`                                  |
| `npm run test:hooks`          | Tests the commit hooks                                                                                                                                     |
| `npm run test:readme`         | Tests the README examples check                                                                                                                            |
| `npm run docs:dev`            | Serves the docs site with live reload                                                                                                                      |
| `npm run docs:build`          | Builds the docs site, after generating the API pages with TypeDoc                                                                                          |
| `npm run docs:preview`        | Serves the built docs site                                                                                                                                 |
| `npm run docs:check`          | Checks the API documentation comments with TypeDoc                                                                                                         |
| `npm run check:site`          | After `docs:build`: loads every page in headless Chrome and checks requests, accessibility, links and layout                                               |
| `npm run test:site`           | Tests the site checks                                                                                                                                      |
| `npm run render:logo`         | Redraws the logo PNGs from the SVGs and design tokens; needs Chrome and Python with Pillow                                                                 |
| `npm run release:dry-run`     | Shows whether merging would release, and the planned version and changelog                                                                                 |

`check:site`, `test:site` and `render:logo` need Google Chrome, or
`CHROME=/path/to/chrome`.

### Coding style

TypeScript in strict mode with ES modules; relative imports end in `.js`. Code
follows the ESLint configuration (`eslint-config-phun-ky`) and Prettier. A
contribution must pass `lint`, `format:check`, `typecheck` and `docs:check`,
which all run in CI.

All tool input is validated with zod before it is used. Write in British
English, in code comments and documentation too.

### Tests

- **Tests live in `src/__tests__/`** as `*.spec.ts`, and use only `node:test`
  and `node:assert/strict`. Tests for the scripts live in `scripts/__tests__/`.
- **No network.** Mock `fetch` with `mock.method(globalThis, 'fetch', ...)`.
  Media file tests use a fake `c2patool` script, never the real binary.
- **New behaviour comes with tests; a bug fix comes with a test** that fails
  without it.
- **Coverage must not drop.** `npm run test:ci` fails below 96% of lines and
  100% of branches and functions. The lines it can't reach are the bin's shebang
  and the doc comments on type-only declarations.

### Documentation

- A change users can see updates the [README](README.md) or the guide in
  `docs/guide/` in the same pull request.
- Exported functions and types have TSDoc comments; the API pages are generated
  from them. `docs:check` fails on a broken `{@link}`, or on a type the API uses
  but doesn't export. Don't commit `docs/api/`.
- The README's TypeScript and JavaScript examples run in CI against the packed
  package, offline. A `console.log(...); // value` line must print that value.
  Answers from OSV.dev come from `scripts/fixtures/osv.json`; an example that
  checks another package needs its answer recorded there. Put
  `<!-- illustrative -->` before an example that shouldn't run.

### Dependencies

- Ask in an issue before adding a dependency.
- Runtime dependencies use caret ranges, so users get fixes; development
  dependencies use exact versions. `check:pack` fails otherwise, and also when
  the build imports a package that isn't a runtime dependency.
- The [security policy](SECURITY.md#dependencies) says how dependencies are
  chosen and tracked, and which advisories are accepted.

### Developer Certificate of Origin

Every commit must be signed off under the
[Developer Certificate of Origin](https://developercertificate.org/) (DCO): a
statement that you wrote the change, or otherwise have the right to submit it
under the project's licence. The sign-off is a line at the end of the commit
message:

```text
Signed-off-by: Your Name <you@example.com>
```

- `git commit -s` adds it, and so does the hook in
  `.githooks/prepare-commit-msg` once `npm ci` has turned the hooks on.
- Forgot? Run `git rebase --signoff main`, then `git push --force-with-lease`.

The DCO check on every pull request fails if a commit isn't signed off.

The hook in `.githooks/commit-msg` rejects commit messages that credit an AI
tool, such as a `Co-Authored-By` trailer naming one or a "Generated with" line.
CI runs the same check on every commit in a pull request.

### Commits and pull requests

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:` and so on. The
  maintainer adds a gitmoji after the colon (`feat: 🎸`, `fix: 🐛`); that is
  optional. The changelog and the next version come from these, so pick the type
  that fits.
- A breaking change uses `type!:` and a `BREAKING CHANGE:` footer that says what
  to change. A change to the `EvidenceReport` shape that breaks existing readers
  is breaking.
- Open the pull request against `main`. Its title is a conventional commit line.
  Say what changed and how to test it, and link the issue with `Closes #n`.
- The `check` job (lint, format, typecheck, tests with coverage, build, the
  package and README checks, the API docs and the docs site), dependency review,
  CodeQL and the DCO check must pass, the branch must be up to date with `main`,
  and review threads must be resolved. Pull requests are merged with a merge
  commit.

### Deprecations

Deprecating something isn't a breaking change, so it can land in any release.
Mark it `@deprecated` in its TSDoc, with what to use instead, and say so in the
pull request. It keeps working until the next major version at the earliest:
deprecated during 0.x, it can go in 1.0.0; deprecated during 1.x, in 2.0.0. A
field of the `EvidenceReport` is deprecated the same way, and keeps being filled
in until it is removed.

### Releases

The maintainer merges pull requests. Releases then follow from GitHub Actions:

1. When a merged pull request touches the published files, the publish workflow
   checks whether there is anything to release: a `feat`, `fix`, `perf` or
   `revert` commit, or a breaking change, that touches them. Anything else waits
   for the next release.
2. If so, it checks the runtime dependencies with `npm audit`, then release-it
   picks the version from the commits, updates `CHANGELOG.md`, builds and checks
   the package, and publishes it to npm with provenance.
3. The release commit and tag (`1.2.3`) go to `main`, and a GitHub release is
   created with a CycloneDX software bill of materials attached.

Before 1.0, a breaking change releases 1.0.0. `npm run release:dry-run` shows
what merging would release.

# Roadmap

What evidence-report-mcp intends to do, and not do, from November 2026 to
November 2027. It's a plan, not a promise: priorities can change, and changes to
this file are made in pull requests like any other. Pieces of work are tracked
as [GitHub issues](https://github.com/phun-ky/evidence-report-mcp/issues),
grouped in milestones.

## Planned

### Checks that can pass

Two checks are stubs today: they report `skipped`, so a dataset or a claim is
never verified as `pass` yet.

- **The dataset observability adapter:** `observability.health` asks a real
  source about the dataset's `assetId`, such as a data catalogue or a pipeline's
  health, instead of skipping.
- **Claim corroboration:** `claim.corroboration` decides whether the given
  sources independently support the claim, from the sources' own records and
  without a language model, instead of skipping.

Each starts with an issue that names the source it relies on and what the report
says when that source can't answer.

### Project health

- **OpenSSF Best Practices:** registration, the answers kept in the repository
  and checked in CI, and badges in the README
  ([#17](https://github.com/phun-ky/evidence-report-mcp/issues/17)).
- **TypeScript 7**, once TypeDoc and typescript-eslint support it
  ([#30](https://github.com/phun-ky/evidence-report-mcp/issues/30)).
- **A second maintainer**, so that pull requests get a review from someone other
  than the author and access to the project doesn't rest on one person; see
  [governance](GOVERNANCE.md#continuity).

## Considered, not scheduled

Ideas that fit the project but have no date. Each would be discussed in an issue
first.

- **Lockfiles and software bills of materials:** `verify` over a whole
  `package-lock.json` or CycloneDX file, with the OSV.dev batch API.
- **Signed reports:** a report signed with Sigstore, so that other systems can
  trust the verifier's output and not only an agent's summary of it.
- **Limits on input size:** a largest dataset, schema depth and number of claim
  sources, so that one call can't hold the server for long.
- **More media checks:** ingredient manifests (earlier edits), which the C2PA
  check reports as not checked today.

## Not planned

- **A language model inside the verifier.** No "plausibility" scores: checks are
  deterministic or labelled heuristic, and the generator never grades its own
  output.
- **A bare yes or no.** Every answer is an evidence report, with its sources,
  times and `notChecked` list.
- **Acting on targets.** The server only reads: it never installs packages,
  changes data or files, or publishes anything.
- **Collecting data.** The server keeps nothing and reports nothing back. The
  only outside call is the package lookup on OSV.dev, as the
  [security policy](SECURITY.md#security-expectations) describes.

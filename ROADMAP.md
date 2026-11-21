# Roadmap

What evidence-report-mcp intends to do, and not do, from November 2026 to
November 2027. It's a plan, not a promise: priorities can change, and changes to
this file are made in pull requests like any other. Pieces of work are tracked
as [GitHub issues](https://github.com/phun-ky/evidence-report-mcp/issues),
grouped in milestones.

## Planned

### Project health

- **TypeScript 7**, once TypeDoc and typescript-eslint support it
  ([#30](https://github.com/phun-ky/evidence-report-mcp/issues/30)).
- **A second maintainer**, so that pull requests get a review from someone other
  than the author and access to the project doesn't rest on one person; see
  [governance](GOVERNANCE.md#continuity).

## Considered, not scheduled

Ideas that fit the project but have no date. Each would be discussed in an issue
first.

- **Signed reports:** a report signed with Sigstore, so that other systems can
  trust the verifier's output and not only an agent's summary of it.
- **Structured claims:** a deterministic check of claims that fit a subject,
  property and value against Wikidata, the only way a claim could ever `pass`.
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
- **Collecting data.** The server keeps nothing and reports nothing back. Its
  only outside calls are the package lookups on OSV.dev, the pages of claim
  sources given with a quote, the DOI lookups on Crossref and doi.org, and the
  paper lookups on Europe PMC and OpenAlex, as the
  [security policy](SECURITY.md#security-expectations) describes.

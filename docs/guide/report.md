# The evidence report

`verify` never answers with a bare yes or no. It returns an `EvidenceReport`:
the verdict, every check that was planned with its source, time and findings,
and a list of what was not checked.

## Fields

| Field         | What it holds                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `verdict`     | `pass`, `fail` or `unknown`                                                                            |
| `summary`     | One line for a person, such as `Failed: 1/1 checks completed, 4 finding(s).` The checks are the answer |
| `target`      | The target as it was checked                                                                           |
| `checks`      | One result for each check planned for this kind of target                                              |
| `notChecked`  | What this verifier cannot or did not check. Always present, never empty                                |
| `generatedAt` | When the report was made (ISO 8601)                                                                    |
| `verifier`    | The package name and version that made it                                                              |

Each check result holds:

| Field        | What it holds                                                                             |
| ------------ | ----------------------------------------------------------------------------------------- |
| `id`         | The check, such as `osv.vulnerabilities`                                                  |
| `kind`       | `deterministic` or `heuristic`                                                            |
| `status`     | `pass`, `fail`, `error` or `skipped`                                                      |
| `source`     | Where the evidence came from (`name`, sometimes `url`) and when (`retrievedAt`, ISO 8601) |
| `findings`   | What it found, each with a `severity`, a `message` and often a `ref`                      |
| `reason`     | Why it errored or was skipped                                                             |
| `durationMs` | How long it took                                                                          |

A finding's `severity` is `info`, `low`, `medium`, `high` or `critical`. Its
`ref` points at what was found: an advisory id, a JSON pointer into the records,
or a C2PA manifest field.

## Verdicts

The verdict fails closed. It is worked out in this order:

1. <span class="verdict fail">fail</span> when any check failed, even a
   heuristic one or one that is not required.
2. <span class="verdict unknown">unknown</span> when a required check is
   missing, errored or was skipped. Unknown is not zero.
3. <span class="verdict unknown">unknown</span> when only heuristic checks are
   required: judgement can't certify.
4. <span class="verdict pass">pass</span> otherwise.

Treat `unknown` as not verified. Read `notChecked` before telling anyone that
something is safe or true: a `pass` means the named checks passed against their
sources at the time in `retrievedAt`, nothing more.

## Statuses and kinds

- `pass` and `fail` mean the check ran to completion. The summary counts these
  as completed.
- `error` means it could not run: the source did not answer, the input was
  invalid, or the tool crashed. The `reason` says which. A check never throws;
  an exception becomes `error`.
- `skipped` means it did not run, on purpose: nothing is configured for it, or
  there was nothing it could decide. The `reason` says which.
- `deterministic` checks give the same result for the same input and source
  state: advisory lookups, schema validation, signature checks.
- `heuristic` checks are judgements. They can fail a target, never pass one on
  their own.

## Over MCP

The tool returns the report twice: as JSON text, for clients that only show
text, and as structured content, for clients that read it as data. The tool is
marked read-only (`readOnlyHint`), and as reaching outside the client
(`openWorldHint`), since it looks advisories up on OSV.dev.

## Rules baked in

1. **Evidence, not verdicts.** Every check names its source and when it looked,
   and `notChecked` is always there, so limits are never silent.
2. **Deterministic first.** Every check is labelled `deterministic` or
   `heuristic`, and heuristics can fail a target but never pass it alone.
3. **Independent checks.** There is no language model "plausibility" score. The
   verifier never asks the generator to grade its own work.
4. **Fail closed.** A required check that errors or is skipped makes the verdict
   `unknown`, never `pass`.
5. **Verify the verifier.** The server is a dependency too: it is read-only, has
   three runtime dependencies, and is published with provenance. See the
   [security policy](https://github.com/phun-ky/evidence-report-mcp/blob/main/SECURITY.md).

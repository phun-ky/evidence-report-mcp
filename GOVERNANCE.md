# Governance

evidence-report-mcp is a small open source project with one maintainer. This
document says how decisions are made, who does what, and what happens if the
maintainer can't continue.

## Model

The project is **maintainer-led**: the maintainer makes the final decision on
what goes in, guided by the [roadmap](ROADMAP.md), the design rules in the
[contributing guide](CONTRIBUTING.md#design-rules) and the discussion with
contributors.

Decisions are made in public:

- **Proposals** are
  [GitHub issues](https://github.com/phun-ky/evidence-report-mcp/issues). Larger
  changes, such as a change to the `EvidenceReport` shape, a new check or a
  breaking change, are discussed in an issue before work starts.
- **Decisions** are recorded as a comment on their issue, so the reason can be
  found later.
- **Changes** are pull requests, reviewed by the maintainer, and merged only
  when the required checks pass.
- **Disagreements** are settled by discussion in the issue or pull request. If
  that doesn't settle it, the maintainer decides and explains why.
- **Conduct** is governed by the [Code of Conduct](CODE_OF_CONDUCT.md), which
  the maintainer enforces.

### Reviews

With one maintainer, a pull request by the maintainer has no second reviewer.
The rules on `main` therefore require a pull request, resolved review threads, a
branch that is up to date with `main`, and passing checks (`check`, dependency
review and the DCO, with no high or critical CodeQL alerts), but no approving
review. Pull requests are merged with a merge commit, and the history of `main`
can't be rewritten or deleted.

The maintainer can bypass the merge rules, so that the release workflow can push
its release commit and tag. Once there is a second maintainer, pull requests
need an approving review from a maintainer other than the author.

## Roles

| Role            | Who                                                                        | Responsibilities                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Maintainer**  | Alexander Vassbotn Røyne-Helgesen ([@phun-ky](https://github.com/phun-ky)) | Sets the direction and roadmap; triages issues; reviews and merges pull requests; makes releases; handles security reports; enforces the Code of Conduct; manages the repository and the npm package |
| **Contributor** | Anyone who opens an issue or a pull request                                | Follows the [contributing guide](CONTRIBUTING.md) and the Code of Conduct; includes tests with code changes                                                                                          |

### Becoming a maintainer

Contributors who have made sustained, careful contributions may be invited to
become maintainers. A new maintainer gets write access to the repository and is
added to the table above, and from then on a pull request needs a review from a
maintainer other than its author.

Before anyone gets write access or any other raised permission, such as
publishing rights on npm, the maintainer reviews their contribution history and
confirms that their GitHub account uses two-factor authentication. They get the
lowest role that lets them do the work, and the change is recorded in the table
above.

## Continuity

Today, one person holds everything needed to run the project: admin access to
the [GitHub repository](https://github.com/phun-ky/evidence-report-mcp), and
ownership of the
[`evidence-report-mcp` package](https://www.npmjs.com/package/evidence-report-mcp)
on npm.

- **Releases** are published from GitHub Actions with npm trusted publishing, so
  publishing needs no personal npm token. Pushing the release commit and tag
  uses the `GH_TOKEN` repository secret, a token of the maintainer's; a new
  maintainer would replace it with their own. See the
  [security policy](SECURITY.md#secrets).
- **The code** is MIT-licensed. Anyone can fork it and carry on under a new name
  if the project stops.
- **A second person with access** doesn't exist yet. Until there is one, the
  project can't continue under its own name if the maintainer is unavailable.

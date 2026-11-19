# Packages

```json
{
  "kind": "package",
  "ecosystem": "npm",
  "name": "lodash",
  "version": "4.17.20"
}
```

`ecosystem` is one of `npm`, `PyPI`, `Go`, `Maven`, `crates.io`, `NuGet` and
`RubyGems`.

## The check: `osv.vulnerabilities`

A deterministic check against [OSV.dev](https://osv.dev), the open database of
advisories. It sends the ecosystem, name and version to
`https://api.osv.dev/v1/query`, and nothing else.

- No advisories: <span class="verdict pass">pass</span>.
- One or more: <span class="verdict fail">fail</span>, with one finding for each
  advisory. The message is the advisory's summary and the `ref` its id, such as
  `GHSA-35jh-r3h4-6jhm`.
- OSV.dev does not answer within 10 seconds, answers with an error, or sends
  something that is not JSON: `error`, and the verdict is `unknown`.
- More than 10 pages of results: `error`. A partial list is never reported as
  complete.

## Severity

Each finding takes the worst rating any source in the advisory gives:

- labels such as GitHub's `MODERATE` or Ubuntu's `medium` (`none`, `negligible`
  and `unimportant` count as `info`, `moderate` as `medium` and `important` as
  `high`);
- a CVSS 3.0 or 3.1 vector, scored with the
  [CVSS 3.1 base formula](https://www.first.org/cvss/v3.1/specification-document)
  and rated on its scale: 0 is `info`, below 4 `low`, below 7 `medium`, below 9
  `high`, and the rest `critical`.

CVSS 4 and CVSS 2 vectors are not scored. An advisory with no usable rating is
reported as `high`, and its message says "(severity not provided; assumed
high)".

## Not checked

- Unpublished or zero-day vulnerabilities
- Malicious behaviour without an advisory (typosquats, install scripts)
- Whether this package is the right one for the job

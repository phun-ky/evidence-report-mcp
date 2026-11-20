# Lockfiles and SBOMs

```json
{
  "kind": "dependencies",
  "path": "/home/me/app/package-lock.json"
}
```

Give exactly one of `path`, a file the server reads (and never changes), or
`content`, the file's JSON as a string. `path` only works when the server runs
on the machine that has the file. Either is at most 10 MB.

The file is one of:

- an npm `package-lock.json`, lockfile version 2 or 3 (npm 7 or later);
- a [CycloneDX](https://cyclonedx.org) JSON software bill of materials (SBOM).
  Every component is read, nested ones included, by its
  [purl](https://github.com/package-url/purl-spec), so it covers every ecosystem
  OSV.dev knows.

## The check: `osv.vulnerabilities`

The same deterministic check as for [a package](./package), for every package in
the file at once. It sends each package's name and version, or its purl, to
`https://api.osv.dev/v1/querybatch`, 1000 at a time, and then fetches each
advisory it finds from `https://api.osv.dev/v1/vulns/{id}` for its summary and
severity. Nothing else in the file is sent.

- No advisories: <span class="verdict pass">pass</span>.
- One or more: <span class="verdict fail">fail</span>, with one finding for each
  package and advisory. The message starts with the package, such as
  `lodash@4.17.20: Prototype Pollution in lodash`, and the `ref` is the
  advisory's id. Severity is worked out as for [a package](./package#severity).
- Entries OSV.dev can't look up: each is an `info` finding, such as
  `g@1.0.0: not looked up (not from a registry: git+ssh://…)`, and the check is
  `skipped`, so the verdict is `unknown` even when nothing is known to be
  vulnerable. A known vulnerability still makes it
  <span class="verdict fail">fail</span>. These are:
  - in a package-lock, links to folders that are not workspaces, git and file
    dependencies, and entries without a version;
  - in a CycloneDX file, components without a purl, or with a purl that has no
    version.
- No packages in the file: `skipped`.
- A file that is missing, larger than 10 MB, not JSON, or neither a package-lock
  (version 2 or 3) nor CycloneDX: `error`.
- OSV.dev does not answer within 10 seconds, answers with an error, or has more
  results for one package than fit in one batch answer: `error`. A partial list
  is never reported as complete.

The root project, its workspaces and the links to them in a package-lock are the
project itself, not dependencies, and are not looked up. A link is to a
workspace when its folder matches one of the root's `workspaces` patterns (`*`
and `**`; negated patterns are not read, so those links stay unresolved).

## Not checked

- Unpublished or zero-day vulnerabilities
- Malicious behaviour without an advisory (typosquats, install scripts)
- Whether the file matches what is or will be installed
- Which registry a package-lock entry came from: each is looked up as an npm
  package

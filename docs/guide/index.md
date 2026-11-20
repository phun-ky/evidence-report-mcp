# Getting started

`evidence-report-mcp` is an MCP server with one tool, `verify`. An agent calls
it before acting on something it did not make: a package it is about to install,
a dataset it is about to use, a media file it is about to pass on, or a claim it
is about to repeat. It gets back an [evidence report](./report): what was
checked, where each result came from and when, and what was not checked.

It needs Node.js 22.12.0 or later.

## Add it to Claude Code

```sh
claude mcp add evidence-report -- npx -y evidence-report-mcp
```

The tool then shows up as `mcp__evidence-report__verify`. Ask your agent to use
it before it acts, for example:

> Before you add lodash 4.17.20, verify it, and tell me what was not checked.

## Add it to another MCP client

Clients that read a JSON configuration, such as Claude Desktop, start it the
same way:

```json
{
  "mcpServers": {
    "evidence-report": {
      "command": "npx",
      "args": ["-y", "evidence-report-mcp"]
    }
  }
}
```

The server talks over stdio. Checking media files needs `c2patool`; see
[Configuration](./configuration).

## Read the answer

A call with a package:

```json
{
  "target": {
    "kind": "package",
    "ecosystem": "npm",
    "name": "lodash",
    "version": "4.17.20"
  }
}
```

returns, shortened:

```json
{
  "verdict": "fail",
  "summary": "Failed: 1/1 checks completed, 4 finding(s).",
  "checks": [
    {
      "id": "osv.vulnerabilities",
      "kind": "deterministic",
      "status": "fail",
      "source": {
        "name": "OSV.dev",
        "url": "https://osv.dev",
        "retrievedAt": "2026-11-19T11:17:18.524Z"
      },
      "findings": [
        {
          "severity": "high",
          "message": "Command Injection in lodash",
          "ref": "GHSA-35jh-r3h4-6jhm"
        }
      ]
    }
  ],
  "notChecked": [
    "Unpublished or zero-day vulnerabilities",
    "Malicious behaviour without an advisory (typosquats, install scripts)",
    "Whether this package is the right one for the job"
  ]
}
```

Read the verdict first, then the findings, then `notChecked`. A verdict of
`unknown` means not verified, never safe. [The evidence report](./report)
explains every field.

## Use it without MCP

The package also exports `verify`, `aggregate` and `createServer`, and the types
of the report and its input:

```ts
import { verify, type EvidenceReport } from 'evidence-report-mcp';

const report: EvidenceReport = await verify({
  kind: 'package',
  ecosystem: 'npm',
  name: 'lodash',
  version: '4.17.20'
});

if (report.verdict !== 'pass') {
  console.log(report.summary, report.notChecked);
}
```

See the [API reference](../api/) for each export.

## What it checks

| Target         | Input                           | Check                                                        |
| -------------- | ------------------------------- | ------------------------------------------------------------ |
| `package`      | `{ ecosystem, name, version }`  | [Known advisories from OSV.dev](./checks/package)            |
| `dataset`      | `{ schema, records, assetId? }` | [A JSON Schema contract, units included](./checks/dataset)   |
| `dependencies` | `{ path }` or `{ content }`     | [Every package in a lockfile or SBOM](./checks/dependencies) |
| `file`         | `{ path }`                      | [C2PA content credentials](./checks/file)                    |
| `claim`        | `{ text, sources }`             | [Independent sources](./checks/claim)                        |

### Limits

So that one call can't hold the server for long, the `verify` tool rejects a
target over any of these limits before a check runs. The agent gets a validation
error, not a report, and never a `pass`.

| Field                        | Limit                                                          |
| ---------------------------- | -------------------------------------------------------------- |
| `name`, `version`, `assetId` | 256 characters                                                 |
| `path`                       | 4096 characters                                                |
| `content`                    | 10 MB, and a file read from `path` too                         |
| `text`                       | 10 000 characters                                              |
| `sources`                    | 20 URLs, each at most 2048 characters                          |
| `schema`                     | nested at most 32 deep, at most 100 KB as JSON                 |
| `records`                    | 1000 records, each nested at most 32 deep, 1 MB as JSON in all |

## What is not there yet

- The dataset check's observability adapter and the claim check's source
  matching are stubs: they report `skipped`, so a dataset or a claim is never
  verified as `pass` yet. Their pages say what they do today.
- An idea for later: a signed report (Sigstore), so that other systems can trust
  the verifier's output and not only the agent's summary of it.

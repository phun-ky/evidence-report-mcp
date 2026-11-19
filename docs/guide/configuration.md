# Configuration

The server needs Node.js 22.12.0 or later and no configuration for packages,
datasets and claims. Media files need `c2patool`.

## Environment variables

| Variable                       | What it does                                                              |
| ------------------------------ | ------------------------------------------------------------------------- |
| `EVIDENCE_REPORT_MCP_C2PATOOL` | Path to the `c2patool` binary. Unset, the C2PA check is `skipped`         |
| `C2PATOOL_TRUST_ANCHORS`       | `c2patool`'s own setting: the certificates (PEM) of the signers you trust |
| `C2PATOOL_TRUST_CONFIG`        | `c2patool`'s own setting: its trust configuration                         |
| `C2PATOOL_ALLOWED_LIST`        | `c2patool`'s own setting: signing certificates that are allowed           |

## `c2patool`

Download [`c2patool`](https://github.com/contentauth/c2pa-rs/releases) for your
system and check the release checksum. It is tested with 0.27.23. Then point the
server at it, with the trust anchors that decide which signers pass:

```sh
claude mcp add evidence-report \
  -e EVIDENCE_REPORT_MCP_C2PATOOL=/path/to/c2patool \
  -e C2PATOOL_TRUST_ANCHORS=/path/to/anchors.pem \
  -- npx -y evidence-report-mcp
```

Or, in a JSON configuration:

```json
{
  "mcpServers": {
    "evidence-report": {
      "command": "npx",
      "args": ["-y", "evidence-report-mcp"],
      "env": {
        "EVIDENCE_REPORT_MCP_C2PATOOL": "/path/to/c2patool",
        "C2PATOOL_TRUST_ANCHORS": "/path/to/anchors.pem"
      }
    }
  }
}
```

Without trust anchors, an intact manifest is reported as `skipped`, never
`pass`: it proves only that someone signed the file.

## What it reaches

- **Network:** only `https://api.osv.dev/v1/query`, for package targets, with
  the ecosystem, name and version. Claim sources are never fetched.
- **Files:** only the path of a file target, read by `c2patool`. It can read any
  file the server process can, so run the server with no more rights than it
  needs.
- **Processes:** only `c2patool`, started without a shell.

The
[security policy](https://github.com/phun-ky/evidence-report-mcp/blob/main/SECURITY.md)
says what you can rely on, and how to report a problem.

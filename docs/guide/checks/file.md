# Media files

```json
{ "kind": "file", "path": "/path/to/photo.jpg" }
```

## The check: `c2pa.manifest`

A deterministic check of the file's [C2PA](https://c2pa.org) content
credentials: a signed record of where the file came from and how it was edited.
It runs [`c2patool`](https://github.com/contentauth/c2pa-rs/releases), which
reads the file and writes nothing. See [Configuration](../configuration) to set
it up.

| What `c2patool` reports                         | Status    | Why                                   |
| ----------------------------------------------- | --------- | ------------------------------------- |
| `Trusted`: intact, from a trusted signer        | `pass`    |                                       |
| `Invalid`: the manifest or the file was changed | `fail`    | One finding for each validation code  |
| `Valid`: intact, but the signer is not trusted  | `skipped` | Proves only that someone signed it    |
| No manifest                                     | `skipped` | Absence of credentials proves nothing |
| Anything else, or `c2patool` fails              | `error`   |                                       |
| `c2patool` not configured                       | `skipped` |                                       |

So only a trusted signer passes; a skipped check keeps the verdict
<span class="verdict unknown">unknown</span>.

Each finding is one validation code from `c2patool`, such as
`assertion.dataHash.mismatch`, with its explanation. An untrusted signing
credential is `medium`, everything else `high`.

`c2patool` runs with a 30 second limit and up to 16 MiB of output. The file path
is always passed as an absolute path, so a path can never be read as one of
`c2patool`'s options.

## Not checked

- Whether the depicted content is true or in context
- Files whose credentials were stripped in transit
- Signers outside the configured trust anchors
- Ingredient manifests (earlier edits), only the active manifest

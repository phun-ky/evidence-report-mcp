# Try it

A short session in Claude Code that uses every kind of target, with the answer
to expect from each. Results come from live sources, OSV.dev and the pages you
quote, so the exact findings change over time.

## Add the server

```sh
claude mcp add -s user evidence-report -- npx -y evidence-report-mcp
```

Start a new session and run `/mcp`. `evidence-report` should be connected, with
one tool, `verify`.

If you work on this repository: inside a clone of `evidence-report-mcp`, `npx`
finds the clone instead of the published package, and the server does not start.
Add it with `-s user` from another folder, as above.

## Ask

You don't need to name the tool. Its description tells the agent to call it
before acting on something it did not make.

### A package

> Is lodash 4.17.20 safe to add to my project?

The agent calls `verify` with a `package` target. Expect
<span class="verdict fail">fail</span>, with each advisory by its id, such as
`GHSA-35jh-r3h4-6jhm`. See [the package check](./checks/package).

### A lockfile

> Before I run npm install, check package-lock.json for known vulnerabilities.

The agent sends a `dependencies` target with the file's `path`. Expect one
finding for each package and advisory, and
<span class="verdict fail">fail</span> if there are any. A git or file
dependency keeps the verdict <span class="verdict unknown">unknown</span>. See
[the lockfile check](./checks/dependencies).

### A claim

> Is it true that example.com is reserved for documentation? Find two sources
> and quote them.

The agent sends each source as `{ url, quote }`. When both quotes are on their
pages, the check passes but the verdict is
<span class="verdict unknown">unknown</span>: a quote shows that a page says it,
not that it is true. Then:

> Check it again, but quote the IANA page as saying "example.com was registered
> by the BBC".

Expect <span class="verdict fail">fail</span>, with "Quote not found" for the
IANA page. See [the claim check](./checks/claim).

### A dataset

This needs a dbt project and `EVIDENCE_REPORT_MCP_DBT_TARGET`; see
[configuration](./configuration#dbt).

> Before I use the orders data, verify these records against this schema: the
> schema is `{"type":"object","required":["id"]}`, the records are `[{"id":1}]`,
> and its dbt id is `model.shop.orders`.

Expect <span class="verdict pass">pass</span> when the records fit the schema,
every dbt test on the model passed and its sources are fresh. Without the
variable, expect <span class="verdict unknown">unknown</span>, with a reason
that names it. See [the dataset check](./checks/dataset).

### A media file

This needs `c2patool`; see [configuration](./configuration#c2patool).

> Check the content credentials of ./photo.jpg before I publish it.

Expect <span class="verdict pass">pass</span> only for a file signed by a signer
you trust. A file without credentials, or without `c2patool`, is
<span class="verdict unknown">unknown</span>. See
[the media file check](./checks/file).

## Read the agent's answer

The verdicts matter less than what the agent does with them. A good answer:

- says what the verdict was, and treats
  <span class="verdict unknown">unknown</span> as not verified, never as safe;
- names the findings that matter, by their `ref`;
- mentions what the report lists under `notChecked` before it calls anything
  safe or true.

An agent that calls an <span class="verdict unknown">unknown</span> safe is the
mistake this server is meant to prevent. If you see it,
[open an issue](https://github.com/phun-ky/evidence-report-mcp/issues) with the
prompt and the answer.

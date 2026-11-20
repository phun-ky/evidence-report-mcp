# Datasets

```json
{
  "kind": "dataset",
  "schema": { "type": "object", "required": ["id"] },
  "records": [{ "id": 1 }],
  "assetId": "warehouse.orders"
}
```

`schema` is a JSON Schema, `records` the data to check against it, and `assetId`
the dataset's optional dbt `unique_id`, for its health.

## The check: `schema.conformance`

A deterministic check with [Ajv](https://ajv.js.org), which validates every
record against the schema and reports every error, not only the first.

- Every record conforms: <span class="verdict pass">pass</span>.
- Any record does not: <span class="verdict fail">fail</span>, with one finding
  for each error, such as `record 0: / must have required property 'id'`. The
  `ref` is a JSON pointer into the records, such as `/0/impulse`. Findings are
  `medium`, and unit mismatches `high`.
- The schema itself is invalid: `error`.

Schemas are compiled in strict mode: an unknown or misspelled keyword makes the
check `error` instead of quietly passing. Keys that start with `x-` are allowed,
and ignored unless they are `x-unit`. A `$ref` to a schema on the web is never
loaded, so it makes the check `error` too.

## Units: `x-unit`

A property with `"x-unit": "N*s"` must be sent as a value with its unit:

```json
{ "impulse": { "value": 4.45, "unit": "N*s" } }
```

A different unit (`lbf*s`) or a bare number is a `high` finding: a bare number
has no unit to check. This is the mistake that lost the Mars Climate Orbiter,
which was sent pound-force seconds where newton seconds were expected.

Only the separators are normalised, so `N·s`, `N*s` and `N s` are the same unit.
Case matters (`mN` is not `MN`), and there are no aliases and no conversion.

## The check: `observability.health`

A deterministic check of the dataset behind `assetId`, read from dbt's artifacts
in the folder that `EVIDENCE_REPORT_MCP_DBT_TARGET` names (see
[configuration](../configuration#dbt)). `assetId` is a dbt `unique_id`: a model,
seed, snapshot or source, such as `model.shop.orders`.

It looks at every dbt test on the node (generic tests attached to it and
singular tests that read it), the node's own build, and the freshness of every
source upstream of it, through any number of models.

- Every test passed and every upstream source is fresh:
  <span class="verdict pass">pass</span>.
- A test failed, the node failed to build, or a source is past its freshness
  `error_after`: <span class="verdict fail">fail</span>, with a `high` finding
  whose `ref` is the test's or source's `unique_id`.
- A test or source that only warned is a `medium` finding, not a fail.
- A test that errored, was skipped or has no result, a source with no freshness
  result, or a node with no tests: `skipped`, with an `info` finding for each.
  Missing evidence is never a pass.
- Artifacts older than 24 hours, or without a time: `skipped`, as stale
  evidence. Each artifact's time is an `info` finding, so the report says how
  old its evidence is.
- An `assetId` dbt does not know: `skipped`.
- No `assetId`, or `EVIDENCE_REPORT_MCP_DBT_TARGET` unset: `skipped`, so the
  verdict is at best <span class="verdict unknown">unknown</span>.
- A missing or unreadable `manifest.json` or `run_results.json`: `error`.

`run_results.json` is written by every dbt command that runs nodes, so it holds
only the last one: run `dbt build` (or `dbt test`) last, then
`dbt source freshness`, which writes `sources.json` and leaves
`run_results.json` alone.

## Not checked

- Whether values are true, only whether they are well-formed
- Meaning of units and labels beyond what the schema encodes
- Records outside the provided sample
- Data quality beyond the dbt tests on the node

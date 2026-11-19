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
an optional name for the dataset in an observability tool.

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

Meant to ask an observability tool, such as Monte Carlo, Soda or Elementary,
whether the dataset behind `assetId` is fresh and complete. No tool can be
configured yet, so it is always `skipped`, and a dataset's verdict is at best
<span class="verdict unknown">unknown</span>: never `pass`.

## Not checked

- Whether values are true, only whether they are well-formed
- Meaning of units and labels beyond what the schema encodes
- Records outside the provided sample

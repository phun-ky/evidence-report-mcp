import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import {
  checkC2pa,
  checkCorroboration,
  checkObservability,
  checkOsv,
  checkSchema,
  plan,
} from "./checkers.js";
import type { Target } from "./types.js";

// No network in tests: any fetch not explicitly mocked fails the test loudly.
beforeEach(() => {
  mock.method(globalThis, "fetch", async () => {
    throw new Error("unexpected network call in test");
  });
});
afterEach(() => mock.restoreAll());

const mockFetch = (impl: (url: string, init?: RequestInit) => Promise<Response>) =>
  mock.method(globalThis, "fetch", impl);

const pkg = { kind: "package", ecosystem: "npm", name: "lodash", version: "4.17.20" } as const;

/* ---------------- schema ---------------- */

test("checkSchema: conforming records -> pass", async () => {
  const r = await checkSchema({
    kind: "dataset",
    schema: { type: "object", properties: { n: { type: "number" } }, required: ["n"] },
    records: [{ n: 1 }, { n: 2 }],
  });
  assert.equal(r.status, "pass");
  assert.equal(r.kind, "deterministic");
  assert.deepEqual(r.findings, []);
});

test("checkSchema: violations -> fail with one finding per error, pointing at the record", async () => {
  const r = await checkSchema({
    kind: "dataset",
    schema: { type: "object", properties: { n: { type: "number" } }, required: ["n"] },
    records: [{ n: 1 }, { n: "one" }, {}],
  });
  assert.equal(r.status, "fail");
  assert.deepEqual(
    r.findings.map((f) => f.ref),
    ["/1/n", "/2"],
  );
});

test("checkSchema: invalid schema -> error, not crash or pass", async () => {
  const r = await checkSchema({ kind: "dataset", schema: { type: "not-a-type" }, records: [{}] });
  assert.equal(r.status, "error");
  assert.ok(r.reason);
  assert.deepEqual(r.findings, []);
});

/* ---------------- OSV (fetch mocked) ---------------- */

test("checkOsv: no advisories -> pass, and queries the right package", async () => {
  const f = mockFetch(async () => Response.json({}));
  const r = await checkOsv(pkg);
  assert.equal(r.status, "pass");
  const [url, init] = f.mock.calls[0]!.arguments;
  assert.equal(url, "https://api.osv.dev/v1/query");
  assert.deepEqual(JSON.parse(String(init?.body)), {
    package: { name: "lodash", ecosystem: "npm" },
    version: "4.17.20",
  });
});

test("checkOsv: advisories -> fail, severity parsed, unrated ones assumed high and labelled", async () => {
  mockFetch(async () =>
    Response.json({
      vulns: [
        { id: "GHSA-1", summary: "Prototype pollution", database_specific: { severity: "MODERATE" } },
        { id: "GHSA-2", severity: [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" }] },
        { id: "GHSA-3" },
      ],
    }),
  );
  const r = await checkOsv(pkg);
  assert.equal(r.status, "fail");
  assert.deepEqual(
    r.findings.map((f) => [f.ref, f.severity, f.message]),
    [
      ["GHSA-1", "medium", "Prototype pollution"],
      ["GHSA-2", "critical", "Known vulnerability"],
      ["GHSA-3", "high", "Known vulnerability (severity not provided; assumed high)"],
    ],
  );
});

test("checkOsv: follows next_page_token", async () => {
  const f = mockFetch(async (_url, init) =>
    JSON.parse(String(init?.body)).page_token === "p2"
      ? Response.json({ vulns: [{ id: "B" }] })
      : Response.json({ vulns: [{ id: "A" }], next_page_token: "p2" }),
  );
  const r = await checkOsv(pkg);
  assert.equal(f.mock.callCount(), 2);
  assert.deepEqual(
    r.findings.map((x) => x.ref),
    ["A", "B"],
  );
});

test("checkOsv: endless pagination -> error, never a partial pass or fail", async () => {
  mockFetch(async () => Response.json({ vulns: [], next_page_token: "again" }));
  const r = await checkOsv(pkg);
  assert.equal(r.status, "error");
  assert.match(r.reason ?? "", /more than 10 pages/);
});

test("checkOsv: HTTP error -> error with reason", async () => {
  mockFetch(async () => new Response("down", { status: 503 }));
  const r = await checkOsv(pkg);
  assert.equal(r.status, "error");
  assert.match(r.reason ?? "", /503/);
});

test("checkOsv: network failure -> error, source still timestamped", async () => {
  mockFetch(async () => {
    throw new TypeError("fetch failed");
  });
  const r = await checkOsv(pkg);
  assert.equal(r.status, "error");
  assert.equal(r.reason, "fetch failed");
  assert.ok(!Number.isNaN(Date.parse(r.source.retrievedAt)));
});

test("checkOsv: malformed JSON -> error", async () => {
  mockFetch(async () => new Response("not json", { status: 200 }));
  assert.equal((await checkOsv(pkg)).status, "error");
});

/* ---------------- stubs and heuristics ---------------- */

test("stub checkers report skipped with a reason", async () => {
  for (const r of [
    await checkObservability({ kind: "dataset", schema: {}, records: [{}], assetId: "x" }),
    await checkObservability({ kind: "dataset", schema: {}, records: [{}] }),
    await checkC2pa({ kind: "file", path: "/tmp/x.jpg" }),
  ]) {
    assert.equal(r.status, "skipped");
    assert.ok(r.reason);
  }
});

test("checkCorroboration: one distinct domain (www. ignored) -> heuristic fail", async () => {
  const r = await checkCorroboration({
    kind: "claim",
    text: "x",
    sources: ["https://example.com/a", "https://www.example.com/b"],
  });
  assert.equal(r.kind, "heuristic");
  assert.equal(r.status, "fail");
});

test("checkCorroboration: two domains -> skipped, never pass", async () => {
  const r = await checkCorroboration({
    kind: "claim",
    text: "x",
    sources: ["https://a.example/1", "https://b.example/2"],
  });
  assert.equal(r.status, "skipped");
});

/* ---------------- plan ---------------- */

test("plan: every target kind has required checks and a non-empty notChecked", async () => {
  mockFetch(async () => Response.json({}));
  const targets: Target[] = [
    pkg,
    { kind: "dataset", schema: {}, records: [{}] },
    { kind: "file", path: "/tmp/x.jpg" },
    { kind: "claim", text: "x", sources: [] },
  ];
  for (const t of targets) {
    const p = plan(t);
    await Promise.all(p.checks);
    assert.ok(p.required.length > 0, t.kind);
    assert.ok(p.notChecked.length > 0, t.kind);
  }
});

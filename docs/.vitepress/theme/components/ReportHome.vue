<script setup lang="ts">
/*
 * The home page, direction D: the report whole in the middle and taken apart
 * around it. Every report here is real output from verify, captured on
 * 19 November 2026 (lodash 4.17.20 against OSV.dev, the x-unit dataset and a
 * one-source claim); the tiles around the first screen are parts of those and
 * the other checks' reports.
 */
import { withBase } from 'vitepress';

import pkg from '../../../../package.json' with { type: 'json' };

interface Tile {
  body: string;
  small?: string;
  strip: string;
  tone?: 'nc' | 'v-fail' | 'v-unknown' | 'v-pass';
  big?: boolean;
  stripTone?: 's2' | 's3' | 's4';
}

const verifier = `${pkg.name} ${pkg.version}`;
const columns: { lift?: 'up' | 'down'; tiles: Tile[] }[] = [
  {
    tiles: [
      {
        body: 'fail',
        big: true,
        small: 'Failed: 1/1 checks completed, 4 finding(s).',
        strip: 'verdict',
        tone: 'v-fail'
      },
      {
        body: 'osv.vulnerabilities',
        small: 'deterministic',
        strip: 'check',
        stripTone: 's2'
      },
      {
        body: 'OSV.dev',
        small: 'retrieved 11:17:18 UTC',
        strip: 'source',
        stripTone: 's2'
      },
      {
        body: 'Unpublished or zero-day vulnerabilities',
        strip: 'not checked',
        tone: 'nc',
        stripTone: 's3'
      },
      {
        body: 'GHSA-29mw-wpgm-hmr9',
        small: 'medium, ReDoS in lodash',
        strip: 'finding',
        stripTone: 's4'
      },
      {
        body: 'pass',
        big: true,
        small: 'Trusted signer, manifest intact.',
        strip: 'verdict',
        tone: 'v-pass'
      },
      {
        body: 'JSON Schema (ajv)',
        small: 'retrieved 11:17:18 UTC',
        strip: 'source',
        stripTone: 's2'
      }
    ]
  },
  {
    lift: 'up',
    tiles: [
      {
        body: 'Records outside the provided sample',
        strip: 'not checked',
        tone: 'nc',
        stripTone: 's3'
      },
      {
        body: 'schema.conformance',
        small: 'deterministic',
        strip: 'check',
        stripTone: 's2'
      },
      {
        body: 'observability.health',
        small: 'skipped: No assetId given',
        strip: 'check',
        stripTone: 's2'
      },
      {
        body: 'Whether values are true, only whether they are well-formed',
        strip: 'not checked',
        tone: 'nc',
        stripTone: 's3'
      },
      {
        body: 'GHSA-r5fr-rjxr-66jc',
        small: 'high, Code Injection',
        strip: 'finding',
        stripTone: 's4'
      },
      {
        body: 'Meaning of units and labels beyond what the schema encodes',
        strip: 'not checked',
        tone: 'nc',
        stripTone: 's3'
      },
      {
        body: 'c2patool',
        small: 'tested with 0.27.23',
        strip: 'source',
        stripTone: 's2'
      },
      {
        body: 'claim.corroboration',
        small: 'heuristic',
        strip: 'check',
        stripTone: 's2'
      }
    ]
  },
  {
    lift: 'down',
    tiles: [
      {
        body: '2026-11-19T11:17:18.524Z',
        strip: 'generatedAt',
        stripTone: 's2'
      },
      {
        body: 'Files whose credentials were stripped in transit',
        strip: 'not checked',
        tone: 'nc',
        stripTone: 's3'
      },
      {
        body: 'assertion.dataHash.mismatch',
        small: 'high',
        strip: 'finding',
        stripTone: 's4'
      },
      {
        body: 'OSV.dev',
        small: 'retrieved 11:17:18 UTC',
        strip: 'source',
        stripTone: 's2'
      },
      { body: 'unknown', big: true, strip: 'verdict', tone: 'v-unknown' },
      {
        body: 'Interpretation: what the claim means to its audience',
        strip: 'not checked',
        tone: 'nc',
        stripTone: 's3'
      }
    ]
  },
  {
    lift: 'up',
    tiles: [
      {
        body: 'c2pa.manifest',
        small: 'skipped',
        strip: 'check',
        stripTone: 's2'
      },
      {
        body: 'Signers outside the configured trust anchors',
        strip: 'not checked',
        tone: 'nc',
        stripTone: 's3'
      },
      {
        body: 'CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H',
        small: 'base score 7.2',
        strip: 'severity',
        stripTone: 's4'
      },
      {
        body: '2026-11-19T11:17:18.535Z',
        strip: 'generatedAt',
        stripTone: 's2'
      },
      {
        body: 'Records outside the provided sample',
        strip: 'not checked',
        tone: 'nc',
        stripTone: 's3'
      },
      { body: 'fail', big: true, strip: 'verdict', tone: 'v-fail' },
      {
        body: 'Only 1 distinct source domain(s)',
        small: 'medium',
        strip: 'finding',
        stripTone: 's4'
      },
      { body: 'provided sources', strip: 'source', stripTone: 's2' }
    ]
  },
  {
    lift: 'down',
    tiles: [
      { body: verifier, strip: 'verifier', stripTone: 's2' },
      {
        body: 'Whether the cited sources are themselves reliable',
        strip: 'not checked',
        tone: 'nc',
        stripTone: 's3'
      },
      {
        body: 'signingCredential.untrusted',
        small: 'medium',
        strip: 'finding',
        stripTone: 's4'
      },
      {
        body: 'schema.conformance',
        small: 'deterministic',
        strip: 'check',
        stripTone: 's2'
      },
      {
        body: 'Ingredient manifests (earlier edits), only the active manifest',
        strip: 'not checked',
        tone: 'nc',
        stripTone: 's3'
      },
      { body: 'JSON Schema (ajv)', strip: 'source', stripTone: 's2' }
    ]
  },
  {
    tiles: [
      {
        body: 'GHSA-35jh-r3h4-6jhm',
        small: 'high, Command Injection in lodash',
        strip: 'finding',
        stripTone: 's4'
      },
      {
        body: 'Whether this package is the right one for the job',
        strip: 'not checked',
        tone: 'nc',
        stripTone: 's3'
      },
      {
        body: 'unknown',
        big: true,
        small: 'A required check was skipped.',
        strip: 'verdict',
        tone: 'v-unknown'
      },
      {
        body: 'unit "lbf*s" does not match required "N*s"',
        small: 'high, /0/impulse',
        strip: 'finding',
        stripTone: 's4'
      },
      {
        body: 'provided sources',
        small: '2 domains needed',
        strip: 'source',
        stripTone: 's2'
      },
      {
        body: 'Malicious behaviour without an advisory',
        strip: 'not checked',
        tone: 'nc',
        stripTone: 's3'
      }
    ]
  }
];
const lodashFindings = [
  {
    severity: 'high',
    message: 'Command Injection in lodash',
    ref: 'GHSA-35jh-r3h4-6jhm'
  },
  {
    severity: 'high',
    message:
      'lodash vulnerable to Code Injection via _.template imports key names',
    ref: 'GHSA-r5fr-rjxr-66jc'
  },
  {
    severity: 'medium',
    message: 'Regular Expression Denial of Service (ReDoS) in lodash',
    ref: 'GHSA-29mw-wpgm-hmr9'
  },
  {
    severity: 'medium',
    message:
      'Lodash has Prototype Pollution Vulnerability in _.unset, _.omit, and _.pullAt functions',
    ref: 'GHSA-xxjr-mmjv-4gpg'
  }
];
const lodashNotChecked = [
  'Unpublished or zero-day vulnerabilities',
  'Malicious behaviour without an advisory (typosquats, install scripts)',
  'Whether this package is the right one for the job'
];
const datasetInput = `{
  "kind": "dataset",
  "schema": {
    "properties": {
      "impulse": { "x-unit": "N*s" }
    }
  },
  "records": [
    { "impulse": { "value": 1, "unit": "lbf*s" } }
  ]
}`;
const command = 'claude mcp add evidence-report -- npx -y evidence-report-mcp';
const kinds = [
  {
    name: 'Packages',
    text: "Advisories from OSV.dev, rated from each advisory's own CVSS vector.",
    finding: {
      severity: 'high',
      message: 'Command Injection in lodash',
      ref: 'CVSS 7.2'
    },
    strip: 'package',
    link: '/guide/checks/package'
  },
  {
    name: 'Datasets',
    text: 'Records against a JSON Schema contract, units included.',
    finding: {
      severity: 'high',
      message: '"lbf*s" is not "N*s"',
      ref: '/0/impulse'
    },
    strip: 'dataset',
    stripTone: 's2',
    link: '/guide/checks/dataset'
  },
  {
    name: 'Media files',
    text: 'C2PA content credentials through c2patool. Only a trusted signer passes.',
    finding: {
      severity: 'high',
      message: 'assertion.dataHash.mismatch',
      ref: 'c2pa.hash.data'
    },
    strip: 'file',
    stripTone: 's3',
    link: '/guide/checks/file'
  },
  {
    name: 'Claims',
    text: 'Two independent source domains. Heuristic: it can fail a claim, never pass one.',
    finding: {
      severity: 'medium',
      message: 'Only 1 distinct source domain(s)',
      ref: 'claim.corroboration'
    },
    strip: 'claim',
    stripTone: 's4',
    link: '/guide/checks/claim'
  }
];
</script>

<template>
  <div class="er-home">
    <section class="board" aria-labelledby="er-title">
      <div
        v-for="(column, c) in columns"
        :key="c"
        class="col"
        :class="column.lift"
        aria-hidden="true"
      >
        <div
          v-for="(tile, t) in column.tiles"
          :key="t"
          class="tile"
          :class="tile.tone"
        >
          <div class="body">
            <span :class="{ big: tile.big }">{{ tile.body }}</span
            ><span v-if="tile.small" class="small">{{ tile.small }}</span>
          </div>
          <div class="strip" :class="tile.stripTone">{{ tile.strip }}</div>
        </div>
      </div>

      <div class="stage">
        <div>
          <h1 id="er-title">Evidence, not verdicts.</h1>
          <p>
            An MCP server with one tool, <code>verify</code>. Agents call it
            before acting on something they did not make, and get back what was
            checked, where it came from, and what was not checked.
          </p>
          <div class="actions">
            <a class="button" :href="withBase('/guide/')">Get started</a
            ><code class="install">npx -y evidence-report-mcp</code>
          </div>
        </div>
        <div class="report" role="group" aria-label="Report for lodash 4.17.20">
          <header>
            <span class="verdict fail">fail</span
            ><span>Failed: 1/1 checks completed, 4 finding(s).</span>
          </header>
          <div class="check">
            <div class="check-head">
              <span>osv.vulnerabilities</span><span>deterministic</span>
            </div>
            <div class="src">OSV.dev, retrieved 19 Nov 2026 11:17 UTC</div>
            <ul class="rows">
              <li v-for="f in lodashFindings" :key="f.ref">
                <span class="sev" :class="f.severity">{{ f.severity }}</span
                ><span>{{ f.message }}</span
                ><span class="ref">{{ f.ref }}</span>
              </li>
            </ul>
          </div>
          <div class="not-checked">
            <h2>Not checked</h2>
            <ul>
              <li v-for="item in lodashNotChecked" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="phone-only" aria-hidden="true">
        <div class="tile v-fail">
          <div class="body"><span class="big">fail</span></div>
          <div class="strip">verdict</div>
        </div>
        <div class="tile nc">
          <div class="body">Unpublished or zero-day vulnerabilities</div>
          <div class="strip s3">not checked</div>
        </div>
      </div>
    </section>

    <section class="fields" aria-labelledby="er-how">
      <h2 id="er-how" class="title">One report, from question to limits</h2>
      <div class="field">
        <div class="card">
          <b>target</b>
          <div class="row">package npm lodash 4.17.20</div>
        </div>
        <p>An agent asks before it acts on something it did not make.</p>
      </div>
      <div class="field">
        <div class="card">
          <b>target</b>
          <div class="row">package npm lodash 4.17.20</div>
          <b>check</b>
          <div class="row">
            osv.vulnerabilities, deterministic<br /><span class="muted"
              >OSV.dev, 11:17:18 UTC</span
            >
          </div>
        </div>
        <p>Each check names its source and when it looked.</p>
      </div>
      <div class="field">
        <div class="card">
          <b>target</b>
          <div class="row">package npm lodash 4.17.20</div>
          <b>check</b>
          <div class="row">
            osv.vulnerabilities, deterministic<br /><span class="muted"
              >OSV.dev, 11:17:18 UTC</span
            >
          </div>
          <b>findings</b>
          <div class="row">
            high: Command Injection, GHSA-35jh-r3h4-6jhm<br />high: Code
            Injection, GHSA-r5fr-rjxr-66jc<br />and 2 medium
          </div>
        </div>
        <p>Findings point at exactly what they found.</p>
      </div>
      <div class="field">
        <div class="card">
          <span class="verdict fail">fail</span>
          <div class="row">Failed: 1/1 checks completed, 4 finding(s).</div>
          <div class="nc">
            <b>not checked</b>Unpublished or zero-day vulnerabilities; malicious
            behaviour without an advisory; whether this is the right package.
          </div>
        </div>
        <p>The verdict comes with its limits, every time.</p>
      </div>
    </section>

    <section class="split" aria-labelledby="er-units">
      <div class="in">
        <h2 id="er-units" class="title">The agent hands over a dataset</h2>
        <p class="say">
          A thruster log in pound-force seconds, against a contract that says
          newton seconds.
        </p>
        <pre><code>{{ datasetInput }}</code></pre>
      </div>
      <div class="out">
        <h2 class="title">and gets this back</h2>
        <p class="say">
          The Mars Climate Orbiter mismatch, caught before anyone acts on it.
        </p>
        <div class="report" role="group" aria-label="Report for the dataset">
          <header>
            <span class="verdict fail">fail</span
            ><span>Failed: 1/2 checks completed, 1 finding(s).</span>
          </header>
          <div class="check">
            <div class="check-head">
              <span>schema.conformance</span><span>fail</span>
            </div>
            <div class="src">
              JSON Schema (ajv), retrieved 19 Nov 2026 11:17 UTC
            </div>
            <ul class="rows">
              <li>
                <span class="sev high">high</span
                ><span
                  >record 0: /impulse unit "lbf*s" does not match required
                  "N*s"</span
                ><span class="ref">/0/impulse</span>
              </li>
            </ul>
          </div>
          <div class="check">
            <div class="check-head">
              <span>observability.health</span><span>skipped</span>
            </div>
            <div class="src">No assetId given</div>
          </div>
          <div class="not-checked">
            <h3>Not checked</h3>
            <ul>
              <li>
                Whether values are true, only whether they are well-formed
              </li>
              <li>
                Meaning of units and labels beyond what the schema encodes
              </li>
              <li>Records outside the provided sample</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="kinds" aria-labelledby="er-kinds">
      <h2 id="er-kinds" class="title">
        Four kinds of target, each with its own source
      </h2>
      <div class="cells">
        <a
          v-for="kind in kinds"
          :key="kind.name"
          class="tile"
          :href="withBase(kind.link)"
        >
          <div class="body">
            <div>
              <h3>{{ kind.name }}</h3>
              <p>{{ kind.text }}</p>
            </div>
            <div class="report">
              <ul class="rows">
                <li>
                  <span class="sev" :class="kind.finding.severity">{{
                    kind.finding.severity
                  }}</span
                  ><span>{{ kind.finding.message }}</span
                  ><span class="ref">{{ kind.finding.ref }}</span>
                </li>
              </ul>
            </div>
          </div>
          <div class="strip" :class="kind.stripTone">{{ kind.strip }}</div>
        </a>
      </div>
    </section>

    <section class="act" aria-labelledby="er-start">
      <div aria-hidden="true"></div>
      <div class="main">
        <h2 id="er-start" class="title">Add it to Claude Code</h2>
        <p>One command, then ask your agent to verify before it acts.</p>
        <pre><code>{{ command }}</code></pre>
        <a :href="withBase('/guide/')">Read the guide</a>
      </div>
      <div aria-hidden="true"></div>
    </section>

    <div class="band">
      <div class="big-mark" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.er-home {
  color: var(--er-ink);
  font-family: var(--er-font-text);
}

/* The report, whole in the middle and taken apart around it */
.board {
  position: relative;
  height: calc(100svh - var(--vp-nav-height));
  min-height: 760px;
  overflow: hidden;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  padding: 0 12px;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  grid-row: 1;
}

.board > .col:nth-child(1) {
  grid-column: 1;
}
.board > .col:nth-child(2) {
  grid-column: 2;
}
.board > .col:nth-child(3) {
  grid-column: 3;
}
.board > .col:nth-child(4) {
  grid-column: 4;
}
.board > .col:nth-child(5) {
  grid-column: 5;
}
.board > .col:nth-child(6) {
  grid-column: 6;
}

.col.up {
  margin-top: -150px;
}
.col.down {
  margin-top: -40px;
}

.tile {
  display: flex;
  flex-direction: column;
  background: var(--er-tile);
  color: var(--er-ink);
  flex: none;
  text-decoration: none;
}

.tile .body {
  flex: 1;
  padding: 16px 18px 20px;
  font-size: 16px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.tile .big {
  font-weight: var(--er-weight-display);
  font-size: clamp(32px, 3vw, 44px);
  letter-spacing: var(--er-tracking-display);
  line-height: 1;
  overflow-wrap: normal;
}

.tile .small {
  display: block;
  margin-top: 6px;
  font-size: 14px;
  color: var(--er-muted);
}

.tile .strip {
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 13px;
  color: var(--er-strip-ink);
  background: var(--er-strip-1);
}

.strip.s2 {
  background: var(--er-strip-2);
}
.strip.s3 {
  background: var(--er-strip-3);
}
.strip.s4 {
  background: var(--er-strip-4);
}
.tile.nc {
  background: var(--er-surface);
}
.tile.nc .body {
  font-size: 20px;
  line-height: 1.25;
  font-weight: var(--er-weight-display);
}
.tile.v-fail {
  background: var(--er-fail-bg);
  color: var(--er-fail-ink);
}
.tile.v-unknown {
  background: var(--er-unknown-bg);
  color: var(--er-unknown-ink);
}
.tile.v-pass {
  background: var(--er-pass-bg);
  color: var(--er-pass-ink);
}
.tile.v-fail .small,
.tile.v-unknown .small,
.tile.v-pass .small {
  color: inherit;
}

.stage {
  grid-column: 2 / span 4;
  grid-row: 1;
  align-self: start;
  margin-top: 72px;
  z-index: 1;
  background: var(--er-bg);
  outline: 12px solid var(--er-bg);
  padding: 40px;
  display: grid;
  grid-template-columns: 5fr 6fr;
  gap: 40px;
  align-items: start;
}

.stage h1 {
  font-weight: var(--er-weight-display);
  font-size: clamp(40px, 4vw, 60px);
  letter-spacing: var(--er-tracking-display);
  line-height: 1;
  margin: 0 0 24px;
}

.stage p {
  font-size: 19px;
  line-height: 1.5;
  margin: 0 0 28px;
}

.stage p code,
.install {
  font-family: var(--er-font-mono);
  background: var(--er-surface);
  padding: 2px 6px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.button {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  padding: 0 24px;
  background: var(--er-accent);
  color: var(--er-accent-ink);
  text-decoration: none;
  font-weight: var(--er-weight-strong);
}

.button:focus-visible,
.cells .tile:focus-visible,
.act a:focus-visible {
  outline: 3px solid var(--er-ink);
  outline-offset: 3px;
}

.install {
  font-size: 14px;
  padding: 13px 14px;
}

/* Report fragment */
.report {
  background: var(--er-panel);
  padding: 18px;
  font-size: 14px;
  line-height: 1.45;
  color: var(--er-ink);
}

.stage .report {
  background: var(--er-tile);
}

.report header {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin-bottom: 14px;
}

.verdict {
  display: inline-block;
  padding: 0 0.45em;
  font-weight: var(--er-weight-strong);
  font-size: 15px;
}

.verdict.fail {
  background: var(--er-fail-bg);
  color: var(--er-fail-ink);
}

.report .check {
  background: var(--er-panel);
  padding: 12px 14px;
  margin-bottom: 10px;
}

.split .report .check,
.cells .report {
  background: var(--er-surface);
}

.report .check-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-weight: var(--er-weight-strong);
}

.report .src {
  color: var(--er-muted);
  margin: 2px 0 8px;
}

.report .rows {
  list-style: none;
  margin: 0;
  padding: 0;
}

.report .rows li {
  display: grid;
  grid-template-columns: 62px 1fr;
  gap: 8px;
  padding: 3px 0;
}

.report .rows .ref {
  grid-column: 2;
  color: var(--er-muted);
  font-size: 13px;
}

.sev {
  font-weight: var(--er-weight-strong);
}
.sev.high {
  color: var(--er-fail-ink);
}
.sev.medium {
  color: var(--er-unknown-ink);
}

.report .not-checked {
  padding: 12px 14px;
  background: var(--er-unknown-bg);
  color: var(--er-unknown-ink);
}

.report .not-checked :is(h2, h3) {
  font-size: 14px;
  font-weight: var(--er-weight-strong);
  margin: 0 0 4px;
  letter-spacing: 0;
  border: 0;
  padding: 0;
}

.report .not-checked ul {
  margin: 0;
  padding-left: 18px;
  list-style: disc;
}

h2.title {
  font-weight: var(--er-weight-display);
  font-size: clamp(32px, 3.4vw, 52px);
  letter-spacing: var(--er-tracking-display);
  line-height: 1.05;
  margin: 0 0 40px;
  border: 0;
  padding: 0;
}

/* One report, four fields */
.fields {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin-top: 160px;
}

.fields h2 {
  grid-column: 1 / -1;
  padding: 0 32px;
}

.field {
  padding: 32px 28px 28px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 32px;
  min-height: 540px;
}

.field:nth-of-type(1) {
  background: var(--er-surface);
}
.field:nth-of-type(2) {
  background: var(--er-tile);
}
.field:nth-of-type(3) {
  background: var(--er-field-2);
  color: var(--er-field-ink);
}
.field:nth-of-type(4) {
  background: var(--er-field);
  color: var(--er-field-ink);
}

.card {
  background: var(--er-bg);
  color: var(--er-ink);
  padding: 16px;
  font-size: 14px;
  line-height: 1.45;
  max-width: 290px;
  margin-top: 10vh;
}

.card b {
  display: block;
  font-weight: var(--er-weight-strong);
}

.card .row {
  padding: 5px 0;
}
.card .muted {
  color: var(--er-muted);
}

.card .nc {
  background: var(--er-unknown-bg);
  color: var(--er-unknown-ink);
  padding: 8px 10px;
  margin-top: 8px;
}

.field p {
  font-size: clamp(20px, 1.7vw, 26px);
  line-height: 1.25;
  margin: 0;
}

/* Input tile, output tile */
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 160px 12px 0;
}

.split > div {
  padding: 64px 48px;
}

.split .in {
  background: var(--er-field);
  color: var(--er-field-ink);
}

.split pre {
  margin: 0;
  font-family: var(--er-font-mono);
  font-size: 17px;
  line-height: 1.5;
  overflow-x: auto;
  color: var(--er-field-ink);
}

.split .out {
  background: var(--er-tile);
}
.split .out .report {
  max-width: 520px;
}

.split .say {
  font-size: 18px;
  max-width: 36ch;
  margin: 0 0 28px;
}

/* Four kinds, as labelled tiles */
.kinds {
  padding: 160px 12px 0;
}
.kinds h2 {
  padding: 0 20px;
}

.cells {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.cells .tile .body {
  display: grid;
  gap: 20px;
  padding: 24px;
  flex: 1;
}

.cells h3 {
  font-weight: var(--er-weight-display);
  font-size: 30px;
  letter-spacing: var(--er-tracking-display);
  margin: 0 0 6px;
}

.cells p {
  margin: 0;
  color: var(--er-muted);
  font-size: 16px;
}

.cells .tile:hover h3 {
  text-decoration: underline;
}
.cells .report {
  align-self: end;
}

/* The action tile */
.act {
  display: grid;
  grid-template-columns: 1fr 4fr 1fr;
  gap: 12px;
  margin: 160px 0 12px;
  padding: 0 12px;
}

.act > div {
  background: var(--er-tile);
  min-height: 340px;
}

.act .main {
  background: var(--er-accent);
  color: var(--er-accent-ink);
  padding: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.act h2 {
  margin-bottom: 12px;
}
.act p {
  margin: 0 0 20px;
  font-size: 18px;
}

.act pre {
  background: var(--er-bg);
  color: var(--er-ink);
  font-family: var(--er-font-mono);
  font-size: 16px;
  padding: 16px 20px;
  margin: 0 0 20px;
  max-width: 640px;
  overflow-x: auto;
}

.act a {
  color: var(--er-accent-ink);
  font-weight: var(--er-weight-strong);
}

/* The mark, built large */
.band {
  background: var(--er-surface);
  padding: 48px 32px 32px;
}

.big-mark {
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  gap: 8px;
  height: 30svh;
  min-height: 220px;
}

.big-mark span:nth-child(1) {
  background: var(--er-mark-a);
}
.big-mark span:nth-child(2) {
  background: var(--er-mark-b);
  width: 72%;
}
.big-mark span:nth-child(3) {
  outline: 6px solid var(--er-mark-b);
  outline-offset: -6px;
  width: 86%;
}

.phone-only {
  display: none;
}

@media (max-width: 760px) {
  .board {
    display: block;
    height: auto;
    min-height: 0;
    padding: 0;
    overflow: visible;
  }

  .board > .col {
    display: none;
  }

  .stage {
    display: block;
    margin: 0;
    padding: 24px 16px;
    outline: 0;
  }

  .stage h1 {
    font-size: 11vw;
  }
  .stage .report {
    margin-top: 28px;
  }

  .phone-only {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 0 8px;
  }

  .fields {
    display: block;
    margin-top: 80px;
  }

  .fields h2 {
    padding: 0 16px;
  }

  .field {
    min-height: 0;
    padding: 24px 16px;
  }

  .card {
    margin-top: 0;
  }

  .split {
    grid-template-columns: minmax(0, 1fr);
    padding: 80px 8px 0;
    gap: 8px;
  }

  .split > div {
    padding: 32px 16px;
  }
  .split pre {
    font-size: 14px;
  }
  .kinds {
    padding: 80px 8px 0;
  }
  .kinds h2 {
    padding: 0 8px;
  }

  .cells {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .act {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: 80px;
    gap: 8px;
    padding: 0 8px;
  }

  .act .main {
    grid-column: 1 / -1;
    order: -1;
    padding: 32px 16px;
  }

  .act > div:not(.main) {
    min-height: 100px;
  }
  .band {
    padding: 32px 16px;
  }

  .big-mark {
    height: 20svh;
    min-height: 140px;
  }
}
</style>

<script setup lang="ts">
/*
 * The home page, direction C: the waterline. Checked above the line, not
 * checked below it. The report is real output from verify, captured on
 * 19 November 2026 (lodash 4.17.20 against OSV.dev).
 */
import { withBase } from 'vitepress';

const command = 'claude mcp add evidence-report -- npx -y evidence-report-mcp';
const target = `{ "kind": "package", "ecosystem": "npm",
  "name": "lodash", "version": "4.17.20" }`;
const findings = [
  {
    severity: 'high',
    message: 'Command Injection in lodash',
    ref: 'GHSA-35jh-r3h4-6jhm'
  },
  {
    severity: 'high',
    message: 'Code Injection via _.template imports key names',
    ref: 'GHSA-r5fr-rjxr-66jc'
  },
  {
    severity: 'medium',
    message: 'Regular Expression Denial of Service (ReDoS)',
    ref: 'GHSA-29mw-wpgm-hmr9'
  },
  {
    severity: 'medium',
    message: 'Prototype Pollution in _.unset, _.omit and _.pullAt',
    ref: 'GHSA-xxjr-mmjv-4gpg'
  }
];
const notChecked = [
  'Unpublished or zero-day vulnerabilities',
  'Malicious behaviour without an advisory (typosquats, install scripts)',
  'Whether this package is the right one for the job'
];
const kinds = [
  {
    name: 'Packages',
    text: 'Known advisories from OSV.dev.',
    small: "Severity from each advisory's own rating or CVSS vector.",
    link: '/guide/checks/package'
  },
  {
    name: 'Lockfiles and SBOMs',
    text: 'Every package in a lockfile or SBOM, from OSV.dev.',
    small: 'package-lock.json or CycloneDX. A git dependency keeps it unknown.',
    link: '/guide/checks/dependencies'
  },
  {
    name: 'Datasets',
    text: 'Records against their contract, units included.',
    small: 'JSON Schema in strict mode, with x-unit: lbf*s is not N*s.',
    link: '/guide/checks/dataset'
  },
  {
    name: 'Media files',
    text: 'Content credentials, through c2patool.',
    small: 'Only a trusted signer passes. No manifest proves nothing.',
    link: '/guide/checks/file'
  },
  {
    name: 'Claims',
    text: 'Two independent source domains, at least.',
    small: 'Heuristic, so it can fail a claim but never pass one.',
    link: '/guide/checks/claim'
  }
];
const links = [
  { text: 'Guide', href: withBase('/guide/') },
  { text: 'API reference', href: withBase('/api/') },
  { text: 'GitHub', href: 'https://github.com/phun-ky/evidence-report-mcp' },
  { text: 'npm', href: 'https://www.npmjs.com/package/evidence-report-mcp' }
];
</script>

<template>
  <div class="er-home">
    <section class="hero" aria-labelledby="er-title">
      <div class="below"></div>
      <!-- Two copies of the headline, each clipped to its side of the line -->
      <div class="layer top">
        <h1 id="er-title" class="headline">
          <span>Unknown</span><span>is not pass</span>
        </h1>
      </div>
      <div class="layer under" aria-hidden="true">
        <p class="headline"><span>Unknown</span><span>is not pass</span></p>
      </div>
      <div class="foot">
        <p>
          evidence-report-mcp gives agents an evidence report before they act:
          what was checked, where it came from, and what was not checked.
        </p>
        <a class="button" :href="withBase('/guide/')">Get started</a>
      </div>
    </section>

    <section class="exchange" aria-labelledby="er-ask">
      <h2 id="er-ask" class="big">Ask before acting</h2>
      <ol>
        <li>
          <p>First, add it to Claude Code.</p>
          <pre><code>{{ command }}</code></pre>
          <div class="response">
            <div class="row">
              <b>tool</b><span>verify: Verify before acting</span>
            </div>
            <div class="row">
              <b>mode</b><span class="muted">read-only</span>
            </div>
          </div>
        </li>
        <li>
          <p>Then let the agent hand over what it is about to use.</p>
          <pre><code>{{ target }}</code></pre>
          <div
            class="response"
            role="group"
            aria-label="Report for lodash 4.17.20"
          >
            <div class="row">
              <b>verdict</b
              ><span
                ><span class="verdict fail">fail</span> Failed: 1/1 checks
                completed, 4 finding(s).</span
              >
            </div>
            <div class="row">
              <b>source</b
              ><span>OSV.dev, retrieved 19 Nov 2026 11:17:18 UTC</span>
            </div>
            <div v-for="f in findings" :key="f.ref" class="row">
              <b>{{ f.severity }}</b
              ><span
                >{{ f.message }} <span class="muted">{{ f.ref }}</span></span
              >
            </div>
          </div>
        </li>
        <li>
          <p>Read where the answer stops.</p>
          <div class="response">
            <b>not checked</b>
            <ul>
              <li v-for="item in notChecked" :key="item">{{ item }}</li>
            </ul>
          </div>
        </li>
      </ol>
    </section>

    <section class="bands" aria-labelledby="er-kinds">
      <h2 id="er-kinds" class="big">Five kinds of target</h2>
      <div v-for="kind in kinds" :key="kind.name" class="band">
        <h3>
          <a :href="withBase(kind.link)">{{ kind.name }}</a>
        </h3>
        <p>
          {{ kind.text }}<small>{{ kind.small }}</small>
        </p>
      </div>
    </section>

    <section class="close" aria-labelledby="er-add">
      <h2 id="er-add" class="big">One line to add it</h2>
      <div>
        <pre><code>{{ command }}</code></pre>
        <a :href="withBase('/guide/')">Read the guide</a>
      </div>
    </section>

    <div class="name">
      <div class="word" aria-hidden="true">evidence-report</div>
      <nav aria-label="Project">
        <a v-for="link in links" :key="link.text" :href="link.href">{{
          link.text
        }}</a>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.er-home {
  color: var(--er-ink);
  font-family: var(--er-font-text);
  font-size: 17px;
  line-height: var(--er-leading-text);
}

.er-home a {
  color: var(--er-link);
  text-underline-offset: 0.18em;
}

/* The waterline: checked above, not checked below */
.hero {
  --fs: clamp(84px, 13vw, 196px);
  --line: 50%;
  position: relative;
  height: calc(100svh - var(--vp-nav-height));
  min-height: 640px;
  overflow: hidden;
  background: var(--er-bg);
}

.hero .below {
  position: absolute;
  inset: var(--line) 0 0 0;
  background: var(--er-field);
}

.layer {
  position: absolute;
  inset: 0;
}

.layer.top {
  clip-path: inset(0 0 calc(100% - var(--line)) 0);
  color: var(--er-ink);
}

.layer.under {
  clip-path: inset(var(--line) 0 0 0);
  color: var(--er-field-ink);
}

/* Two lines at 0.88: the line cuts through the middle of the second */
.headline {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(var(--line) - 1.32 * var(--fs));
  margin: 0;
  text-align: center;
  font-family: var(--er-font-display);
  font-weight: var(--er-weight-display);
  font-size: var(--fs);
  line-height: var(--er-leading-display);
  letter-spacing: var(--er-tracking-display);
  text-transform: uppercase;
}

.headline span {
  display: block;
}

.hero .foot {
  position: absolute;
  left: 32px;
  right: 32px;
  bottom: 40px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 32px;
  color: var(--er-field-ink);
}

.hero .foot p {
  max-width: 44ch;
  margin: 0;
  font-size: 20px;
  line-height: 1.45;
}

.er-home .button {
  display: inline-flex;
  align-items: center;
  flex: none;
  min-height: 52px;
  padding: 0 28px;
  background: var(--er-accent);
  color: var(--er-accent-ink);
  font-weight: var(--er-weight-strong);
  font-size: 18px;
  text-decoration: none;
}

.big {
  margin: 0 0 56px;
  font-family: var(--er-font-display);
  font-weight: var(--er-weight-display);
  font-size: clamp(56px, 7vw, 112px);
  line-height: var(--er-leading-display);
  letter-spacing: var(--er-tracking-display);
  text-transform: uppercase;
}

pre {
  margin: 0;
  padding: 20px 24px;
  /* Short commands: wrap rather than scroll, so nothing needs keyboard focus */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--er-code-bg);
  color: var(--er-code-ink);
  font-family: var(--er-font-mono);
  font-size: 15px;
  line-height: 1.6;
}

/* Call and response */
.exchange {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 24px;
  padding: 160px 32px;
}

.exchange .big {
  grid-column: 1 / span 4;
}

.exchange ol {
  grid-column: 5 / span 7;
  max-width: 680px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.exchange ol > li + li {
  margin-top: 88px;
}

.exchange ol > li > p {
  margin: 0 0 16px;
  font-size: 22px;
  font-weight: var(--er-weight-strong);
}

.response {
  margin: 16px 0 0 32px;
  padding: 20px;
  background: var(--er-surface);
  font-size: 15px;
}

.response .row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
  padding: 3px 0;
}

.response .muted {
  color: var(--er-muted);
}

.response ul {
  margin: 8px 0 0;
  padding-left: 20px;
  list-style: disc;
}

/* A band per kind of target */
.bands .big {
  padding: 0 32px;
}

.band {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 24px;
  align-items: center;
  min-height: 20vh;
  padding: 32px;
}

.band:nth-of-type(odd) {
  background: var(--er-field-2);
  color: var(--er-field-2-ink);
}

.band h3 {
  grid-column: 1 / span 5;
  margin: 0;
  font-family: var(--er-font-display);
  font-weight: var(--er-weight-display);
  font-size: clamp(44px, 5vw, 80px);
  line-height: 0.9;
  letter-spacing: var(--er-tracking-display);
  text-transform: uppercase;
}

.er-home .band h3 a {
  color: inherit;
  text-decoration: none;
}

.er-home .band h3 a:hover {
  text-decoration: underline;
  text-decoration-thickness: 0.06em;
}

.band p {
  grid-column: 6 / span 6;
  margin: 0;
  font-size: 22px;
  line-height: 1.4;
}

.band small {
  display: block;
  margin-top: 8px;
  font-size: 16px;
}

/* Close */
.close {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 24px;
  padding: 160px 32px 120px;
}

.close .big {
  grid-column: 1 / span 7;
  margin: 0;
}

.close div {
  grid-column: 8 / span 5;
  align-self: end;
}

.close pre {
  margin-bottom: 16px;
}

/* The name opens the end of the page */
.name {
  container-type: inline-size;
  padding: 40px 32px 32px;
  overflow: hidden;
  background: var(--er-field);
  color: var(--er-field-ink);
}

.name .word {
  margin-bottom: 64px;
  font-family: var(--er-font-display);
  font-weight: var(--er-weight-display);
  /* The word is about 6.8 em wide: fill the band without running off it */
  font-size: calc(100cqw / 6.9);
  line-height: 0.82;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  white-space: nowrap;
}

.name nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 32px;
}

.er-home .name a {
  color: var(--er-field-ink);
}

@media (max-width: 760px) {
  .hero {
    --fs: 19vw;
    --line: 46%;
    min-height: 600px;
  }

  .hero .foot {
    left: 16px;
    right: 16px;
    bottom: 24px;
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }

  .hero .foot p {
    font-size: 17px;
  }

  .exchange,
  .close {
    display: block;
    padding: 80px 16px;
  }

  .exchange ol > li + li {
    margin-top: 56px;
  }

  .response {
    margin-left: 0;
  }

  .band {
    display: block;
    padding: 28px 16px;
  }

  .band p {
    margin-top: 12px;
    font-size: 19px;
  }

  .bands .big {
    padding: 0 16px;
  }

  .close div {
    margin-top: 32px;
  }

  .name {
    padding: 32px 16px;
  }
}
</style>

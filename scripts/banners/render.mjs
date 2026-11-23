// Renders the release banners for a release into docs/public/images, as the
// waterline of the home page: four formats (banner, og, square and portrait),
// each at 1x and 2x, as palette PNGs. Colours come from the design tokens and
// type from the site's Big Shoulders and Public Sans, so they match the docs.
//
// Usage: npm run banners -- <release>, e.g. 0.8
// The content is in scripts/banners/<release>.mjs. Needs google-chrome (or
// CHROME=/path/to/chrome) and Python with Pillow; nothing is downloaded.
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { launchChrome } from '../lib/chrome.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = join(ROOT, 'docs', 'public', 'images');
const FONTSOURCE = join(ROOT, 'node_modules', '@fontsource');
const FORMATS = [
  { suffix: '', width: 1200, height: 600, layout: 'wide' },
  { suffix: '-og', width: 1200, height: 630, layout: 'wide' },
  { suffix: '-square', width: 1080, height: 1080, layout: 'tall' },
  { suffix: '-portrait', width: 1080, height: 1350, layout: 'tall' }
];
const SCALES = [1, 2];
const release = process.argv[2];

if (!release) {
  console.error('Usage: npm run banners -- <release>, e.g. 0.8');
  process.exit(1);
}

const { default: content } = await import(
  pathToFileURL(join(ROOT, 'scripts', 'banners', `${release}.mjs`)).href
);
// The light tokens only: a PNG can't follow the theme
const tokens = readFileSync(
  join(ROOT, 'docs', '.vitepress', 'theme', 'tokens.css'),
  'utf8'
).match(/(?:^|\n):root \{[^}]*\}/)?.[0];

if (!tokens) throw new Error('No :root block in tokens.css');

const escape = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
const mark = readFileSync(
  join(ROOT, 'docs', 'public', 'logo', 'mark.svg'),
  'utf8'
).replace('<svg ', '<svg class="mark" ');
const title = content.title
  .map((part) =>
    typeof part === 'string'
      ? escape(part)
      : `<span class="accent">${escape(part.accent)}</span>`
  )
  .join('<br>');
const { report } = content;
const rows = report.rows
  .map(
    (row) =>
      `<div class="row"><b>${escape(row.source)}</b><span>${escape(row.read)}</span><i class="verdict ${row.status}">${escape(row.chip)}</i></div>`
  )
  .join('');
const page = (layout, format) => `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><style>
@font-face { font-family: 'Big Shoulders'; src: url(big-shoulders-latin-800-normal.woff2); font-weight: 800; }
@font-face { font-family: 'Public Sans'; src: url(public-sans-latin-400-normal.woff2); font-weight: 400; }
@font-face { font-family: 'Public Sans'; src: url(public-sans-latin-600-normal.woff2); font-weight: 600; }
${tokens}
* { box-sizing: border-box; margin: 0; }
html, body { width: 100%; height: 100%; }
body { position: relative; overflow: hidden; background: var(--er-bg); color: var(--er-ink);
  font-family: var(--er-font-text); line-height: var(--er-leading-text); }
/* The waterline, as on the home page: checked above, not checked below */
.below { position: absolute; inset: var(--line) 0 0 0; background: var(--er-field); }
.layer { position: absolute; inset: 0; }
.top { clip-path: inset(0 0 calc(100% - var(--line)) 0); color: var(--er-ink); }
.under { clip-path: inset(var(--line) 0 0 0); color: var(--er-field-ink); }
/* Below the line the accent turns tangerine, which reads on navy, not on white */
.under .accent { color: var(--er-accent); }
h1 { position: absolute; font-family: var(--er-font-display); font-weight: var(--er-weight-display);
  font-size: var(--fs); line-height: var(--lead); letter-spacing: var(--er-tracking-display);
  text-transform: uppercase; white-space: nowrap; }
.pill { position: absolute; display: inline-flex; align-items: center; gap: 14px;
  padding: 10px 18px 10px 12px; border: 2px solid var(--er-ink); background: var(--er-bg);
  font: 600 18px var(--er-font-mono); letter-spacing: 0.02em; }
.pill .mark { width: 28px; height: 28px; }
p { position: absolute; color: var(--er-field-ink); line-height: 1.45; }
/* Flat and square as on the site; the border keeps it apart from white */
.panel { position: absolute; padding: 20px 24px 8px; border: 2px solid var(--er-ink);
  background: var(--er-surface); color: var(--er-ink); }
.panel header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px;
  border-bottom: 2px solid var(--er-table-line); font: 600 15px var(--er-font-mono); color: var(--er-muted); }
.row { display: grid; grid-template-columns: 1fr auto; gap: 2px 16px; align-items: center; padding: 12px 0; }
.row + .row { border-top: 1px solid var(--er-table-line); }
.row b { font-weight: 600; font-size: 19px; }
.row span { grid-row: 2; font-size: 15px; color: var(--er-muted); }
.verdict { grid-row: 1 / span 2; grid-column: 2; padding: 4px 12px; font: 600 15px var(--er-font-mono);
  font-style: normal; }
.verdict.pass { background: var(--er-pass-bg); color: var(--er-pass-ink); }
.verdict.fail { background: var(--er-fail-bg); color: var(--er-fail-ink); }
.verdict.unknown { background: var(--er-unknown-bg); color: var(--er-unknown-ink); }
/* wide: text left, the report right, across the line */
/* Looser than the site's 0.88, so the two big lines don't touch */
main { --lead: 1; }
.wide { --line: 330px; --fs: 92px; }
.og .wide { --line: 345px; }
.wide .pill { top: 56px; left: 56px; }
/* The line cuts through the middle of the second line, 1.5 leads down */
.wide h1 { top: calc(var(--line) - 1.5 * var(--lead) * var(--fs)); left: 56px; }
.wide p { bottom: 56px; left: 56px; width: 580px; font-size: 20px; }
.wide .panel { top: 56px; right: 56px; width: 440px; }
/* tall: text on top, the report below the line */
.tall { --line: 350px; --fs: 120px; }
.portrait .tall { --line: 400px; --fs: 140px; }
.tall .pill { top: 72px; left: 72px; padding: 12px 22px 12px 14px; font-size: 22px; }
.tall .pill .mark { width: 34px; height: 34px; }
.tall h1 { top: calc(var(--line) - 1.5 * var(--lead) * var(--fs)); left: 72px; }
.tall p { top: calc(var(--line) + 84px); left: 72px; width: 920px; font-size: 27px; }
/* zoom scales left and top too, so they're divided by it: 72px and 600px */
.tall .panel { left: calc(72px / 1.1); top: calc(600px / 1.1); width: calc(936px / 1.1); zoom: 1.1; }
.portrait .tall p { top: calc(var(--line) + 116px); }
.portrait .tall .panel { left: calc(72px / 1.4); top: calc(700px / 1.4); width: calc(936px / 1.4); zoom: 1.4; }
</style></head>
<body class="${format}"><main class="${layout}">
  <div class="below"></div>
  <div class="layer top"><h1>${title}</h1></div>
  <div class="layer under" aria-hidden="true"><h1>${title}</h1></div>
  <div class="pill">${mark}${escape(content.pill)}</div>
  <p>${escape(content.body)}</p>
  <section class="panel">
    <header><span>${escape(report.label)}</span><i class="verdict ${report.verdict}">${escape(report.verdict)}</i></header>
    ${rows}
  </section>
</main></body></html>`;
const work = mkdtempSync(join(tmpdir(), 'evidence-report-mcp-banners-'));

// Fonts beside the page, so a file:// page can load them
for (const font of [
  'big-shoulders/files/big-shoulders-latin-800-normal.woff2',
  'public-sans/files/public-sans-latin-400-normal.woff2',
  'public-sans/files/public-sans-latin-600-normal.woff2'
]) {
  copyFileSync(join(FONTSOURCE, font), join(work, font.split('/').pop()));
}

const outputs = FORMATS.flatMap(({ suffix, width, height, layout }) =>
  SCALES.map((scale) => ({
    path: join(
      OUT,
      `evidence-report-mcp-${content.slug}${suffix}${scale === 2 ? '@2x' : ''}.png`
    ),
    html: page(layout, suffix.slice(1)),
    width,
    height,
    scale
  }))
);
const { send, close } = await launchChrome();

mkdirSync(OUT, { recursive: true });

try {
  await send('Page.enable');

  for (const [index, output] of outputs.entries()) {
    const file = join(work, `${index}.html`);

    writeFileSync(file, output.html);
    await send('Emulation.setDeviceMetricsOverride', {
      width: output.width,
      height: output.height,
      deviceScaleFactor: output.scale,
      mobile: false
    });
    await send('Page.navigate', { url: pathToFileURL(file).href });
    await wait(800);
    await send('Runtime.evaluate', {
      expression: 'document.fonts.ready',
      awaitPromise: true
    });

    const { data } = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: output.width, height: output.height, scale: 1 }
    });

    writeFileSync(output.path, Buffer.from(data, 'base64'));
  }
} finally {
  await close();
  rmSync(work, { recursive: true, force: true });
}

// A palette of up to 256 colours keeps flat artwork sharp and small; median
// cut keeps the token colours exact, where octree shifts white and navy
execFileSync(
  'python3',
  [
    '-c',
    `import sys
from PIL import Image
for path in sys.argv[1:]:
    Image.open(path).convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT).save(path, optimize=True)`,
    ...outputs.map(({ path }) => path)
  ],
  { stdio: 'inherit' }
);

for (const { path } of outputs) {
  console.log(`${path.slice(ROOT.length)}: ${statSync(path).size} bytes`);
}

// Render the logo's PNGs from the SVG marks in docs/public/logo: the README
// banners, the social cards and the PNG icons. They're drawn as HTML with the
// site's Work Sans in headless Chrome, with the colours read from the design
// tokens, so they match the docs. Adapted from hybrid-compute.
// Needs google-chrome (or CHROME=/path/to/chrome) and Python with Pillow,
// which turns each PNG into a palette image to keep it small.
// Usage: node scripts/render-logo.mjs
import { Buffer } from 'node:buffer';
import { execFileSync, spawn } from 'node:child_process';
import {
  copyFileSync,
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

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOGO = join(ROOT, 'docs', 'public', 'logo');
const FONTS = join(ROOT, 'node_modules', '@fontsource', 'work-sans', 'files');
const TOKENS = readFileSync(
  join(ROOT, 'docs', '.vitepress', 'theme', 'tokens.css'),
  'utf8'
);
const work = mkdtempSync(join(tmpdir(), 'evidence-report-mcp-logo-'));

for (const weight of [300, 400, 600]) {
  copyFileSync(
    join(FONTS, `work-sans-latin-${weight}-normal.woff2`),
    join(work, `work-sans-${weight}.woff2`)
  );
}

/** The --er-* tokens of one CSS block, as CSS that sets them on :root. */
const tokensOf = (selector) => {
  const block = TOKENS.match(
    new RegExp(`(?:^|\\n)${selector.replace('.', '\\.')} \\{([^}]*)\\}`)
  )?.[1];

  if (!block) throw new Error(`No ${selector} block in tokens.css`);

  return `:root {${[...block.matchAll(/(--er-[\w-]+):\s*([^;]+);/g)]
    .map(([, name, value]) => `${name}: ${value};`)
    .join(' ')}}`;
};
const LIGHT = tokensOf(':root');
// Dark overrides light, as on the site
const DARK = `${LIGHT}\n${tokensOf('.dark')}`;
const svg = (file) => readFileSync(join(LOGO, file), 'utf8');
const MARKS = { light: svg('mark.svg'), dark: svg('mark-dark.svg') };
const HEADLINE = 'Evidence, not verdicts.';
const TAGLINE =
  'An MCP server that tells agents what was checked, and what was not.';
const page = (body, tokens, background = 'var(--er-bg)') => `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'Work Sans'; src: url(work-sans-300.woff2); font-weight: 300; }
  @font-face { font-family: 'Work Sans'; src: url(work-sans-400.woff2); font-weight: 400; }
  @font-face { font-family: 'Work Sans'; src: url(work-sans-600.woff2); font-weight: 600; }
  ${tokens}
  html, body { margin: 0; background: ${background}; color: var(--er-ink); font-family: var(--er-font-text); overflow: hidden; }
  * { box-sizing: border-box; }
  .wordmark { display: flex; align-items: center; gap: 12px; font-weight: 600; letter-spacing: -0.01em; }
  .wordmark svg { flex: none; }
  h1 { margin: 0; font-family: var(--er-font-display); font-weight: var(--er-weight-display); letter-spacing: var(--er-tracking-display); line-height: var(--er-leading-display); }
  p { margin: 0; color: var(--er-muted); line-height: 1.4; }
  .report { background: var(--er-tile); padding: 16px; font-size: 15px; line-height: 1.4; }
  .report header { display: flex; gap: 10px; align-items: baseline; margin-bottom: 12px; }
  .verdict { padding: 0 0.45em; font-weight: 600; background: var(--er-fail-bg); color: var(--er-fail-ink); }
  .check { background: var(--er-panel); padding: 10px 14px; margin-bottom: 10px; }
  .head { display: flex; justify-content: space-between; font-weight: 600; }
  .src { color: var(--er-muted); margin: 2px 0 6px; }
  .rows { list-style: none; margin: 0; padding: 0; }
  .rows li { display: grid; grid-template-columns: 3.4em 1fr; gap: 8px; padding: 2px 0; }
  .sev { font-weight: 600; color: var(--er-fail-ink); }
  .nc { padding: 10px 14px; background: var(--er-unknown-bg); color: var(--er-unknown-ink); }
  .nc b { display: block; margin-bottom: 2px; }
  .nc ul { margin: 0; padding-left: 18px; }
</style>
${body}`;
const mark = (theme, size) =>
  MARKS[theme].replace('<svg ', `<svg width="${size}" height="${size}" `);
/** The report from the home page: lodash 4.17.20, checked against OSV.dev. */
const report = (
  notChecked,
  size
) => `<div class="report" style="font-size:${size}px">
  <header><span class="verdict">fail</span><span>Failed: 1/1 checks completed, 4 finding(s).</span></header>
  <div class="check">
    <div class="head"><span>osv.vulnerabilities</span><span>deterministic</span></div>
    <div class="src">OSV.dev, retrieved 18 Nov 2026 12:07 UTC</div>
    <ul class="rows">
      <li><span class="sev">high</span><span>Command Injection in lodash</span></li>
      <li><span class="sev">high</span><span>Code Injection via _.template imports</span></li>
    </ul>
  </div>
  <div class="nc"><b>Not checked</b><ul>${notChecked.map((item) => `<li>${item}</li>`).join('')}</ul></div>
</div>`;
const NOT_CHECKED = [
  'Unpublished or zero-day vulnerabilities',
  'Malicious behaviour without an advisory',
  'Whether this package is the right one for the job'
];
const banner = (theme) =>
  page(
    `<div style="width:1280px;height:400px;padding:48px 56px;display:grid;grid-template-columns:1fr 580px;gap:48px;align-items:center">
      <div>
        <div class="wordmark" style="font-size:24px">${mark(theme, 36)}<span>evidence-report-mcp</span></div>
        <h1 style="font-size:72px;margin-top:36px">${HEADLINE}</h1>
        <p style="margin-top:22px;font-size:23px">${TAGLINE}</p>
      </div>
      ${report(NOT_CHECKED.slice(0, 2), 18)}
    </div>`,
    theme === 'dark' ? DARK : LIGHT
  );
const social = (theme) =>
  page(
    `<div style="width:1200px;height:630px;padding:72px;display:grid;grid-template-columns:1fr 500px;gap:48px;align-items:center">
      <div>
        <div class="wordmark" style="font-size:28px">${mark(theme, 44)}<span>evidence-report-mcp</span></div>
        <h1 style="font-size:76px;margin-top:52px">Evidence,<br>not verdicts.</h1>
        <p style="margin-top:28px;font-size:25px">${TAGLINE}</p>
        <p style="margin-top:36px;font-size:22px;font-family:var(--er-font-mono)">phun-ky.net/evidence-report-mcp</p>
      </div>
      ${report(NOT_CHECKED, 17)}
    </div>`,
    theme === 'dark' ? DARK : LIGHT
  );
/** The mark on the light ground, inset: a PNG can't follow the theme. */
const icon = (size, inset) =>
  page(
    `<div style="width:${size}px;height:${size}px;display:grid;place-items:center">${mark('light', size - inset * 2)}</div>`,
    LIGHT
  );
const OUTPUTS = [
  {
    file: 'banner-light.png',
    html: banner('light'),
    width: 1280,
    height: 400,
    scale: 2
  },
  {
    file: 'banner-dark.png',
    html: banner('dark'),
    width: 1280,
    height: 400,
    scale: 2
  },
  {
    file: 'social.png',
    html: social('light'),
    width: 1200,
    height: 630,
    scale: 1
  },
  {
    file: 'social@2x.png',
    html: social('light'),
    width: 1200,
    height: 630,
    scale: 2
  },
  {
    file: 'favicon-32.png',
    html: icon(32, 0),
    width: 32,
    height: 32,
    scale: 1
  },
  // iOS rounds the corners itself, so the mark keeps clear of them
  {
    file: 'apple-touch-icon.png',
    html: icon(180, 26),
    width: 180,
    height: 180,
    scale: 1
  }
];
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(process.env.CHROME ?? 'google-chrome', [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${join(work, 'profile')}`,
  'about:blank'
]);

try {
  let target;

  for (let i = 0; i < 50 && !target; i++) {
    await wait(200);

    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();

      target = list.find((entry) => entry.type === 'page');
    } catch {
      // Chrome isn't listening yet
    }
  }

  if (!target) throw new Error('Chrome did not start');

  const ws = new WebSocket(target.webSocketDebuggerUrl);

  await new Promise((resolve) =>
    ws.addEventListener('open', resolve, { once: true })
  );

  let id = 0;

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const mine = ++id;
      const onMessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.id !== mine) return;

        ws.removeEventListener('message', onMessage);
        resolve(message.result);
      };

      ws.addEventListener('message', onMessage);
      ws.send(JSON.stringify({ id: mine, method, params }));
    });

  await send('Page.enable');

  for (const output of OUTPUTS) {
    const file = join(work, `${output.file}.html`);

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

    writeFileSync(join(LOGO, output.file), Buffer.from(data, 'base64'));
  }

  ws.close();
} finally {
  chrome.kill();
  rmSync(work, { recursive: true, force: true });
}

const before = new Map(
  OUTPUTS.map(({ file }) => [file, statSync(join(LOGO, file)).size])
);

// A palette of up to 256 colours keeps flat artwork sharp and small; tiny
// icons can come out larger, and then keep Chrome's PNG
execFileSync(
  'python3',
  [
    '-c',
    `import io, os, sys
from PIL import Image
for path in sys.argv[1:]:
    image = Image.open(path)
    image = image.convert('RGBA') if image.mode != 'RGBA' else image
    out = io.BytesIO()
    image.quantize(256, method=Image.Quantize.FASTOCTREE).save(out, 'PNG', optimize=True)
    if out.tell() < os.path.getsize(path):
        open(path, 'wb').write(out.getvalue())`,
    ...OUTPUTS.map(({ file }) => join(LOGO, file))
  ],
  { stdio: 'inherit' }
);

for (const { file } of OUTPUTS) {
  console.log(
    `${file}: ${before.get(file)} bytes from Chrome, ${statSync(join(LOGO, file)).size} kept`
  );
}

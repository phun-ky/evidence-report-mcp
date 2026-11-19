// Render the logo's PNGs from the SVG marks in docs/public/logo: the README
// banners, the social cards and the PNG icons. They're drawn as HTML with the
// site's Big Shoulders and Public Sans in headless Chrome, with the colours
// read from the design tokens, so they match the docs. Adapted from
// hybrid-compute.
// Needs google-chrome (or CHROME=/path/to/chrome) and Python with Pillow,
// which turns each PNG into a palette image to keep it small.
// Usage: node scripts/render-logo.mjs
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
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
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { launchChrome } from './lib/chrome.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOGO = join(ROOT, 'docs', 'public', 'logo');
const FONTSOURCE = join(ROOT, 'node_modules', '@fontsource');
const TOKENS = readFileSync(
  join(ROOT, 'docs', '.vitepress', 'theme', 'tokens.css'),
  'utf8'
);
const work = mkdtempSync(join(tmpdir(), 'evidence-report-mcp-logo-'));

for (const font of [
  'big-shoulders/files/big-shoulders-latin-800-normal.woff2',
  'public-sans/files/public-sans-latin-400-normal.woff2',
  'public-sans/files/public-sans-latin-600-normal.woff2'
]) {
  copyFileSync(join(FONTSOURCE, font), join(work, font.split('/').pop()));
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
const TAGLINE =
  'An MCP server that tells agents what was checked, where it came from, and what was not.';
const page = (body, tokens) => `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'Big Shoulders'; src: url(big-shoulders-latin-800-normal.woff2); font-weight: 800; }
  @font-face { font-family: 'Public Sans'; src: url(public-sans-latin-400-normal.woff2); font-weight: 400; }
  @font-face { font-family: 'Public Sans'; src: url(public-sans-latin-600-normal.woff2); font-weight: 600; }
  ${tokens}
  html, body { margin: 0; background: var(--er-bg); color: var(--er-ink); font-family: var(--er-font-text); overflow: hidden; }
  * { box-sizing: border-box; }
  .hero { position: relative; overflow: hidden; }
  .below { position: absolute; inset: var(--line) 0 0 0; background: var(--er-field); }
  .layer { position: absolute; inset: 0; }
  .top { clip-path: inset(0 0 calc(100% - var(--line)) 0); color: var(--er-ink); }
  .under { clip-path: inset(var(--line) 0 0 0); color: var(--er-field-ink); }
  .headline { position: absolute; left: 0; right: 0; top: calc(var(--line) - 1.32 * var(--fs)); margin: 0; text-align: center; font-family: var(--er-font-display); font-weight: 800; font-size: var(--fs); line-height: 0.88; letter-spacing: -0.005em; text-transform: uppercase; }
  .headline span { display: block; }
  .wordmark { position: absolute; display: flex; align-items: center; gap: 12px; font-family: var(--er-font-display); font-weight: 800; text-transform: uppercase; }
  .wordmark svg { flex: none; }
  .foot { position: absolute; display: flex; justify-content: space-between; align-items: flex-end; gap: 32px; margin: 0; color: var(--er-field-ink); line-height: 1.4; }
</style>
${body}`;
const mark = (theme, size) =>
  MARKS[theme].replace('<svg ', `<svg width="${size}" height="${size}" `);
const HEADLINE = '<span>Unknown</span><span>is not pass</span>';
/** The home page's first screen in small: the waterline through the headline. */
const waterline = ({ theme, width, height, fs, inset, wordmark, foot, url }) =>
  page(
    `<div class="hero" style="width:${width}px;height:${height}px;--fs:${fs}px;--line:50%">
      <div class="below"></div>
      <div class="layer top"><div class="headline">${HEADLINE}</div></div>
      <div class="layer under"><div class="headline">${HEADLINE}</div></div>
      <div class="wordmark" style="left:${inset}px;top:${inset}px;font-size:${wordmark}px">${mark(theme, Math.round(wordmark * 1.3))}<span>evidence-report-mcp</span></div>
      <div class="foot" style="left:${inset}px;right:${inset}px;bottom:${inset}px;font-size:${foot}px"><span style="max-width:30em">${TAGLINE}</span>${url ? '<span style="font-family:var(--er-font-mono);white-space:nowrap">phun-ky.net/evidence-report-mcp</span>' : ''}</div>
    </div>`,
    theme === 'dark' ? DARK : LIGHT
  );
const banner = (theme) =>
  waterline({
    theme,
    width: 1280,
    height: 400,
    fs: 120,
    inset: 32,
    wordmark: 24,
    foot: 20
  });
const social = (theme) =>
  waterline({
    theme,
    width: 1200,
    height: 630,
    fs: 150,
    inset: 56,
    wordmark: 30,
    foot: 24,
    url: true
  });
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
const { send, close } = await launchChrome();

try {
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
} finally {
  await close();
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

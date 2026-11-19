// Check the built docs site in headless Chrome, page by page:
// - network: nothing loads from another origin, and nothing fails to load
// - axe: no WCAG 2.2 A or AA violations, in light and in dark
// - links: every internal link, anchor and asset resolves
// - overflow: no horizontal scroll at 390, 768 and 1440 pixels wide
// - board: the home page's tile board has no blank band, on a usual and a tall
//   screen
// It serves the site the way GitHub Pages does (clean URLs, under the base
// path). Needs google-chrome, or CHROME=/path/to/chrome.
// Usage: node scripts/check-site.mjs [dir] [--base /evidence-report-mcp/]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, relative, sep } from 'node:path';
import process from 'node:process';
import { setTimeout as wait } from 'node:timers/promises';
import { parseArgs } from 'node:util';

import { launchChrome } from './lib/chrome.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { base: { type: 'string', default: '/evidence-report-mcp/' } }
});
const DIR = positionals[0] ?? 'docs/.vitepress/dist';
const BASE = values.base;
const AXE = readFileSync(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8'
);
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const WIDTHS = [390, 768, 1440];
const BOARD_SIZES = [
  [1440, 900],
  [2560, 1400]
];
const TYPES = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml'
};
/** Every file under a directory, as paths relative to it with / separators. */
const walk = (dir) =>
  readdirSync(dir, { recursive: true })
    .filter((file) => statSync(join(dir, file)).isFile())
    .map((file) => file.split(sep).join('/'));
const files = new Set(walk(DIR));
/** The file GitHub Pages serves for a path under the base, or undefined. */
const resolveFile = (pathname) => {
  if (!pathname.startsWith(BASE)) return undefined;

  const path = decodeURIComponent(pathname.slice(BASE.length));
  const candidates =
    path === '' || path.endsWith('/')
      ? [`${path}index.html`]
      : [path, `${path}.html`, `${path}/index.html`];

  return candidates.find((candidate) => files.has(candidate));
};
const server = createServer((request, response) => {
  const file = resolveFile(new URL(request.url, 'http://localhost').pathname);
  const status = file ? 200 : 404;
  const served = file ?? (files.has('404.html') ? '404.html' : undefined);

  response.writeHead(status, {
    'content-type':
      TYPES[extname(served ?? '.txt')] ?? 'application/octet-stream'
  });
  response.end(served ? readFileSync(join(DIR, served)) : 'Not found');
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const ORIGIN = `http://127.0.0.1:${server.address().port}`;
const pages = [...files]
  .filter((file) => file.endsWith('.html') && file !== '404.html')
  .map(
    (file) =>
      BASE + file.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '')
  )
  .sort();
const failures = [];
const fail = (page, check, detail) => failures.push({ page, check, detail });
const chrome = await launchChrome();
const { send, on } = chrome;

try {
  await send('Page.enable');
  await send('Network.enable');

  // Every request the page makes, and every one that failed
  let requests = [];

  on('Network.requestWillBeSent', ({ requestId, request }) =>
    requests.push({ requestId, url: request.url })
  );
  on('Network.responseReceived', ({ requestId, response }) => {
    const entry = requests.find((r) => r.requestId === requestId);

    if (entry) entry.status = response.status;
  });
  on('Network.loadingFailed', ({ requestId, errorText, canceled }) => {
    const entry = requests.find((r) => r.requestId === requestId);

    if (entry && !canceled) entry.error = errorText;
  });

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });

    if (exceptionDetails) {
      throw new Error(
        exceptionDetails.exception?.description ?? exceptionDetails.text
      );
    }

    return result.value;
  };
  /** Load a page at a size and colour scheme, and wait for it to settle. */
  const load = async (page, { width, height = 900, dark = false }) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 800
    });
    await send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }
      ]
    });
    requests = [];

    const loaded = new Promise((resolve) => {
      const stop = on('Page.loadEventFired', () => {
        stop();
        resolve();
      });
    });

    await send('Page.navigate', { url: ORIGIN + page });
    await loaded;
    await evaluate('document.fonts.ready.then(() => true)');
    await wait(300);
  };
  /** Fail on requests to other origins, and on requests that failed. */
  const checkNetwork = (page, label) => {
    for (const { url, status, error } of requests) {
      if (url.startsWith('data:') || url.startsWith('blob:')) continue;

      if (new URL(url).origin !== ORIGIN) {
        fail(page, 'network', `${label}: request to another origin: ${url}`);
      } else if (error || status >= 400) {
        fail(page, 'network', `${label}: ${url} failed: ${error ?? status}`);
      }
    }
  };
  const checkOverflow = async (page, width) => {
    const overflow = await evaluate(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth'
    );

    if (overflow > 0) {
      fail(
        page,
        'overflow',
        `scrolls ${overflow}px sideways at ${width}px wide`
      );
    }
  };
  const checkAxe = async (page, mode) => {
    if (!(await evaluate('typeof axe !== "undefined"'))) await evaluate(AXE);

    const violations = await evaluate(
      `axe.run(document, { runOnly: { type: 'tag', values: ${JSON.stringify(AXE_TAGS)} } })
        .then((r) => r.violations.map((v) => ({ id: v.id, help: v.help, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')), count: v.nodes.length })))`
    );

    for (const v of violations) {
      fail(
        page,
        'axe',
        `${mode}: ${v.id} (${v.help}), ${v.count} element(s), such as ${v.targets.join(', ')}`
      );
    }
  };
  // The same-origin URLs the page links to or loads, as the browser resolved them
  const linkTargets = () =>
    evaluate(`[...new Set([
      ...[...document.querySelectorAll('a[href]')].map((a) => a.href),
      ...[...document.querySelectorAll('link[href]')].map((l) => l.href),
      ...[...document.querySelectorAll('img[src], script[src], source[src]')].map((e) => e.src)
    ])].filter((u) => u.startsWith(${JSON.stringify(ORIGIN)}))`);
  const ids = new Map();
  /** The ids in a served page, read from its HTML as served. */
  const idsOf = (file) => {
    if (!ids.has(file)) {
      const html = readFileSync(join(DIR, file), 'utf8');

      ids.set(
        file,
        new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
      );
    }

    return ids.get(file);
  };
  const checkLinks = async (page) => {
    for (const target of await linkTargets()) {
      const url = new URL(target);
      const file = resolveFile(url.pathname);

      if (!file) {
        fail(page, 'links', `broken link: ${url.pathname}${url.hash}`);
      } else if (url.hash.length > 1 && file.endsWith('.html')) {
        const id = decodeURIComponent(url.hash.slice(1));

        if (!idsOf(file).has(id)) {
          fail(page, 'links', `broken anchor: ${url.pathname}${url.hash}`);
        }
      }
    }
  };
  /** How far each board column stops short of the board's bottom edge. */
  const boardGaps = () =>
    evaluate(`(() => {
      const board = document.querySelector('.board');
      if (!board || getComputedStyle(board).display !== 'grid') return null;
      const bottom = board.getBoundingClientRect().bottom;
      return [...board.querySelectorAll(':scope > .col')]
        .map((col) => Math.round(bottom - col.lastElementChild.getBoundingClientRect().bottom));
    })()`);

  for (const page of pages) {
    process.stdout.write(`${page}\n`);

    await load(page, { width: 1440 });
    checkNetwork(page, 'light, 1440px');
    await checkOverflow(page, 1440);
    await checkLinks(page);
    await checkAxe(page, 'light');

    const hasBoard = (await boardGaps()) !== null;

    await load(page, { width: 1440, dark: true });
    checkNetwork(page, 'dark, 1440px');

    if (
      !(await evaluate(
        'document.documentElement.classList.contains("dark") || !document.querySelector("#app")'
      ))
    ) {
      fail(page, 'axe', 'dark: the page did not switch to dark');
    }

    await checkAxe(page, 'dark');

    for (const width of WIDTHS.filter((w) => w !== 1440)) {
      await load(page, { width });
      checkNetwork(page, `light, ${width}px`);
      await checkOverflow(page, width);
    }

    if (hasBoard) {
      for (const [width, height] of BOARD_SIZES) {
        await load(page, { width, height });

        const gaps = await boardGaps();
        const short = gaps.filter((gap) => gap > 0);

        if (short.length > 0) {
          fail(
            page,
            'board',
            `${short.length} column(s) stop up to ${Math.max(...short)}px short of the board's bottom edge at ${width}x${height}`
          );
        }
      }
    }
  }
} finally {
  await chrome.close();
  server.close();
}

for (const { page, check, detail } of failures) {
  console.error(`✗ ${page} [${check}] ${detail}`);
}

console.log(
  `${pages.length} page(s) in ${relative(process.cwd(), DIR) || '.'}: ${failures.length} problem(s)`
);
process.exitCode = failures.length > 0 ? 1 : 0;

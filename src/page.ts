import dns from 'node:dns';
import type { IncomingMessage } from 'node:http';
import https from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';

/* Fetching a page an agent named, read-only and only on the public internet (decided on #64). */

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10_000;
/** Addresses that are not on the public internet: private, loopback, link-local, shared, documentation, multicast, reserved, and IPv6 ranges that embed IPv4. */
const blocked = new BlockList();

for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
] as const)
  blocked.addSubnet(net, prefix, 'ipv4');

// No ::ffff:0:0/96 rule: BlockList checks IPv4-mapped addresses against the
// IPv4 rules above, and such a rule would block every IPv4 address.
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001::', 32],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8]
] as const)
  blocked.addSubnet(net, prefix, 'ipv6');

/** Whether an IP address is on the public internet. Anything that is not an IP address is not. */
export function isPublic(ip: string): boolean {
  const v = isIP(ip);

  return v !== 0 && !blocked.check(ip, v === 4 ? 'ipv4' : 'ipv6');
}

/**
 * dns.lookup that refuses a host with any non-public address. It runs when the
 * socket connects, so the address checked is the address used: a DNS answer
 * that changes between a check and the connection can't get round it.
 */
export const safeLookup = ((hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);

    const bad = addresses.find((a) => !isPublic(a.address));

    if (bad)
      return callback(
        new Error(
          `${hostname} resolves to a non-public address (${bad.address})`
        ),
        []
      );

    if (options.all) return callback(null, addresses);

    callback(null, addresses[0]!.address, addresses[0]!.family);
  });
}) as LookupFunction;

function get(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          lookup: safeLookup,
          signal,
          // A generic client name: nothing about who runs the server
          headers: {
            'user-agent': 'evidence-report-mcp',
            accept: 'text/html, text/plain;q=0.9'
          }
        },
        resolve
      )
      .on('error', reject);
  });
}

/**
 * Fetches a page's text: https only, public addresses only (redirects
 * rechecked, at most 5), at most 2 MB and 10 seconds, no cookies. Throws on
 * anything else.
 */
export async function fetchPage(url: string): Promise<string> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  let current = new URL(url);

  for (let hop = 0; ; hop++) {
    if (current.protocol !== 'https:')
      throw new Error(`Only https pages are fetched: ${current.href}`);

    // Hosts that are IP literals never reach safeLookup
    const host = current.hostname.replace(/^\[|\]$/g, '');

    if (isIP(host) && !isPublic(host))
      throw new Error(`${host} is not a public address`);

    const res = await get(current, signal);
    const status = Number(res.statusCode);

    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();

      if (hop === MAX_REDIRECTS) throw new Error('More than 5 redirects');

      current = new URL(res.headers.location, current);
      continue;
    }

    if (status < 200 || status >= 300) {
      res.resume();
      throw new Error(`Responded ${status}`);
    }

    const type = res.headers['content-type'] ?? '';

    if (!/^(text\/|application\/xhtml\+xml)/i.test(type)) {
      res.resume();
      throw new Error(`Not a text page (${type || 'no content type'})`);
    }

    const chunks: Buffer[] = [];

    let size = 0;

    for await (const chunk of res as AsyncIterable<Buffer>) {
      size += chunk.length;

      if (size > MAX_BYTES) {
        res.destroy();
        throw new Error('Larger than 2 MB');
      }

      chunks.push(chunk);
    }

    return decode(Buffer.concat(chunks), type);
  }
}

/** Decodes a page with its charset: the content-type header's, then a <meta> in the first 1,024 bytes, then UTF-8 (decided on #88). */
function decode(body: Buffer, type: string): string {
  const label =
    /charset=["']?([\w-]+)/i.exec(type)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(
      body.subarray(0, 1024).toString('latin1')
    )?.[1] ??
    'utf-8';

  try {
    return new TextDecoder(label).decode(body);
  } catch {
    // An unknown charset: UTF-8, which can only make a quote not found
    return new TextDecoder().decode(body);
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
  hellip: '...',
  // Typographic ones (decided on #88); normalise makes them match their plain forms
  ndash: '–',
  mdash: '—',
  minus: '−',
  shy: '\u00ad',
  zwnj: '\u200c',
  zwj: '\u200d',
  thinsp: '\u2009',
  ensp: '\u2002',
  emsp: '\u2003',
  sbquo: '‚',
  bdquo: '„',
  laquo: '«',
  raquo: '»',
  middot: '·',
  bull: '•',
  times: '×'
};
/** Tags that a browser renders inline, in a line of text: they become nothing, any other tag a space. HTML, then JATS, the XML of papers' full texts (#84). */
const INLINE = new RegExp(
  `^</?(${'a abbr b bdi bdo cite code data del dfn em font i ins kbd mark q s samp small span strong sub time tt u var wbr bold ext-link italic monospace named-content sc styled-content underline xref'.split(' ').join('|')})(?=[\\s/>])`,
  'i'
);
// Private-use marks: around a <sup>, so that a footnote marker in one can be dropped once the tags are gone, and for an inline tag
const SUP_OPEN = '\ue000';
const SUP_CLOSE = '\ue001';
const INLINE_MARK = '\ue002';

function tag(t: string): string {
  if (/^<sup(?=[\s/>])/i.test(t)) return SUP_OPEN;

  if (/^<\/sup(?=[\s/>])/i.test(t)) return SUP_CLOSE;

  return INLINE.test(t) ? INLINE_MARK : ' ';
}

function entity(match: string, name: string): string {
  if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? match;

  const hex = name[1] === 'x' || name[1] === 'X';
  const cp = parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);

  return cp <= 0x10ffff ? String.fromCodePoint(cp) : match;
}

/**
 * The visible text of an HTML page, roughly: script, style and noscript
 * contents and comments dropped, tags replaced by spaces, common entities
 * decoded. Every step is linear, so a hostile page can't make it slow.
 */
export function pageText(html: string): string {
  // Matched against a lower-cased copy; the i flag only says so to readers and scanners
  const lower = html.toLowerCase();
  const open = /<(script|style|noscript)\b|<!--/gi;
  // Browsers end a comment at "-->" or "--!>"
  const commentEnd = /--!?>/g;
  const parts: string[] = [];

  let at = 0;

  for (let m = open.exec(lower); m; m = open.exec(lower)) {
    parts.push(html.slice(at, m.index));

    if (m[1]) {
      const end = lower.indexOf(`</${m[1]}`, open.lastIndex);

      // Unclosed: the rest of the page is inside it
      if (end === -1) return text(parts.join(' '));

      // Past the closing tag's ">", after any attributes: </script foo="bar">
      at = lower.indexOf('>', end) + 1 || html.length;
    } else {
      commentEnd.lastIndex = open.lastIndex;

      if (!commentEnd.exec(lower)) return text(parts.join(' '));

      at = commentEnd.lastIndex;
    }

    open.lastIndex = at;
  }

  parts.push(html.slice(at));

  return text(parts.join(' '));
}

const text = (html: string) =>
  html
    // A lone < is a space too, so that removing inline tags can never join "<scr<b>ipt>" into a tag
    .replace(/<[^<>]*>|</g, tag)
    .replace(/\ue002/g, '')
    // A <sup> whose whole text is in square brackets is a footnote marker, such as [1] (decided on #88)
    .replace(/\ue000\s*\[[^[\]\ue000\ue001]{1,30}\]\s*\ue001/g, '')
    .replace(/[\ue000\ue001]/g, '')
    .replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,8});/gi, entity);

/** For matching: Unicode compatibility form, no soft hyphens or zero-width characters, straight quotes and hyphens, one space, lower case. */
export const normalise = (s: string) =>
  s
    .normalize('NFKC')
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

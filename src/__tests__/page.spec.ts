import assert from 'node:assert/strict';
import dns from 'node:dns';
import { afterEach, mock, test } from 'node:test';

import {
  fetchPage,
  isPublic,
  normalise,
  pageText,
  safeLookup
} from '../page.js';
import { mockHttps } from '../test/https.js';

afterEach(() => mock.restoreAll());

test('isPublic: public addresses only', () => {
  for (const ip of [
    '104.20.23.154',
    '8.8.8.8',
    '2606:4700::6812:1817',
    '::ffff:104.20.23.154'
  ])
    assert.equal(isPublic(ip), true, ip);

  for (const ip of [
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.8',
    '192.0.2.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
    '64:ff9b::a00:1',
    '100::1',
    '2001::1',
    '2001:db8::1',
    '2002:7f00:1::',
    'fd00::1',
    'fe80::1',
    'ff02::1',
    'localhost',
    ''
  ])
    assert.equal(isPublic(ip), false, ip);
});

type Answer = { address: string; family: number }[];

const mockDns = (answer: Answer | Error) =>
  mock.method(dns, 'lookup', ((
    _host: string,
    _options: unknown,
    cb: (err: Error | null, addresses: Answer) => void
  ) => (answer instanceof Error ? cb(answer, []) : cb(null, answer))) as never);
const lookup = (options: object) =>
  new Promise<unknown[]>((resolve) =>
    safeLookup('host.example', options as never, (...args: unknown[]) =>
      resolve(args)
    )
  );

test('safeLookup: public answers pass through, in either callback shape', async () => {
  const answer = [
    { address: '104.20.23.154', family: 4 },
    { address: '2606:4700::6812:1817', family: 6 }
  ];

  mockDns(answer);
  assert.deepEqual(await lookup({ all: true }), [null, answer]);
  assert.deepEqual(await lookup({}), [null, '104.20.23.154', 4]);
});

test('safeLookup: any non-public answer, or a DNS error, is refused', async () => {
  mockDns([
    { address: '104.20.23.154', family: 4 },
    { address: '127.0.0.1', family: 4 }
  ]);

  const [err] = await lookup({ all: true });

  assert.match(
    (err as Error).message,
    /host.example resolves to a non-public address \(127.0.0.1\)/
  );

  mock.restoreAll();
  mockDns(new Error('ENOTFOUND'));
  assert.equal(((await lookup({}))[0] as Error).message, 'ENOTFOUND');
});

test('fetchPage: returns the body, asks with safeLookup, a timeout and a generic user agent', async () => {
  const get = mockHttps({ 'https://a.example/': { body: '<p>Hi</p>' } });

  assert.equal(await fetchPage('https://a.example/'), '<p>Hi</p>');

  const options = get.mock.calls[0]!.arguments[1] as unknown as {
    lookup: unknown;
    signal: AbortSignal;
    headers: Record<string, string>;
  };

  assert.equal(options.lookup, safeLookup);
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(options.headers['user-agent'], 'evidence-report-mcp');
});

test('fetchPage: follows https redirects, relative ones too', async () => {
  mockHttps({
    'https://a.example/': {
      status: 301,
      headers: { location: 'https://b.example/x' }
    },
    'https://b.example/x': { status: 302, headers: { location: '/y' } },
    'https://b.example/y': {
      body: 'done',
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    }
  });

  assert.equal(await fetchPage('https://a.example/'), 'done');
});

test('fetchPage: refuses http, private address literals, redirects to either, and more than 5 redirects', async () => {
  await assert.rejects(
    fetchPage('http://a.example/'),
    /Only https pages are fetched/
  );

  for (const url of [
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://169.254.169.254/latest'
  ])
    await assert.rejects(fetchPage(url), /is not a public address/);

  mockHttps({
    'https://a.example/': {
      status: 302,
      headers: { location: 'http://a.example/' }
    },
    'https://b.example/': {
      status: 302,
      headers: { location: 'https://10.0.0.1/' }
    },
    'https://loop.example/': {
      status: 302,
      headers: { location: 'https://loop.example/' }
    }
  });
  await assert.rejects(
    fetchPage('https://a.example/'),
    /Only https pages are fetched/
  );
  await assert.rejects(
    fetchPage('https://b.example/'),
    /10.0.0.1 is not a public address/
  );
  await assert.rejects(
    fetchPage('https://loop.example/'),
    /More than 5 redirects/
  );
});

test('fetchPage: an error status, a page that is not text, or one over 2 MB is refused', async () => {
  const mb = Buffer.alloc(1024 * 1024, 'a');

  mockHttps({
    'https://a.example/404': { status: 404 },
    'https://a.example/redirect-without-location': { status: 302 },
    'https://a.example/pdf': { headers: { 'content-type': 'application/pdf' } },
    'https://a.example/untyped': { headers: { 'content-type': undefined } },
    'https://a.example/empty-type': { headers: { 'content-type': '' } },
    'https://a.example/xhtml': {
      body: 'x',
      headers: { 'content-type': 'application/xhtml+xml' }
    },
    'https://a.example/2mb': { chunks: [mb, mb] },
    'https://a.example/big': { chunks: [mb, mb, Buffer.from('a')] },
    'https://a.example/down': new Error('ECONNRESET')
  });

  await assert.rejects(fetchPage('https://a.example/404'), /Responded 404/);
  await assert.rejects(
    fetchPage('https://a.example/redirect-without-location'),
    /Responded 302/
  );
  await assert.rejects(
    fetchPage('https://a.example/pdf'),
    /Not a text page \(application\/pdf\)/
  );
  for (const url of [
    'https://a.example/untyped',
    'https://a.example/empty-type'
  ])
    await assert.rejects(fetchPage(url), /Not a text page \(no content type\)/);
  assert.equal(await fetchPage('https://a.example/xhtml'), 'x');
  assert.equal(
    (await fetchPage('https://a.example/2mb')).length,
    2 * 1024 * 1024
  );
  await assert.rejects(fetchPage('https://a.example/big'), /Larger than 2 MB/);
  await assert.rejects(fetchPage('https://a.example/down'), /ECONNRESET/);
});

test('pageText: drops scripts, styles, noscript and comments, keeps the text between', () => {
  const html = [
    '<!doctype html><html><head><title>T</title>',
    '<style>p { color: red }</style><script type="x">var a = "<p>no</p>";</script></head>',
    '<body><!-- hidden --><p class="a">Bridge <b>opened</b></p><noscript>enable JS</noscript>',
    '<SCRIPT>also no</SCRIPT >in 1894</body></html>'
  ].join('');

  assert.equal(normalise(pageText(html)), 't bridge opened in 1894');
});

test('pageText: ends tags and comments where browsers do', () => {
  assert.equal(
    normalise(pageText('a<script>b</script foo="bar">c<Script>d</sCrIpT>e')),
    'a c e'
  );
  assert.equal(normalise(pageText('a<!-- b --!>c<!-- d -->e')), 'a c e');
});

test('pageText: an unclosed script or comment hides the rest of the page', () => {
  assert.equal(normalise(pageText('a<script>b c')), 'a');
  assert.equal(normalise(pageText('a<!-- b c')), 'a');
  assert.equal(normalise(pageText('a<style>b</style')), 'a');
});

test('pageText: decodes common entities, numeric and hex; leaves others alone', () => {
  assert.equal(
    pageText(
      'Tom &amp; Jerry&rsquo;s &#8220;café&#x201D; &copy; &#x110000; &bogus;'
    ),
    // &rsquo; becomes a straight quote; numeric entities keep the exact character
    "Tom & Jerry's “café” &copy; &#x110000; &bogus;"
  );
});

test('pageText: hostile input stays linear', () => {
  const t0 = Date.now();

  pageText('<'.repeat(2 * 1024 * 1024));
  pageText('<script'.repeat(300_000));
  pageText('&a'.repeat(1024 * 1024));
  assert.ok(Date.now() - t0 < 2000, `${Date.now() - t0} ms`);
});

test('normalise: quotes, hyphens, spaces, case and compatibility forms', () => {
  assert.equal(
    normalise('  The “ﬁrst”   bridge’s  span – 1894\n'),
    'the "first" bridge\'s span - 1894'
  );
});

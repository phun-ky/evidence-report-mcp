import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, mock, test } from 'node:test';

import { checkCorroboration } from '../checkers.js';
import { mockHttps } from '../test/https.js';

/* Quote matching on recorded and hand-made pages (#85); src/test/pages/README.md lists the sources. */

afterEach(() => mock.restoreAll());

const PAGE = 'https://recorded.example/';
const OTHER = 'https://other.example/';

interface Case {
  file: string;
  quote: string;
  /** found: the claim passes; not found: it fails, as it should. */
  expect: 'found' | 'not found';
  contentType?: string;
  /** A quote that is on the page but missed today, with the issue that fixes it. */
  todo?: string;
}

const cases: Record<string, Case> = {
  'Wikipedia: across links': {
    file: 'wikipedia-tower-bridge.html',
    quote: 'built between 1886 and 1894, designed by Horace Jones',
    expect: 'found'
  },
  'Wikipedia: straight quotes in the page': {
    file: 'wikipedia-tower-bridge.html',
    quote:
      'populations of "Manchester on the one side, and Liverpool on the other"',
    expect: 'found'
  },
  'Wikipedia: a non-breaking space in its own span': {
    file: 'wikipedia-tower-bridge.html',
    quote: '940 feet (290 m) in length',
    expect: 'found'
  },
  'Wikipedia: a footnote marker inside the quoted sentence': {
    file: 'wikipedia-tower-bridge.html',
    quote: 'cantilever bridge in London, built between 1886 and 1894',
    expect: 'found',
    todo: '#88: drop footnote markers, or decide that quotes keep them'
  },
  'GOV.UK: curly quotes in the page, straight in the quote': {
    file: 'govuk-gladstone.html',
    quote: 'described him as a "half-mad firebrand"',
    expect: 'found'
  },
  'GOV.UK: &quot; entities': {
    file: 'govuk-gladstone.html',
    quote: 'he was the "Grand Old Man"',
    expect: 'found'
  },
  'GOV.UK: a curly apostrophe and a link': {
    file: 'govuk-gladstone.html',
    quote:
      "Gladstone's talent for public speaking caught the attention of Robert Peel",
    expect: 'found'
  },
  'GOV.UK: a pound sign': {
    file: 'govuk-gladstone.html',
    quote: 'at least £10 or all those holding land valued at £10',
    expect: 'found'
  },
  'GOV.UK: a closing tag right before an apostrophe': {
    file: 'govuk-gladstone.html',
    quote: "the Earl of Derby's Conservative government",
    expect: 'found',
    todo: '#88: inline tags become a space'
  },
  'Hand-made: text built with JavaScript': {
    file: 'hand-made-js-shell.html',
    quote: 'opened to traffic on 30 June 1894',
    expect: 'not found'
  },
  'Hand-made: the teaser above a paywall': {
    file: 'hand-made-paywall.html',
    quote: 'the largest and most sophisticated bascule bridge ever completed',
    expect: 'found'
  },
  'Hand-made: the text behind a paywall': {
    file: 'hand-made-paywall.html',
    quote: 'the bascules were raised for the first time',
    expect: 'not found'
  },
  'Hand-made: &ndash;': {
    file: 'hand-made-typography.html',
    quote: 'built between 1886–1894',
    expect: 'found',
    todo: '#88: named entities'
  },
  'Hand-made: &mdash;': {
    file: 'hand-made-typography.html',
    quote: 'bascules—each weighing over 1,000 tonnes—still open',
    expect: 'found',
    todo: '#88: named entities'
  },
  'Hand-made: &shy;': {
    file: 'hand-made-typography.html',
    quote: 'open to visitors every day',
    expect: 'found',
    todo: '#88: soft hyphens'
  },
  'Hand-made: a literal soft hyphen': {
    file: 'hand-made-typography.html',
    quote: 'closed to the public in 1910',
    expect: 'found',
    todo: '#88: soft hyphens'
  },
  'Hand-made: a zero-width space': {
    file: 'hand-made-typography.html',
    quote: 'high-level walkways reopened in 1982',
    expect: 'found',
    todo: '#88: zero-width characters'
  },
  'Hand-made: a Windows-1252 page': {
    file: 'hand-made-windows-1252.html',
    contentType: 'text/html; charset=windows-1252',
    quote: '"the gateway to London" and the city\'s cafés agreed',
    expect: 'found',
    todo: '#88: read the charset'
  }
};

for (const [name, c] of Object.entries(cases)) {
  test(`recorded page: ${name} -> ${c.expect}`, { todo: c.todo }, async () => {
    mockHttps({
      [PAGE]: {
        headers: {
          'content-type': c.contentType ?? 'text/html; charset=utf-8'
        },
        chunks: [
          readFileSync(new URL(`../test/pages/${c.file}`, import.meta.url))
        ]
      },
      [OTHER]: { body: '<p>A second source that says the same.</p>' }
    });

    const r = await checkCorroboration({
      kind: 'claim',
      text: 'A claim about the page.',
      sources: [
        { url: PAGE, quote: c.quote },
        { url: OTHER, quote: 'a second source that says the same' }
      ]
    });

    assert.equal(r.status, c.expect === 'found' ? 'pass' : 'fail', r.reason);
    assert.deepEqual(r.findings[0], {
      severity: c.expect === 'found' ? 'info' : 'medium',
      message:
        c.expect === 'found'
          ? 'Quote found'
          : 'Quote not found in the page text. The page may also build its text with JavaScript, or be behind a paywall',
      ref: PAGE
    });
  });
}

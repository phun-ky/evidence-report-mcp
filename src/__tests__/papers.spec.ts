import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';

import {
  fromInvertedIndex,
  paperKey,
  paperOf,
  paperText,
  type Paper
} from '../papers.js';

afterEach(() => mock.restoreAll());

const EPMC = 'https://www.ebi.ac.uk/europepmc/webservices/rest';
const search = (query: string) =>
  `${EPMC}/search?${new URLSearchParams({ query, resultType: 'core', format: 'json', pageSize: '1' })}`;
const openalex = (doi: string) =>
  `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`;
const hits = (...result: Record<string, unknown>[]) =>
  Response.json({ hitCount: result.length, resultList: { result } });
const signal = () => AbortSignal.timeout(1000);
/** fetch answered by URL; anything else fails the test. */
const mockApis = (answers: Record<string, () => Response>) =>
  mock.method(globalThis, 'fetch', async (url: string) => {
    const answer = answers[url];

    if (!answer) throw new Error(`unexpected request to ${url}`);

    return answer();
  });
// Shaped like the live Europe PMC records of 2026-11-21
const wakefield = {
  id: '9500320',
  source: 'MED',
  doi: '10.1016/s0140-6736(97)11096-0',
  abstractText:
    '<h4>Background</h4>We investigated a consecutive series of children with chronic enterocolitis and regressive developmental disorder.',
  isOpenAccess: 'N',
  inEPMC: 'N'
};
const ioannidis = {
  id: '16060722',
  source: 'MED',
  doi: '10.1371/journal.pmed.0020124',
  pmcid: 'PMC1182327',
  abstractText:
    'There is increasing concern that most current published research findings are false.',
  isOpenAccess: 'Y',
  inEPMC: 'Y'
};

test('paperOf: doi.org, PubMed, PMC and Europe PMC links; nothing else', () => {
  const cases: [string, Paper | undefined][] = [
    ['https://doi.org/10.1038/Nature14539', { doi: '10.1038/nature14539' }],
    ['https://pubmed.ncbi.nlm.nih.gov/9500320/', { pmid: '9500320' }],
    ['https://www.ncbi.nlm.nih.gov/pubmed/9500320', { pmid: '9500320' }],
    [
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC1182327/',
      { pmcid: 'PMC1182327' }
    ],
    [
      'https://www.ncbi.nlm.nih.gov/pmc/articles/pmc1182327',
      { pmcid: 'PMC1182327' }
    ],
    ['https://europepmc.org/article/MED/9500320', { pmid: '9500320' }],
    ['https://europepmc.org/abstract/med/9500320/', { pmid: '9500320' }],
    ['https://europepmc.org/article/PMC/PMC1182327', { pmcid: 'PMC1182327' }],
    ['https://europepmc.org/articles/PMC1182327', { pmcid: 'PMC1182327' }],
    ['https://pubmed.ncbi.nlm.nih.gov/?term=autism', undefined],
    ['https://pubmed.ncbi.nlm.nih.gov/9500320/citations', undefined],
    ['https://europepmc.org/search?query=x', undefined],
    ['https://example.org/pubmed/9500320', undefined]
  ];

  for (const [url, paper] of cases) assert.deepEqual(paperOf(url), paper, url);
});

test('paperKey: one key per kind of id', () => {
  assert.equal(paperKey({ doi: '10.1234/a' }), 'doi:10.1234/a');
  assert.equal(paperKey({ pmid: '1' }), 'pmid:1');
  assert.equal(paperKey({ pmcid: 'PMC1' }), 'pmcid:PMC1');
});

test('fromInvertedIndex: words back in order; bad positions and shapes ignored', () => {
  assert.equal(
    fromInvertedIndex({
      The: [0, 4],
      dominant: [1],
      models: [2],
      are: [3, -1, 1.5, 100_000, '6'],
      best: [5],
      odd: 'not a list'
    }),
    'The dominant models are The best'
  );
  assert.equal(fromInvertedIndex(null), '');
  assert.equal(fromInvertedIndex('text'), '');
});

test('paperText: a paywalled paper -> its abstract from Europe PMC, keyed by DOI', async () => {
  const fetch = mockApis({
    [search('EXT_ID:9500320 AND SRC:MED')]: () => hits(wakefield)
  });

  assert.deepEqual(await paperText({ pmid: '9500320' }, signal()), {
    key: 'doi:10.1016/s0140-6736(97)11096-0',
    abstract:
      ' Background We investigated a consecutive series of children with chronic enterocolitis and regressive developmental disorder.',
    fullText: undefined,
    from: 'Europe PMC'
  });

  const init = fetch.mock.calls[0]!.arguments[1] as RequestInit & {
    headers: Record<string, string>;
  };

  assert.equal(init.headers['user-agent'], 'evidence-report-mcp');
  assert.ok(init.signal instanceof AbortSignal);
});

test('paperText: an open-access paper -> its abstract and its JATS full text', async () => {
  mockApis({
    [search('DOI:"10.1371/journal.pmed.0020124"')]: () => hits(ioannidis),
    [`${EPMC}/PMC1182327/fullTextXML`]: () =>
      new Response(
        '<?xml version="1.0"?><article><body><p>Corollary 1: The <italic>smaller</italic> the studies<xref ref-type="bibr">1</xref>.</p></body></article>',
        { headers: { 'content-type': 'application/xml' } }
      )
  });

  const t = await paperText({ doi: '10.1371/journal.pmed.0020124' }, signal());

  assert.equal(t?.key, 'doi:10.1371/journal.pmed.0020124');
  assert.match(t?.fullText ?? '', /Corollary 1: The smaller the studies1\./);
});

test('paperText: no DOI or abstract on an open record -> keyed by Europe PMC id; full text gone -> no text but the empty abstract', async () => {
  mockApis({
    [search('PMCID:PMC1182327')]: () =>
      hits({ ...ioannidis, doi: undefined, abstractText: undefined }),
    [`${EPMC}/PMC1182327/fullTextXML`]: () => new Response('', { status: 404 })
  });

  const t = await paperText({ pmcid: 'PMC1182327' }, signal());

  assert.equal(t?.key, 'MED:16060722');
  assert.equal(t?.abstract, '');
  assert.equal(t?.fullText, undefined);
});

test('paperText: Europe PMC has no text -> OpenAlex for a DOI; neither -> undefined', async () => {
  const arxiv = '10.48550/arxiv.1706.03762';

  mockApis({
    [search(`DOI:"${arxiv}"`)]: () => hits(),
    [openalex(arxiv)]: () =>
      Response.json({
        abstract_inverted_index: { The: [0], dominant: [1], models: [2] }
      }),
    [search('DOI:"10.1234/no-abstract"')]: () =>
      hits({ ...wakefield, abstractText: undefined }),
    [openalex('10.1234/no-abstract')]: () =>
      Response.json({ abstract_inverted_index: null }),
    [search('DOI:"10.1234/unknown"')]: () => hits(),
    [openalex('10.1234/unknown')]: () => new Response('', { status: 404 }),
    [search('EXT_ID:1 AND SRC:MED')]: () => hits()
  });

  assert.deepEqual(await paperText({ doi: arxiv }, signal()), {
    key: `doi:${arxiv}`,
    abstract: 'The dominant models',
    from: 'OpenAlex'
  });
  assert.equal(
    await paperText({ doi: '10.1234/no-abstract' }, signal()),
    undefined
  );
  assert.equal(
    await paperText({ doi: '10.1234/unknown' }, signal()),
    undefined
  );
  // Not a DOI: no OpenAlex lookup (an unexpected one would throw)
  assert.equal(await paperText({ pmid: '1' }, signal()), undefined);
});

test('paperText: a DOI with a quote mark skips the Europe PMC query', async () => {
  const fetch = mockApis({
    [openalex('10.1234/a"b')]: () => new Response('', { status: 404 })
  });

  assert.equal(await paperText({ doi: '10.1234/a"b' }, signal()), undefined);
  assert.equal(fetch.mock.callCount(), 1);
});

test('paperText: an API error throws (fail closed)', async () => {
  mockApis({
    [search('EXT_ID:2 AND SRC:MED')]: () => new Response('', { status: 503 })
  });

  await assert.rejects(
    paperText({ pmid: '2' }, signal()),
    /www\.ebi\.ac\.uk responded 503/
  );
});

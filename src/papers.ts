import { pageText } from './page.js';

/* Research papers as claim sources: their text from Europe PMC, or OpenAlex, not the publisher's page (decided on #84). */

const DOI_HOSTS = new Set(['doi.org', 'dx.doi.org', 'www.doi.org']);

/** The DOI in a doi.org link, lower-cased (DOIs ignore case), or undefined for any other URL (decided on #83). */
export function doiOf(url: string): string | undefined {
  const u = new URL(url);

  if (!DOI_HOSTS.has(u.hostname)) return undefined;

  let doi: string;

  try {
    doi = decodeURIComponent(u.pathname.slice(1));
  } catch {
    return undefined;
  }

  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi.toLowerCase() : undefined;
}

/** A paper that a link names: by DOI, PubMed id or PMC id. */
export type Paper = { doi: string } | { pmid: string } | { pmcid: string };

/** Links to PubMed, PMC and Europe PMC records; `www.` is ignored. */
const PAPER_LINKS: [string, RegExp, 'pmid' | 'pmcid'][] = [
  ['pubmed.ncbi.nlm.nih.gov', /^\/(\d{1,9})\/?$/, 'pmid'],
  ['ncbi.nlm.nih.gov', /^\/pubmed\/(\d{1,9})\/?$/, 'pmid'],
  ['pmc.ncbi.nlm.nih.gov', /^\/articles\/(pmc\d{1,9})\/?$/i, 'pmcid'],
  ['ncbi.nlm.nih.gov', /^\/pmc\/articles\/(pmc\d{1,9})\/?$/i, 'pmcid'],
  ['europepmc.org', /^\/(?:article|abstract)\/med\/(\d{1,9})\/?$/i, 'pmid'],
  [
    'europepmc.org',
    /^\/(?:article\/pmc\/|articles\/)(pmc\d{1,9})\/?$/i,
    'pmcid'
  ]
];

/** The paper a link names, or undefined for any other URL. */
export function paperOf(url: string): Paper | undefined {
  const doi = doiOf(url);

  if (doi) return { doi };

  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '');

  for (const [h, path, kind] of PAPER_LINKS) {
    const id = h === host ? path.exec(u.pathname)?.[1] : undefined;

    if (id && kind === 'pmid') return { pmid: id };

    if (id) return { pmcid: id.toUpperCase() };
  }

  return undefined;
}

/** A paper's identity as it was linked, before any lookup. */
export function paperKey(p: Paper): string {
  if ('doi' in p) return `doi:${p.doi}`;

  if ('pmid' in p) return `pmid:${p.pmid}`;

  return `pmcid:${p.pmcid}`;
}

/** A paper's text, read with pageText. */
export interface PaperText {
  /** The paper, the same however it was linked. */
  key: string;
  abstract: string;
  /** The open-access full text, when there is one. */
  fullText?: string;
  from: 'Europe PMC' | 'OpenAlex';
}

const EPMC = 'https://www.ebi.ac.uk/europepmc/webservices/rest';
// A generic client name, without contact details
const API = { headers: { 'user-agent': 'evidence-report-mcp' } };

/** A GET from a fixed API: undefined on 404, throws on any other error (fail closed). */
async function get(
  url: string,
  signal: AbortSignal
): Promise<Response | undefined> {
  const res = await fetch(url, { ...API, signal });

  if (res.status === 404) {
    await res.body?.cancel();

    return undefined;
  }

  if (!res.ok)
    throw new Error(`${new URL(url).hostname} responded ${res.status}`);

  return res;
}

interface EpmcRecord {
  id?: string;
  source?: string;
  doi?: string;
  pmcid?: string;
  abstractText?: string;
  isOpenAccess?: string;
  inEPMC?: string;
}

function epmcQuery(p: Paper): string {
  if ('doi' in p) return `DOI:"${p.doi}"`;

  if ('pmid' in p) return `EXT_ID:${p.pmid} AND SRC:MED`;

  return `PMCID:${p.pmcid}`;
}

/** OpenAlex sends an abstract as word -> positions; this puts the words back in order. */
export function fromInvertedIndex(index: unknown): string {
  const words: string[] = [];

  if (typeof index !== 'object' || index === null) return '';

  for (const [word, at] of Object.entries(index)) {
    if (!Array.isArray(at)) continue;

    for (const i of at as unknown[])
      // Bounded, so a hostile index can't make a huge array
      if (Number.isInteger(i) && (i as number) >= 0 && (i as number) < 100_000)
        words[i as number] = word;
  }

  return words.filter(Boolean).join(' ');
}

/**
 * A paper's abstract, and its full text when it is open access: from Europe
 * PMC, or OpenAlex for a DOI that Europe PMC has no text for. Undefined when
 * neither has text, so the caller can fetch the page instead.
 */
export async function paperText(
  p: Paper,
  signal: AbortSignal
): Promise<PaperText | undefined> {
  // A quote mark would end the DOI in the search query
  const res =
    'doi' in p && p.doi.includes('"')
      ? undefined
      : await get(
          `${EPMC}/search?${new URLSearchParams({
            query: epmcQuery(p),
            resultType: 'core',
            format: 'json',
            pageSize: '1'
          })}`,
          signal
        );
  const r = (
    (await res?.json()) as
      { resultList?: { result?: EpmcRecord[] } } | undefined
  )?.resultList?.result?.[0];
  const open = r?.isOpenAccess === 'Y' && r.inEPMC === 'Y' && r.pmcid;

  if (r && (r.abstractText || open)) {
    // shortcut: the full text is read whole, as from OSV.dev and Crossref; cap it if very large papers become a problem
    const xml = open
      ? await (await get(`${EPMC}/${open}/fullTextXML`, signal))?.text()
      : undefined;

    return {
      key: r.doi ? `doi:${r.doi.toLowerCase()}` : `${r.source}:${r.id}`,
      abstract: pageText(r.abstractText ?? ''),
      fullText: xml === undefined ? undefined : pageText(xml),
      from: 'Europe PMC'
    };
  }

  if (!('doi' in p)) return undefined;

  const work = await get(
    `https://api.openalex.org/works/doi:${encodeURIComponent(p.doi)}`,
    signal
  );
  const abstract = fromInvertedIndex(
    ((await work?.json()) as { abstract_inverted_index?: unknown } | undefined)
      ?.abstract_inverted_index
  );

  return abstract
    ? { key: `doi:${p.doi}`, abstract: pageText(abstract), from: 'OpenAlex' }
    : undefined;
}

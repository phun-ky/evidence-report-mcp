// Content of the release banners for 0.8. Copy this file for the next release
// (e.g. 1.0.mjs, with slug v1) and run: npm run banners -- 1.0
export default {
  slug: 'v0',
  pill: 'Release 0.8 · November 2026',
  // The first line sits above the waterline, the accent line across it
  title: ['Check the paper', { accent: 'not the paywall' }],
  body: "0.8 looks for a claim's quotes in each paper's abstract and open-access full text on Europe PMC or OpenAlex, not on the publisher's page, and fails a claim that cites a retracted paper.",
  // The panel: a claim's sources, where each was read and what was found,
  // as in the report; a chip is a verdict colour from tokens.css
  report: {
    label: 'verify · claim',
    verdict: 'fail',
    rows: [
      {
        source: 'doi.org paper',
        read: 'Europe PMC · full text',
        chip: 'found',
        status: 'pass'
      },
      {
        source: 'PubMed paper',
        read: 'Europe PMC · abstract',
        chip: 'found',
        status: 'pass'
      },
      {
        source: 'arXiv DOI',
        read: 'OpenAlex · abstract',
        chip: 'found',
        status: 'pass'
      },
      {
        source: 'doi.org paper',
        read: 'Crossref · Retraction Watch',
        chip: 'retracted',
        status: 'fail'
      }
    ]
  }
};

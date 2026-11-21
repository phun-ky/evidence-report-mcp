# Claims

```json
{
  "kind": "claim",
  "text": "The bridge opened in 1894.",
  "sources": [
    {
      "url": "https://example.org/history",
      "quote": "the bridge opened to traffic in 1894"
    },
    {
      "url": "https://archive.example.com/1894",
      "quote": "opened in June 1894"
    }
  ]
}
```

`sources` are what the agent is relying on: each is a URL, or a URL and the
sentence on that page the agent relies on (`quote`, at most 1000 characters).
They are never checked against the agent's own output.

## The check: `claim.corroboration`

A heuristic check. It does not ask a language model whether the claim sounds
plausible: that would be the generator grading its own work. It checks that each
source says what the agent quotes from it.

- Sources from fewer than two distinct domains (`www.` is ignored):
  <span class="verdict fail">fail</span>, with a `medium` finding such as
  `Only 1 distinct source domain(s)`. Nothing is fetched.
- No source has a quote: `skipped`. A plain URL is not fetched.
- Each quoted page is fetched, and its text (without scripts, styles and markup)
  is searched for the quote. The text is read roughly as a browser shows it: an
  inline tag such as a link or `<b>` joins the text either side, other tags
  separate it, and a footnote marker in square brackets in a `<sup>`, such as
  `[1]`, is dropped. Case, runs of spaces, curly and straight quotes and hyphens
  and dashes are treated alike, and soft hyphens and zero-width characters are
  ignored.
- A quote not in its page's text: <span class="verdict fail">fail</span>, with a
  `medium` finding whose `ref` is the URL. A page that builds its text with
  JavaScript, or sits behind a paywall, also fails, and the finding says so: an
  agent should not rely on a source it can't show says what it quotes.
- A page that can't be fetched: `skipped`, with an `info` finding that says why.
- Quotes found on fewer than two distinct domains: `skipped`.
- Every quote found, on at least two distinct domains: `pass`, with an `info`
  finding for each page.

Even then the claim's verdict is <span class="verdict unknown">unknown</span>: a
heuristic can fail a target, but never pass one on its own. A quote on a page
shows that the page says it, not that it is true.

## The check: `claim.retractions`

A deterministic check of the papers a claim relies on. It runs only on sources
given as a `doi.org` link, such as `https://doi.org/10.1038/nature14539`
(`dx.doi.org` and `www.doi.org` too); DOIs in other URLs are not read.

- No `doi.org` source: `skipped`. Nothing is fetched.
- Each DOI is looked up in [Crossref](https://www.crossref.org), whose records
  include the [Retraction Watch](https://retractionwatch.com) data, so a
  retraction counts even when the publisher never registered it.
- A retraction, partial retraction, withdrawal or removal: a `high` finding. An
  expression of concern: a `medium` finding. Either makes the check
  <span class="verdict fail">fail</span>. Each finding names the notice, its
  date and, when it comes from Retraction Watch, says so; its `ref` is the DOI.
- A correction, erratum or other update: an `info` finding.
- A DOI that Crossref doesn't know is looked up on `doi.org`. One that doesn't
  exist: a `medium` finding, and <span class="verdict fail">fail</span>: an
  agent can cite a paper that was never written. One registered with another
  agency, such as DataCite for arXiv: an `info` finding, and `skipped`.
- Every paper in Crossref with no retraction, withdrawal or expression of
  concern: `pass`, with an `info` finding for each.
- Crossref or `doi.org` not answering, or answering with an error: `error`.

The check is not required, so it never makes a claim pass: the verdict is
<span class="verdict unknown">unknown</span> at best, as above. Its
<span class="verdict fail">fail</span> makes the claim's verdict
<span class="verdict fail">fail</span>.

## What it fetches

Only `https` pages on public addresses: the host is resolved when the connection
is made, and a host with any private, loopback, link-local or otherwise
non-public address is refused, so a source can't reach the machine or network
the server runs in. Redirects are followed only to `https` and public addresses,
at most 5. Each page may take 10 seconds and 2 MB, and must be text or HTML. It
is decoded with the charset in its `content-type` header, or else in a `<meta>`
in its first 1,024 bytes, or else as UTF-8. No cookies are sent, and the user
agent is `evidence-report-mcp`.

For `claim.retractions`, each DOI is sent to
`https://api.crossref.org/works/{doi}` and, only when Crossref doesn't know it,
to `https://doi.org/ra/{doi}`. The lookups run one at a time, as Crossref's
public API asks, within 30 seconds in all. The user agent is
`evidence-report-mcp`, with no contact details.

## Not checked

- Interpretation: what the claim means to its audience
- Whether the cited sources are themselves reliable, beyond retractions recorded
  in Crossref
- Retractions of papers not given as a doi.org link, or registered outside
  Crossref
- Whether a quote that was found supports the claim as worded
- Sources given without a quote, and text a page builds with JavaScript

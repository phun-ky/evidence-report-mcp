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
  is searched for the quote. Case, runs of spaces, curly and straight quotes and
  hyphens and dashes are treated alike.
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

## What it fetches

Only `https` pages on public addresses: the host is resolved when the connection
is made, and a host with any private, loopback, link-local or otherwise
non-public address is refused, so a source can't reach the machine or network
the server runs in. Redirects are followed only to `https` and public addresses,
at most 5. Each page may take 10 seconds and 2 MB, must be text or HTML, and is
read as UTF-8. No cookies are sent, and the user agent is `evidence-report-mcp`.

## Not checked

- Interpretation: what the claim means to its audience
- Whether the cited sources are themselves reliable
- Whether a quote that was found supports the claim as worded
- Sources given without a quote, and text a page builds with JavaScript

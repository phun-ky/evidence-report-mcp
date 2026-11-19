# Claims

```json
{
  "kind": "claim",
  "text": "The bridge opened in 1894.",
  "sources": ["https://example.org/history", "https://archive.example.com/1894"]
}
```

`sources` are the URLs the agent is relying on. They are never checked against
the agent's own output.

## The check: `claim.corroboration`

A heuristic check. It does not ask a language model whether the claim sounds
plausible: that would be the generator grading its own work.

Today it counts the distinct domains among the sources (`www.` is ignored), and
fetches nothing:

- Fewer than two: <span class="verdict fail">fail</span>, with a `medium`
  finding such as `Only 1 distinct source domain(s)`.
- Two or more: `skipped`, because the sources are not fetched or matched against
  the claim yet, so the verdict is <span class="verdict unknown">unknown</span>.

A claim can fail, but is never verified as `pass`: a heuristic can't pass a
target on its own.

## Not checked

- Interpretation: what the claim means to its audience
- Whether the cited sources are themselves reliable

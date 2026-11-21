# Recorded pages

Pages for the quote matching tests in `src/__tests__/recorded-pages.spec.ts`
(decided on [#85](https://github.com/phun-ky/evidence-report-mcp/issues/85)).
They are recorded by hand, once, and kept byte for byte: Prettier skips them
(`.prettierignore`). They are not in the npm package.

Unlike the rest of the repository, which is MIT, the recorded pages keep their
own licences:

| File                          | Source                                                                                                                                                                                          | Licence                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `wikipedia-tower-bridge.html` | [Tower Bridge](https://en.wikipedia.org/wiki/Tower_Bridge), Wikipedia contributors, recorded 2026-11-21. The first three paragraphs of the lead, with an html shell added.                      | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)                                                             |
| `govuk-gladstone.html`        | [William Ewart Gladstone](https://www.gov.uk/government/history/past-prime-ministers/william-ewart-gladstone), GOV.UK, recorded 2026-11-21. Part of the main element, with an html shell added. | Crown copyright, [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) |
| `hand-made-*.html`            | Written for these tests, modelled on real markup.                                                                                                                                               | MIT, like the repository                                                                                                    |

## Adding a page

- Record only from sites whose licence allows it, and add a row above.
- Trim the page to what the test needs, and copy that part byte for byte. Say at
  the top of the file what was trimmed or added.
- Write markup that open pages don't have by hand, and name the file
  `hand-made-*.html`.
- A quote that is on the page but missed today is a `todo` test that names the
  issue that fixes it.

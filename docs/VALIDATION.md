# Validation of the free multi-source update

Checked October 24, 2026, in the cloud workspace with Node 24.19.0. All changes are on `paperbridge-first-version`; no merge into main, deployment, purchase, or paid model call was performed.

## Automated checks

- `npm test`: **144 tests passed in 11 files**.
- Clean lockfile install with `npm ci --cache /workspace/.npm-cache --no-audit --no-fund`: passed.
- `npm run typecheck`: passed for browser, backend and shared modules.
- `npm run build`: passed.
- Tests use clearly marked synthetic records and mocked provider responses. No synthetic paper is used as an application fallback.
- Built-server smoke check passed: production HTML, compiled free-comparison UI, no model-key variable names in the browser asset, and disabled-model health. The temporary smoke-test server was stopped.
- Original model tests still mock the official SDK. Actual OpenAI requests and model quality remain untested because API spending is not approved.

Three helper agents worked in separate file areas: multi-source/comparison tests, full-text extraction/security tests, and documentation. The primary agent reviewed their changes and reran the complete suite.

## Live source checks

These used real provider responses through PaperBridge's backend, with no AI key:

| Operation                              | Observed result                                                                                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Combined query `graph neural networks` | HTTP 200; all three provider statuses successful                                                                                                                     |
| OpenAlex open-access search            | 16 records with reported free-copy links                                                                                                                             |
| Europe PMC OA search                   | 12 records with reported free-copy links                                                                                                                             |
| arXiv search                           | 12 records with reported free-copy links                                                                                                                             |
| Combined output for that query         | 40 records after grouping; counts describe this request, not the entire literature                                                                                   |
| PMC full-text import                   | HTTP 200 for _Enhancing structural to functional brain network prediction using topological graph learning_, PMC13655150; readable article-body paragraphs extracted |
| arXiv HTML import                      | HTTP 200 for _Transformers are Graph Neural Networks_, arXiv:2506.22084v1; readable article-body paragraphs extracted                                                |

Only supported article-body prose was imported. Figures, tables, references and supplements were omitted; formulas and formatting may be flattened. These checks do not establish scientific correctness, completeness of the publication, or unrestricted reuse rights.

Official arXiv API documentation/TOS were read from its source repository. The legacy API is serialized to one connection, with at least 3.1 seconds after a request completes before the next starts. A bounded ten-minute cache and same-query pending-request sharing reduce duplicate requests. Official OpenAlex source documentation was consulted for open-access fields. Europe PMC's actual core search and fullTextXML endpoints were exercised. Direct documentation website access was unavailable during initial probing; successful application requests were checked separately.

## Browser validation

The Browser plugin was unavailable, so QA used Playwright with installed headless Chromium. Internal test address: port 5173 on the cloud machine. This is not a public preview link.

| Check                                                                 | Result                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------- |
| Correct title, meaningful PaperBridge workspace, no Vite overlay      | Passed                                                          |
| Real combined search from browser through all three adapters          | Passed                                                          |
| Collection statuses and provenance displayed                          | Passed                                                          |
| Select two papers from different sources without a question or AI key | Passed                                                          |
| Free side-by-side comparison enabled                                  | Passed                                                          |
| Available abstracts displayed directly from stored source text        | Passed                                                          |
| Actual PMC and arXiv full-text retrieval through browser controls     | Passed                                                          |
| Retrieved body passages visible in comparison                         | Passed                                                          |
| Phrase filtering shows only matching source passages                  | Passed                                                          |
| No-match phrase state                                                 | Passed                                                          |
| Methods-section filter and honest missing-section state               | Passed                                                          |
| Desktop 1500×1050 layout inspected                                    | Passed                                                          |
| No page-wide horizontal overflow at 390px and 320px                   | Passed; the comparison has its own deliberate horizontal scroll |
| One source failure preserves successful results                       | Passed with explicitly marked temporary test response           |
| Empty free-search state                                               | Passed with explicitly marked temporary test response           |
| Unexpected page/runtime/console errors                                | None                                                            |

Screenshots of the actual comparison at desktop and mobile widths were inspected. The full license notice was moved into an expandable source-license disclosure so it does not push one paper's evidence far below the other. Form/select labels were made explicit. No claim is made that a screenshot establishes scientific interpretation or source completeness.

## Important regression and boundary coverage

- Missing abstracts, malformed JSON, empty result sets, safe source links, rate limits, network failures and bounded response bodies.
- Truncated/malformed Atom and PMC XML are rejected rather than called complete.
- DOI/PMC/arXiv duplicate grouping retains provenance and the earliest canonical paper ID, even when a late record bridges earlier groups. Versions may differ; grouping does not assert identical text. Similar titles alone are not treated as duplicates.
- Stable, unique passage IDs; wrong paper/passage references rejected; source quotations resolve from stored text.
- Full-text retrieval uses cached validated identifiers, not browser-supplied URLs. Redirects are bounded, HTTPS-only and restricted to the selected trusted article/version. No arbitrary repository crawling, paywall bypass or PDF extraction.
- Full-text failures preserve the abstract. Excerpts are labelled when the reading limit truncates a paragraph or document.
- PMC source front matter can supply missing abstract/year; unknown metadata is not invented.
- Concurrent imports share pending retrieval, and later searches do not discard already-retrieved body text.
- Non-OpenAlex source IDs are accepted only after server retrieval; fabricated IDs are rejected.
- Resource edits invalidate prior assessments. Saved examples remain explicitly separate from live results. Model spending gates and secret boundaries remain enforced.
- Codespaces tests cover exact trusted website hostname, accidental backend-port recovery, and rejection of unrelated origins. No wildcard host allowance is introduced.

## Remaining limits / checks not performed

- No live OpenAI request or evaluation of model-generated scientific quality.
- No Firefox, Safari, physical-device or assistive-technology testing; this is not a full accessibility audit.
- No full-paper binary/PDF parsing. Free PDFs and unsupported repository formats can be opened at their sources but are not imported into the comparison.
- Not every free paper, repository or version is indexed by these services. A query with no match does not establish novelty.
- Source access and licensing metadata can be incomplete or stale. Free-to-read does not imply a reuse license.
- No public deployment or testing as a multi-user service with production accounts/abuse protection.
- No new-cloud-instance restoration or publication verification. Saved startup/configuration is distinct from a published, restored environment.

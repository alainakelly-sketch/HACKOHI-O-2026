# Validation of the one-field research-gap workflow

Checked October 24, 2026, in the cloud workspace using Node 24.19.0. Code is on `paperbridge-first-version`. No merge into main, deployment, purchase, or paid model request was performed.

## Automated checks

- `npm test`: **198 tests passed in 13 files**.
- `npm run typecheck`, `npm run build`, and `npm run format:check`: passed.
- Original source parsing, full-text safety, deduplication, resource invalidation and credential-boundary tests remain passing.
- New checks cover a single `field` request/prompt/schema, within-field prior-work queries, free discovery keyword suggestions, body-only reader defaults, a single-paper reader, local gap signals, negated/resolved phrases, source coverage, exact passage references, relevance ordering and background issues that may already be addressed by the same paper.
- Optional model references must be in the actual bounded excerpt submitted to the provider, not merely somewhere in the full stored source. SDK responses are mocked; no paid call was used.
- Synthetic paper data is confined to explicitly labelled automated tests. No synthetic papers or canned live responses are used in the application.

Helper agents owned separate areas: the single-field backend/schema, gap-lead logic, reader behavior, and documentation. The primary agent integrated and reviewed their results, reran the whole suite and checked the browser workflow.

## Actual browser workflow

The Browser plugin was unavailable. QA used installed Chromium through Playwright, at desktop 1500×1050 and mobile widths 390px/320px. Local test requests are internal checks, not externally accessible preview links.

| Check                                                                            | Result                                                                                             |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| One field of interest; no Field A/Field B form                                   | Passed                                                                                             |
| Correct PaperBridge title, useful rendered content, no Vite overlay              | Passed                                                                                             |
| Field/question create suggested terms when Find papers for this focus is clicked | Passed; input remains editable                                                                     |
| Supported in-app body-text filter defaults on                                    | Passed                                                                                             |
| Real combined search of OpenAlex, Europe PMC and arXiv                           | Passed; all three statuses successful                                                              |
| Selecting a supported PMC and an arXiv paper automatically retrieves body text   | Passed with real provider responses                                                                |
| Cached body text appears immediately when reselected                             | Passed                                                                                             |
| Reader opens automatically; Article body is the default                          | Passed                                                                                             |
| Body view never silently substitutes abstract text                               | Passed                                                                                             |
| User can explicitly choose Abstracts only                                        | Passed                                                                                             |
| Free gap scan over actual retrieved source text                                  | Passed; two author-stated leads found in the selected test sources, not claimed as field-wide gaps |
| Gap quotation and passage ID resolve exactly to stored source text               | Passed                                                                                             |
| Introductory limitation flagged as background that the same paper may address    | Passed                                                                                             |
| Unsupported repository gets explicit unavailable-body state                      | Passed; no abstract shown as body                                                                  |
| Page-wide horizontal overflow at 390px/320px                                     | None; source comparison intentionally scrolls within its own panel                                 |
| Unexpected runtime or console errors                                             | None                                                                                               |

The focus-to-query wiring test used an explicitly marked empty response to inspect the request without inventing paper records. Separate real multi-source queries and automatic imports exercised the actual services. Both initial retrieval and reuse of already-imported text were checked.

Actual combined query used for source testing: `graph neural networks`. The observed response contained 16 OpenAlex, 12 Europe PMC and 12 arXiv free-linked records. These are this request's records, not counts of all papers. The live body imports included _Enhancing structural to functional brain network prediction using topological graph learning_ (PMC13655150) and _Transformers are Graph Neural Networks_ (arXiv:2506.22084v1).

A live introductory statement described a limitation of older prediction methods. Since the same paper may address it, the scanner now labels introductory/background leads accordingly, ranks them after nonbackground leads, and requires checking that paper's own findings first. This does not replace scientific reading.

Desktop/mobile screenshots were inspected for readable body text, source labels, missing-text states, gap quotations and follow-up actions. Full license notices remain expandable rather than pushing one paper's text far below another.

## Retained source and access boundaries

- Real metadata/links come from retrieved records. Source text remains untrusted data, never application/model instructions.
- Stable passage IDs preserve provenance. Wrong paper/passage IDs and unsubmitted model references are rejected.
- A source-reported free-copy link is different from article text retrieved into the reader. Unsupported free PDFs/repositories remain external links.
- PMC XML and arXiv HTML imports use validated stored identifiers, fixed trusted endpoints, bounded HTTPS redirects, identity/version checks and bounded response/text sizes. No arbitrary metadata URL is fetched and no paywall is bypassed.
- XML/Atom truncation and malformed responses are rejected. Body extraction omits figures, tables, references and supplements; mathematical formatting may be flattened. A shortened body is labelled as an excerpt.
- Search failures remain explicit; partial source failures retain successful results. Empty searches do not establish novelty.
- arXiv API requests are serialized and spaced; repeated-query caching and shared pending requests avoid redundant calls.
- Previously retrieved body text survives later searches. A changed evidence snapshot clears old optional AI analysis.
- Optional model calls remain disabled without both spending enablement and credentials. Browser source has no credential binding or backend-module import.
- Codespaces uses the exact trusted forwarded hostname; development backend-port mistakes show recovery guidance or redirect to the known website port.

## What has not been established

- **A confirmed research gap, novelty or scientific correctness.** The free scan uses explicit text signals. It can miss implicit issues or misread context, and later studies may already resolve a lead. A study limitation is not automatically a field-wide gap.
- **Full scientific synthesis by the free scan.** Field/question terms affect discovery and ordering; no claim is made of semantic understanding or an exhaustive review.
- **Live model quality/provider success.** Model calls were mocked; no paid requests were made.
- **Complete publication extraction.** No PDF parser, figure/table/supplement import, or universal repository crawler is implemented.
- **All free literature.** These services have coverage, query and access limits; free-access/license metadata may be incomplete or stale.
- **Firefox/Safari, physical phones, or assistive technology.** Those checks were not performed; this is not a full accessibility audit.
- **Public hosting or new-instance restoration.** No public deployment, production multi-user validation, new cloud restore, or publication verification was performed.

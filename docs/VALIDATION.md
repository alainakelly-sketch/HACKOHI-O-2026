# Validation of actual-text filters, gap controls, and comparison overview

Checked October 24, 2026, in the cloud workspace using Node 24.19.0. Changes stay on `paperbridge-first-version`; no merge into main, deployment, purchase, or paid model request was performed.

## Checks completed

- `npm test`: **238 tests passed in 16 files**.
- `npm run typecheck`, `npm run build`, `npm run format:check`, and Git whitespace checks passed.
- Three helper areas were independently implemented and then reviewed/integrated: actual-text filtering, gap controls, and the cited comparison overview. Documentation was updated separately. The primary agent reran the complete suite and browser workflow.
- New automated checks cover real-body-vs-metadata distinctions, labelled excerpt opt-in, sources/year/preprint filters, body-only gap scan inputs, always-enabled gap guidance, body-only comparison summaries, source references and exact snippets, and explicit missing sections.
- Synthetic papers and responses remain confined to clearly labelled automated tests. No synthetic paper or canned result is substituted for a live request.

## Live browser validation

The Browser plugin was unavailable. Playwright used installed Chromium at desktop 1500×1050 and widths 390px/320px. These are internal cloud checks, not a user-facing public preview.

| User action / condition                               | Observed outcome                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Click Find gap leads with no field or selected papers | Button enabled; actionable selection guide and Go to papers shown                                    |
| Search `graph neural networks`                        | Real combined search succeeded with OpenAlex, Europe PMC and arXiv                                   |
| Default Text availability                             | Retrieved article body only; all visible admitted records had imported body text and a body preview  |
| Text checks running                                   | Progress shown; ready records can be used before other checks finish                                 |
| Click Read article body                               | Source selected and body reader opened                                                               |
| Select two ready sources                              | In common, Distinct emphases, and aims/methods/findings/limitations matrix shown                     |
| Inspect a comparison citation                         | Right inspector showed the exact stored passage matching its source ID                               |
| Scan selected body text without a field               | Free gap leads shown; no field or model key required                                                 |
| Inspect a free gap lead                               | Same evidence inspector showed its actual supporting passage                                         |
| Default gap evidence scope                            | Retrieved body only; no automatic abstract scan                                                      |
| Year range excludes all results                       | Zero matches with explicit filter guidance                                                           |
| All collections unchecked                             | Zero matches with explicit choose-a-collection guidance                                              |
| Narrow viewports                                      | No page-wide horizontal overflow at 390px/320px; comparison tables scroll within their own container |
| Application runtime errors                            | None                                                                                                 |

Live requests used actual records and article prose, including PMC and arXiv sources. Source checks returned 16 OpenAlex, 12 Europe PMC and 12 arXiv free-linked records for the test query; these are per-request counts, not literature totals. Article-body data may be reused from the server's bounded cache, which was also checked. Body retrieval for both PMC XML and arXiv HTML was verified in preceding checks and remains covered by the retained parsing/network tests.

Screenshots of the actual filters, quoted comparison and mobile layout were inspected. The comparison is text-based: shared topics come from terms in the bodies, distinct emphases are terms not seen in the other retrieved texts, and the matrix contains exact source excerpts. None of those operations establishes scientific agreement, disagreement, equivalence, or novelty.

## Defects addressed

- A supported identifier/free link no longer qualifies for the default actual-text filter. It requires a source metadata object, actual nonempty body passages, full retrieved coverage, and no truncation. Partial excerpts require explicit opt-in.
- Searches check up to twelve supported candidates per batch with two workers; failures remain inspectable and retryable. Source/year/version filters are separate from text availability. Selected sources are retained independently, with an explicit note.
- The gap button no longer silently blocks on an empty field or no selection. No-selection clicks give instructions instead of pretending a scan ran.
- Gap analysis excludes abstracts by default, supports explicit abstract opt-in, and explains missing/waiting body text with retrieval actions.
- Free gap and comparison citations now share the evidence inspector. Old free inspections are cleared when a different optional AI hypothesis is chosen.
- Raw side-by-side text now has an explicit similarities/differences overview and a quoted source-statement matrix.
- Generic “we examine/investigate” methods text no longer qualifies as a study aim. Fallback snippets show the matching sentence and preserve the full original passage reference, rather than displaying an unrelated paragraph prefix.

## Retained boundaries

- Paper metadata and links come from retrieved records. Source text remains untrusted data.
- The one-field question/focus still suggests editable search terms and orders local gap leads. It is not a semantic interpretation of every scientific issue.
- Stable citation IDs, malformed/truncated response rejection, deduplication/provenance, bounded same-article HTTPS redirects, fixed trusted full-text endpoints, and resource-assessment invalidation remain tested.
- Introductory/background issues are flagged as possibly already addressed by the same paper. Later work still needs review; no novelty score or confirmed-gap claim is produced.
- A free-copy link is not proof of imported text, unrestricted reuse, complete publisher content, or peer review. Excluding identified preprints does not certify peer review.
- The body reader omits figures, tables, references and supplements; formulas/formatting may be flattened. Excerpts are labelled. PDF parsing and arbitrary repository crawling are not implemented.
- Optional model calls remain disabled without explicit spending enablement and credentials. Model tests use mocked SDK responses; actual paid provider calls remain untested.

## Not performed / remaining limitations

No Firefox, Safari, physical-device, or assistive-technology checks were performed. The overview and gap scan are conservative text rules, not a full scientific synthesis or exhaustive review; they can miss implicit results, unfamiliar headings, other languages, or context. Missing text is kept unknown. No universal free-paper coverage, confirmed scientific gap, public deployment, production multi-user validation, or newly restored cloud instance is claimed.

## Workflow tabs, AI diagnosis and editable planning

- Existing feature branch inspected at `fdcc726` with a clean working tree before edits.
- Workflow steps now use keyboard-operable tabs; mounted hidden panels retain local reader/filter/scan state. Switching tabs makes no search or model request.
- AI input checklist mirrors server constraints, counts usable submitted source text, and separates unreachable backend, spending disabled, missing credentials and safe provider errors. Readiness recheck is a bounded health request.
- Hypothesis plans reuse the generated proposal; manual and gap-lead drafts leave unknown methods blank. Draft edits/export, evidence inspection, source/resource review flags and distinct analysis draft identities are covered.
- Unit/API suites: 255 tests passed across 18 files. TypeScript and production build passed.
- `tests/workflow.browser.ts` exercises Chromium at desktop 1440×1000 and mobile 390×844, using explicitly synthetic mock papers and AI responses. It verifies all tabs, state retention, three-paper checklist, readiness recheck, unreachable backend, provider timeout/retry, insufficient evidence, successful request wiring, hypothesis-to-plan, edited JSON export, evidence inspection, no draft collision across analyses, free gap-to-plan and review warnings after changing papers/resources. No page errors or horizontal overflow were found.
- Browser plugin not available; Playwright with installed `/usr/bin/chromium` used. Screenshots inspected outside the repository. Firefox, Safari, physical devices and assistive technology were not tested.
- Actual local health endpoint reported `spending-disabled`. No paid provider calls were made; live AI generation/authentication/quota remain unverified. Existing legal source retrieval behavior is unchanged by this update.

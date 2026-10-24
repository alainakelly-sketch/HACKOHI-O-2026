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

## Resource search filtering and simpler comparison

- Added source-grounded local resource screening: blank notes leave records/order unchanged; positive available terms enable supported matches, limits/deadline alone preserve unknowns and exclude explicit conflicts. Users can override mode, inspect hidden records, and read exact supporting source sentences. Selection is retained after filtering.
- Source matching requires explicit method use; background, negated use, comparative resource mentions, unknown equipment/skill capacity and unstated requirements are not treated as established requirements. Deadline checks only screen explicit procedure durations longer than a stated hours/days/weeks limit. A supported match is one matched resource term, not complete feasibility.
- Comparison now shows two selected papers with clear common-topic and difference sections, aspect buttons, exact excerpt cards, source inspection and optional longer reading. No scientific summaries or agreement claims are invented.
- 274 tests passed in 19 files. TypeScript, production build, formatting and Git whitespace checks passed.
- Both browser suites passed: `tests/workflow.browser.ts` and `tests/resource-comparison.browser.ts`. The latter covers positive matches, clear GPU conflicts, blank reset without a new search, deadline conflict, overrides, evidence, retained selection, pair changes/aspects, optional source reader and 390px layout. Both suites use explicitly synthetic mocked retrieval/AI responses; no paid model call is made.
- Screenshots inspected at desktop 1440×1000 and mobile 390×844 using Playwright with installed Chromium (Browser plugin unavailable). No page errors or horizontal page overflow. Firefox/Safari, assistive technology and resource feasibility judgments were not verified. Existing live search integration is unchanged.

## Per-run OpenAI cost visibility

- Live analysis records provider-returned input/cached/output token counts and a reference-rate USD estimate. GPT-4.1 mini/snapshot only; other models or incomplete/malformed usage stay unknown. No-request results explicitly report zero.
- Evidence-validation rejection retains response usage in safe error metadata. Failed/interrupted frontend requests without usage remain unknown, including alongside the known-cost subtotal. Ledger survives ordinary tab/focus/source changes but resets on reload and is included in workspace export.
- 296 unit/API/UI tests passed in 22 files; TypeScript and production build passed. Formatting was corrected and rechecked. The browser regression with synthetic SDK/HTTP responses verifies per-run estimates, known subtotal plus unknown run, source-linked plans and desktop/mobile layouts. Cost screenshots were inspected; no paid model requests or actual billing verification were performed.
- Official pricing pages were blocked by the environment proxy. Reference rates ($0.40 input/$0.10 cached/$1.60 output per million tokens) are explicitly marked not live-verified; pricingCheckedAt remains null. OpenAI Usage is linked for actual charges, other apps and account adjustments.

## Evidence-led discovery workflow

- Added guided question templates, exact-passage source profiles, selected-scope reporting patterns, conservative possible finding tensions/scope differences, source/method/dataset/lead map nodes, direct free experiment drafting and optional AI question handoff.
- Lead-to-AI references are checked against selected cached papers and prioritized within the bounded model source excerpt. Unknown/nonselected references are rejected before model invocation. Planning fields now include independent/dependent variables, confounding factors and supporting-result criteria; unknown new values remain blank. Live structured output now includes the new planning keys; older stored examples remain compatible, and supplied proposed values are preserved.
- Manual prior-work search is available without a model result/key; edits invalidate previous results. Three honest search outcomes and visible queries remain intact. Actual local HTTP request to the new endpoint returned 200 and five real retrieved candidate records for “transformer diagnostic accuracy,” with no collection error. Topical retrieval is not confirmation of equivalent experiments or novelty; broad “transformer” searches can include other domains.
- 327 tests passed in 26 files. TypeScript, production build and whitespace passed. Formatting was corrected after the first check. Playwright Chromium browser suites cover guided focus, synthetic opposing findings and context, exact evidence, free draft/export/new variables, all three prior-work outcomes, explicit-only AI handoff and retained plans. Existing tab/cost/planning and resource/comparison browser suites also passed.
- Browser fixtures and model responses are explicitly synthetic mocks. No paid OpenAI request was made. Desktop 1440×1000 and mobile 390×844 screenshots were inspected; no page errors or horizontal overflow found. Browser plugin unavailable; installed Chromium used. Firefox, Safari, assistive technology, scientific entailment, exhaustive discovery coverage and true novelty remain unverified. No PDF upload or arbitrary URL fetching was added.

## Logo palette and planning-focused resources

- Prepared logo/compact icon PNG variants from the supplied visual reference; header, sidebar and favicon now use them. Navy/violet/blue accents with lavender/sky surfaces replace the old bridge mark and flat indigo actions. Desktop/mobile screenshots inspected.
- Removed resource-based source exclusion and ordering from the running UI. Filled/cleared resources and no-GPU/deadline notes preserve all returned records and their order, with no new search. Normal source/text/year/version filters remain active.
- AI prompt explicitly treats resources as user-stated planning constraints, retains the selected literature, respects exclusions and unknown feasibility, and leaves blank notes unconstrained. New drafts carry labelled resource notes; current resources are shown separately from creation snapshots. Explicit free append preserves method edits and exported constraints. Discovery-to-plan handoff preserves these seeded notes. Older AI hypotheses/plans are flagged after resource edits without automatic paid regeneration.
- 330 tests passed in 26 files; TypeScript, production build, formatting and whitespace checks passed. Updated resource/comparison browser test and new `tests/brand-planning.browser.ts` passed in Chromium; existing workflow/cost/planning and discovery suites also passed. New browser coverage includes logo/favicon loading, all paper records retained with resources, outbound mock request constraints, stale analysis warning, preserved edits and exported updated notes, 1440×1000/390×844 layouts without page errors or horizontal overflow.
- Browser fixtures/model responses are synthetic mocks. No paid OpenAI API request or live resource-adapted model output was tested. Firefox/Safari, physical devices and assistive technology were not tested. Image assets are prepared variants of the reference rather than original uploaded-file bytes.

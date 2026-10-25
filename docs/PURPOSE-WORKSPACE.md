# Purpose-focused PaperBridge workspace

This targeted correction consolidates the existing research workflow; it does not add a new research service, model, search provider or billing configuration.

| Workflow                  | Existing capabilities retained                                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focus                     | One research question, field and optional question guide                                                                                                                                      |
| Papers                    | Search & select; Read & compare, including article reader, detailed comparison, coverage, filters, rankings and exact citations                                                               |
| Find gaps: Gap findings   | One shared candidate collection, author/AI/example origins, source statements, unresolved point, rationale, uncertainty, expandable evidence, related-work check and one selected next action |
| Find gaps: Visual map     | Same selected gap and citations, focal candidate question, relevant source/relationship/unresolved branches and inline passage drawers                                                        |
| Contextual AI development | Existing readiness/configuration/spending controls, optional planning resources, explicit generation and cost ledger; manual experiment fallback remains available                            |
| Experiment                | Existing editable plan fields, multiple drafts, current-resource/stale-context checks, source inspection, related work, copy/export                                                           |

## Shared evidence and claims

The root computes the existing source-led gap scan once and adapts it alongside current analysis into canonical `GapFinding` records. Both views receive the same selected ID and exact references. Author statements retain their original ID and text. AI-derived records include their analysis ID and remain labelled inferences; saved examples are explicitly manual examples. Source statements do not independently validate an interpretation. Background-only, generic, stale or missing evidence is not promoted to a defensible gap. A selected-evidence issue does not establish a field-wide gap or novelty.

Derived titles trim only generic source boilerplate. Exact supporting passages are rendered directly from stored text. Author findings can include a second cited Methods/Results passage for context when available; missing context is explicit. The map never runs another topic/gap generator or invents a relationship to fill space.

The selected AI/saved finding’s Uncertainty & limitations disclosure retains the full hypothesis inspector, including cited method requirements/resource assessment and hypothesis-linked prior work. Preparing development preserves the original research focus and existing hypotheses. Only the existing explicit model-generation button sends a request; navigating, expanding, selecting or inspecting does not. The model source-validation pipeline is unchanged. Edited experiment drafts remain cached independently of displayed findings and evidence overlays.

## Brand and interface

The original `public/paperbridge-icon.png` and `paperbridge-logo.png` are unchanged. The icon is fully contained, not cropped, beside the existing navy/violet wordmark. Typography uses the already available self-hosted IBM Plex Sans with fewer weights and consistent spacing; the unrelated orange/serif direction is superseded. No new logo, gradient system or decorative metrics were introduced.

Primary navigation is exactly Focus → Papers → Find gaps → Experiment. Find gaps always enters on Gap findings; switching to Visual map keeps the same selection and the H1 remains Find gaps. Papers and Find gaps each have only their two needed subviews. There are no standalone competing Resources/AI dashboards. Evidence scope and optional development are disclosures rather than extra navigation.

## Verification

- 374 unit/API tests pass in30files, including11 canonical-finding tests: stable IDs, exact context references, generic/background/unknown-source handling, AI namespacing, saved-example origin and unchanged source text after display-title trimming.
- TypeScript, production build, formatting and whitespace checks pass.
- New `tests/purpose-flow.browser.ts` and the eight existing browser entrypoints pass in actual Chromium with synthetic API fixtures. This covers default readable findings, exactly two gap views, same selected map ID/citation equality, independent in-place branches, no page jumps, no duplicated tools, source inspection, comparison under Papers, explicit mocked AI, hypothesis-to-plan routing and preserved edits across navigation/evidence.
- Laptop1366×900 and narrow390×844 were checked for errors and horizontal overflow. Actual IBM font rendering and the fully contained original logo were verified. Primary white/violet contrast is6.79:1. This is targeted UI QA, not a full accessibility audit.
- Screenshots and proof are under `/tmp/paperbridge-purpose/`: after-focus, after-gap-findings, after-visual-map, after-papers-comparison, after-experiment, after-map-mobile, after-insufficient-evidence and brand-proof.json. The captured initial screen is not claimed as a controlled before/after brand comparison because edits overlapped capture timing.
- Browser plugin unavailable; Playwright with installed Chromium used. No paid model request or live literature retrieval was made for this correction. Safari, Firefox, assistive technology, physical devices and scientific entailment/novelty were not evaluated.

No repository/history deletion, force push, merge into main or deployment occurred.

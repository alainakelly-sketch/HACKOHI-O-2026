# Hypothesis validation fix for 3955f82

This patch is based directly on 3955f82 and changes only backend analysis, its tests and this note. It preserves that version's logo, typography, layout, mind map, workflow and API configuration. It does not import later research-check or redesign changes.

Live structured output now restricts paper and passage identifiers to the actual bounded source input. Server validation still checks each paper/passage pair, available text and evidence from two distinct selected papers. Unknown sources, wrong-paper passages, empty/unseen text and missing required hypothesis fields are never accepted.

Each proposed hypothesis is checked independently. A valid proposal can survive an invalid neighboring proposal. An unsupported optional resource requirement is omitted and explicitly marked unknown, rather than discarding otherwise valid core evidence; resource feasibility is not inferred. Original uncertainty notes are retained. If no supported proposal survives, the response gives fixed, safe diagnostic reasons instead of exposing model text or blaming the selected material indiscriminately.

Paid usage from an unsuccessful provider response remains recorded. No automatic model retry was added. Tests use mocked SDK responses; no paid requests were made.

Validation: 353 unit/API tests passed; type checking, production build, changed-file formatting and Git whitespace checks passed. The browser regression uses synthetic intercepted API responses, not live scientific or billing validation. Live provider assessment quality remains unverified.

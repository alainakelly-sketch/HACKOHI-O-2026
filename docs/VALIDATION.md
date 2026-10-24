# Validation of the first working version

Checked on October 24, 2026, in the cloud workspace, using Node 24.19.0. No paid model requests were made. Changes remain local to `paperbridge-first-version`; no merge, push, deployment or purchase occurred.

## Automated checks

- Clean `npm ci --cache /workspace/.npm-cache --no-audit --no-fund`: passed.
- `npm test`: **56 tests passed in 6 files**. Provider tests mock the official SDK; they do not send network requests to OpenAI.
- `npm run typecheck`: passed, including browser, backend and shared code.
- `npm run build`: passed.
- `npm run format:check`: passed.
- A build with a **synthetic, non-secret canary** in the server model-key variable did not expose that value or model-key variable names in the compiled JavaScript asset. No real credential was used in this check.
- Built-server smoke check passed: production HTML, compiled JavaScript asset, safe `/api/health`, and explicitly labelled `/api/example` response. The temporary production server was stopped afterward.

## Browser checks

The Browser plugin was not available. QA used Playwright with installed headless Chromium, viewing the local website internally through port 5173. This does not create an externally accessible preview.

| Check                                                                      | Result                                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Correct PaperBridge title and nonblank workspace                           | Passed                                                                               |
| No Vite error overlay                                                      | Passed                                                                               |
| Real OpenAlex paper search from browser through backend                    | Passed                                                                               |
| Four actual papers selected; record links and available abstract displayed | Passed                                                                               |
| Analysis button disabled while model spending is unapproved                | Passed                                                                               |
| Desktop 1500×1050 layout                                                   | Passed                                                                               |
| No horizontal overflow at 390px and 320px widths                           | Passed                                                                               |
| Saved example clearly distinguished from live analysis                     | Passed                                                                               |
| Stored source quotation rendered by connection selection                   | Passed                                                                               |
| Initial resource assessment honestly Unknown                               | Passed                                                                               |
| Resource edits immediately remove old assessment                           | Passed                                                                               |
| Explicit available term reassesses as Appears compatible                   | Passed                                                                               |
| Explicit missing term reassesses as Potential mismatch                     | Passed                                                                               |
| Real related-prior-work search completes and shows queries/results         | Passed; Related prior work found                                                     |
| Export retains saved-example origin and current source data                | Passed                                                                               |
| Question edits clear old analysis                                          | Passed                                                                               |
| Empty search state using labelled synthetic test response                  | Passed                                                                               |
| Rate-limit/error state with retry using labelled synthetic test response   | Passed                                                                               |
| Unexpected application runtime/console errors                              | None; the deliberate HTTP 429 test produced its expected browser network-error entry |

Synthetic browser responses were temporary Playwright intercepts, not application fixtures or fallback behaviour. The saved example uses real OpenAlex records. Real OpenAlex searches and prior-work requests were also checked separately from these intercepts.

## Fixes found through validation

- Replaced a sentence-splitting expression that could drop text around `e.g.` with `Intl.Segmenter`; a regression test checks preservation of abbreviations and decimal numbers.
- Preserved the website Host header in Vite's development proxy. Otherwise the backend's same-origin protection rejected legitimate POST requests.
- Reworked narrow-screen navigation to prevent horizontal overflow at 320px.
- Added a favicon so the initial browser load has no missing-asset error.
- Returned the source snapshot used for analysis, so later retrieval cannot silently change the text behind a displayed citation.
- Kept old prior-work requests from updating the screen after a new analysis begins.
- Moved server-only evidence-schema validation out of the browser dependency graph; the browser bundle excludes the model SDK and server credentials.
- Saved-source captions identify their origin rather than claiming they came from a new live search.

## Visual review

The generated full-screen concept and the rendered screenshots were inspected directly, including the brand/header, step navigation, light/indigo palette, research/resource form, paper-selection panel, connection view, evidence inspector, and experiment section. The implementation preserves the concept's workspace structure and visual hierarchy. Functional changes include a working Search button instead of the concept's unused Filter control, a free-text deadline for hackathon constraints, an explicit saved-example entry point, and more precise availability/provenance copy. Desktop and mobile screenshots were examined; native-width overflow was checked programmatically.

## Not performed / remaining limitations

- **Live OpenAI request and actual model quality:** not tested; API spending has not been approved. SDK integration is implemented and tested with mocks, not claimed as provider-verified.
- **Scientific correctness or novelty:** not established. The saved interpretation and model outputs need researcher review. Valid IDs are not proof of entailment.
- **Full-text retrieval:** not implemented. All evidence is abstract-only or metadata-only.
- **Firefox, Safari, physical mobile devices and assistive technology:** not tested. Controls have labels, visible focus styles and responsive layouts, but this is not a full accessibility audit.
- **New cloud instance restoration and publication:** not performed. Installation/startup configuration is saved for review; that is distinct from publishing and testing a newly restored instance.
- **Current OpenAlex documentation website:** unreachable from this machine. The official documentation source repository was consulted, and actual search requests succeeded. Optional-key and authorization failures are handled explicitly.
- **Public multi-user hosting:** not tested or deployed. This prototype has no accounts or durable database. Its caches are in-memory and expire; a reload resets the browser workspace.

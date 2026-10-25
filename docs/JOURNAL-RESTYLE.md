# PaperBridge journal restyle

A scoped visual change on the existing feature branch. No search ranking, map relationships, evidence text, model configuration, spending gates, hypothesis state, experiment logic or export schema changed.

## Design system

- Newsreader: wordmark500, page headings400 at32–38px, section/publication headings500 (publication21px).
- IBM Plex Sans: body16px; controls, navigation, metadata and map nodes14px or larger. Newsreader optical sizing is automatic; actual source text remains unchanged.
- Shared colors: page#FAF9F6, white reading surfaces, text#242321, secondary#64615C, accent#A63E2B, dividers#DDD9D2. Stronger control borders are separate from quiet dividers. Success/error/warning colors remain distinct and retain their text/icons.
- `design-tokens.css` centralizes families, scales, colors, spacing and radii. Historical duplicate global selector blocks were consolidated in their existing responsive scopes; component CSS consumes the same tokens. No decorative gradients, texture, glows or card shadows remain. Evidence overlays retain a functional shadow.
- Open sections, thin dividers, numbered reading-list entries, source authors underneath titles, small-radius controls and restrained active underlines replace the repeated rounded-card/lavender treatment. Existing brand assets remain preserved; the header is typographic and the favicon retains the supplied identity.

## Fonts and licenses

Both font binaries are self-hosted, unmodified files from the official Google Fonts repository. The Google Fonts CSS endpoint returned403, so original TTF files were used instead. `public/fonts/README.md` records exact source URLs, sizes, axes andSHA256 checksums; SIL OFL notices are retained next to each font. `src/fonts.css` sets normal variable-weight ranges and `font-display: swap`. Sensible Georgia/system fallbacks remain available. Browser use does not depend on a third-party font service.

## Visual and interaction checks

Before screenshots were captured before stylesheet edits. The brief supplied the visual specification; no new imagery, fake research, decorative metrics or marketing sections were introduced.

Playwright/Chromium was used because the Browser plugin is unavailable. Actual rendered-font inspection through Chrome DevTools reported custom Newsreader glyphs for the wordmark/publication title and IBM Plex Sans glyphs for metadata. This verifies font use rather than only trusting CSS family names. The heading measured38px/400 at1366px and32px/400 at390px; publication21px/500; metadata/map UI14px.

Measured actual rendered contrast: primary white/rust6.28:1; body14.91:1; secondary text6.17:1; error text/background6.37:1; control borders3.56:1. Keyboard focus has a visible2px solid outline. This is targeted QA, not a complete accessibility audit.

The `journal-restyle.browser.ts` workflow exercises Focus, Papers with long titles/body/abstract/metadata records, error state, selection, expanded map branches, evidence dialog, manual Experiment editing and tab-state preservation at1366×900 and390×844. Existing browser entrypoints additionally cover model gates/costs, source filters/relevance, hypothesis selection, drafts/export and map/list evidence consistency. All provider/analysis responses in interaction tests are explicitly synthetic mocks; no paid request was made.

Before/after screenshots and font/contrast proof are saved outside Git under `/tmp/paperbridge-journal/`:

- `before-focus.png`, `before-focus-mobile.png`, `before-map.png`, `before-experiment.png`
- `after-focus.png`, `after-papers.png`, `after-map.png`, `after-experiment.png`, `after-evidence.png`, `after-error.png` and corresponding mobile captures
- `font-and-contrast-proof.json`

Inspected comparison points: heading/interface typography, actual palette, numbered reading-list anatomy, underlined navigation, flatter surfaces/radii, readable quotations and narrow-screen reflow. A narrow heading initially shared a cramped row with the example link; it was corrected to a full-width stacked layout. Required workflow copy remains; the header image-to-wordmark switch and visible author metadata are intentional changes requested by the brief.

Safari, Firefox, assistive technology, physical devices and a full accessibility audit were not performed. No billing changes, forced push, merge or deployment occurred.

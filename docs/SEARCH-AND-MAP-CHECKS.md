# Search relevance and expandable gap workspace checks

These checks distinguish live retrieval from deterministic synthetic tests. No paid model request was made.

## Causes found

The previous query builder kept only four keywords and prefixed the broad field; combined results interleaved providers; the default access filter hid non-imported papers. The previous map scrolled to a separate detail area and made gap exploration depend too much on map selections.

## Live before / after

For the same legacy query `psychology music affect time perception`, the old combined search returned 28 deduplicated free-linked records without a common question assessment. The new request used the same query plus the explicit original question `How does music affect time perception?` and field `psychology`; it returned 54 free-linked candidates, then ranked them consistently against that question. All three provider searches completed successfully; a provider returning zero records is not a failure. Counts describe one live request, not coverage or accuracy.

| Position | Before: provider interleaving                                                                                                                                                  | After: common question ranking                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Time perception, immersion and music in videogames                                                                                                                             | Time perception, immersion and music in videogames                                                                                                |
| 2        | Effects of visual pacing cue and motivational auditory content on running fatigue and biomechanics.                                                                            | The Influence of Music and Music Familiarity on Time Perception                                                                                   |
| 3        | Music and communication in music psychology                                                                                                                                    | Music, emotion, and time perception: the influence of subjective emotional valence and arousal?                                                   |
| 4        | Enhancing neurodivergent student success through wellbeing: Protocol for a quasi-experimental evaluation of the Tuned In Connect program across three Australian universities. | The influence of tonality, tempo, and musical sophistication on the listener’s time-duration estimates                                            |
| 5        | Music, emotion, and time perception: the influence of subjective emotional valence and arousal?                                                                                | Music and speech time perception of musically trained individuals: The effects of audio type, duration of musical training, and rhythm perception |

The new normal focus query `music "time perception"` returned 59 candidates in this session. Numbers and positions can change with provider indexes and lexical vocabulary updates.

- **The influence of tonality, tempo, and musical sophistication on the listener’s time-duration estimates** was retrieved in the ordinary music-search candidate pool and classified as a direct match (rank 4 for the legacy query, rank 6 for the focused query in the final live check). Its abstract describes two experiments and duration-estimation methods. It was never inserted as a canned result.
- A separate explicit OpenAlex title query for **Disco Time: The Relationship Between Perceived Duration and Tempo in Music** returned records with DOI `10.1177/2059204320986384` and repository DOI `10.5281/zenodo.6563145`. This targeted sanity check is not evidence that every normal music query retrieves it, and those records were not injected into ordinary searches.
- New live `household water leak detection` results included **Leak detection for household pipelines based on a smart valve with single pressure and flow sensors** and **A Shazam-like Household Water Leakage Detection Method** near the top.
- New live `urban heat vegetation` results included **Interactions between urban vegetation and surface urban heat islands: a case study in the Boston metropolitan region** and **Evidence of urban heat island impacts on the vegetation growing season length in a tropical city** near the top.
- An old-version live baseline was not captured for the water/heat queries. Generalization comparisons for those topics are deterministic synthetic fixtures, not claimed live before/after improvements.

Official Europe PMC REST documentation and the arXiv API manual were consulted for phrase and Boolean syntax. OpenAlex documentation access was blocked, so its existing plain-text search syntax was retained rather than assuming equivalent Boolean behavior. Semantic Scholar documentation returned403 and no credential/access was configured, so its optional integration was left unadded.

## Deterministic and browser checks

Synthetic fixtures cover musical tempo/perceived duration above pain-only papers, pain plus duration remaining eligible, duration-estimation synonyms, incidental and prior-study mentions, explicitly unmeasured outcomes, general water/heat topics, missing abstracts, duplicates, empty results, rate limits, provider failures, caching, phrase boundaries, validated concept overrides and refreshed relevance with preserved imported text.

Actual Chromium UI runs use mocked API responses, including clearly synthetic analysis responses. New `search-relevance.browser.ts` verifies discovery/access separation, concept corrections, source explanations, actual-query/failure displays and retained selections. New `expandable-map.browser.ts` covers all ten requested map acceptance cases, keyboard activation and compact layout controls. The existing mind-map, workflow, discovery, brand/planning and resource/comparison browser entrypoints were updated and passed. Ordinary map actions make no API requests; explicit mocked generation remains a separate action.

Desktop/laptop and390px layouts were inspected; no page errors or horizontal overflow were found. Browser plugin unavailable; installed Playwright/Chromium used. Screenshots are in `/tmp/paperbridge-search/` and `/tmp/paperbridge-expand/`. Full unit/API test, type-check/build and formatting totals are recorded in the final task response.

## Limits

This is a transparent lexical baseline, not scientific entailment or semantic reranking. The explicit synonym vocabulary is small; important papers can be conservatively placed under background or missed. Provider limits and the free-linked pool restrict discovery. Full-publication completeness, novelty, scientific validity, exhaustive accessibility testing, Firefox/Safari and real device hardware were not verified. No paywall bypass, arbitrary publisher scraping, vector database, custom training, new account or spending configuration was added.

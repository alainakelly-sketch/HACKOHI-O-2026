# PaperBridge module boundaries

## Browser workspace

`src/App.tsx` owns session state and composes the question form, paper results, free comparison, optional AI connections, evidence inspector and experiment plan. `src/lib/api.ts` calls only same-origin `/api` routes. Browser modules never read provider credentials or import backend modules.

`src/components/PaperPanel.tsx` shows source provenance, free-copy links, grouped versions, coverage and per-collection status. The retrieval filter means a supported PMC/arXiv identifier is known; it is not a guarantee that the remote service will return readable text. Selected records persist across searches.

`src/components/ComparisonPanel.tsx` provides free side-by-side reading for 2–6 selected records. `shared/comparison.ts` filters stored passages by source section or phrase. Methods and findings come from source headings, not inferred AI summaries. Missing sections stay missing. PDF and external-repository links remain separate from text imported into the workspace.

## Search and grouping

`server/sources/combined.ts` runs three search adapters concurrently: OpenAlex, Europe PMC and arXiv. It interleaves each source's relevance-ranked list rather than comparing incompatible provider scores. Records without a source-reported free-copy link are excluded from this combined discovery workflow. Successful results survive another provider's failure; per-source status makes the incomplete search visible. All-provider failure is an explicit error, not an empty successful search or a saved fallback.

- `server/openalex.ts` applies the open-access filter for combined search, reconstructs positional inverted abstracts and preserves OA location links, license metadata and identifiers. These links can include university repositories; there is no separate universal repository crawler.
- `server/sources/europepmc.ts` requests core JSON with an OA constraint and normalizes source metadata, abstracts, PMC identifiers and free-copy links. Quoted keyword clauses prevent form text from overriding the OA search constraint.
- `server/sources/arxiv.ts` parses the Atom feed, retains arXiv version identifiers and marks manuscript/preprint origin. A shared queue spaces requests according to the API guidance. An arXiv record does not establish peer review or publication status.

Grouping uses DOI, PMC identifier, arXiv identifier or an already-known source identity. Similar titles alone do not establish duplicate identity. Provenance and distinct free-copy links are retained. A canonical record supplies the displayed source text; grouping does not assert that manuscript and published versions have identical contents.

`server/sources/common.ts` supplies stable sentence passage IDs, safe link normalization and bounded response reading. Source text is always untrusted data.

## Source store and full-text retrieval

`server/app.ts` validates requests and binds selected IDs to the server-side source store. A browser cannot supply invented paper text or an arbitrary retrieval URL. The bounded source/analysis caches expire after one hour; no database or account system is involved. Search responses preserve already-retrieved body text. Concurrent imports of the same paper share a pending retrieval.

`server/sources/fulltext.ts` constructs supported retrieval URLs from validated PMC/arXiv identifiers. It imports PMC article-body paragraphs from XML and arXiv article-body paragraphs from HTML, checks response identity, and preserves the original abstract. It does not crawl arbitrary metadata links, bypass paywalls, or parse PDFs. Retrieval and response limits are explicit; a shortened result is labelled **Full text excerpt**.

Figures, tables, references and supplements are excluded from the extracted prose. Mathematical formatting may be lost. The coverage label **Full text retrieved** refers to the supported article-body extraction, not the complete publication package. Full-text metadata records the source URL, retrieval time, license information when supplied, scope note and truncation state. Unknown licensing is not converted into a reuse grant.

Abstract and article-body passage IDs include the canonical paper ID, text kind, content hash and source-order index. Full-text passages also carry their source section. Quotations are rendered from these stored passages, never from model-generated quote strings. Updating the retrieved evidence clears an older analysis rather than retaining conclusions against changed source text.

## Optional model analysis and evidence validation

`server/analysis.ts` uses the official OpenAI SDK only when both the spending-enablement flag and a server credential are present. It sends untrusted paper/form strings as data and instructs the model not to obey embedded directions. No tools execute model instructions. This reduces prompt-injection risk but does not guarantee model obedience.

Model input is bounded per selected paper and explicitly described as an excerpt. A reader may have more stored text than was submitted for AI analysis; omitted passages were not analyzed. Missing credentials never prevent paper search or free source comparison. Model failures do not load the saved example.

`shared/analysis-schema.ts` defines the structured response. `server/evidence-validation.ts` rejects invalid schemas, inconsistent insufficient-evidence outcomes, nonexistent paper/passage IDs, duplicate hypotheses and resource terms absent from cited text. A connection needs at least two distinct selected source papers. These are provenance checks, not scientific verification or proof that a passage entails an interpretation.

An accepted analysis returns the exact source snapshot used. `shared/evidence.ts` resolves citations against that snapshot. The evidence UI distinguishes source statements, PaperBridge interpretations and untested hypotheses, including whether a quotation came from an abstract or article-body text.

## Prior work, resources and examples

`server/prior-work.ts` runs two visible combination queries through the same combined free-paper search. Failed queries or partial provider availability produce **Search incomplete**, even when candidates exist. Results are related candidates for human inspection; no match never establishes novelty and no numerical novelty score is calculated.

`shared/resources.ts` conservatively compares explicitly cited method phrases with the user's resource notes. The UI tracks a revision, so editing and undoing an edit still invalidates an old assessment. Experiment plans warn when resources change after generation. Unknown quantities, timing or equivalent terms remain unresolved rather than becoming invented requirements.

`server/examples/` contains real retrieved records and manually prepared, abstract-based analysis labelled `saved-example`. The example opens through an explicit separate-tab action. It is distinguishable from live results and is never a fallback for failed live requests. Synthetic paper fixtures are confined to automated tests.

## Runtime and access

The backend binds to loopback, limits JSON size and request frequency, rejects unrelated origins and does not enable CORS. Vite preserves the website Host header when proxying development requests. `server/config.ts` derives an exact Codespaces website hostname from runtime metadata; it does not disable hostname checks or allow a wildcard. The API's same-origin guard also recognizes that exact HTTPS website origin.

`npm run dev` starts website port 5173 and backend port 3001. In development, the backend root redirects to the known Codespaces website, or displays an explanation of the correct port. `npm start` serves a previously built website and API together on port 3001. This remains a team prototype, not a deployed public service with production accounts, durable storage or abuse controls.

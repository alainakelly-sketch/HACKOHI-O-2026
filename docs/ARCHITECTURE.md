# PaperBridge module boundaries

`src/App.tsx` owns session state and composes focused interface components. `src/lib/api.ts` is the browser's only network boundary. It calls same-origin `/api` routes; it never imports backend code or reads model credentials.

`server/app.ts` validates requests with Zod, binds selected IDs to a server-side source store, and gives each accepted analysis a temporary ID. Clients cannot submit invented paper text for analysis or arbitrary hypotheses for prior-work checks. Backend caches are bounded and expire after one hour; there is no database.

`server/openalex.ts` retrieves actual records and reconstructs abstracts from positional inverted indexes. Passage IDs contain the OpenAlex work ID, an abstract-content hash, and a sentence index. `Intl.Segmenter` avoids losing text around abbreviations. Abstracts have not been checked against full text. Record links are restricted to the retrieved OpenAlex ID and valid DOI URL format.

`server/analysis.ts` uses the official OpenAI SDK behind both a spending-enablement flag and a credential check. It sends untrusted strings as data, explicitly instructs the model not to obey paper/form text, and requests structured JSON. This reduces prompt-injection risk but is not a guarantee. There are no tools for executing model instructions. No model-generated references are used to populate paper metadata or quotes.

`shared/analysis-schema.ts` defines the response contract. `server/evidence-validation.ts` rejects invalid schemas, inconsistent insufficient-evidence outcomes, nonexistent paper/passage IDs, duplicate hypotheses, and resource terms absent from cited text. A hypothesis needs at least two distinct source papers. These checks validate provenance structure, not scientific correctness or whether a passage entails an interpretation. The accepted source snapshot is returned to the browser with the analysis so subsequent searches cannot silently change displayed quotations.

`shared/evidence.ts` resolves references against stored source text. UI quotations come from these stored passages, never from a model's quotation string. `shared/resources.ts` performs a deliberately conservative phrase comparison. The UI tracks a resource revision; editing and then undoing an edit still invalidates an old assessment. Experiment plans also show a warning when resources change after generation.

`server/prior-work.ts` generates two visible search queries from field names and the proposed title. OpenAlex's relevance order determines candidates. Any failed query means **Search incomplete**, including when the other query returned candidates. No match does not establish novelty. The query/result list is inspectable.

`server/examples/` contains real retrieved source records plus manually prepared analysis, labelled `saved-example`. Loading is a separate explicit action in a separate browser tab; failure of a live request never loads it. Automated tests' synthetic records are not imported into application modules.

The server binds to loopback, limits JSON request size and request frequency, rejects unrelated browser origins, and does not enable CORS. Vite preserves the website Host header when proxying development API requests so legitimate same-origin POSTs pass. Do not forward the backend separately in development. This is a team prototype, not a public hosted service with production abuse controls.

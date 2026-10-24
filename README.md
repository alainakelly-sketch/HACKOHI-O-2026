# PaperBridge

A research workspace for a one-day hackathon. Search several free-paper collections together, select papers from different fields, and read their source text side by side. Optional AI connections can help develop an experiment proposal, but **paper search and source comparison do not require a paid AI key**.

PaperBridge does not buy papers or bypass paywalls. It uses source-reported open-access copies. No search covers every free paper, and a free link does not guarantee that its text can be imported into this app.

## Open the app in GitHub Codespaces

Use the **`paperbridge-first-version`** branch, not `main`.

1. Open [the PaperBridge branch on GitHub](https://github.com/alainakelly-sketch/HACKOHI-O-2026/tree/paperbridge-first-version).
2. Click the green **Code** button, then **Codespaces**. Open your existing Codespace for this branch, or create one if needed. GitHub may charge beyond your included Codespaces allowance; creating one is not required if you already have a working editor.
3. In the browser editor, choose **Terminal → New Terminal**. The terminal is the panel where you type commands.
4. From the project folder, run:

   ```bash
   npm ci
   npm run dev
   ```

5. Leave that terminal running. Open **Ports** beside the terminal, find **5173**, and click its globe/**Open in Browser** action. If it is missing, choose **Add Port** and enter `5173`.

**5173 is the website. 3001 is its backend.** You do not need to open the backend separately. In development, opening the backend root redirects to the website when Codespaces supplies its hostname; otherwise it displays a page explaining which port to open.

### Update an existing Codespace

In the terminal running the app, press **Ctrl+C** first. If this Codespace is already on `paperbridge-first-version` and has no changes of your own, run:

```bash
git pull --ff-only
npm ci
npm run dev
```

If Git reports uncommitted changes, a conflict, or a different branch, preserve that work and ask your teammate before proceeding. Do not use `git reset --hard` or overwrite another teammate's files to update the app.

### Other environments

You need **Node.js 22.12 or newer**. Run `npm ci` and `npm run dev` from the folder containing `package.json`. The prepared onboarding checkout is `/workspace/HACKOHI-O-2026`; Codespaces uses its own project path, so do not copy that cloud-only path into a Codespaces terminal.

For a remote editor, forward **5173** and use the editor's supplied browser URL. A localhost address printed inside a remote terminal refers to that remote machine, not your laptop. The onboarding chat itself does not provide an interactive preview.

If running on your own computer, use the Local address printed by Vite on that same computer. Vite accepts localhost, `terminal.local`, and the exact Codespaces website hostname supplied by its environment. For another editor, add only its specific trusted preview hostname to `server.allowedHosts` in `vite.config.ts` if needed; do not disable host checks for all hosts.

## Search several free-paper sources

One search runs these three routes:

| Search route   | What it contributes                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **OpenAlex**   | Open-access scholarly records and free-copy links, including links to university and other repositories.                    |
| **Europe PMC** | Its open-access subset, including PubMed Central articles with available PMC identifiers.                                   |
| **arXiv**      | Freely readable manuscripts and preprints. An arXiv record is not proof of peer review; a published version may also exist. |

Titles, years, identifiers, abstracts and links come from retrieved records, not from AI-generated references. Search each field or a method separately if a combined phrase is too restrictive. Your selection stays while you search.

Results interleave each service's relevance-ranked list. Scores from different services are not treated as directly comparable. Records sharing a DOI, PMC identifier or arXiv identifier are grouped; title similarity alone is not used to declare two papers identical. **Grouped records / versions** retains their source links. Manuscripts and published versions can differ, so inspect the original version you use.

Each service has a visible status. If one is unavailable, the successful services' results remain visible and the search is labelled incomplete. An empty successful result is different from a failed request. No saved paper list is substituted for a failed live search.

**Free-copy links are reported by the source and may change.** A publisher-record link is a reference page and may not itself contain the free copy. Use the separately marked free-copy link. Free to read does not necessarily mean unrestricted reuse; check the source's license and terms.

## Compare papers for free

1. Search a topic and select **2–6 papers** using the checkboxes.
2. In **Compare source text**, click **Compare selected papers**.
3. Read the cards side by side. With more papers or a narrow screen, scroll horizontally within the comparison.
4. Use **Show** to choose abstracts, methods sections, findings/limitations sections, or all retrieved passages. **Find a phrase** filters the actual source text.
5. Click **Retrieve free full text** for a supported PMC or arXiv record. If it succeeds, choose **All retrieved passages** or a section view to read its article-body paragraphs.

**Export sources (JSON)** saves your selected metadata and retrieved text without requiring AI analysis.

This comparison shows stored passages, **not AI summaries**. You can inspect the source link and passage ID. Missing methods or findings are not invented: section headings vary, and abstract-only records cannot provide sections that were never retrieved.

### What “full text” means here

| Label                   | Meaning                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Metadata only**       | No readable abstract or article-body text has been retrieved.                                                                         |
| **Abstract only**       | The available abstract is stored; the complete paper has not been imported.                                                           |
| **Full text retrieved** | Supported article-body prose has been retrieved from PMC XML or arXiv HTML. Figures, tables, references and supplements are excluded. |
| **Full text excerpt**   | Only part of the article-body prose fit the app's reading limit.                                                                      |

The original publication may contain important material missing from the extracted prose. Always use **Read at source** when figures, tables, formulas or supplements matter. Formatting and mathematical notation may not survive text extraction intact.

Some arXiv papers have a free PDF but no readable HTML version. Other repositories may offer only a PDF or an unsupported page format. Those free links remain usable, but **PDF extraction and arbitrary repository crawling are not implemented**. The app reports retrieval failure and preserves any available abstract; it does not pretend that a linked PDF has been read.

No model configuration, account, database, or payment is needed for this reading workflow. The external services still set their own rate limits and access rules.

## Try the saved research example

**Explore saved example** opens a separate tab and leaves your live workspace alone. It includes four real OpenAlex records and an explicitly **manually prepared analysis**, not a live AI response. Its original stored evidence is abstract-only, even though live search can now retrieve more kinds of text.

Click its connection to inspect source passages, assumptions and unknowns. **Assess resources** initially returns **Unknown**. Adding `tripartite ecological networks` to **Available data** and reassessing demonstrates the conservative phrase match; writing `No tripartite ecological networks` instead demonstrates **Potential mismatch**. Edits immediately invalidate the previous assessment.

**Check related prior work** uses the live combined free-paper search. The visible queries and candidate overlaps do not establish novelty. A failed provider makes the search incomplete. The experiment section is a proposal, not an established protocol. **Export workspace**, when a connection is present, downloads sources, notes, analysis origin and the current assessment as JSON.

Reloading clears the browser workspace. The backend keeps bounded, temporary source and analysis caches for one hour; restarting it clears live cache entries. Search and reselect if sources expire. Saved-example loading is explicit and never replaces a failed live request.

## Optional AI connections — spending approval required

Select **4–6 papers**, enter a research question and two fields, then use **Generate AI connections** only if an owner has configured and approved it. **No paid model requests were made while building this app.** Live AI calls remain disabled by default. A ChatGPT subscription does not pay for API calls.

Only after the project owner approves API spending:

1. Use an existing approved OpenAI API account/key. PaperBridge does not create accounts, buy credits or configure billing.
2. Store the key securely as a **server-side** `PAPERBRIDGE_MODEL_KEY`, or an existing `OPENAI_API_KEY` binding. Never put secrets in frontend files, `VITE_` variables, Git, screenshots, logs or chat.
3. Set server-side `ENABLE_LIVE_ANALYSIS=true` and optionally `PAPERBRIDGE_MODEL` (default `gpt-4.1-mini`). Allow outbound HTTPS to `api.openai.com`.
4. Restart `npm run dev` and reload the site. Generating connections sends the question, resource notes and a bounded excerpt of selected source passages to OpenAI and may incur API charges.

For local development, copy `.env.example` to `.env` **only if `.env` does not already exist**, edit it privately, and leave the spending flag false until approved. `.env` files are ignored by Git. The frontend never receives the provider key.

The official OpenAI SDK uses structured output, a timeout, no automatic retries, and `store:false`. Provider retention policies still apply. Each paper's model input is bounded and labelled as an excerpt; do not assume all retrieved text was analyzed. Unknown source IDs, incomplete responses, refusals and provider failures are rejected explicitly. Quotes are rendered from stored text, never invented model quotation strings. Valid references do not prove the model's interpretation is correct.

## Network access and source documentation

Search requires `api.openalex.org`, `www.ebi.ac.uk` and `export.arxiv.org`. Supported in-app text retrieval also uses `www.ebi.ac.uk` and `arxiv.org`. Browser source links may point to `europepmc.org`, `pmc.ncbi.nlm.nih.gov`, DOI pages or individual university repositories.

For restricted cloud environments, allow the required destinations in environment settings; keep the existing proxy, TLS and CA configuration. Do not bypass the proxy to work around a blocked service. A provider error in the app is not evidence that an API key or payment is needed.

OpenAlex supports optional server-side `OPENALEX_API_KEY` and `OPENALEX_EMAIL`. The earlier single-source workflow retrieved records without a key. Current API access rules may change; authorization and rate-limit errors are reported rather than hidden.

Official references:

- [OpenAlex API documentation](https://developers.openalex.org/) and [official source documentation](https://github.com/ourresearch/openalex-docs/blob/main/api-entities/works/search-works.md).
- [Europe PMC RESTful web service](https://europepmc.org/RestfulWebService). Search uses the core JSON response with `OPEN_ACCESS:Y`; readable PMC text uses `/{PMCID}/fullTextXML`.
- [arXiv API manual](https://info.arxiv.org/help/api/user-manual.html) and [official documentation source](https://github.com/arXiv/arxiv-docs/blob/develop/source/help/api/user-manual.md). Searches use Atom responses and a shared request queue spaced according to arXiv's guidance.

The official arXiv source repository and OpenAlex source documentation were consulted. Live combined search was checked through the app backend and returned successful responses from all three services. Direct documentation-site access was restricted during initial setup; see the validation report for the full-text paths, mocked checks and remaining limitations actually verified. Parsing a test response alone is not a live-provider check.

## Check the project

```bash
npm test             # Logic/API tests; no paid model requests
npm run typecheck    # Check TypeScript
npm run build        # Type check and build the website into dist/
npm run format:check # Check formatting
npm start            # Serve the built website and API on port 3001
```

For development, use `npm run dev` and open **5173**. For the built server, run a successful build first, use `npm start`, and forward **3001** instead. Keep `HOST=127.0.0.1` unless your environment explicitly needs another binding.

Tests cover source parsing, free access, duplicate grouping, source IDs, failures, evidence validation, model spending gates, prior-work outcomes and resource invalidation. Synthetic papers belong only in labelled automated tests. Check [docs/VALIDATION.md](docs/VALIDATION.md) for current results and untested cases; a mocked test is not a live-provider verification.

## Work as four teammates

| Teammate              | Work independently in                                                                | Responsibility                                                                          |
| --------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 1 — interface         | `src/components/`, `src/styles.css`                                                  | Search panels, side-by-side reading, evidence readability and mobile layout.            |
| 2 — retrieval         | `server/openalex.ts`, `server/sources/`, related tests                               | Collection adapters, grouping, free copies, text extraction and provenance.             |
| 3 — analysis/evidence | `server/analysis.ts`, `server/evidence-validation.ts`, `shared/analysis-schema.ts`   | Optional model integration and evidence checks; never enable spending without approval. |
| 4 — resources/testing | `server/prior-work.ts`, `shared/resources.ts`, `shared/comparison.ts`, related tests | Prior-work outcomes, conservative resource checks, passage filtering and QA.            |

Coordinate before editing `shared/types.ts`, `server/app.ts` or `src/App.tsx`, which connect these modules. Give teammates separate branches. The implementation branch is `paperbridge-first-version`; changes are reviewed there without merging into `main` or deploying automatically.

## Remaining limits

- Searching several collections is not a search of every free paper or a systematic review. Synonyms, coverage gaps and source failures can hide relevant work.
- Free access and preprint labels come from retrieved records, not a scientific or legal verification. Grouped versions can differ.
- Article-body prose is partial evidence. Missing images, tables, supplements, formulas and methods can change an interpretation.
- No scientific verification, numerical novelty score, guaranteed feasibility, accounts, database, uploads, custom training or automatic experiment execution.
- Resource fit is a conservative comparison of cited terms with user notes. Quantities, quality, equivalent terms, budgets, deadlines and ambiguous negation often remain **Unknown**.

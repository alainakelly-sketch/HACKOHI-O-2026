# PaperBridge

A research workspace for a one-day hackathon. Start with **one field of interest and a research question**, discover free papers, read their article text, and inspect possible research-gap leads supported by authors’ own words. **Paper search, source comparison and the local gap-lead scan do not require a paid AI key.** Optional AI can develop a testable gap hypothesis only after API spending is approved.

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

## Set a research focus

Enter **Your field of interest** and a question about what interests you in that field. There is no second-field requirement.

Click **Find papers for this focus**. PaperBridge extracts simple keywords from your field and question, fills the editable search box, and starts the free-paper search. It is a keyword aid, not an AI interpretation or a guarantee that the query captures your intent. Edit the search terms and search again if they are too broad or restrictive.

Your question and field also help order the exact author-stated gap leads in selected papers. You can change the focus as you learn more; old AI analysis is cleared when the question or field changes.

## Search several free-paper sources

One search runs these three routes:

| Search route   | What it contributes                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **OpenAlex**   | Open-access scholarly records and free-copy links, including links to university and other repositories.                    |
| **Europe PMC** | Its open-access subset, including PubMed Central articles with available PMC identifiers.                                   |
| **arXiv**      | Freely readable manuscripts and preprints. An arXiv record is not proof of peer review; a published version may also exist. |

Titles, years, identifiers, abstracts and links come from retrieved records, not from AI-generated references. Search a narrower topic, a method, or a shorter phrase if the suggested query is too restrictive. Your selection stays while you search.

Results interleave each service's relevance-ranked list. Scores from different services are not treated as directly comparable. Records sharing a DOI, PMC identifier or arXiv identifier are grouped; title similarity alone is not used to declare two papers identical. **Grouped records / versions** retains their source links. Manuscripts and published versions can differ, so inspect the original version you use.

Each service has a visible status. If one is unavailable, the successful services' results remain visible and the search is labelled incomplete. An empty successful result is different from a failed request. No saved paper list is substituted for a failed live search.

**Free-copy links are reported by the source and may change.** A publisher-record link is a reference page and may not itself contain the free copy. Use the separately marked free-copy link. Free to read does not necessarily mean unrestricted reuse; check the source's license and terms.

## Show papers whose body text is actually ready

The default **Filters → Text availability → Retrieved article body only** admits only records whose article-body paragraphs have actually been imported, with full-text provenance metadata and no reported truncation. A free link, PMC/arXiv identifier, abstract, or coverage label alone does not qualify. This confirms text availability, **not scientific correctness or completeness of the whole publication**.

After each search, PaperBridge automatically checks up to **12 supported candidate records**, with at most two checks running together. Ready papers appear as soon as their text arrives. Use **Check more article texts** for another batch. Failed checks remain visible under **text retrieval checks failed — inspect or retry**; expand it to read the error and choose **Retry this article**. A failed import is not silently counted as full text.

A result card admitted by the default filter shows **Article body retrieved**, an actual paragraph preview, and **Read article body**. That button selects the paper if needed and takes you to the reader. A search can return free-linked records while showing no ready text yet: wait for checks, check more candidates, or deliberately widen the filter.

Other filters are explicit:

- **Supported retrieval route — not checked:** show records with a supported import route or available body passages; this is not a promise that retrieval will succeed.
- **All free-copy records — may be abstract-only:** show the broader free-linked discovery results, including unsupported repositories and PDFs.
- **Include labelled partial-text excerpts:** allow explicitly labelled body excerpts in the retrieved-text filter; this is off by default.
- **Show collections**, **Year from / Year to**, and **Publication versions:** narrow the currently retrieved records. A year range excludes records without a known year. Excluding identified preprints/mixed versions does not prove that the remaining papers were peer reviewed.

Filters apply to search results; selected papers remain in the reader and gap scan until you remove their selection chips.

No filter retrieves every paper in a field. A blank filtered list is not evidence that no relevant literature exists.

## Read and compare article text for free

1. Search a topic and let the article-text checks run. Click **Read article body** on a ready result, or select papers using the checkboxes. Supported retrieval also starts automatically when you select a record that still needs it. There can be up to six selected papers.
2. The reader opens automatically with **one selected paper**; select two or more to compare them side by side. With more papers or a narrow screen, scroll horizontally within it. You can use **Collapse reader** to close it for the current selection.
3. The default **Article body — retrieved text** view shows only imported article-body passages. It never silently substitutes an abstract for missing body text. Each card shows whether text is arriving, ready, not retrieved, unavailable or failed.
4. If supported papers are still missing text, use **Retrieve selected full texts** for an explicit sequential batch. Use a paper's **Retrieve free full text** button to retry, or **Read at source** to open its free copy.
5. For two or more selected papers with body text, use the **Similarities & differences overview** above the reader: inspect shared terms, distinct textual emphases, and quoted aims/methods/findings/limitations. Then use **Show** for particular sections or all retrieved passages. **Abstracts only** is available only when you explicitly choose it. **Find a phrase** filters the actual stored text.

**Export sources (JSON)** saves selected metadata and retrieved text without requiring AI analysis. The reader shows stored passages, **not AI summaries**. Source links and passage IDs remain inspectable. Missing methods or findings are not invented: source section headings vary, and an abstract cannot provide sections that were never retrieved.

### Understand the free comparison overview

The overview requires article-body text for at least two selected papers. It does not use their abstracts as a substitute. **In common** shows words and phrases found in two or more retrieved bodies; **Distinct emphases** shows terms found in one retrieved body but not the others. The source-statement matrix displays exact excerpts for aims/purpose, methods, findings and limitations/future work, using source headings or explicit textual cues. An unavailable row stays unavailable.

Click a source button or **Inspect full passage** to open the complete stored quotation in **Evidence & limitations**, together with its paper link and passage ID. The preview can be shortened, but the inspector shows the supporting passage.

This is a local text comparison, not a claim of scientific agreement, equivalent methods or contradictory findings. A term not seen in the retrieved bodies may appear in omitted material or use different wording. Shared vocabulary alone does not establish a connection, and a missing matrix cell does not establish that the original paper lacks that aspect.

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

## Find possible research-gap leads

Click **Find gap leads** in **Possible research gap leads** at any time. The button is always usable: with no selected papers, it opens a selection guide and **Go to papers** action rather than remaining disabled. A field or question can help order leads but is **not required to run this free scan**.

Select at least one relevant source with imported body text. **Evidence to scan** defaults to **Retrieved article body only**. Abstracts are excluded unless you deliberately choose **Include abstracts too — limited evidence**; abstract leads remain labelled. If none of the selected papers has body text, the panel says that no article-body scan ran and offers **Retrieve selected article text** for supported records. It does not turn missing body text into an abstract-based result.

The free local scan looks for explicit author-stated signals of:

- A reported limitation of a study.
- Proposed future work.
- An unresolved or unanswered question.

Background or introductory issues are flagged as potentially already addressed by the same paper and shown after nonbackground leads. Read that paper’s results first.

Each lead includes an exact signal sentence, its complete supporting passage, a stable passage ID, the source link, and whether it came from article-body text or an explicitly included abstract. Click **Inspect evidence** to open that stored quotation in the evidence inspector. Nonbackground leads are shown before introductory/background issues. Within that grouping, body-text leads are preferred to any deliberately included abstract-only leads; simple keyword overlap with your question and field helps order the remaining candidates. That ordering is **not a scientific confidence, importance or novelty score**.

This is a lexical scan of selected retrieved text, not AI scientific synthesis or an exhaustive review of the field. It can miss implicit gaps, unfamiliar phrasing, non-English signals and context, and it can surface statements about earlier work rather than a currently unresolved issue. The coverage summary shows how many selected sources have readable body text and how many do not, along with the chosen evidence scope. Leads update as additional text arrives. If nothing explicit is found, PaperBridge reports insufficient evidence rather than inventing a gap.

Click **Search for follow-up work** on a lead to run its visible follow-up terms through the free-paper search. Inspect newer and related work before treating the lead as a research opportunity: a limitation in one paper is not automatically a field-wide gap, and later studies may already answer the question. **Not finding a lead or a close search match does not establish absence or novelty.**

## Try the saved research example

**Explore saved example** opens a separate tab and leaves your live workspace alone. It includes four real OpenAlex records and an explicitly **manually prepared, within-field example in network ecology**, not a live AI response. The proposed sensitivity comparison is a hypothesis to investigate, not a confirmed research gap. Its original stored evidence is abstract-only, even though live search can retrieve more kinds of text.

Because the example’s original records are abstract-only, they may be hidden by the default retrieved-body search filter. This does not imply body text was imported. The saved hypothesis and its source quotations remain clearly labelled; explicitly include abstracts if you want the local scan to examine that limited evidence. Click the saved hypothesis to inspect source passages, possible-gap rationale, assumptions and unknowns. **Assess resources** initially returns **Unknown**. Adding `tripartite ecological networks` to **Available data** and reassessing demonstrates the conservative phrase match; writing `No tripartite ecological networks` instead demonstrates **Potential mismatch**. Edits immediately invalidate the previous assessment.

**Check related prior work** uses the live combined free-paper search. The visible queries and candidate overlaps do not establish novelty. A failed provider makes the search incomplete. The experiment section is a proposal, not an established protocol. **Export workspace**, when a saved or AI hypothesis is present, downloads sources, notes, analysis origin and the current assessment as JSON.

Reloading clears the browser workspace. The backend keeps bounded, temporary source and analysis caches for one hour; restarting it clears live cache entries. Search and reselect if sources expire. Saved-example loading is explicit and never replaces a failed live request.

## Optional AI gap hypotheses — spending approval required

Select **4–6 papers**, enter a research question and **one field**, then use **Develop AI gap hypotheses** only if an owner has configured and approved it. **No paid model requests were made while building this app.** Live AI calls remain disabled by default. A ChatGPT subscription does not pay for API calls.

Only after the project owner approves API spending:

1. Use an existing approved OpenAI API account/key. PaperBridge does not create accounts, buy credits or configure billing.
2. Store the key securely as a **server-side** `PAPERBRIDGE_MODEL_KEY`, or an existing `OPENAI_API_KEY` binding. Never put secrets in frontend files, `VITE_` variables, Git, screenshots, logs or chat.
3. Set server-side `ENABLE_LIVE_ANALYSIS=true` and optionally `PAPERBRIDGE_MODEL` (default `gpt-4.1-mini`). Allow outbound HTTPS to `api.openai.com`.
4. Restart `npm run dev` and reload the site. Developing gap hypotheses sends the field, question, resource notes and a bounded excerpt of selected source passages to OpenAI and may incur API charges.

For local development, copy `.env.example` to `.env` **only if `.env` does not already exist**, edit it privately, and leave the spending flag false until approved. `.env` files are ignored by Git. The frontend never receives the provider key.

The official OpenAI SDK uses structured output, a timeout, no automatic retries, and `store:false`. Provider retention policies still apply. Each paper's model input is bounded and labelled as an excerpt; do not assume all retrieved text was analyzed. Evidence references are validated against the passages actually submitted in that excerpt, not merely against every stored passage. Unknown or unsubmitted IDs, incomplete responses, refusals and provider failures are rejected explicitly. Possible gap hypotheses distinguish what the sources support, a cautious gap rationale, a proposed approach, assumptions, and what remains unknown. The absence of discussion in selected papers is not evidence that the field lacks an answer. Quotes are rendered from stored text, never invented model quotation strings. Valid references do not prove the model's interpretation is correct.

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

Tests cover source parsing, free access, duplicate grouping, source IDs, retrieval failures, actual imported-body filters, body-only reading, quoted comparison overviews, always-usable gap controls, one-field query suggestions, local gap-lead signals and limitations, excerpt evidence validation, model spending gates, prior-work outcomes and resource invalidation. Synthetic papers belong only in labelled automated tests. Check [docs/VALIDATION.md](docs/VALIDATION.md) for current results and untested cases; a mocked test is not a live-provider verification.

## Work as four teammates

| Teammate                        | Work independently in                                                                                                                                                                          | Responsibility                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1 — interface                   | `src/components/`, `src/styles.css`, reader/overview CSS                                                                                                                                       | Focus form, actual-text filters, reader/overview, evidence inspector and mobile layout.                                     |
| 2 — retrieval                   | `server/openalex.ts`, `server/sources/`, related tests                                                                                                                                         | Collection adapters, grouping, free copies, body extraction and provenance.                                                 |
| 3 — analysis/evidence           | `server/analysis.ts`, `server/evidence-validation.ts`, `shared/analysis-schema.ts`                                                                                                             | Optional within-field gap hypotheses and submitted-evidence checks; never enable spending without approval.                 |
| 4 — discovery/resources/testing | `shared/research-query.ts`, `shared/gaps.ts`, `shared/paper-filters.ts`, `shared/comparison-overview.ts`, `shared/comparison.ts`, `server/prior-work.ts`, `shared/resources.ts`, related tests | Editable queries, conservative gap scan, actual-text filtering, comparison rules, follow-up search, resource checks and QA. |

Coordinate before editing `shared/types.ts`, `server/app.ts` or `src/App.tsx`, which connect these modules. Give teammates separate branches. The implementation branch is `paperbridge-first-version`; changes are reviewed there without merging into `main` or deploying automatically.

## Remaining limits

- Searching several collections is not a search of every free paper or a systematic review. Synonyms, coverage gaps and source failures can hide relevant work.
- Local gap leads are exact author-stated issues identified by text cues, not confirmed field-wide gaps or scientific synthesis. Later work may already resolve them. A limitation or missing discussion alone does not establish novelty.
- Free access and preprint labels come from retrieved records, not a scientific or legal verification. Grouped versions can differ.
- Article-body prose is partial evidence. Missing images, tables, supplements, formulas and methods can change an interpretation.
- No scientific verification, numerical novelty score, guaranteed feasibility, accounts, database, uploads, custom training or automatic experiment execution.
- Resource fit is a conservative comparison of cited terms with user notes. Quantities, quality, equivalent terms, budgets, deadlines and ambiguous negation often remain **Unknown**.

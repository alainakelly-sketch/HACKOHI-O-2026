# PaperBridge

A first working research workspace for a one-day hackathon. Enter a question and two fields, search real scientific records, select 4–6 papers, inspect a proposed connection, check related prior work, and plan a small experiment.

**Abstracts are partial evidence. Connections and experiment plans are untested proposals.** Finding a passage does not establish that an interpretation is correct.

## Start here

You need **Node.js 22.12 or newer** (Node 24 is installed in the prepared cloud environment).

In a terminal:

```bash
cd /workspace/HACKOHI-O-2026
npm ci
npm run dev
```

`npm ci` installs the exact dependencies in the lockfile. `npm run dev` starts both the website on **port 5173** and the Node API on **port 3001**. Leave that terminal running. Press **Ctrl+C** to stop both.

### View it in this cloud environment

The cloud onboarding chat does **not** provide an interactive website preview. A localhost address printed in the remote terminal refers to the remote machine, not your computer.

If you open the project in a remote editor that supports forwarded ports, forward **5173**, then use that editor's **Open in browser** action. Only forward the website port; its `/api` requests are already forwarded internally to port 3001. Use the forwarded URL supplied by the editor. Do not type a remote machine's localhost address into your laptop browser.

Vite accepts `terminal.local` and localhost by default. If your editor's preview uses another hostname and Vite displays “Blocked request,” add the **specific trusted preview hostname** to `server.allowedHosts` in `vite.config.ts`, then restart. Do not disable host checks for all hosts.

If your environment has no forwarded-port feature, run it on your own computer:

1. Copy/download this working branch's project files. These changes have not been pushed to GitHub.
2. Install Node.js 22.12+ if needed.
3. Open a terminal in the copied folder and run `npm ci`, then `npm run dev`.
4. On that same computer, open **http://localhost:5173**.

The backend runs on loopback by default. Do not expose it directly or deploy this hackathon prototype as a public multi-user service without an authentication, abuse prevention, and privacy review.

## Try the complete workflow without a paid model

Click **Explore saved example**. It opens a separate tab and leaves your live workspace alone.

This example includes four **real OpenAlex records** and an explicitly **manually prepared analysis**. It is not an AI response. The checked titles, years, identifiers, links, abstracts, and retrieval dates are stored in `server/examples/network-ecology-papers.json`. No full text has been retrieved.

1. Click the proposed connection to inspect its source passages and limitations.
2. Click **Assess resources**. The initial result is honestly **Unknown**.
3. Add `tripartite ecological networks` to **Available data**, then click **Reassess resources**. The phrase comparison becomes **Appears compatible**, with the source passage and a warning that this is not a feasibility review.
4. Change that field to `No tripartite ecological networks`. The old assessment disappears immediately; reassessing shows **Potential mismatch**.
5. Click **Check related prior work** for a real OpenAlex search. Read the search terms and candidate overlaps; none of the outcomes establish novelty.
6. Review the first-experiment proposal. **Export workspace** downloads your sources, current notes, analysis origin, and any current assessment as JSON.

Reloading clears your workspace. The backend retains a bounded, temporary source/analysis cache for one hour; restarting it clears live selections. If sources expire, search and select them again. Example loading is explicit and never replaces a failed live request.

## Live paper search

Paper search works without model configuration. Search each field or a method separately; selected papers stay selected across searches. OpenAlex orders retrieved candidates by relevance. Titles, years, IDs and links come directly from retrieved records. Missing abstracts are labelled **Metadata only**; available abstracts are labelled **Abstract only**.

OpenAlex access can vary with its current API rules and your access tier. The backend supports optional server-side `OPENALEX_API_KEY` and `OPENALEX_EMAIL`. The tested environment successfully retrieved records without a key. A 401/403 or rate limit is reported; no records are invented as a fallback. Never paste a key into chat or put it in a `VITE_` variable.

Required network destination: `api.openalex.org`. Official documentation: [OpenAlex API documentation](https://developers.openalex.org/), [official documentation source](https://github.com/ourresearch/openalex-docs/blob/main/api-entities/works/search-works.md), and [abstract format](https://github.com/ourresearch/openalex-docs/blob/main/api-entities/works/work-object/README.md). Implementation uses `GET /works` with `search`, `per-page`, and `select`; the actual endpoint was tested. The current documentation website was inaccessible from this onboarding machine; the official source repository was consulted. API access and credentials may change independently of that source documentation.

## Optional live model analysis — spending approval required

**No paid model requests were made while building or testing this app.** Live model calls are disabled by default. A ChatGPT subscription does not pay for API calls.

Only after the project owner approves API spending:

1. Use an existing approved OpenAI API account/key. PaperBridge does not create accounts, buy credits or configure billing.
2. Store the key securely as a **server-side** `PAPERBRIDGE_MODEL_KEY`, or an existing `OPENAI_API_KEY` binding. Never put secrets in frontend files, `VITE_` variables, Git, screenshots, logs or chat.
3. Set server-side `ENABLE_LIVE_ANALYSIS=true` and optionally `PAPERBRIDGE_MODEL` (default `gpt-4.1-mini`). Ensure outbound HTTPS to `api.openai.com` is allowed.
4. Restart `npm run dev` and reload the website. A selected-paper analysis now sends your question, resource notes and selected abstracts to OpenAI. Clicking **Analyze selected papers** may incur API charges.

For local development, copy `.env.example` to `.env` **only if `.env` does not already exist**, edit it in your private editor, and leave `ENABLE_LIVE_ANALYSIS=false` until spending is approved. `.env` files are ignored by Git. The frontend uses same-origin `/api` calls and receives no provider key. Changing server environment settings requires a restart.

The server uses the official OpenAI Node SDK, the Responses API and structured output. Calls have no automatic retries, a timeout, and `store:false`. Other provider retention policies still apply. Upstream error bodies and credentials are not returned to the browser. Missing keys, refusals, invalid references and provider failures are explicit errors; no saved example is silently substituted.

## Checks

```bash
npm test             # Important logic/API tests; no paid calls
npm run typecheck    # Check TypeScript without generating files
npm run build        # Type check and build the website into dist/
npm start            # Serve the built website and API on port 3001
```

For development, prefer `npm run dev` with port 5173. For the built server in a remote editor, forward 3001 instead; it serves the compiled website and API together. Keep `HOST=127.0.0.1` unless your environment explicitly requires another binding.

Tests cover missing abstracts, empty searches, deduplication, rate limits, network failures, stable passage IDs, unknown IDs, model spending gates, mocked model errors, prior-work outcomes, secret boundaries, example labelling, and resource-assessment invalidation. Synthetic paper records occur only in automated test files. Browser QA details and remaining limits are in [docs/VALIDATION.md](docs/VALIDATION.md).

## Work as four teammates

| Teammate                         | Work independently in                                                                                         | Responsibility                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1 — workspace/interface          | `src/components/`, `src/styles.css`                                                                           | Question form, papers list, evidence readability, responsive layout.                              |
| 2 — paper retrieval              | `server/openalex.ts`, `server/openalex.test.ts`                                                               | OpenAlex queries, metadata, abstracts, source cache and IDs.                                      |
| 3 — analysis/evidence            | `server/analysis.ts`, `server/evidence-validation.ts`, `shared/analysis-schema.ts`, `server/analysis.test.ts` | Model prompt/SDK, structured output and citation checks. Do not enable spending without approval. |
| 4 — prior work/resources/testing | `server/prior-work.ts`, `shared/resources.ts`, related tests                                                  | Prior-work outcomes, conservative resource checks, integration QA.                                |

Agree together before editing `shared/types.ts`, `server/app.ts`, or `src/App.tsx`: these connect everyone's modules. Give each person their own branch. The implementation branch is `paperbridge-first-version`; nothing was merged, pushed, or deployed.

## What this version does not establish

- No scientific verification, novelty score, infection/clinical claims, or guaranteed feasibility.
- No full-text retrieval, accounts, database, uploads, custom training or automatic experiment execution.
- Matching IDs checks source existence, not truth or entailment. Model interpretations still need human review.
- Resource fit compares explicitly cited method phrases with resource notes. It cannot reason reliably about quantities, budgets, training, negation, equivalent terms or deadlines. Unmentioned resources stay **Unknown**.
- Prior-work checking runs two visible combination searches and lists the closest retrieved candidates. It is not a systematic review and can miss synonyms or related work.

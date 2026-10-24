# PaperBridge

Finds cross-field connections in research papers and drafts an evidence-backed, testable hypothesis.

## Run

1. Install Node 20 or newer.
2. `npm install`
3. `cp .env.example .env` and add your Anthropic API key.
4. `npm start`, then open http://localhost:3000

## How it works

1. Claude turns your question into one problem search and two method searches.
2. OpenAlex returns papers with abstracts.
3. Claude proposes a hypothesis using only those papers, with quoted evidence.
4. The server checks every quote against the real abstract and flags any that don't match.
5. A second OpenAlex search shows the closest existing work as a novelty check.

Limits: it reads abstracts only, OpenAlex coverage is incomplete, and outputs are hypotheses for you to verify.

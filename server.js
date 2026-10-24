import express from "express";

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.MODEL || "gemini-2.5-flash";
const MAIL = process.env.OPENALEX_EMAIL || "";
if (!KEY) console.warn("Missing GEMINI_API_KEY. Copy .env.example to .env and fill it in.");

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static("public"));

// Ask Gemini for JSON and parse it.
async function llm(system, user) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 },
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || "LLM request failed");
  const text = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("The model did not return JSON. Try again.");
  return JSON.parse(text.slice(s, e + 1));
}

// OpenAlex stores abstracts as {word: [positions]}. Rebuild the text.
const rebuild = (inv) => {
  if (!inv) return "";
  const w = [];
  for (const [word, pos] of Object.entries(inv)) for (const p of pos) w[p] = word;
  return w.filter(Boolean).join(" ");
};

async function openalex(q, n = 8) {
  const u = new URL("https://api.openalex.org/works");
  u.searchParams.set("search", q);
  u.searchParams.set("per-page", n);
  u.searchParams.set("filter", "has_abstract:true");
  u.searchParams.set("select", "id,title,publication_year,doi,abstract_inverted_index,cited_by_count");
  if (MAIL) u.searchParams.set("mailto", MAIL);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`OpenAlex returned ${r.status}`);
  const { results } = await r.json();
  return results.map((w) => ({
    id: w.id.split("/").pop(), title: w.title, year: w.publication_year,
    url: w.doi || w.id, cites: w.cited_by_count, abstract: rebuild(w.abstract_inverted_index),
  }));
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const slim = ({ abstract, ...p }) => p;

app.post("/api/discover", async (req, res) => {
  try {
    const question = String(req.body.question || "").trim().slice(0, 400);
    const fields = (req.body.fields || []).slice(0, 6).map(String);
    if (!question) return res.status(400).json({ error: "Enter a research question." });

    // 1. Plan searches: one for the problem, two for methods from other fields.
    const plan = await llm(
      'Return only JSON: {"problem_query":"...","method_queries":["...","..."]}. problem_query is a 3-6 keyword search for the research problem. method_queries are two 3-6 keyword searches for methods from OTHER fields that might help.',
      `Question: ${question}\nFields: ${fields.join(", ")}`
    );

    // 2. Retrieve papers from OpenAlex.
    const [A, ...rest] = await Promise.all([
      openalex(plan.problem_query, 8),
      ...(plan.method_queries || []).slice(0, 2).map((q) => openalex(q, 5)),
    ]);
    const aIds = new Set(A.map((p) => p.id));
    const B = [...new Map(rest.flat().filter((p) => !aIds.has(p.id)).map((p) => [p.id, p])).values()];
    const all = new Map([...A, ...B].map((p) => [p.id, p]));

    // 3. Ask for a hypothesis grounded in those papers only.
    const listing = [...all.values()]
      .map((p) => `ID: ${p.id}\nTitle: ${p.title} (${p.year})\nAbstract: ${p.abstract.slice(0, 700)}`)
      .join("\n\n");
    const analysis = await llm(
      `You help researchers find cross-field connections. Use ONLY the papers provided. Return only JSON:
{"hypothesis":"","why":"","connections":[{"paperA":"id","paperB":"id","transfer":"what could transfer and what might not","evidence":[{"paper":"id","quote":"verbatim text from that paper's abstract, max 25 words"}]}],"contradictions":[""],"speculative":[""],"novelty_query":"3-6 keywords describing the hypothesis","plan":{"question":"","data":"","method":"","evaluation":"","falsification":""}}
Rules: quotes must be copied exactly from the abstracts shown. Use only the given IDs. Call it a hypothesis, never an established finding. If the papers support no sensible connection, set hypothesis to "" and explain in why.`,
      `Research question: ${question}\n\nPapers:\n${listing}`
    );

    // 4. Verify quotes against the real abstracts and attach paper details.
    analysis.connections = (analysis.connections || [])
      .filter((c) => all.has(c.paperA) && all.has(c.paperB))
      .map((c) => ({
        ...c,
        paperA: slim(all.get(c.paperA)),
        paperB: slim(all.get(c.paperB)),
        evidence: (c.evidence || []).filter((e) => all.has(e.paper)).map((e) => ({
          quote: e.quote,
          paper: slim(all.get(e.paper)),
          verified: norm(all.get(e.paper).abstract).includes(norm(e.quote || "")),
        })),
      }));

    // 5. Novelty check: closest existing work to the hypothesis.
    let novelty = [];
    if (analysis.hypothesis && analysis.novelty_query) {
      try { novelty = (await openalex(analysis.novelty_query, 5)).map(slim); } catch {}
    }

    res.json({ papersA: A.map(slim), papersB: B.map(slim), analysis, novelty });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong." });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("PaperBridge running on http://localhost:" + (process.env.PORT || 3000)));
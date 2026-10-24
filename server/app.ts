import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { createPaperStore } from './openalex';
import { createCombinedSearch } from './sources/combined';
import { createFullTextRetriever } from './sources/fulltext';
import { analyze, analysisAvailability } from './analysis';
import { AppError } from './errors';
import { codespaceHost } from './config';
import { resolveCitation } from '../shared/evidence';
import { checkPriorWork, checkManualPriorWork } from './prior-work';
import {
  exampleAnalysis,
  exampleBrief,
  examplePapers,
} from './examples/network-ecology';
import type {
  Analysis,
  Brief,
  Hypothesis,
  Paper,
  SearchResult,
  ResearchLeadContext,
} from '../shared/types';
const short = z.string().trim().max(1200);
const briefSchema = z.object({
  question: short.min(5),
  field: short.min(2).max(100),
  resources: z.object({
    data: short,
    equipment: short,
    skills: short,
    deadline: short,
  }),
});
const selectionSchema = z
  .object({
    brief: briefSchema,
    lead: z
      .object({
        question: short.min(5),
        reason: z.string().max(4000),
        evidence: z
          .array(
            z.object({
              paperId: z.string().min(1).max(120),
              passageId: z.string().min(1).max(250),
            }),
          )
          .min(1)
          .max(12),
      })
      .optional(),
    paperIds: z
      .array(z.string().regex(/^[A-Za-z0-9_.:-]{1,120}$/))
      .min(4)
      .max(6),
  })
  .refine(
    (x) => new Set(x.paperIds).size === x.paperIds.length,
    'Select distinct papers.',
  );
export function createApp(
  deps: {
    search?: (q: string) => Promise<SearchResult>;
    analyze?: (
      brief: Brief,
      papers: Paper[],
      lead?: ResearchLeadContext,
    ) => Promise<Analysis>;
    retrieveFullText?: (paper: Paper) => Promise<Paper>;
    development?: boolean;
  } = {},
) {
  const app = express();
  const search = deps.search ?? createCombinedSearch();
  const retrieveFullText = deps.retrieveFullText ?? createFullTextRetriever();
  const paperStore = createPaperStore();
  const analyses = new Map<
    string,
    { result: Analysis; brief: Brief; expires: number }
  >();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // No cross-origin API usage. Vite proxies same-origin browser requests.
    const origin = req.headers.origin;
    if (origin) {
      try {
        const parsed = new URL(origin);
        const forwardedWebsites = [
          codespaceHost(5173),
          ...(!deps.development
            ? [codespaceHost(Number(process.env.PORT || 3001))]
            : []),
        ].filter(Boolean);
        if (
          parsed.host !== req.headers.host &&
          !(
            parsed.protocol === 'https:' &&
            forwardedWebsites.includes(parsed.host)
          )
        )
          throw new Error();
      } catch {
        res
          .status(403)
          .json({ error: 'Cross-origin API requests are not allowed.' });
        return;
      }
    }
    next();
  });
  let requests: number[] = [];
  app.use('/api', (_req, res, next) => {
    const now = Date.now();
    requests = requests.filter((t) => now - t < 60000);
    if (requests.length >= 90) {
      res
        .status(429)
        .json({ error: 'Too many requests. Please wait a minute.' });
      return;
    }
    requests.push(now);
    next();
  });
  app.get('/api/health', (_req, res) => {
    const status = analysisAvailability();
    res.json({
      analysisAvailable: status.available,
      analysisState: status.state,
      reason: status.reason,
      openalexKeyConfigured: !!process.env.OPENALEX_API_KEY,
    });
  });
  app.get('/api/example', (_req, res) => {
    const analysisId = crypto.randomUUID();
    if (analyses.size >= 100) analyses.delete(analyses.keys().next().value!);
    analyses.set(analysisId, {
      result: exampleAnalysis,
      brief: exampleBrief,
      expires: Date.now() + 3600000,
    });
    paperStore.put(examplePapers);
    res.json({
      analysisId,
      result: exampleAnalysis,
      brief: exampleBrief,
      papers: examplePapers,
    });
  });
  app.get('/api/search', async (req, res) => {
    const query = z.string().trim().min(2).max(400).parse(req.query.q);
    const result = await search(query);
    paperStore.put(result.papers);
    res.json({
      ...result,
      papers: paperStore.get(result.papers.map((p) => p.id)),
    });
  });
  const fullTextRequests = new Map<string, Promise<Paper>>();
  app.post('/api/papers/:paperId/fulltext', async (req, res) => {
    const id = z
      .string()
      .regex(/^[A-Za-z0-9_.:-]{1,120}$/)
      .parse(req.params.paperId);
    const [paper] = paperStore.get([id]);
    let pending = fullTextRequests.get(id);
    if (!pending) {
      pending = retrieveFullText(paper);
      fullTextRequests.set(id, pending);
    }
    try {
      const result = await pending;
      paperStore.put([result]);
      res.json(result);
    } finally {
      if (fullTextRequests.get(id) === pending) fullTextRequests.delete(id);
    }
  });
  app.post('/api/analyze', async (req, res) => {
    const { brief, paperIds, lead } = selectionSchema.parse(req.body);
    const papers = paperStore.get(paperIds);
    if (lead) {
      try {
        for (const reference of lead.evidence) {
          const { passage } = resolveCitation(reference, papers);
          if (!passage.text.trim()) throw new Error('Empty source text');
        }
      } catch {
        throw new AppError(
          400,
          'The research lead references unavailable or unselected source text. Select its source papers again before developing a hypothesis.',
        );
      }
    }
    const result = await (deps.analyze ?? analyze)(brief, papers, lead);
    const analysisId = crypto.randomUUID();
    if (analyses.size >= 100) analyses.delete(analyses.keys().next().value!);
    analyses.set(analysisId, { result, brief, expires: Date.now() + 3600000 });
    res.json({ analysisId, result, sources: papers });
  });
  app.post('/api/prior-work/search', async (req, res) => {
    const input = z
      .object({
        question: z.string().trim().min(2).max(400),
        field: z.string().trim().max(100).optional().default(''),
      })
      .strict()
      .safeParse(req.body);
    if (!input.success)
      throw new AppError(
        400,
        'Enter a prior-work question or search phrase between 2 and 400 characters, and a field of at most 100 characters.',
      );
    res.json(
      await checkManualPriorWork(input.data.question, input.data.field, search),
    );
  });
  app.post('/api/prior-work', async (req, res) => {
    const { analysisId, hypothesisId } = z
      .object({
        analysisId: z.string().uuid(),
        hypothesisId: z.string().max(40),
      })
      .parse(req.body);
    const analysis = analyses.get(analysisId);
    if (!analysis || analysis.expires < Date.now())
      throw new AppError(
        409,
        'Analysis expired. Analyze your selected papers again.',
      );
    const hypothesis: Hypothesis | undefined = analysis.result.hypotheses.find(
      (h) => h.id === hypothesisId,
    );
    if (!hypothesis) throw new AppError(400, 'Unknown gap hypothesis.');
    res.json(await checkPriorWork(analysis.brief, hypothesis, search));
  });
  const dist = path.resolve('dist');
  if (deps.development || !existsSync(dist))
    app.get('/', (_req, res) => {
      const website = codespaceHost(5173);
      if (website) {
        res.redirect(302, `https://${website}/`);
        return;
      }
      res
        .type('html')
        .send(
          '<!doctype html><html lang="en"><meta charset="utf-8"><title>PaperBridge backend</title><main style="font:18px system-ui;padding:40px;line-height:1.7"><h1>Open the PaperBridge website on port 5173</h1><p>This is the backend on port 3001. Return to your editor, open the Ports tab, and open port 5173.</p><p>Start both services with <code>npm run dev</code>.</p></main></html>',
        );
    });
  if (!deps.development && existsSync(dist)) app.use(express.static(dist));
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error:
            'Please check your input. Provide a question, one field, and 4–6 distinct papers when analyzing.',
        });
        return;
      }
      if (err instanceof AppError) {
        res.status(err.status).json({
          error: err.message,
          ...(err.cost ? { cost: err.cost } : {}),
        });
        return;
      }
      if (
        err &&
        typeof err === 'object' &&
        'status' in err &&
        (err.status === 400 || err.status === 413)
      ) {
        res
          .status(err.status)
          .json({ error: 'Request is malformed or too large.' });
        return;
      }
      res.status(500).json({
        error: 'The request could not be completed. Please try again.',
      });
    },
  );
  return app;
}

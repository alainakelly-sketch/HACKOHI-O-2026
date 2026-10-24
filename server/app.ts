import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { createOpenAlex, createPaperStore } from './openalex';
import { analyze, analysisAvailability } from './analysis';
import { AppError } from './errors';
import { checkPriorWork } from './prior-work';
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
} from '../shared/types';
const short = z.string().trim().max(1200);
const briefSchema = z.object({
  question: short.min(5),
  fieldA: short.min(2).max(100),
  fieldB: short.min(2).max(100),
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
    paperIds: z
      .array(z.string().regex(/^W\d+$/))
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
    analyze?: (brief: Brief, papers: Paper[]) => Promise<Analysis>;
  } = {},
) {
  const app = express();
  const search = deps.search ?? createOpenAlex();
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
        if (new URL(origin).host !== req.headers.host) throw new Error();
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
    res.json(result);
  });
  app.post('/api/analyze', async (req, res) => {
    const { brief, paperIds } = selectionSchema.parse(req.body);
    const papers = paperStore.get(paperIds);
    const result = await (deps.analyze ?? analyze)(brief, papers);
    const analysisId = crypto.randomUUID();
    if (analyses.size >= 100) analyses.delete(analyses.keys().next().value!);
    analyses.set(analysisId, { result, brief, expires: Date.now() + 3600000 });
    res.json({ analysisId, result, sources: papers });
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
    if (!hypothesis) throw new AppError(400, 'Unknown connection.');
    res.json(await checkPriorWork(analysis.brief, hypothesis, search));
  });
  const dist = path.resolve('dist');
  if (existsSync(dist)) app.use(express.static(dist));
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
            'Please check your input. Provide a question, two fields, and 4–6 distinct papers when analyzing.',
        });
        return;
      }
      if (err instanceof AppError) {
        res.status(err.status).json({ error: err.message });
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

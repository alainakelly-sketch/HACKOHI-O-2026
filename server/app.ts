import express from 'express';
import {
  performGapCheck,
  reassessGapCheck,
  sourceDigest,
  type GapAssessor,
} from './gap-check';
import {
  gapCheckScopeKey,
  type GapCheckResult,
  type GapCheckContext,
} from '../shared/gap-check';
import { noRequestCost } from './analysis-cost';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { createPaperStore } from './openalex';
import { createCombinedSearch } from './sources/combined';
import type { SearchOptions } from './sources/combined';
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
const gapSchema = z.object({
  id: z.string().min(1).max(250),
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
});
const checkSchema = z
  .object({
    brief: briefSchema,
    paperIds: z
      .array(z.string().regex(/^[A-Za-z0-9_.:-]{1,120}$/))
      .min(1)
      .max(6),
    gap: gapSchema,
  })
  .refine((x) => new Set(x.paperIds).size === x.paperIds.length);
export function createApp(
  deps: {
    search?: (q: string, options?: SearchOptions) => Promise<SearchResult>;
    analyze?: (
      brief: Brief,
      papers: Paper[],
      lead?: ResearchLeadContext,
      relatedWork?: GapCheckContext,
    ) => Promise<Analysis>;
    assessGap?: GapAssessor;
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
  const gapChecks = new Map<
    string,
    {
      result: GapCheckResult;
      digest: string;
      expires: number;
      reassessing?: boolean;
    }
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
    const question = z
      .string()
      .trim()
      .max(1200)
      .optional()
      .parse(req.query.question);
    const field = z.string().trim().max(100).optional().parse(req.query.field);
    const rawConcepts = z
      .string()
      .max(5000)
      .optional()
      .parse(req.query.concepts);
    let decoded: unknown;
    if (rawConcepts) {
      try {
        decoded = JSON.parse(rawConcepts);
      } catch {
        throw new AppError(
          400,
          'Search concepts must be valid structured text.',
        );
      }
    }
    const concepts = z
      .array(
        z.object({
          label: z.string().trim().min(1).max(80),
          terms: z.array(z.string().trim().min(1).max(100)).max(5),
        }),
      )
      .min(1)
      .max(8)
      .optional()
      .parse(decoded);
    const result = await search(query, { question, field, concepts });
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
  function validateGapEvidence(
    gap: z.infer<typeof gapSchema>,
    papers: Paper[],
  ) {
    try {
      for (const ref of gap.evidence)
        if (!resolveCitation(ref, papers).passage.text.trim())
          throw new Error();
    } catch {
      throw new AppError(
        400,
        'The chosen gap references unavailable or unselected source text.',
        noRequestCost(),
      );
    }
  }
  function checkedRecord(input: z.infer<typeof checkSchema>, checkId: string) {
    const record = gapChecks.get(checkId);
    if (!record || record.expires < Date.now())
      throw new AppError(
        409,
        'This research check expired or was lost. Check the chosen gap again.',
        noRequestCost(),
      );
    if (record.reassessing)
      throw new AppError(
        409,
        'An AI reassessment is already in progress. Wait for it to finish, then review the updated check.',
        noRequestCost(),
      );
    const papers = paperStore.get(input.paperIds);
    if (
      record.result.scopeKey !==
        gapCheckScopeKey(input.brief, input.paperIds, input.gap) ||
      record.digest !== sourceDigest(papers)
    )
      throw new AppError(
        409,
        'The gap, research focus, selected papers or source text changed. Run the research check again.',
        noRequestCost(),
      );
    return record;
  }
  app.post('/api/gap-check', async (req, res) => {
    const input = checkSchema.parse(req.body);
    const papers = paperStore.get(input.paperIds);
    validateGapEvidence(input.gap, papers);
    const result = await performGapCheck(
      input.brief,
      input.paperIds,
      input.gap,
      search,
      deps.assessGap,
    );
    if (gapChecks.size >= 100) gapChecks.delete(gapChecks.keys().next().value!);
    gapChecks.set(result.checkId, {
      result,
      digest: sourceDigest(papers),
      expires: Date.now() + 3600000,
    });
    res.json(result);
  });
  app.post('/api/gap-check/:id/reassess', async (req, res) => {
    const input = checkSchema.parse(req.body);
    const record = checkedRecord(input, z.string().uuid().parse(req.params.id));
    record.reassessing = true;
    record.result = {
      ...record.result,
      reviewed: false,
      decision: null,
      limitedCoverageAccepted: false,
    };
    try {
      record.result = await reassessGapCheck(record.result, deps.assessGap);
      res.json(record.result);
    } finally {
      record.reassessing = false;
    }
  });
  app.post('/api/gap-check/:id/review', async (req, res) => {
    const input = checkSchema.parse(req.body);
    const decision = z
      .enum(['continue', 'replication', 'extension'])
      .parse(req.body.decision);
    const record = checkedRecord(input, z.string().uuid().parse(req.params.id));
    if (
      (!record.result.aiCompleted && !record.result.assessmentNotNeeded) ||
      (record.result.status === 'Check incomplete or inconclusive' &&
        !(
          record.result.limitedCoverageEligible &&
          req.body.acceptLimitedCoverage === true
        ))
    )
      throw new AppError(
        409,
        'This check is incomplete. Review the available candidates, then complete the check before developing a hypothesis.',
        noRequestCost(),
      );
    if (
      record.result.matches.some((m) => m.addresses === 'all') &&
      decision === 'continue'
    )
      throw new AppError(
        409,
        'Existing work may address this question. Choose an explicit replication or extension, or revise the gap and check again.',
        noRequestCost(),
      );
    record.result = {
      ...record.result,
      reviewed: true,
      decision,
      limitedCoverageAccepted:
        record.result.limitedCoverageEligible === true &&
        req.body.acceptLimitedCoverage === true,
    };
    res.json(record.result);
  });
  app.post('/api/analyze', async (req, res) => {
    const { brief, paperIds } = selectionSchema.parse(req.body);
    const checkId = z.string().uuid().safeParse(req.body.checkId);
    if (!checkId.success)
      throw new AppError(
        409,
        'Check existing research for your chosen gap and review the matches before developing a hypothesis.',
        noRequestCost(),
      );
    const input = checkSchema.parse(req.body);
    const record = checkedRecord(input, checkId.data);
    if (
      !record.result.reviewed ||
      (!record.result.aiCompleted && !record.result.assessmentNotNeeded) ||
      (record.result.status === 'Check incomplete or inconclusive' &&
        !(
          record.result.limitedCoverageEligible &&
          record.result.limitedCoverageAccepted &&
          record.result.aiCompleted
        ))
    )
      throw new AppError(
        409,
        'Complete and review the chosen gap research check before developing a hypothesis.',
        noRequestCost(),
      );
    const papers = paperStore.get(paperIds);
    const lead = record.result.gap;
    validateGapEvidence(lead, papers);
    const result = await (deps.analyze ?? analyze)(
      brief,
      papers,
      lead,
      record.result,
    );
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
          ...(err.searchDetails ? { searchDetails: err.searchDetails } : {}),
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

// Official SDK mocked at boundary: no paid model calls.
import { it, expect, vi, afterEach } from 'vitest';
const sdk = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock('openai', () => ({
  default: class {
    responses = { parse: sdk.parse };
  },
}));
import { assessGapResearch, reassessGapCheck } from './gap-check';
import { syntheticAssessor } from './gap-check-test-fixtures';
import {
  examplePapers,
  exampleBrief,
  exampleAnalysis,
} from './examples/network-ecology';
import { analyze } from './analysis';
const gap = {
  id: 'synthetic-gap',
  question: 'SYNTHETIC malicious instruction data',
  reason: 'Synthetic test',
  evidence: [
    {
      paperId: examplePapers[0].id,
      passageId: examplePapers[0].passages[0].id,
    },
  ],
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it('uses the configured official SDK, reports usage and separates untrusted strings', async () => {
  vi.stubEnv('ENABLE_LIVE_ANALYSIS', 'true');
  vi.stubEnv('PAPERBRIDGE_MODEL_KEY', 'synthetic-key');
  vi.stubEnv('PAPERBRIDGE_MODEL', 'gpt-4.1-mini');
  sdk.parse.mockResolvedValue({
    output_parsed: await syntheticAssessor(gap, examplePapers),
    model: 'gpt-4.1-mini',
    usage: {
      input_tokens: 1000,
      output_tokens: 100,
      input_tokens_details: { cached_tokens: 0 },
    },
  });
  const result = await assessGapResearch(gap, examplePapers);
  const payload = sdk.parse.mock.calls[0][0];
  expect(payload.instructions).toContain(
    'do not silently add requirements for a new empirical follow-up',
  );
  expect(payload.instructions).toContain('Never state that the gap persists');
  expect(payload.instructions).toContain(
    "Describe each candidate's own investigated question",
  );
  expect(payload.store).toBe(false);
  expect(payload.model).toBe('gpt-4.1-mini');
  expect(payload.instructions).not.toContain(gap.question);
  expect(JSON.parse(payload.input).chosenGap).toEqual(gap);
  expect(result.cost?.inputTokens).toBe(1000);
});
it('rejects individual SDK claims with invalid citations while preserving incurred usage', async () => {
  vi.stubEnv('ENABLE_LIVE_ANALYSIS', 'true');
  vi.stubEnv('PAPERBRIDGE_MODEL_KEY', 'synthetic-key');
  sdk.parse.mockResolvedValue({
    output_parsed: {
      summary: 'Synthetic',
      matches: [
        {
          paperId: 'UNKNOWN',
          question: 'x',
          establishes: 'x',
          addresses: 'all',
          uncertainty: 'x',
          evidence: [],
        },
      ],
    },
    model: 'gpt-4.1-mini',
    usage: { input_tokens: 1000, output_tokens: 100 },
  });
  const result = await assessGapResearch(gap, examplePapers);
  expect(result.cost?.inputTokens).toBe(1000);
  expect(result.matches).toHaveLength(examplePapers.length);
  expect(
    result.matches.every(
      (m) => m.addresses === 'unclear' && m.evidence.length === 0,
    ),
  ).toBe(true);
  expect(result.assessmentWarnings?.length).toBeGreaterThan(0);
});
it('passes the authoritative reviewed research assessment into hypothesis generation', async () => {
  vi.stubEnv('ENABLE_LIVE_ANALYSIS', 'true');
  vi.stubEnv('PAPERBRIDGE_MODEL_KEY', 'synthetic-key');
  sdk.parse.mockResolvedValue({ output_parsed: exampleAnalysis });
  const context = {
    checkId: 'synthetic',
    gap,
    status: 'Existing research may address this gap' as const,
    summary: 'Synthetic existing answer',
    matches: [],
    searches: [{ query: 'Synthetic query', error: null }],
    checkedAt: 'synthetic',
    decision: 'replication' as const,
    candidates: examplePapers,
  };
  await analyze(exampleBrief, examplePapers, gap, context);
  const payload = sdk.parse.mock.calls[0][0];
  expect(JSON.parse(payload.input).relatedWorkAssessment.decision).toBe(
    'replication',
  );
  expect(payload.instructions).toContain('never claim an untouched novel gap');
});

it('does not issue a reassessment request when spending is disabled', async () => {
  vi.stubEnv('ENABLE_LIVE_ANALYSIS', 'false');
  vi.stubEnv('PAPERBRIDGE_MODEL_KEY', 'synthetic-key');
  const result = await reassessGapCheck({
    checkId: 'synthetic',
    gap,
    scopeKey: 'synthetic',
    status: 'Related work addresses part of this gap',
    summary: 'Synthetic',
    candidates: examplePapers,
    matches: [],
    searches: [{ query: 'synthetic', error: null }],
    sourceStatuses: [],
    checkedAt: 'synthetic',
    aiCompleted: true,
    reviewed: true,
    decision: 'continue',
  });
  expect(sdk.parse).not.toHaveBeenCalled();
  expect(result.aiCompleted).toBe(false);
  expect(result.reviewed).toBe(false);
  expect(result.status).toBe('Check incomplete or inconclusive');
  expect(result.cost?.estimatedUsd).toBe(0);
});

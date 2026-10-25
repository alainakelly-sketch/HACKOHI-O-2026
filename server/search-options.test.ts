/** SYNTHETIC API fixtures only. No provider or paid model calls. */
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { AppError } from './errors';
import { createPaperStore, normalizeWork } from './openalex';
import type { QueryPlan } from '../shared/types';
const plan: QueryPlan = {
  question: 'How does music affect time perception?',
  concepts: [
    { label: 'music', terms: ['music'] },
    {
      label: 'time perception',
      terms: ['time perception', 'duration estimates'],
    },
  ],
  variants: ['music time perception'],
  note: 'Synthetic interpretation',
};
describe('question-preserving search API', () => {
  it('passes validated question and edited concepts without overwriting the question', async () => {
    const search = vi.fn(async () => ({
      query: 'test',
      papers: [],
      retrievedAt: 'synthetic',
      queryPlan: plan,
    }));
    const response = await request(createApp({ search }))
      .get('/api/search')
      .query({
        q: 'music duration estimates',
        question: plan.question,
        field: 'psychology',
        concepts: JSON.stringify(plan.concepts),
      });
    expect(response.status).toBe(200);
    expect(search).toHaveBeenCalledWith('music duration estimates', {
      question: plan.question,
      field: 'psychology',
      concepts: plan.concepts,
    });
    expect(response.body.queryPlan.question).toBe(plan.question);
  });
  it.each([
    'not-json',
    JSON.stringify([{ label: 'music', terms: Array(6).fill('term') }]),
    JSON.stringify([]),
  ])('rejects malformed or excessive concept overrides', async (concepts) => {
    const search = vi.fn();
    const response = await request(createApp({ search }))
      .get('/api/search')
      .query({ q: 'music', concepts });
    expect(response.status).toBe(400);
    expect(search).not.toHaveBeenCalled();
  });
  it('retains safe performed-query diagnostics when all providers fail', async () => {
    const details = {
      queryPlan: plan,
      sourceStatuses: [
        {
          source: 'OpenAlex' as const,
          status: 'error' as const,
          count: 0,
          message: 'Synthetic rate limit',
        },
      ],
      performedQueries: [
        {
          source: 'OpenAlex' as const,
          query: 'music time perception',
          status: 'error' as const,
          message: 'Synthetic rate limit',
        },
      ],
    };
    const app = createApp({
      search: async () => {
        throw new AppError(
          502,
          'Synthetic provider failure',
          undefined,
          details,
        );
      },
    });
    const response = await request(app).get('/api/search?q=music');
    expect(response.status).toBe(502);
    expect(response.body.searchDetails).toEqual(details);
    expect(response.body.cost).toBeUndefined();
  });
  it('refreshes question relevance while preserving previously imported body text', () => {
    const store = createPaperStore();
    const paper = normalizeWork({
      id: 'https://openalex.org/W76543',
      display_name: 'SYNTHETIC TITLE',
      abstract_inverted_index: { Synthetic: [0], abstract: [1] },
    })!;
    const relevance = {
      classification: 'Relevance unclear' as const,
      explanation: 'Synthetic old focus',
      matchedConcepts: [],
      missingConcepts: [],
      evidence: [],
    };
    const loaded = {
      ...paper,
      relevance,
      coverage: 'Full text retrieved' as const,
      fullText: {
        provider: 'Europe PMC' as const,
        url: paper.url,
        license: null,
        retrievedAt: 'synthetic',
        truncated: false,
        note: 'Synthetic body',
      },
      passages: [
        {
          id: 'synthetic-body',
          text: 'SYNTHETIC stored body.',
          kind: 'full-text' as const,
        },
      ],
    };
    store.put([loaded]);
    const next = { ...relevance, explanation: 'Synthetic changed focus' };
    store.put([{ ...paper, relevance: next }]);
    const [retained] = store.get([paper.id]);
    expect(retained.fullText).toEqual(loaded.fullText);
    expect(retained.passages).toEqual(loaded.passages);
    expect(retained.relevance).toEqual(next);
  });
});

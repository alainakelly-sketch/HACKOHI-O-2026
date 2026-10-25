// Explicit synthetic fixtures and injected analyzer; no paid/live model request.
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { reviewedCheck, syntheticAssessor } from './gap-check-test-fixtures';
import { createApp } from './app';
import { normalizeWork } from './openalex';
import type { Analysis } from '../shared/types';
const papers = Array.from({ length: 5 }, (_, index) =>
  normalizeWork({
    id: `https://openalex.org/W${index + 1}`,
    display_name: `SYNTHETIC LEAD TEST ${index}`,
    abstract_inverted_index: { Synthetic: [0], source: [1], text: [2] },
  })!,
);
const brief = {
  question: 'Synthetic research question',
  field: 'Synthetic field',
  resources: { data: '', equipment: '', skills: '', deadline: '' },
};
const output: Analysis = {
  origin: 'live',
  status: 'insufficient',
  summary: 'Synthetic test result',
  hypotheses: [],
};
const validLead = {
  question: 'Synthetic lead question',
  reason: 'SYNTHETIC reasoning only; not a scientific claim.',
  evidence: [{ paperId: papers[0].id, passageId: papers[0].passages[0].id }],
};
async function setup() {
  const analyze = vi.fn().mockResolvedValue(output);
  const app = createApp({
    analyze,
    assessGap: syntheticAssessor,
    search: async () => ({ papers, query: 'synthetic', retrievedAt: 'test' }),
  });
  await request(app).get('/api/search?q=synthetic');
  return { app, analyze };
}
describe('selected-source research lead API validation', () => {
  it('passes validated lead context to analyzer with selected stored papers', async () => {
    const { app, analyze } = await setup();
    const response = await request(app)
      .post('/api/analyze')
      .send({
        ...(await reviewedCheck(app, brief, papers.slice(0, 4), {
          id: 'synthetic-lead',
          ...validLead,
        })),
      });
    expect(response.status).toBe(200);
    expect(analyze.mock.calls[0][2]).toEqual({
      id: 'synthetic-lead',
      ...validLead,
    });
  });
  it('rejects unknown passage and nonselected paper references before model calls', async () => {
    for (const evidence of [
      [{ paperId: papers[0].id, passageId: 'UNKNOWN_TEST_PASSAGE' }],
      [{ paperId: papers[4].id, passageId: papers[4].passages[0].id }],
    ]) {
      const { app, analyze } = await setup();
      const response = await request(app)
        .post('/api/gap-check')
        .send({
          brief,
          paperIds: papers.slice(0, 4).map((p) => p.id),
          gap: { id: 'synthetic', ...validLead, evidence },
        });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('gap references');
      expect(analyze).not.toHaveBeenCalled();
    }
  });
  it('rejects missing evidence and oversized lead context', async () => {
    for (const lead of [
      { ...validLead, evidence: [] },
      { ...validLead, reason: 'x'.repeat(4001) },
      { ...validLead, question: 'x'.repeat(1201) },
    ]) {
      const { app, analyze } = await setup();
      const response = await request(app)
        .post('/api/analyze')
        .send({ brief, paperIds: papers.slice(0, 4).map((p) => p.id), lead });
      expect(response.status).toBe(400);
      expect(analyze).not.toHaveBeenCalled();
    }
  });
});

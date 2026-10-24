import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { AppError } from './errors';
import { noRequestCost } from './analysis-cost';
import { createApp } from './app';
import { normalizeWork } from './openalex';
import { analysisAvailability } from './analysis';
const papers = Array.from({ length: 4 }, (_, i) =>
  normalizeWork({
    id: `https://openalex.org/W${i + 1}`,
    display_name: `SYNTHETIC TEST ${i}`,
    abstract_inverted_index: { Synthetic: [0], abstract: [1] },
  })!,
);
const brief = {
  question: 'Synthetic test question',
  field: 'Synthetic test field',
  resources: { data: '', equipment: '', skills: '', deadline: '' },
};
afterEach(() => vi.unstubAllEnvs());
describe('API boundaries and credentials', () => {
  it('returns safe cost metadata on a failed analysis', async () => {
    const app = createApp({
      search: async () => ({ papers, query: 'test', retrievedAt: 'test' }),
      analyze: async () => {
        throw new AppError(503, 'Synthetic disabled request', noRequestCost());
      },
    });
    await request(app).get('/api/search?q=test');
    const response = await request(app)
      .post('/api/analyze')
      .send({ brief, paperIds: papers.map((p) => p.id) });
    expect(response.status).toBe(503);
    expect(response.body.cost.estimatedUsd).toBe(0);
    expect(response.body.cost.note).toContain('No model provider request');
  });

  it('starts with live analysis disabled and health never exposes keys', async () => {
    vi.stubEnv('PAPERBRIDGE_MODEL_KEY', 'synthetic-secret-test-only');
    vi.stubEnv('ENABLE_LIVE_ANALYSIS', 'false');
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.analysisAvailable).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('synthetic-secret');
  });
  it('requires both explicit spending enablement and credentials', () => {
    vi.stubEnv('ENABLE_LIVE_ANALYSIS', 'true');
    vi.stubEnv('PAPERBRIDGE_MODEL_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(analysisAvailability().available).toBe(false);
    vi.stubEnv('PAPERBRIDGE_MODEL_KEY', 'synthetic-test-only');
    expect(analysisAvailability().available).toBe(true);
  });
  it('validates empty and oversized search input', async () => {
    expect((await request(createApp()).get('/api/search?q=')).status).toBe(400);
    expect(
      (await request(createApp()).get(`/api/search?q=${'a'.repeat(401)}`))
        .status,
    ).toBe(400);
  });
  it('propagates useful failed-API states without leaking error internals', async () => {
    const app = createApp({
      search: vi
        .fn()
        .mockRejectedValue(new Error('sensitive upstream details')),
    });
    const res = await request(app).get('/api/search?q=test');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('sensitive');
  });
  it('rejects browser-invented source IDs before calling the model', async () => {
    const analyze = vi.fn();
    const res = await request(createApp({ analyze }))
      .post('/api/analyze')
      .send({ brief, paperIds: ['W1', 'W2', 'W3', 'W4'] });
    expect(res.status).toBe(409);
    expect(analyze).not.toHaveBeenCalled();
  });
  it('accepts a single research field without requiring a second field', async () => {
    const analyze = vi.fn().mockResolvedValue({
      origin: 'live',
      status: 'insufficient',
      summary: 'Synthetic source-supported uncertainty',
      hypotheses: [],
    });
    const app = createApp({
      search: async () => ({ query: 'test', papers, retrievedAt: 'test' }),
      analyze,
    });
    await request(app).get('/api/search?q=test');
    const res = await request(app)
      .post('/api/analyze')
      .send({ brief, paperIds: papers.map((p) => p.id) });
    expect(res.status).toBe(200);
    expect(analyze.mock.calls[0][0]).toEqual(brief);
    expect(analyze.mock.calls[0][0]).not.toHaveProperty('fieldB');
  });
  it('requires the one field rather than accepting only obsolete field A/B inputs', async () => {
    const { field: _field, ...rest } = brief;
    const res = await request(createApp())
      .post('/api/analyze')
      .send({
        brief: { ...rest, fieldA: 'Old A', fieldB: 'Old B' },
        paperIds: papers.map((p) => p.id),
      });
    expect(res.status).toBe(400);
  });
  it('rejects duplicate selected paper IDs', async () => {
    const res = await request(createApp())
      .post('/api/analyze')
      .send({ brief, paperIds: ['W1', 'W1', 'W1', 'W1'] });
    expect(res.status).toBe(400);
  });
  it('allows paper search without a model key', async () => {
    vi.stubEnv('ENABLE_LIVE_ANALYSIS', 'false');
    const search = vi
      .fn()
      .mockResolvedValue({ papers, query: 'test', retrievedAt: 'now' });
    const app = createApp({ search });
    const res = await request(app).get('/api/search?q=test');
    expect(res.status).toBe(200);
    expect(res.body.papers).toHaveLength(4);
    const analysis = await request(app)
      .post('/api/analyze')
      .send({ brief, paperIds: papers.map((p) => p.id) });
    expect(analysis.status).toBe(503);
  });
  it('accepts only source selections from server retrieval, no client source bodies', async () => {
    const analyze = vi.fn().mockResolvedValue({
      origin: 'live',
      status: 'insufficient',
      summary: 'Synthetic result',
      hypotheses: [],
    });
    const app = createApp({
      search: vi.fn().mockResolvedValue({ papers }),
      analyze,
    });
    await request(app).get('/api/search?q=test');
    const res = await request(app)
      .post('/api/analyze')
      .send({
        brief,
        paperIds: papers.map((p) => p.id),
        papers: [{ title: 'Fabricated' }],
      });
    expect(res.status).toBe(200);
    expect(analyze.mock.calls[0][1]).toEqual(papers);
  });
  it('rejects unrelated origins', async () => {
    const res = await request(createApp())
      .get('/api/health')
      .set('Origin', 'https://attacker.invalid');
    expect(res.status).toBe(403);
  });
  it('rejects unknown analysis IDs for prior-work checking', async () => {
    const res = await request(createApp())
      .post('/api/prior-work')
      .send({ analysisId: crypto.randomUUID(), hypothesisId: 'h1' });
    expect(res.status).toBe(409);
  });
});

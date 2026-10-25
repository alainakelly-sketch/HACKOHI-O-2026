// SYNTHETIC TEST DATA ONLY. No real network or paid model calls.
import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { reviewedCheck, syntheticAssessor } from './gap-check-test-fixtures';
import { createApp } from './app';
import { codespaceHost } from './config';
import type { Paper } from '../shared/types';
const paper: Paper = {
  id: 'PMC12345',
  title: 'SYNTHETIC PMC TEST',
  year: 2025,
  doi: null,
  url: 'https://europepmc.org/articles/PMC12345',
  authors: [],
  abstract: 'Synthetic abstract.',
  passages: [{ id: 'PMC12345:abstract:a:1', text: 'Synthetic abstract.' }],
  retrievedAt: '2026-01-01T00:00:00Z',
  coverage: 'Abstract only',
  identifiers: { pmcid: 'PMC12345' },
  freeCopies: [
    {
      url: 'https://europepmc.org/articles/PMC12345',
      via: 'Europe PMC',
      format: 'HTML',
    },
  ],
};
const loaded: Paper = {
  ...paper,
  coverage: 'Full text retrieved',
  fullText: {
    provider: 'Europe PMC',
    url: paper.url,
    license: null,
    truncated: false,
    retrievedAt: 'now',
    note: 'Test body only',
  },
  passages: [
    ...paper.passages,
    {
      id: 'PMC12345:full-text:test:1',
      text: 'Synthetic body.',
      kind: 'full-text',
      section: 'Methods',
    },
  ],
};
const search = async (q: string) => ({
  query: q,
  papers: [paper],
  retrievedAt: 'test',
});
afterEach(() => vi.unstubAllEnvs());
describe('full-text API source boundary', () => {
  it('rejects unknown source IDs rather than taking arbitrary client URLs', async () => {
    const retrieveFullText = vi.fn();
    const res = await request(createApp({ retrieveFullText }))
      .post('/api/papers/PMC999/fulltext')
      .send({ url: 'http://127.0.0.1/private' });
    expect(res.status).toBe(409);
    expect(retrieveFullText).not.toHaveBeenCalled();
  });
  it('retrieves from stored metadata, preserves loaded text across repeat searches', async () => {
    const retrieveFullText = vi.fn().mockResolvedValue(loaded);
    const app = createApp({ search, retrieveFullText });
    await request(app).get('/api/search?q=test');
    const res = await request(app)
      .post('/api/papers/PMC12345/fulltext')
      .send({ url: 'https://attacker.invalid' });
    expect(res.status).toBe(200);
    expect(res.body.coverage).toBe('Full text retrieved');
    expect(retrieveFullText.mock.calls[0][0]).toEqual(paper);
    expect(
      (await request(app).get('/api/search?q=again')).body.papers[0].fullText,
    ).toEqual(loaded.fullText);
  });
  it('accepts non-OpenAlex IDs for optional AI selections without inventing sources', async () => {
    const records = [
      paper,
      { ...paper, id: 'ARXIV_2401.12345v1' },
      { ...paper, id: 'EPMC_MED_56789' },
      { ...paper, id: 'W12345' },
    ];
    const analyze = vi.fn().mockResolvedValue({
      origin: 'live',
      status: 'insufficient',
      summary: 'Synthetic test',
      hypotheses: [],
    });
    const app = createApp({
      search: async () => ({
        query: 'test',
        papers: records,
        retrievedAt: 'test',
      }),
      analyze,
      assessGap: syntheticAssessor,
    });
    await request(app).get('/api/search?q=test');
    const res = await request(app)
      .post('/api/analyze')
      .send(
        await reviewedCheck(
          app,
          {
            question: 'Synthetic test?',
            field: 'Synthetic test field',
            resources: { data: '', equipment: '', skills: '', deadline: '' },
          },
          records,
        ),
      );
    expect(res.status).toBe(200);
    expect(analyze.mock.calls[0][1]).toEqual(records);
  });
});
describe('Codespaces viewing', () => {
  it('constructs only a valid exact host', () => {
    vi.stubEnv('CODESPACE_NAME', 'fictional-zebra');
    vi.stubEnv('GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN', 'app.github.dev');
    expect(codespaceHost(5173)).toBe('fictional-zebra-5173.app.github.dev');
    vi.stubEnv('CODESPACE_NAME', '../bad');
    expect(codespaceHost(5173)).toBeNull();
  });
  it('redirects accidental dev-backend visits to the known website port', async () => {
    vi.stubEnv('CODESPACE_NAME', 'fictional-zebra');
    vi.stubEnv('GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN', 'app.github.dev');
    const res = await request(createApp({ development: true })).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      'https://fictional-zebra-5173.app.github.dev/',
    );
  });
  it('shows a useful backend page when no public host is known', async () => {
    vi.stubEnv('CODESPACE_NAME', '');
    const res = await request(createApp({ development: true })).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('website on port 5173');
  });
  it('accepts only the exact trusted Codespaces origin through the forwarding proxy', async () => {
    vi.stubEnv('CODESPACE_NAME', 'fictional-zebra');
    vi.stubEnv('GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN', 'app.github.dev');
    const app = createApp();
    expect(
      (
        await request(app)
          .get('/api/health')
          .set('Origin', 'https://fictional-zebra-5173.app.github.dev')
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get('/api/health')
          .set('Origin', 'https://other-5173.app.github.dev')
      ).status,
    ).toBe(403);
  });
});

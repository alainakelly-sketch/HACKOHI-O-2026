import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { exampleAnalysis, examplePapers } from './examples/network-ecology';
import { validateAnalysis } from './evidence-validation';
import { analysisLabel } from '../src/components/ConnectionPanel';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
describe('saved example and source boundaries', () => {
  it('keeps manual example distinct from live analysis', async () => {
    const res = await request(createApp()).get('/api/example');
    expect(res.status).toBe(200);
    expect(res.body.result.origin).toBe('saved-example');
    expect(res.body.papers).toHaveLength(4);
    expect(analysisLabel('saved-example')).toContain('not a live AI result');
    expect(analysisLabel('live')).not.toContain('Saved example');
  });
  it('validates every manually prepared example reference against the checked records', () => {
    expect(() =>
      validateAnalysis(exampleAnalysis, examplePapers),
    ).not.toThrow();
    expect(
      examplePapers.every(
        (p) =>
          p.url.startsWith('https://openalex.org/W') &&
          p.abstract &&
          p.retrievedAt,
      ),
    ).toBe(true);
  });
  it('supports real prior-work checking from saved example IDs without model calls', async () => {
    const app = createApp({
      search: async (q) => ({ query: q, papers: [], retrievedAt: 'test' }),
    });
    const example = await request(app).get('/api/example');
    const res = await request(app).post('/api/prior-work').send({
      analysisId: example.body.analysisId,
      hypothesisId: exampleAnalysis.hypotheses[0].id,
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toContain('novelty is not established');
  });
  it('does not allow credentials or server modules in frontend source', () => {
    function files(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? files(path.join(dir, e.name))
          : [path.join(dir, e.name)],
      );
    }
    const frontend = files('src')
      .filter((p) => /\.[jt]sx?$/.test(p))
      .map((p) => readFileSync(p, 'utf8'))
      .join('\n');
    expect(frontend).not.toMatch(
      /process\.env|VITE_.*(?:KEY|TOKEN|SECRET)|from\s+['"][^'"]*server\//i,
    );
    expect(frontend).not.toContain('PAPERBRIDGE_MODEL_KEY');
  });
});

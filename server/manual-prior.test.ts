// Synthetic search responses only; these tests make no live network/model calls.
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { checkManualPriorWork, manualPriorQueries } from './prior-work';
import { normalizeWork } from './openalex';
const paper = normalizeWork({
  id: 'https://openalex.org/W1',
  display_name: 'SYNTHETIC PRIOR WORK',
  publication_year: 2025,
})!;
describe('manual prior-work search without AI', () => {
  it('keeps actual user terms visible and bounds field-prefixed queries', () => {
    expect(manualPriorQueries('Network sensitivity', 'Ecology')).toEqual([
      'Network sensitivity',
      'Ecology Network sensitivity',
    ]);
    expect(manualPriorQueries('query')).toEqual(['query']);
    expect(
      manualPriorQueries('q'.repeat(400), 'field').every(
        (query) => query.length <= 400,
      ),
    ).toBe(true);
  });
  it('does not establish novelty from empty results', async () => {
    const result = await checkManualPriorWork(
      'Synthetic question',
      '',
      vi.fn().mockResolvedValue({ papers: [] }),
    );
    expect(result.status).toBe(
      'No close match found in these searches; novelty is not established.',
    );
  });
  it('returns incomplete for all failures without leaking provider internals', async () => {
    const result = await checkManualPriorWork(
      'Synthetic question',
      '',
      vi.fn().mockRejectedValue(new Error('private provider error')),
    );
    expect(result.status).toBe('Search incomplete.');
    expect(JSON.stringify(result)).not.toContain('private provider');
  });
  it('keeps partial matches, deduplicates and discloses provider failures', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({
        papers: [paper, paper],
        sourceStatuses: [{ source: 'arXiv', status: 'error' }],
      })
      .mockResolvedValueOnce({ papers: [paper] });
    const result = await checkManualPriorWork(
      'Synthetic question',
      'Synthetic field',
      search,
    );
    expect(result.status).toBe('Search incomplete.');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].overlap).toContain('Possible topical overlap');
  });
  it('works through the API without credentials or an analysis id', async () => {
    const analyze = vi.fn();
    const search = vi.fn().mockResolvedValue({
      papers: [paper],
      query: 'test',
      retrievedAt: 'test',
    });
    const response = await request(createApp({ search, analyze }))
      .post('/api/prior-work/search')
      .send({ question: 'Synthetic question', field: 'Synthetic field' });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('Related prior work found.');
    expect(response.body.searches[0].query).toBe('Synthetic question');
    expect(analyze).not.toHaveBeenCalled();
  });
  it('validates empty/oversized input before any provider request', async () => {
    const search = vi.fn();
    const app = createApp({ search });
    for (const body of [
      { question: '' },
      { question: 'x'.repeat(401) },
      { question: 'valid', field: 'f'.repeat(101) },
      { question: 'valid', url: 'https://example.invalid' },
    ]) {
      const response = await request(app)
        .post('/api/prior-work/search')
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('prior-work');
    }
    expect(search).not.toHaveBeenCalled();
  });
});

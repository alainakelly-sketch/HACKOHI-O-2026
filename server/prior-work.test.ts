import { describe, it, expect, vi } from 'vitest';
import { checkPriorWork, priorQueries } from './prior-work';
import type { Brief, Hypothesis } from '../shared/types';
const brief = {
  field: 'Network ecology',
  question: 'Species removal sensitivity',
} as Brief;
const hypothesis = { title: 'Synthetic method' } as Hypothesis;
describe('prior-work outcomes', () => {
  it('shows the field and question used for follow-up queries', () => {
    expect(priorQueries(brief, hypothesis)).toEqual([
      'Network ecology Species removal sensitivity',
      'Network ecology Synthetic method',
    ]);
  });
  it('bounds the actual field/question queries to provider input limits', () => {
    const queries = priorQueries(
      { ...brief, question: 'q'.repeat(1200) },
      hypothesis,
    );
    expect(queries.every((query) => query.length <= 400)).toBe(true);
    expect(queries[0]).toContain('Network ecology');
  });
  it('does not establish novelty from empty results', async () => {
    const result = await checkPriorWork(
      brief,
      hypothesis,
      vi.fn().mockResolvedValue({ papers: [] }),
    );
    expect(result.status).toBe(
      'No close match found in these searches; novelty is not established.',
    );
    expect(result.searches).toHaveLength(2);
  });
  it('labels partial failure as incomplete even with matches', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({ papers: [{ id: 'W1' }] })
      .mockRejectedValueOnce(new Error('offline'));
    const result = await checkPriorWork(brief, hypothesis, search);
    expect(result.status).toBe('Search incomplete.');
    expect(result.matches).toHaveLength(1);
    expect(result.searches[1].error).not.toBeNull();
  });
  it('deduplicates candidates and reports possible overlap, not proof', async () => {
    const result = await checkPriorWork(
      brief,
      hypothesis,
      vi.fn().mockResolvedValue({ papers: [{ id: 'W1' }, { id: 'W1' }] }),
    );
    expect(result.status).toBe('Related prior work found.');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].overlap).toContain('Possible topical overlap');
  });
});

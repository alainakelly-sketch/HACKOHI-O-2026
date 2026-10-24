import { describe, it, expect, vi } from 'vitest';
import {
  createOpenAlex,
  createPaperStore,
  deduplicate,
  normalizeWork,
  reconstructAbstract,
} from './openalex';
const raw = {
  id: 'https://openalex.org/W1',
  display_name: 'SYNTHETIC TEST WORK',
  publication_year: 2020,
  doi: 'https://doi.org/10.1000/test',
  abstract_inverted_index: { Synthetic: [0], 'abstract.': [1] },
};
describe('OpenAlex retrieval', () => {
  it('reconstructs an inverted abstract in positional order', () => {
    expect(reconstructAbstract({ 'last.': [2], First: [0], then: [1] })).toBe(
      'First then last.',
    );
  });
  it('handles null and empty abstracts without inventing text', () => {
    expect(reconstructAbstract(null)).toBeNull();
    expect(reconstructAbstract({})).toBeNull();
    expect(
      normalizeWork({ ...raw, abstract_inverted_index: null })?.coverage,
    ).toBe('Metadata only');
  });
  it('gives stable IDs to unchanged text and changes IDs for changed text', () => {
    const a = normalizeWork(raw)!;
    expect(a.passages[0].id).toBe(normalizeWork(raw)!.passages[0].id);
    expect(a.passages[0].id).not.toBe(
      normalizeWork({ ...raw, abstract_inverted_index: { Changed: [0] } })!
        .passages[0].id,
    );
  });
  it('preserves abstract text around abbreviations and decimal numbers', () => {
    const sentence =
      'Until recently, one type (e.g. feeding) was used. The value was 1.25 in this test.';
    const index: Record<string, number[]> = {};
    sentence.split(' ').forEach((word, i) => (index[word] ??= []).push(i));
    const p = normalizeWork({ ...raw, abstract_inverted_index: index })!;
    expect(p.passages.map((x) => x.text).join(' ')).toBe(sentence);
  });
  it('rejects missing records and unsafe record links', () => {
    expect(normalizeWork({ display_name: 'No ID' })).toBeNull();
    expect(normalizeWork({ ...raw, id: 'javascript:alert(1)' })).toBeNull();
    expect(
      normalizeWork({ ...raw, doi: 'javascript:alert(1)' })?.doi,
    ).toBeNull();
  });
  it('deduplicates IDs and DOI variants', () => {
    const p = normalizeWork(raw)!;
    expect(
      deduplicate([p, p, { ...p, id: 'W2', doi: p.doi!.toUpperCase() }]),
    ).toHaveLength(1);
  });
  it('handles empty searches', async () => {
    const search = createOpenAlex(
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }))),
    );
    expect((await search('nothing')).papers).toEqual([]);
  });
  it('uses documented search parameters and only retrieved metadata', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ results: [raw, raw] })));
    const result = await createOpenAlex(fetcher)('synthetic');
    expect(result.papers).toHaveLength(1);
    expect(result.papers[0].title).toBe(raw.display_name);
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('search')).toBe(
      'synthetic',
    );
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('per-page')).toBe(
      '16',
    );
  });
  it.each([429, 401, 403, 500])('handles upstream HTTP %i', async (status) => {
    await expect(
      createOpenAlex(vi.fn().mockResolvedValue(new Response('{}', { status })))(
        'test',
      ),
    ).rejects.toThrow(
      status === 429
        ? 'rate limit'
        : status === 500
          ? 'returned an error'
          : 'access was denied',
    );
  });
  it('handles network failures without exposing upstream details', async () => {
    await expect(
      createOpenAlex(
        vi.fn().mockRejectedValue(new Error('secret upstream URL')),
      )('test'),
    ).rejects.toThrow('could not be reached');
  });
  it('handles malformed responses', async () => {
    await expect(
      createOpenAlex(vi.fn().mockResolvedValue(new Response('bad json')))(
        'test',
      ),
    ).rejects.toThrow('unreadable');
    await expect(
      createOpenAlex(vi.fn().mockResolvedValue(new Response('{}')))('test'),
    ).rejects.toThrow('unexpected');
  });
  it('does not let the browser fabricate selected source text', () => {
    const store = createPaperStore();
    expect(() => store.get(['W1'])).toThrow('unknown');
    const p = normalizeWork(raw)!;
    store.put([p]);
    expect(store.get(['W1'])).toEqual([p]);
  });
});

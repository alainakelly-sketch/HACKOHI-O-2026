// SYNTHETIC TEST DATA ONLY. No record or response in this file is a real paper.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Paper, SearchResult, SourceName } from '../../shared/types';
import { createCombinedSearch, mergeDuplicates } from './combined';
import { createEuropePMC, normalizeEuropePMC } from './europepmc';
import { arxivIdentifier, parseArxiv } from './arxiv';
import { readSource, safeSourceUrl, sourcePassages } from './common';
import { createOpenAlex, normalizeWork } from '../openalex';
import { AppError } from '../errors';

const at = '2026-01-01T00:00:00.000Z';
function paper(
  id: string,
  provider: SourceName = 'OpenAlex',
  overrides: Partial<Paper> = {},
): Paper {
  return {
    id,
    title: `SYNTHETIC TEST PAPER ${id}`,
    year: 2025,
    doi: null,
    url: `https://example.invalid/${id}`,
    authors: ['Synthetic Author'],
    abstract: 'Synthetic source sentence.',
    passages: sourcePassages(id, 'Synthetic source sentence.'),
    coverage: 'Abstract only',
    retrievedAt: at,
    sources: [{ provider, id, url: `https://example.invalid/${id}` }],
    freeCopies: [
      {
        url: `https://example.invalid/free/${id}`,
        format: 'Repository',
        via: provider,
      },
    ],
    ...overrides,
  };
}
function result(papers: Paper[]): SearchResult {
  return { query: 'synthetic', papers, retrievedAt: at };
}
function adapters(a: Paper[] = [], b: Paper[] = [], c: Paper[] = []) {
  return {
    OpenAlex: vi.fn().mockResolvedValue(result(a)),
    'Europe PMC': vi.fn().mockResolvedValue(result(b)),
    arXiv: vi.fn().mockResolvedValue(result(c)),
  };
}
const rawPMC = {
  id: '12345',
  source: 'MED',
  title: 'SYNTHETIC TEST PMC PAPER',
  pubYear: '2025',
  pmcid: 'PMC999001',
  doi: '10.1000/synthetic',
  abstractText: '<p>Synthetic <b>abstract</b> text.</p>',
  authorString: 'Synthetic One, Synthetic Two',
  isOpenAccess: 'Y',
};
const arxivFeed = (
  entry = `<entry><id>http://arxiv.org/abs/2601.12345v2</id><title>SYNTHETIC TEST\n ARXIV PAPER</title><summary>Synthetic summary.</summary><published>2026-01-03T00:00:00Z</published><author><name>Synthetic Author</name></author><arxiv:doi>10.1000/synthetic</arxiv:doi></entry>`,
) =>
  `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">${entry}</feed>`;

describe('combined free-paper search', () => {
  it('queries all adapters with the same input and interleaves their existing relevance order', async () => {
    const searches = adapters(
      [paper('W1'), paper('W2')],
      [paper('PMC1', 'Europe PMC')],
      [paper('A1', 'arXiv'), paper('A2', 'arXiv')],
    );
    const found = await createCombinedSearch(searches)('synthetic question');
    Object.values(searches).forEach((search) =>
      expect(search).toHaveBeenCalledWith('synthetic question'),
    );
    expect(found.papers.map((p) => p.id)).toEqual([
      'W1',
      'PMC1',
      'A1',
      'W2',
      'A2',
    ]);
    expect(found.sourceStatuses?.map((s) => s.source)).toEqual([
      'OpenAlex',
      'Europe PMC',
      'arXiv',
    ]);
  });
  it('keeps successful records when one collection fails and marks that collection incomplete', async () => {
    const searches = adapters([paper('W1')], [], [paper('A1', 'arXiv')]);
    searches['Europe PMC'].mockRejectedValue(
      new AppError(429, 'Synthetic Europe PMC rate limit reached.'),
    );
    const found = await createCombinedSearch(searches)('synthetic');
    expect(found.papers).toHaveLength(2);
    expect(found.sourceStatuses?.[1]).toEqual({
      source: 'Europe PMC',
      status: 'error',
      count: 0,
      message: 'Synthetic Europe PMC rate limit reached.',
    });
  });
  it('does not leak internal provider failure details into collection status', async () => {
    const searches = adapters([paper('W1')]);
    searches.arXiv.mockRejectedValue(new Error('SECRET_TEST_UPSTREAM_DETAIL'));
    const found = await createCombinedSearch(searches)('synthetic');
    expect(JSON.stringify(found)).not.toContain('SECRET_TEST_UPSTREAM_DETAIL');
    expect(found.sourceStatuses?.[2].status).toBe('error');
  });
  it('does not replace an all-source failure with invented or saved results', async () => {
    const searches = adapters();
    Object.values(searches).forEach((search) =>
      search.mockRejectedValue(new Error('Synthetic offline')),
    );
    await expect(createCombinedSearch(searches)('synthetic')).rejects.toThrow(
      'All free-paper sources are unavailable',
    );
  });
  it('returns an honest empty search with successful collection statuses', async () => {
    const found = await createCombinedSearch(adapters())('synthetic');
    expect(found.papers).toEqual([]);
    expect(
      found.sourceStatuses?.every((s) => s.status === 'ok' && s.count === 0),
    ).toBe(true);
  });
  it('excludes records with no reported free-copy URL without excluding missing abstracts', async () => {
    const freeNoAbstract = paper('W2', 'OpenAlex', {
      abstract: null,
      passages: [],
      coverage: 'Metadata only',
    });
    const found = await createCombinedSearch(
      adapters([paper('W1', 'OpenAlex', { freeCopies: [] }), freeNoAbstract]),
    )('synthetic');
    expect(found.papers.map((p) => p.id)).toEqual(['W2']);
    expect(found.sourceStatuses?.[0].count).toBe(1);
  });
});

describe('cross-provider duplicate grouping', () => {
  it('groups normalized DOI matches, preserves provenance and canonical passage IDs', () => {
    const first = paper('W1', 'OpenAlex', {
      doi: 'https://doi.org/10.1000/Synthetic',
    });
    const second = paper('PMC999', 'Europe PMC', {
      doi: 'http://dx.doi.org/10.1000/synthetic/',
    });
    const [merged] = mergeDuplicates([first, second]);
    expect(mergeDuplicates([first, second])).toHaveLength(1);
    expect(merged.id).toBe('W1');
    expect(merged.passages).toEqual(first.passages);
    expect(merged.sources?.map((s) => s.provider)).toEqual([
      'OpenAlex',
      'Europe PMC',
    ]);
    expect(merged.freeCopies).toHaveLength(2);
  });
  it('groups PMC identifiers when a DOI is missing', () => {
    expect(
      mergeDuplicates([
        paper('W1', 'OpenAlex', { identifiers: { pmcid: 'PMC999' } }),
        paper('PMC999', 'Europe PMC', { identifiers: { pmcid: 'pmc999' } }),
      ]),
    ).toHaveLength(1);
  });
  it('groups arXiv version IDs while retaining links and marking manuscript versions', () => {
    const grouped = mergeDuplicates([
      paper('W1', 'OpenAlex', {
        identifiers: { arxiv: '2601.12345v1' },
        publicationType: 'Journal / other work',
      }),
      paper('ARXIV_2601.12345v2', 'arXiv', {
        identifiers: { arxiv: '2601.12345v2' },
        publicationType: 'Preprint',
      }),
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].sources).toHaveLength(2);
    expect(grouped[0].publicationType).toBe('Includes preprint version');
  });
  it('resolves a late bridge between separate DOI and PMC groups', () => {
    const first = paper('W1', 'OpenAlex', {
      doi: 'https://doi.org/10.1000/bridge',
    });
    const second = paper('PMC9', 'Europe PMC', {
      identifiers: { pmcid: 'PMC9' },
    });
    const bridge = paper('A1', 'arXiv', {
      doi: first.doi,
      identifiers: { pmcid: 'PMC9' },
    });
    const grouped = mergeDuplicates([first, second, bridge]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].id).toBe('W1');
    expect(grouped[0].sources).toHaveLength(3);
  });
  it('recognizes later repeats of an already grouped secondary record', () => {
    const first = paper('W1', 'OpenAlex', {
      doi: 'https://doi.org/10.1000/repeat',
    });
    const second = paper('PMC9', 'Europe PMC', { doi: first.doi });
    expect(
      mergeDuplicates([first, second, { ...second, doi: null }]),
    ).toHaveLength(1);
  });
  it('does not merge distinct records only because their titles are the same', () => {
    expect(
      mergeDuplicates([
        paper('W1'),
        { ...paper('PMC2', 'Europe PMC'), title: 'SYNTHETIC TEST PAPER W1' },
      ]),
    ).toHaveLength(2);
  });
  it('fills a missing abstract with selected source text and rebases passage IDs to the canonical paper', () => {
    const first = paper('W1', 'OpenAlex', {
      doi: 'https://doi.org/10.1000/abstract',
      abstract: null,
      passages: [],
      coverage: 'Metadata only',
    });
    const other = paper('PMC9', 'Europe PMC', { doi: first.doi });
    const [merged] = mergeDuplicates([first, other]);
    expect(merged.abstract).toBe(other.abstract);
    expect(merged.coverage).toBe('Abstract only');
    expect(merged.passages[0].id.startsWith('W1:')).toBe(true);
    expect(merged.passages[0].text).toBe(other.passages[0].text);
  });
});

describe('provider metadata normalization', () => {
  it('imports actual fields from Europe PMC core records and strips abstract markup without inventing full text', () => {
    const p = normalizeEuropePMC(rawPMC, at)!;
    expect(p.id).toBe('PMC999001');
    expect(p.title).toBe(rawPMC.title);
    expect(p.abstract).toBe('Synthetic abstract text.');
    expect(p.coverage).toBe('Abstract only');
    expect(p.fullText).toBeUndefined();
    expect(p.identifiers?.pmcid).toBe('PMC999001');
    expect(p.freeCopies?.[0].url).toBe(
      'https://europepmc.org/articles/PMC999001',
    );
  });
  it('labels missing abstracts and missing free copies honestly', () => {
    const p = normalizeEuropePMC(
      { ...rawPMC, abstractText: undefined, isOpenAccess: 'N' },
      at,
    )!;
    expect(p.abstract).toBeNull();
    expect(p.passages).toEqual([]);
    expect(p.coverage).toBe('Metadata only');
    expect(p.freeCopies).toEqual([]);
  });
  it('rejects malformed records and does not use an invalid DOI as a link', () => {
    for (const value of [
      null,
      {},
      'bad',
      { ...rawPMC, id: '../../secret' },
      { ...rawPMC, source: '<script>' },
    ])
      expect(normalizeEuropePMC(value)).toBeNull();
    expect(
      normalizeEuropePMC({ ...rawPMC, doi: 'javascript:alert(1)' })?.doi,
    ).toBeNull();
  });
  it('labels Europe PMC preprint records explicitly', () => {
    expect(
      normalizeEuropePMC({ ...rawPMC, source: 'PPR' })?.publicationType,
    ).toBe('Preprint');
  });
  it('enforces OA search independently of user search operators', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ resultList: { result: [rawPMC] } })),
      );
    const found = await createEuropePMC(fetcher)('network OR OPEN_ACCESS:N');
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.hostname).toBe('www.ebi.ac.uk');
    expect(url.searchParams.get('query')).toMatch(/AND OPEN_ACCESS:Y$/);
    expect(url.searchParams.get('resultType')).toBe('core');
    expect(found.papers[0].title).toBe(rawPMC.title);
  });
  it('handles empty Europe PMC responses without a made-up paper', async () => {
    const found = await createEuropePMC(
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ resultList: { result: [] } })),
        ),
    )('synthetic');
    expect(found.papers).toEqual([]);
  });
  it.each(['null', '{}', 'not-json'])(
    'rejects malformed Europe PMC responses: %s',
    async (body) => {
      await expect(
        createEuropePMC(vi.fn().mockResolvedValue(new Response(body)))(
          'synthetic',
        ),
      ).rejects.toThrow(/unreadable|unexpected/);
    },
  );
  it('turns Europe PMC rate limiting and network errors into useful errors', async () => {
    await expect(
      createEuropePMC(
        vi.fn().mockResolvedValue(new Response('', { status: 429 })),
      )('synthetic'),
    ).rejects.toThrow('rate limit');
    await expect(
      createEuropePMC(
        vi.fn().mockRejectedValue(new Error('PRIVATE_TEST_DETAILS')),
      )('synthetic'),
    ).rejects.toThrow('could not be reached');
  });
  it('keeps arXiv source identity, version, DOI and preprint status from Atom', () => {
    const [p] = parseArxiv(arxivFeed(), at);
    expect(p.id).toBe('ARXIV_2601.12345v2');
    expect(p.title).toBe('SYNTHETIC TEST ARXIV PAPER');
    expect(p.doi).toBe('https://doi.org/10.1000/synthetic');
    expect(p.publicationType).toBe('Preprint');
    expect(p.identifiers?.arxiv).toBe('2601.12345v2');
    expect(p.freeCopies?.[0].format).toBe('PDF');
    expect(p.coverage).toBe('Abstract only');
  });
  it('handles empty arXiv feeds and missing abstracts', () => {
    expect(parseArxiv(arxivFeed(''))).toEqual([]);
    const [p] = parseArxiv(
      arxivFeed(
        '<entry><id>http://arxiv.org/abs/2601.12345</id><title>SYNTHETIC TEST</title></entry>',
      ),
    );
    expect(p.abstract).toBeNull();
    expect(p.coverage).toBe('Metadata only');
  });
  it('rejects non-feed responses and arXiv API error entries', () => {
    expect(() => parseArxiv('<html>unavailable</html>')).toThrow('unexpected');
    expect(() =>
      parseArxiv(
        arxivFeed(
          '<entry><id>http://arxiv.org/api/errors#incorrect_id_format_for_2601</id></entry>',
        ),
      ),
    ).toThrow('rejected');
  });
  it('does not call a truncated arXiv Atom response a complete search', () => {
    expect(() => parseArxiv(arxivFeed().replace('</feed>', ''))).toThrow();
  });
  it('does not accept an arbitrary URL as an arXiv identifier', () => {
    expect(arxivIdentifier('https://evil.invalid/abs/2601.12345')).toBeNull();
    expect(arxivIdentifier('../../secret')).toBeNull();
    expect(arxivIdentifier('https://arxiv.org/pdf/2601.12345v1.pdf')).toBe(
      '2601.12345v1',
    );
    expect(arxivIdentifier('cond-mat/0702661v2')).toBe('cond-mat/0702661v2');
  });
  it('requests the documented OA filter for OpenAlex free-only searches', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ results: [] })));
    await createOpenAlex(fetcher, { freeOnly: true })('synthetic');
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('filter')).toBe(
      'open_access.is_oa:true',
    );
  });
  it('retains OA repository links but rejects unsafe URLs and locations not marked open', () => {
    const p = normalizeWork({
      id: 'https://openalex.org/W1',
      display_name: 'SYNTHETIC TEST OPENALEX',
      open_access: { is_oa: true, oa_url: 'https://example.invalid/free' },
      locations: [
        { is_oa: false, pdf_url: 'https://example.invalid/paywall' },
        {
          is_oa: true,
          pdf_url: 'javascript:alert(1)',
          landing_page_url: 'https://arxiv.org/abs/2601.12345v1',
        },
      ],
    })!;
    expect(p.freeCopies?.map((c) => c.url)).toEqual([
      'https://arxiv.org/abs/2601.12345v1',
      'https://example.invalid/free',
    ]);
    expect(p.identifiers?.arxiv).toBe('2601.12345v1');
  });
});

describe('untrusted source response boundaries', () => {
  it('rejects credentials and executable URL schemes', () => {
    for (const url of [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'https://user:secret@example.invalid',
      'data:text/html,test',
    ])
      expect(safeSourceUrl(url)).toBeNull();
    expect(safeSourceUrl('https://example.invalid/paper')).toBe(
      'https://example.invalid/paper',
    );
  });
  it('caps response size using the declared length and the streamed bytes', async () => {
    await expect(
      readSource(
        new Response('short', { headers: { 'content-length': '100' } }),
        'Synthetic',
        10,
      ),
    ).rejects.toThrow('too large');
    await expect(
      readSource(new Response('synthetic long response'), 'Synthetic', 5),
    ).rejects.toThrow('too large');
  });
  it('returns stable content-derived passage IDs and does not drop abbreviations', () => {
    const text = 'Synthetic e.g. method preserved. A result follows.';
    const one = sourcePassages('W1', text);
    expect(one.map((p) => p.text).join(' ')).toBe(text);
    expect(sourcePassages('W1', text)).toEqual(one);
    expect(sourcePassages('W1', text + ' Changed.')[0].id).not.toBe(one[0].id);
  });
});

describe('arXiv single-connection queue and bounded query reuse', () => {
  let createQueuedSearch: typeof import('./arxiv').createArxiv;
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    vi.resetModules();
    createQueuedSearch = (await import('./arxiv')).createArxiv;
  });
  afterEach(() => vi.useRealTimers());
  it('waits for the previous connection to finish and then spaces the next request', async () => {
    let releaseFirst!: (response: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockImplementation(() => Promise.resolve(new Response(arxivFeed())));
    const search = createQueuedSearch(fetcher);
    const first = search('synthetic first');
    const second = search('synthetic second');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetcher).toHaveBeenCalledTimes(1); // The first connection is still open.
    releaseFirst(new Response(arxivFeed()));
    await first;
    await vi.advanceTimersByTimeAsync(3099);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await second;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('shares an in-flight query and reuses successful results for ten minutes', async () => {
    let releaseFirst!: (response: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockImplementation(() => Promise.resolve(new Response(arxivFeed())));
    const search = createQueuedSearch(fetcher);
    const first = search('Synthetic Query');
    const same = search(' synthetic QUERY ');
    await vi.advanceTimersByTimeAsync(0);
    releaseFirst(new Response(arxivFeed()));
    await Promise.all([first, same]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const cached = await search('SYNTHETIC QUERY');
    expect(cached.query).toBe('SYNTHETIC QUERY');
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600001);
    await search('Synthetic Query');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not cache a provider error and allows a later spaced retry', async () => {
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(new Response('synthetic error', { status: 500 })),
      )
      .mockImplementation(() => Promise.resolve(new Response(arxivFeed())));
    const search = createQueuedSearch(fetcher);
    await expect(search('Synthetic Retry')).rejects.toThrow(
      'returned an error',
    );
    const retry = search('Synthetic Retry');
    await vi.advanceTimersByTimeAsync(3100);
    expect((await retry).papers).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects excess queued searches without opening extra provider connections', async () => {
    let releaseFirst!: (response: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockImplementation(() => Promise.resolve(new Response(arxivFeed())));
    const search = createQueuedSearch(fetcher);
    const pending = ['one', 'two', 'three', 'four'].map((query) =>
      search(`synthetic ${query}`),
    );
    await vi.advanceTimersByTimeAsync(0);
    await expect(search('synthetic five')).rejects.toThrow('busy');
    expect(fetcher).toHaveBeenCalledTimes(1);
    releaseFirst(new Response(arxivFeed()));
    await vi.advanceTimersByTimeAsync(10000);
    await Promise.all(pending);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});

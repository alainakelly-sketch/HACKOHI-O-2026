// SYNTHETIC PAPER RECORDS ONLY. These are never supplied as application results.
import { describe, expect, it } from 'vitest';
import type { Paper, SourceName } from './types';
import { defaultFilter, filterPapers, hasArticleBody } from './paper-filters';

function record(id: string, overrides: Partial<Paper> = {}): Paper {
  return {
    id,
    title: `SYNTHETIC FILTER TEST ${id}`,
    year: 2025,
    doi: null,
    url: `https://example.invalid/${id}`,
    authors: [],
    abstract: 'Synthetic abstract text.',
    passages: [
      {
        id: `${id}:abstract:1`,
        text: 'Synthetic abstract text.',
        kind: 'abstract',
      },
    ],
    retrievedAt: '2026-01-01T00:00:00Z',
    coverage: 'Abstract only',
    ...overrides,
  };
}
function imported(id: string, overrides: Partial<Paper> = {}): Paper {
  return record(id, {
    coverage: 'Full text retrieved',
    fullText: {
      provider: 'Europe PMC',
      url: `https://example.invalid/full/${id}`,
      license: null,
      retrievedAt: '2026-01-01T00:00:00Z',
      truncated: false,
      note: 'Synthetic article prose; excluded surfaces remain excluded.',
    },
    passages: [
      {
        id: `${id}:body:1`,
        text: 'Synthetic body paragraph.',
        kind: 'full-text',
        section: 'Methods',
      },
    ],
    ...overrides,
  });
}
const provenance = (...providers: SourceName[]) =>
  providers.map((provider) => ({
    provider,
    id: `SYNTHETIC_${provider}`,
    url: 'https://example.invalid/source',
  }));

describe('retrieved body filtering', () => {
  it('defaults to verified imported article bodies, not possible retrieval routes', () => {
    const realBody = imported('BODY');
    const routeOnly = record('ROUTE', { identifiers: { pmcid: 'PMC123' } });
    const freeLinkOnly = record('LINK', {
      freeCopies: [
        {
          url: 'https://example.invalid/free',
          via: 'Test only',
          format: 'PDF',
        },
      ],
    });
    expect(defaultFilter.access).toBe('verified');
    expect(filterPapers([routeOnly, freeLinkOnly, realBody])).toEqual([
      realBody,
    ]);
  });
  it('keeps the verified defaults when optional filter fields are undefined', () => {
    const body = imported('BODY');
    expect(
      filterPapers([record('ABSTRACT'), body], {
        access: undefined,
        sources: undefined,
        allowExcerpt: undefined,
      }),
    ).toEqual([body]);
  });
  it('does not accept metadata-only, abstract-only, or whitespace body passages', () => {
    expect(hasArticleBody(record('ABS'))).toBe(false);
    expect(
      hasArticleBody(
        record('META', {
          abstract: null,
          passages: [],
          coverage: 'Metadata only',
        }),
      ),
    ).toBe(false);
    const blank = imported('BLANK', {
      passages: [{ id: 'blank', text: '  \n ', kind: 'full-text' }],
    });
    expect(hasArticleBody(blank)).toBe(false);
    expect(filterPapers([blank])).toEqual([]);
  });
  it('requires actual body and full-text metadata together', () => {
    const labelOnly = record('LABEL', { coverage: 'Full text retrieved' });
    const metadataOnly = imported('META', { passages: [] });
    const bodyWithoutProvenance = imported('NO_META', { fullText: undefined });
    expect(hasArticleBody(bodyWithoutProvenance)).toBe(true);
    expect(
      filterPapers([labelOnly, metadataOnly, bodyWithoutProvenance]),
    ).toEqual([]);
  });
  it('does not mistake an untyped old abstract passage for body', () => {
    expect(
      filterPapers([
        imported('OLD', {
          passages: [{ id: 'old', text: 'An untyped synthetic abstract.' }],
        }),
      ]),
    ).toEqual([]);
  });
  it('excludes excerpts unless the partial-text setting is explicitly enabled', () => {
    const complete = imported('COMPLETE');
    const excerpt = imported('EXCERPT', {
      coverage: 'Full text excerpt',
      fullText: { ...complete.fullText!, truncated: true },
    });
    expect(filterPapers([excerpt, complete])).toEqual([complete]);
    expect(filterPapers([excerpt, complete], { allowExcerpt: true })).toEqual([
      excerpt,
      complete,
    ]);
  });
  it('rejects inconsistent complete labels on truncated records even when excerpts are allowed', () => {
    const complete = imported('BASE');
    const inconsistent = imported('INCONSISTENT', {
      fullText: { ...complete.fullText!, truncated: true },
    });
    expect(filterPapers([inconsistent], { allowExcerpt: true })).toEqual([]);
  });
  it('supported mode includes known retrieval routes or actual body, but not merely a free-copy link', () => {
    const route = record('PMC', { identifiers: { pmcid: 'PMC123' } });
    const arxiv = record('ARXIV', { identifiers: { arxiv: '2601.12345' } });
    const body = imported('BODY', { fullText: undefined });
    const link = record('LINK', {
      freeCopies: [
        {
          url: 'https://example.invalid/free',
          via: 'Test only',
          format: 'PDF',
        },
      ],
    });
    expect(
      filterPapers([route, arxiv, body, link], { access: 'supported' }),
    ).toEqual([route, arxiv, body]);
  });
  it('all mode does not impose a text-access gate', () => {
    const papers = [
      record('ABS'),
      record('META', {
        abstract: null,
        passages: [],
        coverage: 'Metadata only',
      }),
    ];
    expect(filterPapers(papers, { access: 'all' })).toEqual(papers);
  });
});

describe('provenance, year and publication-kind filters', () => {
  it('matches any collection retained in grouped provenance', () => {
    const grouped = imported('GROUP', {
      sources: provenance('OpenAlex', 'Europe PMC'),
    });
    expect(filterPapers([grouped], { sources: ['Europe PMC'] })).toEqual([
      grouped,
    ]);
    expect(filterPapers([grouped], { sources: ['arXiv'] })).toEqual([]);
    expect(grouped.sources).toHaveLength(2);
  });
  it('uses OpenAlex fallback only for legacy records lacking explicit provenance', () => {
    const legacy = imported('LEGACY');
    expect(filterPapers([legacy], { sources: ['OpenAlex'] })).toEqual([legacy]);
    expect(filterPapers([legacy], { sources: ['Europe PMC'] })).toEqual([]);
  });
  it('does not silently treat an empty collection selection as all collections', () => {
    expect(filterPapers([imported('BODY')], { sources: [] })).toEqual([]);
  });
  it('uses inclusive year bounds and excludes unknown years only when a bound is set', () => {
    const unknown = imported('UNKNOWN', { year: null });
    const old = imported('OLD', { year: 2020 });
    const recent = imported('RECENT', { year: 2025 });
    expect(filterPapers([unknown, old, recent])).toEqual([
      unknown,
      old,
      recent,
    ]);
    expect(
      filterPapers([unknown, old, recent], { yearFrom: 2020, yearTo: 2025 }),
    ).toEqual([old, recent]);
    expect(filterPapers([old, recent], { yearFrom: 2021 })).toEqual([recent]);
    expect(filterPapers([old, recent], { yearTo: 2024 })).toEqual([old]);
  });
  it('returns no records for reversed finite year bounds and never invents a year', () => {
    const paper = imported('BODY');
    expect(filterPapers([paper], { yearFrom: 2026, yearTo: 2020 })).toEqual([]);
    expect(paper.year).toBe(2025);
  });
  it('ignores nonfinite year bounds rather than treating NaN as a real publication date', () => {
    const paper = imported('BODY');
    expect(
      filterPapers([paper], {
        yearFrom: Number.NaN,
        yearTo: Number.POSITIVE_INFINITY,
      }),
    ).toEqual([paper]);
  });
  it('keeps preprint-version groups distinct and does not call the remaining records peer reviewed', () => {
    const preprint = imported('PREPRINT', { publicationType: 'Preprint' });
    const mixed = imported('MIXED', {
      publicationType: 'Includes preprint version',
    });
    const journal = imported('JOURNAL', {
      publicationType: 'Journal / other work',
    });
    const unknown = imported('UNKNOWN', { publicationType: undefined });
    expect(
      filterPapers([preprint, mixed, journal, unknown], {
        articleKind: 'preprints',
      }),
    ).toEqual([preprint, mixed]);
    expect(
      filterPapers([preprint, mixed, journal, unknown], {
        articleKind: 'exclude-preprints',
      }),
    ).toEqual([journal, unknown]);
    expect(mixed.publicationType).toBe('Includes preprint version');
    expect(unknown.publicationType).toBeUndefined();
  });
  it('combines constraints without mutating input records or filter arrays', () => {
    const papers = [
      imported('PMC', { sources: provenance('Europe PMC'), year: 2025 }),
      imported('ARXIV', {
        sources: provenance('arXiv'),
        publicationType: 'Preprint',
      }),
    ];
    const snapshot = structuredClone(papers);
    const sources: SourceName[] = ['Europe PMC'];
    const found = filterPapers(papers, {
      sources,
      yearFrom: 2025,
      articleKind: 'exclude-preprints',
    });
    expect(found).toEqual([papers[0]]);
    expect(papers).toEqual(snapshot);
    expect(sources).toEqual(['Europe PMC']);
  });
});

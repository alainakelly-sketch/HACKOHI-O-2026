// SYNTHETIC TEST PAPERS ONLY. No source data here is used by the application.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Paper } from './types';
import { GapPanel, gapScanSources } from '../src/components/GapPanel';
import { scanGapLeads } from './gaps';
function paper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: 'SYNTHETIC_GAP_CONTROL',
    title: 'SYNTHETIC GAP CONTROL TEST',
    year: 2025,
    doi: null,
    url: 'https://example.invalid/synthetic-only',
    authors: [],
    abstract: 'Future work should test the synthetic model.',
    passages: [
      {
        id: 'SYNTHETIC_GAP_CONTROL:abstract:1',
        kind: 'abstract',
        section: 'Abstract',
        text: 'Future work should test the synthetic model.',
      },
    ],
    coverage: 'Abstract only',
    retrievedAt: 'synthetic-test-time',
    ...overrides,
  };
}
function render(
  papers: Paper[],
  options: { field?: string; busy?: Set<string>; retrieve?: boolean } = {},
) {
  return renderToStaticMarkup(
    createElement(GapPanel, {
      papers,
      question: '',
      field: options.field ?? '',
      busy: options.busy ?? new Set(),
      onSearch: () => {},
      ...(options.retrieve ? { onRetrieve: async () => {} } : {}),
    }),
  );
}
function findButton(html: string) {
  return html.match(/<button[^>]*>Find gap leads<\/button>/)?.[0] ?? '';
}
describe('gap controls make prerequisites and evidence scope explicit', () => {
  it('enables scanning selected sources without requiring a field or question', () => {
    const html = render([paper()]);
    expect(findButton(html)).toContain('Find gap leads');
    expect(findButton(html)).not.toContain('disabled');
    expect(html).toContain('You can scan now without a field.');
    expect(html).toContain('No AI key or field is required.');
  });
  it('keeps the gap action clickable and explains selection when no papers are selected', () => {
    const html = render([]);
    expect(findButton(html)).not.toContain('disabled');
    expect(html).toContain('Select at least one paper to scan its text.');
    expect(html).toContain(
      'You can click Find gap leads for step-by-step guidance.',
    );
  });
  it('defaults the evidence filter to retrieved body only', () => {
    const html = render([paper()]);
    expect(html).toContain(
      '<option value="body" selected="">Retrieved article body only</option>',
    );
    expect(html).toContain('Abstracts excluded from this scan.');
    expect(html).toContain(
      'No retrieved article-body text is available to scan yet.',
    );
    expect(html).not.toContain('Future work should test the synthetic model.');
  });
  it('distinguishes unsupported text from retrievable text and offers the supported action', () => {
    const unsupported = render([paper()], { retrieve: true });
    expect(unsupported).toContain('These records have no imported body text.');
    expect(unsupported).not.toContain(
      'Retrieve selected article text</button>',
    );
    const supported = render([paper({ identifiers: { pmcid: 'PMC123' } })], {
      retrieve: true,
    });
    expect(supported).toContain('Retrieve selected article text</button>');
    expect(supported).toContain('Retrieve selected article text first');
  });
  it('shows waiting and disabled retrieval while selected body text is arriving', () => {
    const p = paper({ identifiers: { pmcid: 'PMC123' } });
    const html = render([p], { retrieve: true, busy: new Set([p.id]) });
    expect(html).toContain('Waiting for article-body retrieval.');
    expect(
      html.match(/<button[^>]*>Retrieve selected article text<\/button>/)?.[0],
    ).toContain('disabled');
  });
});
describe('gap scan evidence selection never silently falls back to abstracts', () => {
  it('excludes abstract-only and metadata-only papers from body scope', () => {
    expect(
      gapScanSources(
        [
          paper(),
          paper({
            id: 'META',
            abstract: null,
            passages: [],
            coverage: 'Metadata only',
          }),
        ],
        'body',
      ),
    ).toEqual([]);
  });
  it('strips the abstract from mixed-source inputs before body scanning without mutating the original', () => {
    const body = {
      id: 'SYNTHETIC_GAP_CONTROL:body:1',
      kind: 'full-text' as const,
      section: 'Discussion',
      text: 'The synthetic model worked in the tested setting.',
    };
    const original = paper({
      passages: [...paper().passages, body],
      coverage: 'Full text retrieved',
    });
    const sources = gapScanSources([original], 'body');
    expect(sources).toHaveLength(1);
    expect(sources[0].passages).toEqual([body]);
    expect(original.passages).toHaveLength(2);
    expect(scanGapLeads(sources, '', '').candidates).toEqual([]);
    expect(
      scanGapLeads(gapScanSources([original], 'include-abstracts'), '', '')
        .candidates,
    ).toHaveLength(1);
  });
  it('includes abstract-only evidence only by explicit scope choice', () => {
    const sources = [paper()];
    expect(gapScanSources(sources, 'include-abstracts')).toBe(sources);
    expect(
      scanGapLeads(gapScanSources(sources, 'include-abstracts'), '', '')
        .candidates[0].kind,
    ).toBe('abstract');
  });
  it('requires actual stored body passages rather than trusting a fullText metadata marker', () => {
    const p = paper({
      fullText: {
        provider: 'Europe PMC',
        url: 'https://example.invalid',
        license: null,
        retrievedAt: 'test',
        note: 'Synthetic marker',
        truncated: false,
      },
    });
    expect(gapScanSources([p], 'body')).toEqual([]);
  });
});

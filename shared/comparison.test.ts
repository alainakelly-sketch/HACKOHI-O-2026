// SYNTHETIC TEST PAPERS ONLY. These records are not used by the application.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComparisonPanel } from '../src/components/ComparisonPanel';
import type { Paper } from './types';
import { canLoadFullText, comparisonPassages } from './comparison';
const paper: Paper = {
  id: 'TEST1',
  title: 'SYNTHETIC COMPARISON PAPER',
  year: null,
  doi: null,
  url: 'https://example.invalid/test',
  authors: [],
  abstract: 'Synthetic abstract.',
  retrievedAt: 'test-only',
  coverage: 'Full text retrieved',
  passages: [
    { id: 'TEST1:abstract:1', text: 'Synthetic abstract.' },
    {
      id: 'TEST1:full:1',
      text: 'A synthetic graph method.',
      kind: 'full-text',
      section: 'Materials and methods',
    },
    {
      id: 'TEST1:full:2',
      text: 'Synthetic graph finding.',
      kind: 'full-text',
      section: 'Results',
    },
    {
      id: 'TEST1:full:3',
      text: 'Synthetic limitations.',
      kind: 'full-text',
      section: 'Discussion',
    },
    {
      id: 'TEST1:full:4',
      text: 'Unclassified synthetic paragraph.',
      kind: 'full-text',
      section: 'Article body',
    },
  ],
};
describe('free comparison uses stored source text, not generated claims', () => {
  it('distinguishes abstract-only passages, including old saved-example passage metadata', () => {
    expect(comparisonPassages(paper, 'abstract', '').map((p) => p.id)).toEqual([
      'TEST1:abstract:1',
    ]);
  });
  it('defaults to body-only text without substituting abstracts', () => {
    expect(comparisonPassages(paper, 'body', '').map((p) => p.id)).toEqual([
      'TEST1:full:1',
      'TEST1:full:2',
      'TEST1:full:3',
      'TEST1:full:4',
    ]);
    const abstractOnly = {
      ...paper,
      coverage: 'Abstract only' as const,
      passages: [paper.passages[0]],
    };
    expect(comparisonPassages(abstractOnly, 'body', '')).toEqual([]);
    expect(comparisonPassages(abstractOnly, 'abstract', '')[0].text).toBe(
      'Synthetic abstract.',
    );
  });
  it('uses source headings to select methods and findings, without guessing content', () => {
    expect(comparisonPassages(paper, 'methods', '').map((p) => p.id)).toEqual([
      'TEST1:full:1',
    ]);
    expect(comparisonPassages(paper, 'findings', '').map((p) => p.id)).toEqual([
      'TEST1:full:2',
      'TEST1:full:3',
    ]);
  });
  it('searches literal source text case-insensitively and preserves original text/IDs', () => {
    const matches = comparisonPassages(paper, 'all', ' GRAPH ');
    expect(matches.map((p) => p.id)).toEqual([
      'TEST1:full:1',
      'TEST1:full:2',
      'TEST1:full:4',
    ]);
    expect(matches[0]).toBe(paper.passages[1]);
  });
  it('returns no fabricated section or search result when text is absent', () => {
    expect(
      comparisonPassages({ ...paper, passages: [] }, 'methods', ''),
    ).toEqual([]);
    expect(comparisonPassages(paper, 'all', 'not in any passage')).toEqual([]);
  });
  it('offers supported PMC or arXiv text retrieval only until full text is present', () => {
    expect(canLoadFullText({ ...paper, identifiers: { pmcid: 'PMC9' } })).toBe(
      true,
    );
    expect(
      canLoadFullText({ ...paper, identifiers: { arxiv: '2601.12345' } }),
    ).toBe(true);
    expect(canLoadFullText(paper)).toBe(false);
    expect(
      canLoadFullText({
        ...paper,
        identifiers: { pmcid: 'PMC9' },
        fullText: {
          provider: 'Europe PMC',
          url: 'https://example.invalid',
          license: null,
          retrievedAt: 'test',
          note: 'Synthetic test',
          truncated: false,
        },
      }),
    ).toBe(false);
  });
});

describe('reader defaults prevent abstract-only confusion', () => {
  const fullText = {
    provider: 'Europe PMC' as const,
    url: 'https://example.invalid/source',
    license: null,
    retrievedAt: 'test',
    note: 'Synthetic body extraction.',
    truncated: false,
  };
  function render(
    papers: Paper[],
    busy = new Set<string>(),
    errors: Record<string, string> = {},
  ) {
    return renderToStaticMarkup(
      createElement(ComparisonPanel, {
        papers,
        busy,
        errors,
        onLoad: () => {},
        onExport: () => {},
      }),
    );
  }
  it('opens a single selected paper immediately so its article body can be read', () => {
    const html = render([{ ...paper, fullText }]);
    expect(html.match(/class="comparison-paper"/g)).toHaveLength(1);
    expect(html).toContain('A synthetic graph method.');
    expect(html).not.toContain('Synthetic abstract.');
    expect(html).toContain('1 of 1 selected paper has article-body');
  });
  it('opens for two sources immediately and renders body text instead of available abstracts', () => {
    const first = { ...paper, fullText };
    const second = {
      ...first,
      id: 'TEST2',
      passages: first.passages.map((p) => ({
        ...p,
        id: p.id.replace('TEST1', 'TEST2'),
      })),
    };
    const html = render([first, second]);
    expect(html.match(/class="comparison-paper"/g)).toHaveLength(2);
    expect(html).toContain('A synthetic graph method.');
    expect(html).not.toContain('Synthetic abstract.');
    expect(html).toContain('2 of 2 selected papers have article-body');
  });
  it('shows a retrieving state and never renders an abstract as body text', () => {
    const pending = {
      ...paper,
      id: 'PENDING',
      fullText: undefined,
      coverage: 'Abstract only' as const,
      identifiers: { pmcid: 'PMC9' },
      passages: [
        { id: 'PENDING:abstract:1', text: 'Synthetic hidden abstract.' },
      ],
    };
    const html = render(
      [pending, { ...pending, id: 'PENDING2' }],
      new Set(['PENDING']),
    );
    expect(html).toContain('Retrieving article-body text');
    expect(html).toContain('Article body is not available here yet');
    expect(html).not.toContain('Synthetic hidden abstract.');
  });
  it('distinguishes unsupported formats from failed imports', () => {
    const unsupported = {
      ...paper,
      id: 'UNSUPPORTED',
      fullText: undefined,
      passages: [],
      freeCopies: [
        {
          url: 'https://example.invalid/free.pdf',
          format: 'PDF' as const,
          via: 'Synthetic test repository',
        },
      ],
    };
    const failed = {
      ...unsupported,
      id: 'FAILED',
      identifiers: { pmcid: 'PMC9' },
    };
    const html = render([unsupported, failed], new Set(), {
      FAILED: 'Synthetic retrieval error',
    });
    expect(html).toContain('In-app article body unavailable for this record');
    expect(html).toContain('Body retrieval failed');
    expect(html).toContain('Synthetic retrieval error');
  });
});

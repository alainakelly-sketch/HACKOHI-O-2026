// SYNTHETIC TEST RECORDS ONLY. No paper here is a real scientific source.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Paper, Passage } from './types';
import { buildComparisonOverview } from './comparison-overview';
import { ComparisonOverview } from '../src/components/ComparisonOverview';
const paragraph = (id: string, text: string, section = 'Methods'): Passage => ({
  id,
  text,
  section,
  kind: 'full-text',
});
function paper(id: string, passages: Passage[]): Paper {
  return {
    id,
    title: `SYNTHETIC TEST ${id}`,
    year: 2025,
    doi: null,
    url: 'https://example.invalid/test',
    authors: [],
    abstract: 'Synthetic abstract only.',
    passages,
    retrievedAt: 'test',
    coverage: 'Full text retrieved',
  };
}
const a = paper('A', [
  paragraph(
    'A:aim',
    'Our objective is to compare functional connectivity in a control cohort.',
    'Objectives',
  ),
  paragraph(
    'A:methods',
    'We measured functional connectivity using topological features. Topological features describe the functional connectivity.',
    'Methods',
  ),
  paragraph(
    'A:results',
    'We found functional connectivity differed across the control cohort.',
    'Results',
  ),
  paragraph(
    'A:limits',
    'Our limitation is the small control cohort. Future work should test another population.',
    'Limitations',
  ),
]);
const b = paper('B', [
  paragraph(
    'B:aim',
    'Our objective is to evaluate functional connectivity.',
    'Objectives',
  ),
  paragraph(
    'B:methods',
    'We measured functional connectivity using attention weights. Attention weights describe functional connectivity.',
    'Methods',
  ),
  paragraph(
    'B:results',
    'We found functional connectivity changed across the patient cohort.',
    'Results',
  ),
]);
describe('free comparison overview grounded in body text', () => {
  it('requires at least two distinct selected paper identities', () => {
    expect(buildComparisonOverview([]).status).toBe('need-more-papers');
    expect(buildComparisonOverview([a, a]).status).toBe('need-more-papers');
  });
  it('does not silently use abstract text as body evidence', () => {
    const noBody = paper('C', [
      {
        id: 'C:abstract',
        text: 'Functional connectivity with topological features.',
        kind: 'abstract',
      },
    ]);
    const result = buildComparisonOverview([a, noBody]);
    expect(result.status).toBe('need-body-text');
    expect(result.papers[1].hasBody).toBe(false);
    expect(result.shared).toHaveLength(0);
    expect(result.matrix.every((r) => r.cells[1].evidence === null)).toBe(true);
  });
  it('shows shared source terms with references from more than one paper', () => {
    const result = buildComparisonOverview([a, b]);
    expect(result.status).toBe('ready');
    const common = result.shared.find(
      (t) => t.term === 'functional connectivity',
    );
    expect(common).toBeDefined();
    expect(common!.evidence.map((e) => e.reference.paperId)).toEqual([
      'A',
      'B',
    ]);
  });
  it('keeps shared/distinct citations grounded in stored passages', () => {
    const result = buildComparisonOverview([a, b]);
    for (const item of result.shared)
      for (const ref of item.evidence) {
        const source = [a, b]
          .find((p) => p.id === ref.reference.paperId)!
          .passages.find((p) => p.id === ref.reference.passageId)!;
        expect(source.text.toLowerCase()).toContain(item.term);
        expect(source.text.startsWith(ref.excerpt)).toBe(true);
      }
    for (const group of result.distinct)
      for (const item of group.terms) {
        const source = [a, b]
          .find((p) => p.id === group.paperId)!
          .passages.find((p) => p.id === item.evidence.reference.passageId)!;
        expect(source.text.toLowerCase()).toContain(item.term);
      }
  });
  it('identifies distinct textual emphases without claiming whole-paper absence', () => {
    const result = buildComparisonOverview([a, b]);
    expect(
      result.distinct.find((d) => d.paperId === 'A')!.terms.map((t) => t.term),
    ).toContain('topological features');
    expect(
      result.distinct.find((d) => d.paperId === 'B')!.terms.map((t) => t.term),
    ).toContain('attention weights');
    expect(result.caution).toContain(
      'does not mean those papers never discuss',
    );
  });
  it('compares available methods/findings/limitations through exact excerpts', () => {
    const result = buildComparisonOverview([a, b]);
    expect(
      result.matrix.find((r) => r.key === 'methods')!.cells[0].evidence
        ?.reference.passageId,
    ).toBe('A:methods');
    expect(
      result.matrix.find((r) => r.key === 'findings')!.cells[1].evidence
        ?.reference.passageId,
    ).toBe('B:results');
    expect(
      result.matrix.find((r) => r.key === 'limitations')!.cells[1].evidence,
    ).toBeNull();
  });
  it('recognizes explicit author statements without inventing a missing section', () => {
    const c = paper('C', [
      paragraph(
        'C:m',
        'We collected a synthetic cohort for this test.',
        'Article body',
      ),
    ]);
    const result = buildComparisonOverview([a, c]);
    expect(
      result.matrix.find((r) => r.key === 'methods')!.cells[1].evidence
        ?.reference.passageId,
    ).toBe('C:m');
    expect(
      result.matrix.find((r) => r.key === 'aim')!.cells[1].evidence,
    ).toBeNull();
  });
  it('bounds excerpts while preserving exact source prefixes and original IDs', () => {
    const c = paper('C', [
      paragraph(
        'C:long',
        'We used ' + 'synthetic measurements '.repeat(100),
        'Methods',
      ),
    ]);
    const result = buildComparisonOverview([a, c]);
    const ref = result.matrix.find((r) => r.key === 'methods')!.cells[1]
      .evidence!;
    expect(ref.excerpt.length).toBe(300);
    expect(ref.truncated).toBe(true);
    expect(c.passages[0].text.startsWith(ref.excerpt)).toBe(true);
  });
  it('does not call a generic method examination a study aim', () => {
    const c = paper('C', [
      paragraph(
        'C:metric',
        'We examine Kullback-Leibler divergence as a measure of prediction error.',
        'Evaluation',
      ),
    ]);
    const result = buildComparisonOverview([a, c]);
    expect(
      result.matrix.find((row) => row.key === 'aim')!.cells[1].evidence,
    ).toBeNull();
  });
  it('shows the actual findings sentence rather than an unrelated paragraph prefix', () => {
    const opening =
      'We evaluate a synthetic model across several measurement settings. ' +
      'This sentence describes setup rather than a finding. '.repeat(10);
    const finding =
      'Our results indicate that synthetic connectivity changed under the selected conditions.';
    const c = paper('C', [
      paragraph(
        'C:long-intro',
        opening + finding + ' Later material describes another issue.',
        'Introduction',
      ),
    ]);
    const result = buildComparisonOverview([a, c]);
    const item = result.matrix.find((row) => row.key === 'findings')!.cells[1]
      .evidence!;
    expect(item.reference).toEqual({ paperId: 'C', passageId: 'C:long-intro' });
    expect(item.excerpt).toContain(finding);
    expect(item.excerpt).not.toContain('We evaluate');
    expect(c.passages[0].text).toContain(item.excerpt);
    expect(item.leadingOmitted).toBe(true);
    expect(item.truncated).toBe(true);
  });
  it('excludes bibliography and acknowledgement text from shared topics', () => {
    const c = paper('C', [
      paragraph(
        'C:ref',
        'Functional connectivity topological features control cohort.',
        'References',
      ),
    ]);
    expect(buildComparisonOverview([a, c]).status).toBe('need-body-text');
  });
  it('does not join terms across sentence punctuation', () => {
    const c = paper('C', [
      paragraph('C:m', 'Neural. Connectivity!', 'Methods'),
    ]);
    const d = paper('D', [
      paragraph('D:m', 'Neural connectivity appears here.', 'Methods'),
    ]);
    expect(
      buildComparisonOverview([c, d]).shared.map((t) => t.term),
    ).not.toContain('neural connectivity');
  });
  it('renders clear common/different headings, source inspection and unavailable sections', () => {
    const html = renderToStaticMarkup(
      createElement(ComparisonOverview, {
        papers: [a, b],
        onInspect: () => {},
      }),
    );
    expect(html).toContain('What they have in common');
    expect(html).toContain('How they differ');
    expect(html).toContain('Comparison paper A');
    expect(html).toContain('Comparison paper B');
    expect(html).toContain('aria-pressed="true">Method');
    expect(html).not.toContain('<table');
    expect(html).toContain('Inspect full passage');
    const missing = renderToStaticMarkup(
      createElement(ComparisonOverview, {
        papers: [
          a,
          paper('C', [
            paragraph('C:x', 'An unrelated source statement.', 'Discussion'),
          ]),
        ],
        onInspect: () => {},
      }),
    );
    expect(missing).toContain('No clear method passage found');
    expect(html).not.toContain('scientifically verified');
  });
  it('renders honest instruction with only one paper', () => {
    const html = renderToStaticMarkup(
      createElement(ComparisonOverview, { papers: [a], onInspect: () => {} }),
    );
    expect(html).toContain('Select at least two papers');
    expect(html).not.toContain('Compare what the sources state');
  });
});

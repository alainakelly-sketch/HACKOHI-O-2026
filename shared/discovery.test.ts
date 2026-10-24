// Synthetic test sources only. No real scientific claims or model calls.
import { describe, expect, it } from 'vitest';
import type { Paper, Passage } from './types';
import { buildDiscoveryReport } from './discovery';
function paper(id: string, passages: Passage[]): Paper {
  return {
    id,
    title: `SYNTHETIC ${id}`,
    year: 2026,
    doi: null,
    url: 'https://example.invalid',
    authors: [],
    abstract: null,
    passages,
    coverage: 'Full text retrieved',
    retrievedAt: 'test',
  };
}
function p(
  id: string,
  text: string,
  section = 'Results',
  kind: 'full-text' | 'abstract' = 'full-text',
): Passage {
  return { id, text, section, kind };
}
const a = paper('a', [
  p(
    'a:result',
    'Our results show that transformer screening improved diagnostic accuracy in adult patients.',
  ),
  p(
    'a:methods',
    'We used transformer screening with the SYNTHETIC Atlas dataset. We enrolled 120 participants. We evaluated diagnostic accuracy.',
    'Methods',
  ),
  p(
    'a:limit',
    'A limitation of our study is the small sample size.',
    'Limitations',
  ),
  p(
    'a:future',
    'Future work should investigate a larger independent cohort.',
    'Future work',
  ),
]);
const b = paper('b', [
  p(
    'b:result',
    'Our results show that transformer screening reduced diagnostic accuracy in adult patients.',
  ),
  p(
    'b:methods',
    'We used transformer screening with the SYNTHETIC Birch dataset. We enrolled 80 participants. We evaluated diagnostic accuracy.',
    'Methods',
  ),
]);
describe('selected-source discovery screening', () => {
  it('links opposing explicit findings to exact stored passages and context', () => {
    const report = buildDiscoveryReport([a, b]);
    expect(report.tensions).toHaveLength(1);
    expect(report.tensions[0].label).toContain('Possible disagreement');
    expect(report.tensions[0].claims.map((c) => c.reference.paperId)).toEqual([
      'a',
      'b',
    ]);
    expect(
      report.tensions[0].context.find((c) => c.field === 'dataset')?.left
        ?.quote,
    ).toContain('SYNTHETIC Atlas');
    for (const evidence of [
      ...report.tensions[0].claims,
      ...report.patterns.flatMap((item) => item.evidence),
    ]) {
      const source = [a, b].find((x) => x.id === evidence.reference.paperId)!;
      expect(
        source.passages.find((x) => x.id === evidence.reference.passageId)!
          .text,
      ).toContain(evidence.quote);
    }
    expect(report.tensions[0].followUp).toContain(
      'does not establish a contradiction',
    );
  });
  it('extracts exact reported detail without inventing missing details', () => {
    const report = buildDiscoveryReport([a, b]);
    const fields = report.profiles[0].fields;
    expect(fields.sample?.quote).toBe('We enrolled 120 participants.');
    expect(fields.population?.quote).toContain('adult patients');
    expect(fields.dataset?.quote).toContain('SYNTHETIC Atlas');
    expect(fields.method?.quote).toContain('We used');
    expect(fields.metric?.quote).toContain('evaluated diagnostic accuracy');
    expect(fields.limitation?.quote).toContain('A limitation');
    expect(fields.futureWork?.quote).toContain('Future work');
    expect(report.profiles[1].fields.futureWork).toBeNull();
  });
  it('reports selected-text coverage rather than a field-wide missing evidence claim', () => {
    const c = paper('c', [
      p('c:result', 'This is a synthetic descriptive account.'),
    ]);
    const report = buildDiscoveryReport([a, c]);
    const sample = report.patterns.find((item) => item.field === 'sample')!;
    expect(sample.label).toContain('1 of 2 selected');
    expect(sample.unknownPaperIds).toEqual(['c']);
    expect(sample.caution).toContain('not evidence');
    expect(sample.caution).toContain('elsewhere');
  });
  it('does not manufacture a tension for empty, metadata-only, or single-source inputs', () => {
    expect(buildDiscoveryReport([]).tensions).toEqual([]);
    expect(buildDiscoveryReport([a]).tensions).toEqual([]);
    const c = paper('c', []);
    expect(buildDiscoveryReport([c, a]).tensions).toEqual([]);
    expect(buildDiscoveryReport([c]).profiles[0].fields.sample).toBeNull();
  });
  it('excludes background, previous studies, hypotheticals, and negated improvement', () => {
    for (const [text, section] of [
      [
        'Our results show that transformer screening reduced diagnostic accuracy in adult patients.',
        'Background',
      ],
      [
        'Previous studies found that transformer screening reduced diagnostic accuracy in adult patients.',
        'Results',
      ],
      [
        'Our results suggest transformer screening might reduce diagnostic accuracy in adult patients.',
        'Results',
      ],
      [
        'Our results show that transformer screening did not improve diagnostic accuracy in adult patients.',
        'Results',
      ],
    ])
      expect(
        buildDiscoveryReport([a, paper('c', [p('c:result', text, section)])])
          .tensions,
      ).toEqual([]);
  });
  it('does not pair unrelated measures or assign a sentence direction across two measures', () => {
    const unrelated = paper('c', [
      p(
        'c:result',
        'Our results show that transformer screening reduced response time in adult patients.',
      ),
    ]);
    const ambiguous = paper('c', [
      p(
        'c:result',
        'Our results show that transformer screening increased diagnostic accuracy and reduced latency in adult patients.',
      ),
    ]);
    expect(buildDiscoveryReport([a, unrelated]).tensions).toEqual([]);
    expect(buildDiscoveryReport([a, ambiguous]).tensions).toEqual([]);
  });
  it('does not assign a direction about a different resource or pair generic populations', () => {
    const resource = paper('c', [
      p(
        'c:r',
        'Our results show transformer screening used higher memory while diagnostic accuracy remained stable in adult patients.',
      ),
    ]);
    expect(buildDiscoveryReport([a, resource]).tensions).toEqual([]);
    const otherMethod = paper('c', [
      p(
        'c:r',
        'Our results show wavelet imaging reduced diagnostic accuracy in adult patients.',
      ),
    ]);
    expect(buildDiscoveryReport([a, otherMethod]).tensions).toEqual([]);
  });
  it('requires meaningful shared context rather than the same generic metric alone', () => {
    const c = paper('c', [
      p(
        'c:result',
        'Our results show that wavelet compression reduced diagnostic accuracy in satellite images.',
      ),
    ]);
    expect(buildDiscoveryReport([a, c]).tensions).toEqual([]);
  });
  it('labels overall/subgroup and adult/pediatric directions as possible scope differences', () => {
    const overall = paper('overall', [
      p(
        'o',
        'Our results show transformer screening improved diagnostic accuracy in the overall cohort.',
      ),
    ]);
    const subgroup = paper('subgroup', [
      p(
        's',
        'Our results show transformer screening reduced diagnostic accuracy in an underrepresented subgroup.',
      ),
    ]);
    expect(
      buildDiscoveryReport([overall, subgroup]).tensions[0].label,
    ).toContain('Possible scope difference');
    const pediatric = paper('pediatric', [
      p(
        'p',
        'Our results show transformer screening reduced diagnostic accuracy in pediatric patients.',
      ),
    ]);
    expect(buildDiscoveryReport([a, pediatric]).tensions[0].label).toContain(
      'Possible scope difference',
    );
  });
  it('keeps abstract-only coverage honest and prefers imported body text', () => {
    const abstract = paper('abstract', [
      p(
        'ab',
        'Our results show transformer screening reduced diagnostic accuracy in adult patients.',
        'Abstract',
        'abstract',
      ),
    ]);
    expect(buildDiscoveryReport([a, abstract]).tensions[0].claims[1].kind).toBe(
      'abstract',
    );
    const withBody = paper('c', [
      ...abstract.passages,
      p('body', 'This paper supplies descriptive observations.', 'Results'),
    ]);
    expect(buildDiscoveryReport([a, withBody]).tensions).toEqual([]);
  });
  it('deduplicates selected paper IDs, caps selection and gives stable tension IDs', () => {
    const first = buildDiscoveryReport([a, b, a]);
    expect(first.profiles).toHaveLength(2);
    expect(first.tensions[0].id).toBe(
      buildDiscoveryReport([a, b]).tensions[0].id,
    );
    const many = Array.from({ length: 9 }, (_, i) =>
      paper(`test${i}`, [
        p(
          `test${i}:p`,
          `Our results show transformer screening ${i % 2 ? 'improved' : 'reduced'} diagnostic accuracy in adult patients.`,
        ),
      ]),
    );
    expect(buildDiscoveryReport(many).profiles).toHaveLength(6);
    expect(buildDiscoveryReport(many).tensions.length).toBeLessThanOrEqual(4);
  });
});

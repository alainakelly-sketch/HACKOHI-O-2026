// Synthetic fixtures only; no real scientific claims, retrieval or model calls.
import { describe, it, expect } from 'vitest';
import { buildConceptOverlap } from './concept-overlap';
import type { Paper } from './types';
function paper(id: string, text: string, title = `SYNTHETIC ${id}`): Paper {
  return {
    id,
    title,
    year: 2026,
    doi: null,
    url: 'https://example.invalid',
    authors: [],
    abstract: null,
    passages: [
      { id: `${id}:body`, kind: 'full-text', section: 'Results', text },
    ],
    coverage: 'Full text retrieved',
    retrievedAt: 'test',
  };
}
const question =
  'How does sleep duration affect memory recall in university students?';
const related = Array.from({ length: 4 }, (_, i) =>
  paper(
    `related-${i}`,
    'We measured sleep duration and memory recall in university students using a daily sleep diary and a word recall task. Our results show that longer sleep duration improved memory recall in university students. A limitation of this study is its small sample of university students. Future work should test sleep duration and memory recall during examinations.',
  ),
);
describe('source-grounded concept overlap', () => {
  it('extracts 3–5 supported themes and co-mentions from related papers', () => {
    const report = buildConceptOverlap(related, question, 'Neuroscience');
    expect(report.themes.length).toBeGreaterThanOrEqual(3);
    expect(report.themes.length).toBeLessThanOrEqual(5);
    expect(report.overlaps.some((node) => node.kind === 'overlap')).toBe(true);
    expect(report.fits.every((fit) => fit.label === 'Strong fit')).toBe(true);
    expect(report.weakWarning).toBe(false);
    const concepts = report.themes.map((theme) => theme.label.toLowerCase());
    expect(concepts).toContain('sleep duration');
    expect(concepts).toContain('memory recall');
    expect(concepts).toContain('university students');
  });
  it('warns for multiple weak papers and exposes matched and missing terms', () => {
    const unrelated = [
      paper('coral', 'Coral reefs respond to ocean acidification.'),
      paper(
        'quantum',
        'Quantum entanglement is measured in superconducting circuits.',
      ),
      paper('fossil', 'Dinosaur fossils reveal Jurassic anatomy.'),
    ];
    const report = buildConceptOverlap(unrelated, question, 'Neuroscience');
    expect(report.weakWarning).toBe(true);
    expect(report.fits.every((fit) => fit.label === 'Weak fit')).toBe(true);
    expect(report.fits.every((fit) => fit.missingTerms.includes('sleep'))).toBe(
      true,
    );
    expect(report.fits.every((fit) => fit.matchedTerms.length === 0)).toBe(
      true,
    );
  });
  it('provides only exact stored source quotations with valid paper and passage IDs', () => {
    const report = buildConceptOverlap(related, question, '');
    for (const node of [...report.themes, ...report.overlaps]) {
      expect(node.evidence.length).toBeGreaterThan(0);
      for (const evidence of node.evidence) {
        const source = related.find((p) => p.id === evidence.reference.paperId);
        const passage = source?.passages.find(
          (p) => p.id === evidence.reference.passageId,
        );
        expect(passage).toBeDefined();
        expect(passage?.text.includes(evidence.quote)).toBe(true);
      }
    }
  });
  it('does not invent an overlap where themes occur in separate source sentences', () => {
    const sources = [
      paper('a', 'Sleep duration was measured in adults.'),
      paper('b', 'Memory recall was measured in children.'),
    ];
    const report = buildConceptOverlap(
      sources,
      'sleep duration memory recall',
      '',
    );
    expect(report.overlaps.length).toBeGreaterThan(0);
    expect(
      report.overlaps.every((node) => node.kind === 'missing-bridge'),
    ).toBe(true);
    expect(report.overlaps[0].missing).toContain('may exist elsewhere');
    expect(report.overlaps[0].rationale).toContain(
      'not a detected research gap',
    );
  });
  it('bounds themes, suggestions and repeated limitation evidence', () => {
    const report = buildConceptOverlap(related, question, '');
    expect(report.themes.length).toBeLessThanOrEqual(5);
    expect(report.overlaps.length).toBeLessThanOrEqual(4);
    expect(
      report.overlaps.filter((node) => node.kind === 'missing-bridge').length,
    ).toBeLessThanOrEqual(1);
    for (const node of [...report.themes, ...report.overlaps]) {
      const keys = node.evidence.map(
        (item) =>
          `${item.reference.paperId}:${item.reference.passageId}:${item.quote}`,
      );
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(
      report.themes.some((theme) => theme.missing.includes('Authors identify')),
    ).toBe(true);
    expect(
      report.overlaps.some((node) =>
        node.rationale.includes('author-stated issue'),
      ),
    ).toBe(true);
  });
  it('groups recurring author issues under themes instead of duplicate cards or generic size themes', () => {
    const sources = related.map((source, index) => ({
      ...source,
      passages: [
        ...source.passages,
        {
          id: `${source.id}:issue`,
          kind: 'full-text' as const,
          section: 'Limitations',
          text:
            index % 2
              ? 'Our limitation is the small sample size for sleep duration and memory recall.'
              : 'A limitation of this study is the small sample size for memory recall and sleep duration.',
        },
      ],
    }));
    const report = buildConceptOverlap(sources, question, '');
    expect(
      new Set(report.themes.map((theme) => theme.label.toLowerCase())).size,
    ).toBe(report.themes.length);
    expect(
      report.themes.every(
        (theme) => !/^(small|size|longer)$/i.test(theme.label),
      ),
    ).toBe(true);
    const sleep = report.themes.find(
      (theme) => theme.label.toLowerCase() === 'sleep duration',
    );
    expect(sleep?.missing).toContain('Authors identify');
    expect(sleep?.evidence.some((item) => /limitation/i.test(item.quote))).toBe(
      true,
    );
  });
  it('retains every supporting paper before applying an evidence cap and does not pad three focus themes', () => {
    const verbose = related.map((source) => ({
      ...source,
      passages: [
        {
          ...source.passages[0],
          text: `${source.passages[0].text} ${'Sleep duration, memory recall and university students were measured daily. '.repeat(20)}Diary completion was measured daily.`,
        },
      ],
    }));
    const report = buildConceptOverlap(verbose, question, 'Neuroscience');
    expect(
      report.themes.map((theme) => theme.label.toLowerCase()).sort(),
    ).toEqual(['memory recall', 'sleep duration', 'university students']);
    expect(report.themes.every((theme) => theme.paperIds.length === 4)).toBe(
      true,
    );
    expect(report.overlaps.every((node) => node.paperIds.length === 4)).toBe(
      true,
    );
    expect(report.overlaps.every((node) => node.kind === 'overlap')).toBe(true);
  });
  it('does not invent themes to fill an empty map or assess fit from field alone', () => {
    expect(buildConceptOverlap([], question, '').themes).toEqual([]);
    const report = buildConceptOverlap(
      related,
      '',
      'sleep duration memory recall',
    );
    expect(report.fits.every((fit) => fit.label !== 'Strong fit')).toBe(true);
    expect(
      report.fits.every((fit) => fit.reason.includes('cannot be assessed')),
    ).toBe(true);
    expect(report.weakWarning).toBe(false);
  });
  it('does not use a references-only match as strong question fit', () => {
    const source = paper(
      'refs',
      'References list sleep duration and memory recall in university students.',
    );
    source.passages[0].section = 'References';
    const report = buildConceptOverlap([source], question, '');
    expect(report.fits[0].label).toBe('Weak fit');
    expect(report.themes).toEqual([]);
  });
  it('is deterministic across identical input and duplicate paper records', () => {
    expect(buildConceptOverlap([...related, related[0]], question, '')).toEqual(
      buildConceptOverlap(related, question, ''),
    );
  });
});

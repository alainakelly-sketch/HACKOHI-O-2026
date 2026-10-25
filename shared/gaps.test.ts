// SYNTHETIC TEST PAPERS ONLY. No record in this file is real research or shipped app data.
import { describe, expect, it } from 'vitest';
import type { Paper, Passage } from './types';
import { scanGapLeads } from './gaps';
function paper(
  id = 'TEST1',
  passages: Partial<Passage>[] = [
    { text: 'A limitation of this synthetic study is its small sample.' },
  ],
  overrides: Partial<Paper> = {},
): Paper {
  return {
    id,
    title: `SYNTHETIC TEST PAPER ${id}`,
    year: 2025,
    doi: null,
    url: `https://example.invalid/${id}`,
    authors: [],
    abstract: 'Synthetic abstract.',
    passages: passages.map((p, i) => ({
      id: `${id}:test:${i}`,
      text: p.text ?? '',
      kind: 'abstract',
      section: 'Abstract',
      ...p,
    })),
    retrievedAt: '2026-01-01T00:00:00Z',
    coverage: 'Abstract only',
    ...overrides,
  };
}
describe('free source-led gap candidates', () => {
  it('returns exact stored passage quotations and resolvable source references', () => {
    const source = paper();
    const result = scanGapLeads(
      [source],
      'sample reliability',
      'Synthetic field',
    );
    expect(result.status).toBe('leads-found');
    expect(result.candidates).toHaveLength(1);
    const lead = result.candidates[0];
    expect(lead.quote).toBe(source.passages[0].text);
    expect(lead.paperId).toBe(source.id);
    expect(lead.passageId).toBe(source.passages[0].id);
    expect(lead.category).toBe('reported-limitation');
    expect(lead.kind).toBe('abstract');
    expect(lead.followUp).toContain('not automatically a gap');
  });
  it('finds future-work leads, preserving a full paragraph rather than a generated summary', () => {
    const text =
      'This is a synthetic result. Future work should test the method in a larger cohort.';
    const result = scanGapLeads(
      [paper('T', [{ text, kind: 'full-text', section: 'Discussion' }])],
      'cohort',
      'Epidemiology',
    );
    expect(result.candidates[0]).toMatchObject({
      quote: text,
      signalText: 'Future work should test the method in a larger cohort.',
      kind: 'full-text',
      section: 'Discussion',
      category: 'future-work',
    });
  });
  it.each([
    'It remains unclear whether the synthetic mechanism applies in adults.',
    'The relationship is still unknown in this synthetic setting.',
    'Little is known about the response of the synthetic cohort.',
    'The mechanism has not yet been investigated in this synthetic model.',
  ])('recognizes an explicit unresolved statement: %s', (text) => {
    expect(
      scanGapLeads([paper('T', [{ text }])], 'response', 'Medicine')
        .candidates[0]?.category,
    ).toBe('unanswered-question');
  });
  it('uses a limitations heading only with a stated limiting detail', () => {
    const sources = [
      paper('T', [
        {
          text: 'The sample was small and restricted to a single synthetic setting.',
          kind: 'full-text',
          section: 'Limitations',
        },
      ]),
    ];
    expect(
      scanGapLeads(sources, 'sample', 'Medicine').candidates[0]?.category,
    ).toBe('reported-limitation');
    expect(
      scanGapLeads(
        [
          paper('T', [
            {
              text: 'The experiment involved a synthetic cohort.',
              section: 'Limitations',
            },
          ]),
        ],
        'cohort',
        'Medicine',
      ).candidates,
    ).toHaveLength(0);
  });
  it.each([
    'We found no limitations in this synthetic demonstration.',
    'This is not a limitation of our synthetic implementation.',
    'These limitations were resolved by the synthetic follow-up.',
    'Our synthetic method is not limited by sample size.',
    'We addressed this limitation in the synthetic follow-up.',
    'We resolved the limitation of the synthetic model.',
    'We overcame the important limitation in the synthetic method.',
    'Further research is not needed for this synthetic comparison.',
    'No further research is required for this synthetic question.',
    'We do not propose future work for this synthetic demonstration.',
    'We did not recommend further studies for this synthetic question.',
    'Future work was already completed for this synthetic demonstration.',
    'We are not planning further studies in this synthetic demonstration.',
    'We propose no future work for this synthetic experiment.',
  ])(
    'does not manufacture a lead from a negated or completed signal: %s',
    (text) => {
      expect(
        scanGapLeads([paper('T', [{ text }])], 'synthetic', 'Test').candidates,
      ).toHaveLength(0);
    },
  );
  it('does not let a negated sentence hide a separate real future-work sentence', () => {
    const text =
      'We found no limitations in this toy example. Future work should test a real cohort.';
    expect(
      scanGapLeads([paper('T', [{ text }])], 'cohort', 'Test').candidates[0]
        ?.signalText,
    ).toBe('Future work should test a real cohort.');
  });
  it.each(['References', 'Bibliography', 'Acknowledgments'])(
    'ignores non-evidence section %s',
    (section) => {
      expect(
        scanGapLeads(
          [
            paper('T', [
              {
                text: 'Future work should test synthetic data.',
                kind: 'full-text',
                section,
              },
            ]),
          ],
          'data',
          'Test',
        ).candidates,
      ).toHaveLength(0);
    },
  );
  it('does not infer a gap from ordinary findings or metadata', () => {
    expect(
      scanGapLeads(
        [
          paper('T', [
            { text: 'The synthetic method improved the recorded comparison.' },
          ]),
        ],
        'comparison',
        'Test',
      ).status,
    ).toBe('insufficient-evidence');
    expect(
      scanGapLeads([paper('T', [])], 'comparison', 'Test').candidates,
    ).toEqual([]);
  });
  it('reports empty evidence honestly rather than proving absence of a gap', () => {
    const empty = scanGapLeads([], 'What matters?', 'Ecology');
    expect(empty.status).toBe('insufficient-evidence');
    expect(empty.coverage.paperCount).toBe(0);
    expect(empty.candidates).toEqual([]);
    const noSignals = scanGapLeads(
      [paper('T', [{ text: 'The experiment used synthetic data.' }])],
      'data',
      'Ecology',
    );
    expect(noSignals.summary).toContain('does not mean the field has no gaps');
  });
  it('ranks full-text leads above abstract leads and keeps the abstract label honest', () => {
    const abstract = paper('A', [
      { text: 'Future work should study synthetic graph data.' },
    ]);
    const body = paper('B', [
      {
        text: 'A limitation is the small synthetic sample.',
        kind: 'full-text',
        section: 'Discussion',
      },
    ]);
    const result = scanGapLeads(
      [abstract, body],
      'graph data',
      'Graph science',
    );
    expect(result.candidates[0].paperId).toBe('B');
    expect(result.candidates[1].kind).toBe('abstract');
  });
  it('orders same-coverage leads by the actual question and field without changing quotations', () => {
    const biology = paper('BIO', [
      {
        text: 'Future research should test synthetic cells in an additional cohort.',
        kind: 'full-text',
      },
    ]);
    const graph = paper('GRAPH', [
      {
        text: 'Future research should test synthetic graph robustness after targeted attacks.',
        kind: 'full-text',
      },
    ]);
    expect(
      scanGapLeads(
        [biology, graph],
        'graph robustness under attacks',
        'Network science',
      ).candidates[0].paperId,
    ).toBe('GRAPH');
    expect(
      scanGapLeads([biology, graph], 'cells cohort', 'Biology').candidates[0]
        .paperId,
    ).toBe('BIO');
  });
  it('deduplicates selected paper IDs and repeated signal passages, preferring body text', () => {
    const text =
      'Future work should study the synthetic response in another cohort.';
    const source = paper('T', [
      { text },
      { text, kind: 'full-text', section: 'Conclusion' },
    ]);
    const result = scanGapLeads([source, source], 'cohort', 'Medicine');
    expect(result.coverage.paperCount).toBe(1);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].kind).toBe('full-text');
  });
  it('preserves separate reports from separate papers even when their wording is identical', () => {
    const result = scanGapLeads([paper('A'), paper('B')], 'sample', 'Test');
    expect(result.candidates).toHaveLength(2);
    expect(new Set(result.candidates.map((l) => l.paperId)).size).toBe(2);
  });
  it('counts actual source coverage, including excerpts and missing text', () => {
    const body = paper(
      'B',
      [
        {
          text: 'A limitation is the small synthetic sample.',
          kind: 'full-text',
        },
      ],
      { coverage: 'Full text excerpt' },
    );
    const result = scanGapLeads(
      [
        body,
        paper('A'),
        paper('M', [], { abstract: null, coverage: 'Metadata only' }),
      ],
      'sample',
      'Test',
    );
    expect(result.coverage).toEqual({
      paperCount: 3,
      fullTextPapers: 1,
      abstractOnlyPapers: 1,
      metadataOnlyPapers: 1,
      excerptPapers: 1,
    });
  });
  it('does not count a full-text label without actual body passages as body evidence', () => {
    const result = scanGapLeads(
      [paper('T', [], { coverage: 'Full text retrieved' })],
      'data',
      'Test',
    );
    expect(result.coverage.fullTextPapers).toBe(0);
    expect(result.coverage.metadataOnlyPapers).toBe(1);
  });
  it('returns stable lead IDs and never introduces a numerical novelty/confidence score', () => {
    const sources = [paper()];
    const a = scanGapLeads(sources, 'sample', 'Test'),
      b = scanGapLeads(sources, 'sample', 'Test');
    expect(a.candidates[0].id).toBe(b.candidates[0].id);
    expect(a.candidates[0]).not.toHaveProperty('novelty');
    expect(a.candidates[0]).not.toHaveProperty('confidence');
    expect(a.caution).toContain('not confirmed research gaps');
  });
  it('caps the displayed list while keeping overall paper coverage', () => {
    const sources = Array.from({ length: 20 }, (_, i) => paper(`T${i}`));
    const result = scanGapLeads(sources, 'sample', 'Test');
    expect(result.candidates).toHaveLength(12);
    expect(result.coverage.paperCount).toBe(20);
  });
  it('preserves source concepts in bounded follow-up searches without broad-field padding', () => {
    const result = scanGapLeads(
      [
        paper('T', [
          {
            text: 'A limitation is inadequate sample diversity across clinical populations.',
          },
        ]),
      ],
      'sample reliability',
      'Epidemiology',
    );
    expect(result.candidates[0].searchQuery).toContain(
      'inadequate sample diversity',
    );
    expect(result.candidates[0].searchQuery).not.toContain('Epidemiology');
    expect(result.candidates[0].searchQuery).not.toContain(
      'sample reliability',
    );
    expect(result.candidates[0].searchQuery).toContain('sample');
    expect(result.candidates[0].searchQuery.trim().length).toBeGreaterThan(0);
    expect(result.candidates[0].searchQuery).toContain('clinical populations');
    expect(result.candidates[0].searchQuery.length).toBeLessThanOrEqual(400);
    expect(result.scope).toEqual({
      question: 'sample reliability',
      field: 'Epidemiology',
    });
  });
  it('marks introduction limitations as background issues and prioritizes actual discussion future work', () => {
    const source = paper('T', [
      {
        text: 'A major limitation of current prediction methods is that they neglect higher-order network organization.',
        kind: 'full-text',
        section: '1 Introduction',
      },
      {
        text: 'Future work should evaluate the proposed method on longitudinal cohorts.',
        kind: 'full-text',
        section: 'Discussion',
      },
      {
        text: 'Our proposed synthetic method addresses higher-order organization.',
        kind: 'full-text',
        section: 'Results',
      },
    ]);
    const result = scanGapLeads(
      [source],
      'higher-order network organization',
      'Network neuroscience',
    );
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].category).toBe('future-work');
    const background = result.candidates[1];
    expect(background.quote).toBe(source.passages[0].text);
    expect(background.label).toContain('Background issue');
    expect(background.label).toContain('may be addressed in this paper');
    expect(background.followUp).toContain(
      "Read this paper's methods, results and conclusions first",
    );
    expect(background.followUp).toContain(
      'Do not treat a background problem statement as a currently open research gap',
    );
  });
  it.each(['Background', '2 Related work', 'Literature review', 'Prior work'])(
    'flags unresolved statements in %s as background rather than an established open gap',
    (section) => {
      const result = scanGapLeads(
        [
          paper('T', [
            {
              text: 'It remains unclear how synthetic network mechanisms interact.',
              kind: 'full-text',
              section,
            },
          ]),
        ],
        'network mechanisms',
        'Network science',
      );
      expect(result.candidates[0].category).toBe('unanswered-question');
      expect(result.candidates[0].label).toContain('Background issue');
      expect(result.candidates[0].followUp).toContain(
        'this paper itself addresses',
      );
    },
  );
});

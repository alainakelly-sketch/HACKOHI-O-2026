// SYNTHETIC TEST PAPERS ONLY. These are not real scientific references.
import { describe, expect, it } from 'vitest';
import type { Paper, Resources } from './types';
import {
  assessPaperResources,
  filterByResources,
  hasResourceNotes,
  suggestedResourceMode,
} from './resource-filter';
const empty: Resources = { data: '', equipment: '', skills: '', deadline: '' };
function paper(
  text: string,
  section = 'Methods',
  kind: 'abstract' | 'full-text' = 'full-text',
): Paper {
  return {
    id: 'test:resource',
    title: 'SYNTHETIC TEST PAPER',
    year: 2026,
    doi: null,
    url: 'https://example.invalid',
    authors: [],
    abstract: null,
    passages: [{ id: 'test:passage', text, section, kind }],
    retrievedAt: 'test',
    coverage: kind === 'full-text' ? 'Full text retrieved' : 'Abstract only',
  };
}
describe('optional evidence-backed paper resource screen', () => {
  it('does not change an empty resource search, record references or order', () => {
    const records = [
      paper('We used a GPU.'),
      { ...paper('We used Python.'), id: 'test:second' },
    ];
    const result = filterByResources(records, empty);
    expect(result.papers).toBe(records);
    expect(result.active).toBe(false);
    expect(result.assessments).toEqual([]);
    expect(hasResourceNotes({ ...empty, equipment: ' \n ' })).toBe(false);
  });
  it('hides explicit unavailable-resource conflicts with inspectable exact evidence', () => {
    const source = paper('We trained the network using a GPU.');
    const result = filterByResources([source], {
      ...empty,
      equipment: 'no GPU',
    });
    expect(result.papers).toEqual([]);
    expect(result.hidden).toEqual([source]);
    expect(result.assessments[0].status).toBe('potential-mismatch');
    const evidence = result.assessments[0].rows[0].evidence!;
    expect(evidence.reference).toEqual({
      paperId: source.id,
      passageId: 'test:passage',
    });
    expect(source.passages[0].text).toContain(evidence.quote);
    expect(evidence.kind).toBe('full-text');
  });
  it('matches positive stated method terms without declaring full feasibility', () => {
    const result = assessPaperResources(
      paper('We implemented the analysis in Python.'),
      { ...empty, skills: 'Python' },
    );
    expect(result.status).toBe('likely-match');
    expect(result.rows[0].evidence?.term).toBe('python');
    expect(result.note).toMatch(/not a feasibility/);
  });
  it('treats unmentioned resources as unknown rather than assuming a conflict', () => {
    const records = [paper('We measured network size.')];
    const result = filterByResources(records, { ...empty, equipment: 'GPU' });
    expect(result.papers).toEqual(records);
    expect(result.assessments[0].status).toBe('unknown');
  });
  it('can reveal excluded conflicts without losing assessments', () => {
    const records = [paper('We used a GPU.')];
    expect(
      filterByResources(
        records,
        { ...empty, equipment: 'no GPU' },
        { hideMismatches: false },
      ).papers,
    ).toBe(records);
  });
  it('does not use titles, metadata, bibliography or background mentions as method evidence', () => {
    for (const heading of [
      'References',
      'Introduction',
      'Related work',
      'Background',
    ]) {
      expect(
        assessPaperResources(paper('We used a GPU.', heading), {
          ...empty,
          equipment: 'no GPU',
        }).status,
      ).toBe('unknown');
    }
    expect(
      assessPaperResources(
        paper('GPU computation is important.', 'Discussion'),
        { ...empty, equipment: 'no GPU' },
      ).status,
    ).toBe('unknown');
    const source = {
      ...paper('No source text.'),
      title: 'We used a GPU',
      passages: [],
    };
    expect(
      assessPaperResources(source, { ...empty, equipment: 'no GPU' }).status,
    ).toBe('unknown');
  });
  it('never counts a source saying a resource was not used as a conflict', () => {
    for (const text of [
      'We did not use a GPU.',
      'No GPU was required.',
      'We used Python without a GPU.',
    ])
      expect(
        assessPaperResources(paper(text), { ...empty, equipment: 'no GPU' })
          .status,
      ).not.toBe('potential-mismatch');
  });
  it('keeps negation independent between comma-separated resource notes', () => {
    const result = assessPaperResources(paper('We used Python.'), {
      ...empty,
      skills: 'no MATLAB, Python',
    });
    expect(result.status).toBe('likely-match');
  });
  it('uses bounded word matches instead of matching lab in collaboration', () => {
    expect(
      assessPaperResources(paper('We used collaboration networks.'), {
        ...empty,
        equipment: 'no lab',
      }).status,
    ).toBe('unknown');
  });
  it('supports explicitly public-only data against explicitly private source methods', () => {
    expect(
      assessPaperResources(paper('We used a proprietary dataset.'), {
        ...empty,
        data: 'public data only',
      }).status,
    ).toBe('potential-mismatch');
    expect(
      assessPaperResources(paper('We used publicly available data.'), {
        ...empty,
        data: 'public data only',
      }).status,
    ).toBe('likely-match');
  });
  it('compares only explicit procedure duration longer than a stated deadline', () => {
    const result = assessPaperResources(paper('Training took three days.'), {
      ...empty,
      deadline: 'one day',
    });
    expect(result.status).toBe('potential-mismatch');
    expect(result.rows[0].evidence?.quote).toBe('Training took three days.');
  });
  it('does not promise whole-project feasibility from a short procedure', () => {
    expect(
      assessPaperResources(paper('Training took two hours.'), {
        ...empty,
        deadline: 'one week',
      }).status,
    ).toBe('unknown');
  });
  it('ignores publication dates, follow-up periods, negated durations and unknown deadline phrasing', () => {
    for (const text of [
      'The paper was published three weeks later.',
      'Participants were followed for three weeks.',
      'Training did not take three weeks.',
    ])
      expect(
        assessPaperResources(paper(text), { ...empty, deadline: 'one day' })
          .status,
      ).toBe('unknown');
    expect(
      assessPaperResources(paper('Training took three days.'), {
        ...empty,
        deadline: 'next Friday',
      }).status,
    ).toBe('unknown');
  });
  it('labels abstract evidence as partial rather than claiming body retrieval', () => {
    const result = assessPaperResources(
      paper('We used Python.', '', 'abstract'),
      { ...empty, skills: 'Python' },
    );
    expect(result.status).toBe('likely-match');
    expect(result.rows[0].evidence?.kind).toBe('abstract');
  });
  it('reassesses immediately with edited notes without mutating sources', () => {
    const records = [paper('We used a GPU.')];
    const before = JSON.stringify(records);
    expect(
      filterByResources(records, { ...empty, equipment: 'no GPU' }).papers,
    ).toHaveLength(0);
    expect(
      filterByResources(records, { ...empty, equipment: 'GPU' }).papers,
    ).toHaveLength(1);
    expect(filterByResources(records, empty).papers).toBe(records);
    expect(JSON.stringify(records)).toBe(before);
  });
  it('uses automatic matches only for positive notes, retaining unknowns for negative/deadline-only notes', () => {
    expect(suggestedResourceMode({ ...empty, equipment: 'no GPU' })).toBe(
      'unknown',
    );
    expect(suggestedResourceMode({ ...empty, deadline: 'one day' })).toBe(
      'unknown',
    );
    expect(
      suggestedResourceMode({ ...empty, skills: 'Python and no GPU' }),
    ).toBe('matches');
  });
  it('does not mistake a Methods heading or comparative resource mentions for author use', () => {
    for (const text of [
      'GPU computation is important.',
      'We used Python to compare previous GPU results.',
      'Previous work requires a GPU.',
    ])
      expect(
        assessPaperResources(paper(text), { ...empty, equipment: 'no GPU' })
          .status,
      ).toBe('unknown');
  });
  it('keeps an explicit unavailable resource scoped separately from a positive resource', () => {
    expect(
      assessPaperResources(paper('We used Python.'), {
        ...empty,
        skills: 'Python and no GPU',
      }).status,
    ).toBe('likely-match');
    expect(
      assessPaperResources(paper('We used Python.'), {
        ...empty,
        skills: 'no GPU and Python',
      }).status,
    ).toBe('unknown');
  });
  it('keeps laptop availability separate from a with-no GPU limitation', () => {
    expect(
      assessPaperResources(paper('We used a laptop.'), {
        ...empty,
        equipment: 'laptop with no GPU',
      }).status,
    ).toBe('likely-match');
    expect(
      assessPaperResources(paper('We used a GPU.'), {
        ...empty,
        equipment: 'laptop with no GPU',
      }).status,
    ).toBe('potential-mismatch');
    expect(
      assessPaperResources(paper('We used Python.'), {
        ...empty,
        skills: 'no MATLAB but Python',
      }).status,
    ).toBe('likely-match');
  });
});

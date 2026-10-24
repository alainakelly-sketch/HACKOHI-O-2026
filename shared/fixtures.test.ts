// SYNTHETIC TEST DATA ONLY. These are not real papers and are never used by the app.
import { describe, expect, it } from 'vitest';
import { resolveCitation } from './evidence';
import { validateAnalysis } from '../server/evidence-validation';
import { assessResources, assessmentIsCurrent } from './resources';
import type { Brief, Hypothesis, Paper } from './types';
export const testPaper = (n = 1): Paper => ({
  id: `W${n}`,
  title: `SYNTHETIC TEST PAPER ${n}`,
  year: 2025,
  doi: null,
  url: `https://openalex.org/W${n}`,
  authors: [],
  abstract: 'We used a GPU for the synthetic test.',
  passages: [{ id: `W${n}:p1`, text: 'We used a GPU for the synthetic test.' }],
  coverage: 'Abstract only',
  retrievedAt: '2026-01-01T00:00:00.000Z',
});
export const testBrief: Brief = {
  question: 'Synthetic cross-field question?',
  fieldA: 'Test field A',
  fieldB: 'Test field B',
  resources: { data: '', equipment: 'GPU', skills: '', deadline: '' },
};
export const testHypothesis: Hypothesis = {
  id: 'h1',
  title: 'SYNTHETIC TEST CONNECTION',
  hypothesis: 'Test transfer may improve the baseline.',
  contributionA: 'Synthetic A inference',
  contributionB: 'Synthetic B inference',
  transfer: 'Synthetic transfer',
  evidence: [
    { paperId: 'W1', passageId: 'W1:p1' },
    { paperId: 'W2', passageId: 'W2:p1' },
  ],
  assumptions: ['Synthetic assumption'],
  incompatibilities: ['Unknown compatibility'],
  unknowns: ['Abstract-only limit'],
  requirements: [
    {
      category: 'equipment',
      term: 'GPU',
      evidence: { paperId: 'W1', passageId: 'W1:p1' },
    },
  ],
  experiment: {
    question: 'Test?',
    data: 'Synthetic data',
    method: 'Compare',
    baseline: 'Baseline',
    measure: 'Error',
    against: 'No improvement',
  },
};
const papers = [testPaper(1), testPaper(2)];
const output = () => ({
  status: 'connections',
  summary: 'Synthetic test analysis',
  hypotheses: [structuredClone(testHypothesis)],
});
describe('source validation', () => {
  it('accepts references to stored passages and renders the original source text', () => {
    const result = validateAnalysis(output(), papers);
    expect(
      resolveCitation(result.hypotheses[0].evidence[0], papers).passage.text,
    ).toBe(papers[0].passages[0].text);
  });
  it('rejects an unknown paper ID', () => {
    const data = output();
    data.hypotheses[0].evidence[0].paperId = 'W999';
    expect(() => validateAnalysis(data, papers)).toThrow('unknown');
  });
  it('rejects an unknown passage ID even when the paper exists', () => {
    const data = output();
    data.hypotheses[0].evidence[0].passageId = 'invented';
    expect(() => validateAnalysis(data, papers)).toThrow('unknown');
  });
  it('rejects a passage assigned to the wrong paper', () => {
    expect(() =>
      resolveCitation({ paperId: 'W1', passageId: 'W2:p1' }, papers),
    ).toThrow();
  });
  it('requires two distinct source papers', () => {
    const data = output();
    data.hypotheses[0].evidence = [
      data.hypotheses[0].evidence[0],
      data.hypotheses[0].evidence[0],
    ];
    expect(() => validateAnalysis(data, papers)).toThrow('two selected');
  });
  it('rejects an unsupported resource requirement', () => {
    const data = output();
    data.hypotheses[0].requirements[0].term = 'microscope';
    expect(() => validateAnalysis(data, papers)).toThrow('not found');
  });
  it('permits an honest insufficient-evidence response', () => {
    expect(
      validateAnalysis(
        { status: 'insufficient', summary: 'No evidence', hypotheses: [] },
        papers,
      ).hypotheses,
    ).toEqual([]);
  });
  it('rejects insufficient evidence with a forced hypothesis', () => {
    expect(() =>
      validateAnalysis({ ...output(), status: 'insufficient' }, papers),
    ).toThrow('Inconsistent');
  });
  it('limits hypotheses to two', () => {
    const data = output();
    data.hypotheses = Array.from({ length: 3 }, (_, i) => ({
      ...testHypothesis,
      id: `h${i}`,
    }));
    expect(() => validateAnalysis(data, papers)).toThrow();
  });
  it('rejects duplicate hypothesis IDs', () => {
    const data = output();
    data.hypotheses.push(testHypothesis);
    expect(() => validateAnalysis(data, papers)).toThrow('Duplicate');
  });
});
describe('resource reassessment', () => {
  it('matches an explicitly available source-supported term', () => {
    expect(
      assessResources(testHypothesis, testBrief.resources, papers).status,
    ).toBe('Appears compatible');
  });
  it('recognizes an explicitly unavailable requirement', () => {
    expect(
      assessResources(
        testHypothesis,
        { ...testBrief.resources, equipment: 'no GPU' },
        papers,
      ).status,
    ).toBe('Potential mismatch');
  });
  it('keeps unmentioned requirements unknown', () => {
    expect(
      assessResources(
        testHypothesis,
        { ...testBrief.resources, equipment: 'laptop' },
        papers,
      ).status,
    ).toBe('Unknown');
  });
  it('keeps absent requirements unknown', () => {
    expect(
      assessResources(
        { ...testHypothesis, requirements: [] },
        testBrief.resources,
        papers,
      ).status,
    ).toBe('Unknown');
  });
  it('invalidates a previous resource assessment on every resource revision', () => {
    expect(assessmentIsCurrent(3, 3)).toBe(true);
    expect(assessmentIsCurrent(3, 4)).toBe(false);
    expect(assessmentIsCurrent(null, 0)).toBe(false);
  });
});

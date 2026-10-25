/** SYNTHETIC TEST FIXTURES ONLY. No source retrieval or model calls. */
import { describe, expect, it } from 'vitest';
import { buildGapFindings } from './gap-findings';
import type { Analysis, Hypothesis, Paper } from './types';
import type { GapLead } from './gaps';
const signal =
  'Future work should test sleep duration and memory recall in shift workers.';
function paper(): Paper {
  return {
    id: 'SYNTHETIC_PAPER',
    title: 'SYNTHETIC sleep experiment',
    year: 2026,
    doi: null,
    url: 'https://example.invalid/test',
    authors: [],
    abstract: null,
    retrievedAt: 'test',
    coverage: 'Full text retrieved',
    passages: [
      {
        id: 'SYNTHETIC:methods',
        kind: 'full-text',
        section: 'Methods',
        text: 'We measured sleep duration and memory recall in university students.',
      },
      {
        id: 'SYNTHETIC:issue',
        kind: 'full-text',
        section: 'Limitations',
        text: signal,
      },
    ],
  };
}
function lead(overrides: Partial<GapLead> = {}): GapLead {
  return {
    id: 'lead:SYNTHETIC:issue:future-work',
    paperId: 'SYNTHETIC_PAPER',
    passageId: 'SYNTHETIC:issue',
    quote: signal,
    signalText: signal,
    kind: 'full-text',
    section: 'Limitations',
    category: 'future-work',
    label: 'Author-proposed future work',
    followUp: 'Check whether later studies already tested shift workers.',
    searchQuery: 'sleep duration memory recall shift workers',
    ...overrides,
  };
}
function hypothesis(overrides: Partial<Hypothesis> = {}): Hypothesis {
  return {
    id: 'H1',
    title: 'SYNTHETIC proposed shift-work study',
    hypothesis: 'Sleep duration may change memory recall in shift workers.',
    evidenceSummary: 'SYNTHETIC model summary, not established evidence.',
    gapRationale: 'The cited study recommends checking shift workers.',
    proposedApproach: 'Compare recall while recording sleep duration.',
    evidence: [{ paperId: 'SYNTHETIC_PAPER', passageId: 'SYNTHETIC:methods' }],
    assumptions: ['Shift workers are available.'],
    incompatibilities: [],
    unknowns: ['Later work is unknown.'],
    requirements: [],
    experiment: {
      question: 'Test?',
      data: '',
      method: '',
      baseline: '',
      measure: '',
      against: '',
    },
    ...overrides,
  };
}
function analysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    origin: 'live',
    status: 'connections',
    summary: 'Synthetic response',
    hypotheses: [hypothesis()],
    ...overrides,
  };
}
describe('canonical gap findings shared by list and map', () => {
  it('preserves exact author IDs, source statements and specific unresolved issue', () => {
    const source = paper();
    const item = lead();
    const [finding] = buildGapFindings([item], null, '', [source]);
    expect(finding.id).toBe(item.id);
    expect(finding.sourceLead).toBe(item);
    expect(finding.origin).toBe('author-stated');
    expect(finding.ready).toBe(true);
    expect(finding.unresolved).toBe(signal);
    expect(finding.title).toBe(
      'test sleep duration and memory recall in shift workers.',
    );
    expect(finding.question).toBe(
      'What follow-up study could address “test sleep duration and memory recall in shift workers”?',
    );
    expect(finding.known).toContain(source.passages[0].text);
    expect(finding.rationale).toContain(item.followUp);
    expect(finding.evidence).toEqual([
      { paperId: source.id, passageId: 'SYNTHETIC:issue' },
      { paperId: source.id, passageId: 'SYNTHETIC:methods' },
    ]);
    expect(finding.uncertainty.join(' ')).toContain(
      'not proof of a field-wide gap',
    );
  });
  it('trims limitation boilerplate only in display labels and preserves the source statement', () => {
    const text =
      'A limitation of this study is that sleep duration was evaluated only in university students.';
    const source = paper();
    source.passages[1].text = text;
    const [finding] = buildGapFindings(
      [lead({ signalText: text, quote: text })],
      null,
      '',
      [source],
    );
    expect(finding.title).toBe(
      'sleep duration was evaluated only in university students.',
    );
    expect(finding.question).toContain(
      '“sleep duration was evaluated only in university students”',
    );
    expect(finding.unresolved).toBe(text);
    expect(finding.sourceLead?.signalText).toBe(text);
    expect(finding.rationale).toBe(lead().followUp);
  });
  it('does not invent established findings when only an issue passage was retrieved', () => {
    const source = paper();
    source.passages = source.passages.slice(1);
    const [finding] = buildGapFindings([lead()], null, '', [source]);
    expect(finding.known).toContain('not enough methods/results context');
    expect(finding.evidence).toHaveLength(1);
  });
  it('keeps generic limitation notices visibly insufficient and non-actionable', () => {
    const text = 'This study has some limitations.';
    const source = paper();
    source.passages[1].text = text;
    const [finding] = buildGapFindings(
      [lead({ signalText: text, quote: text })],
      null,
      '',
      [source],
    );
    expect(finding.ready).toBe(false);
    expect(finding.title).toBe('Insufficient detail for a candidate gap');
    expect(finding.uncertainty.join(' ')).toContain(
      'without specifying a useful unresolved point',
    );
  });
  it('does not treat a background problem as a current open gap', () => {
    const [finding] = buildGapFindings(
      [lead({ section: 'Background' })],
      null,
      '',
      [paper()],
    );
    expect(finding.ready).toBe(false);
    expect(finding.uncertainty.join(' ')).toContain(
      'may already be addressed by this paper',
    );
  });
  it('does not present stale or invented issue text as valid evidence', () => {
    const [finding] = buildGapFindings(
      [
        lead({
          signalText: 'Future work should test an invented research outcome.',
        }),
      ],
      null,
      '',
      [paper()],
    );
    expect(finding.ready).toBe(false);
    expect(finding.unresolved).toContain('unavailable');
    expect(
      finding.evidence.every((ref) =>
        paper().passages.some((p) => p.id === ref.passageId),
      ),
    ).toBe(true);
  });
  it('flags vanished citations without substituting an invented paper or quote', () => {
    const [finding] = buildGapFindings(
      [lead({ paperId: 'UNKNOWN' })],
      null,
      '',
      [paper()],
    );
    expect(finding.ready).toBe(false);
    expect(finding.evidence).toEqual([]);
    expect(finding.known).not.toContain('SYNTHETIC sleep experiment');
  });
  it('namespaces inferred findings by analysis and preserves origins and source refs', () => {
    const first = buildGapFindings([], analysis(), 'analysis-one', [
      paper(),
    ])[0];
    const next = buildGapFindings([], analysis(), 'analysis-two', [paper()])[0];
    expect(first.id).toBe('analysis-one:hypothesis:H1');
    expect(next.id).not.toBe(first.id);
    expect(first.origin).toBe('ai-inferred');
    expect(first.hypothesisId).toBe('H1');
    expect(first.ready).toBe(true);
    expect(first.known).toContain(paper().passages[0].text);
    expect(first.known).not.toContain('model summary');
    expect(first.unresolved).toBe(hypothesis().gapRationale);
    expect(first.uncertainty).toContain('Later work is unknown.');
  });
  it('rejects unknown AI references while retaining inspectable current ones', () => {
    const response = analysis({
      hypotheses: [
        hypothesis({
          evidence: [
            ...hypothesis().evidence,
            { paperId: 'UNKNOWN', passageId: 'FAKE' },
          ],
        }),
      ],
    });
    const [finding] = buildGapFindings([], response, 'run', [paper()]);
    expect(finding.ready).toBe(false);
    expect(finding.evidence).toEqual(hypothesis().evidence);
    expect(finding.uncertainty.join(' ')).toContain(
      'missing from the current selected evidence',
    );
  });
  it('keeps saved examples distinct and labels abstract-only support', () => {
    const source = paper();
    source.coverage = 'Abstract only';
    source.passages = source.passages.map((item) => ({
      ...item,
      kind: 'abstract',
    }));
    const [finding] = buildGapFindings(
      [],
      analysis({ origin: 'saved-example' }),
      'example',
      [source],
    );
    expect(finding.origin).toBe('saved-example');
    expect(finding.uncertainty.join(' ')).toContain(
      'manually prepared example',
    );
    expect(finding.uncertainty.join(' ')).toContain('Only abstract passages');
  });
  it('never fabricates a candidate when neither scan nor analysis supplies one', () => {
    expect(buildGapFindings([], null, '', [paper()])).toEqual([]);
    expect(
      buildGapFindings(
        [],
        analysis({ status: 'insufficient', hypotheses: [] }),
        'run',
        [paper()],
      ),
    ).toEqual([]);
  });
});

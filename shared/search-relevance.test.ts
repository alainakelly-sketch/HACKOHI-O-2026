// SYNTHETIC FIXTURES ONLY. No real literature or model requests.
import { describe, it, expect } from 'vitest';
import type { Paper } from './types';
import {
  buildQueryPlan,
  compileProviderQuery,
  buildResearchQuery,
} from './research-query';
import {
  assessQuestionRelevance,
  rankQuestionResults,
} from './search-relevance';
const paper = (id: string, title: string, abstract: string | null): Paper => ({
  id,
  title,
  abstract,
  year: 2025,
  doi: null,
  url: 'https://example.invalid/' + id,
  authors: [],
  passages: [],
  coverage: abstract ? 'Abstract only' : 'Metadata only',
  retrievedAt: 'synthetic',
});
const music = buildQueryPlan({
  question: 'How does music affect time perception?',
  field: 'Psychology',
});
describe('inspectable concept-preserving query strategy', () => {
  it('preserves music and the multiword outcome without broad field dominance', () => {
    expect(music.concepts.map((c) => c.label)).toEqual([
      'music',
      'time perception',
    ]);
    expect(music.variants).toHaveLength(2);
    expect(music.variants[0]).toBe('music "time perception"');
    expect(music.variants.join(' ')).not.toContain('psychology');
  });
  it('retains later meaningful concepts instead of firstfourwords', () => {
    const query = buildResearchQuery({
      field: 'Ecology',
      question:
        'How do habitat fragmentation and rainfall variability affect species diversity and forest resilience?',
    });
    expect(query).toContain('forest resilience');
    expect(query).toContain('species diversity');
  });
  it('accepts user-correctedconcepts and compiles distinct safe provider syntax', () => {
    const plan = buildQueryPlan({
      question: 'unchanged',
      concepts: [
        { label: 'music', terms: ['musical'] },
        { label: 'perceived duration', terms: [] },
      ],
    });
    expect(plan.question).toBe('unchanged');
    expect(plan.variants[0]).toBe('music "perceived duration"');
    expect(compileProviderQuery('music time perception', 'Europe PMC')).toBe(
      '("music" AND "time perception") AND OPEN_ACCESS:Y',
    );
    expect(compileProviderQuery('music time perception', 'arXiv')).toBe(
      'all:"music" AND all:"time perception"',
    );
    expect(compileProviderQuery('music time perception', 'OpenAlex')).toBe(
      'music time perception',
    );
    expect(
      compileProviderQuery('music OR OPEN_ACCESS:N', 'Europe PMC'),
    ).not.toContain('OPEN_ACCESS:N');
  });
});
describe('cross-provider question relevance baseline', () => {
  it('ranks tempo/perceivedduration and synonymdurationestimates over painonlypapers', () => {
    const pain = paper(
      'pain',
      'SYNTHETIC Music for pain relief',
      'Listening to music reduced pain intensity.',
    );
    const direct = paper(
      'duration',
      'SYNTHETIC Musical tempo and perceived duration',
      'We measured perceived duration while participants listened to music.',
    );
    const synonym = paper(
      'estimates',
      'SYNTHETIC Music and duration estimates',
      'Musical tempo influenced duration estimates.',
    );
    const ranked = rankQuestionResults([pain, direct, synonym], music);
    expect(ranked.map((p) => p.id)).toEqual(['duration', 'estimates', 'pain']);
    expect(ranked[0].relevance?.classification).toBe(
      'Directly addresses the question',
    );
    expect(ranked[2].relevance?.missingConcepts).toEqual(['time perception']);
  });
  it('doesnotexclude pain when timeperception whilelisteningmusic isactuallystudied', () => {
    const relevant = paper(
      'both',
      'SYNTHETIC Time perception during pain and music',
      'We measured time perception during pain while listening to music.',
    );
    expect(assessQuestionRelevance(relevant, music).classification).toBe(
      'Directly addresses the question',
    );
  });
  it('missingabstractsproduce uncertainty not fabricated abstract evidence', () => {
    const result = assessQuestionRelevance(
      paper('metadata', 'SYNTHETIC Music and time perception', null),
      music,
    );
    expect(result.classification).not.toBe('Directly addresses the question');
    expect(result.explanation).toContain('no abstract');
    expect(result.evidence.every((e) => e.field === 'title')).toBe(true);
  });
  it('incidental separate mentions do not establish a relationship', () => {
    const result = assessQuestionRelevance(
      paper(
        'separate',
        'SYNTHETIC Questionnaire development',
        'We surveyed music preferences. An unrelated inventory concerns time perception.',
      ),
      music,
    );
    expect(result.classification).toBe(
      'Related background or potentially transferable method',
    );
  });
  it('generalizes household water-leak synonym matching and urbanheat', () => {
    const leaks = buildQueryPlan({
      question: 'How can household water leaks be detected?',
    });
    expect(leaks.concepts.map((c) => c.label)).toEqual([
      'household',
      'water leaks',
      'detected',
    ]);
    const rank = rankQuestionResults(
      [
        paper(
          'bad',
          'SYNTHETIC Residential energy saving',
          'Energy use was monitored in homes.',
        ),
        paper(
          'good',
          'SYNTHETIC Residential water leakage identification',
          'Water leakage identification was evaluated in residential buildings.',
        ),
      ],
      leaks,
    );
    expect(rank[0].id).toBe('good');
    expect(rank[0].relevance?.classification).toBe(
      'Directly addresses the question',
    );
    const heat = buildQueryPlan({
      question: 'How does vegetation reduce urban heat?',
    });
    const heatRank = rankQuestionResults(
      [
        paper(
          'heatbad',
          'SYNTHETIC Urban traffic',
          'Traffic noise affects cities.',
        ),
        paper(
          'heatgood',
          'SYNTHETIC Green spaces and urban temperature',
          'Green spaces lowered urban temperature.',
        ),
      ],
      heat,
    );
    expect(heatRank[0].id).toBe('heatgood');
    expect(heatRank[0].relevance?.classification).toBe(
      'Directly addresses the question',
    );
  });
  it('keeps relevant abstractonly records and never promotes bodycoverage', () => {
    const [found] = rankQuestionResults(
      [
        paper(
          'abstract',
          'SYNTHETIC Music and perceived duration',
          'Music changed perceived duration.',
        ),
      ],
      music,
    );
    expect(found.coverage).toBe('Abstract only');
    expect(found.passages).toEqual([]);
  });
  it('emptyrecords and unknownterminology stayhonest', () => {
    expect(rankQuestionResults([], music)).toEqual([]);
    expect(
      assessQuestionRelevance(
        paper('unknown', 'SYNTHETIC Quantum optics', null),
        music,
      ).classification,
    ).toBe('Relevance unclear');
  });
});

it('preserves unknown multiword concept boundaries in provider compilation', () => {
  const plan = buildQueryPlan({
    question: 'unchanged',
    concepts: [
      { label: 'rhythmic stimulation', terms: [] },
      { label: 'elapsed interval', terms: [] },
    ],
  });
  expect(compileProviderQuery(plan.variants[0], 'Europe PMC')).toBe(
    '("rhythmic stimulation" AND "elapsed interval") AND OPEN_ACCESS:Y',
  );
  expect(compileProviderQuery(plan.variants[0], 'arXiv')).toBe(
    'all:"rhythmic stimulation" AND all:"elapsed interval"',
  );
});

it('background attribution or explicitly unmeasured outcomes do not establish direct evidence', () => {
  const background = paper(
    'background',
    'SYNTHETIC Music preferences questionnaire',
    'Previous studies examined music and time perception. We developed a questionnaire about preferences.',
  );
  const negated = paper(
    'negated',
    'SYNTHETIC Music preferences',
    'We did not measure time perception while playing music.',
  );
  expect(assessQuestionRelevance(background, music).classification).not.toBe(
    'Directly addresses the question',
  );
  expect(assessQuestionRelevance(negated, music).classification).not.toBe(
    'Directly addresses the question',
  );
});

it('recognizes estimates of duration in a study-specific sentence after attributed background', () => {
  const source = paper(
    'duration-phrase',
    'SYNTHETIC Musical structure and temporal judgment',
    'Previous studies examined music and time perception. Two experiments investigated the influence of musical structure on subjective estimates of duration.',
  );
  const relevance = assessQuestionRelevance(source, music);
  expect(relevance.classification).toBe('Directly addresses the question');
  expect(
    relevance.evidence.find((item) => item.field === 'abstract')?.text,
  ).toContain('Two experiments');
});

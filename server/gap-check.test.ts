// Entirely synthetic fixtures and mocks. No external or paid calls.
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { normalizeWork } from './openalex';
import {
  performGapCheck,
  validateGapAssessment,
  gapCheckQueries,
} from './gap-check';
import { gapCheckScopeKey } from '../shared/gap-check';
import { syntheticAssessor, reviewedCheck } from './gap-check-test-fixtures';
import type { GapCheckGap } from '../shared/gap-check';
const papers = Array.from({ length: 4 }, (_, i) =>
  normalizeWork({
    id: `https://openalex.org/W${i + 1}`,
    display_name: 'SYNTHETIC test',
    abstract_inverted_index: { Synthetic: [0], text: [1] },
  })!,
);
const brief = {
  question: 'Synthetic research focus',
  field: 'Synthetic field',
  resources: { data: '', equipment: '', skills: '', deadline: '' },
};
const gap: GapCheckGap = {
  id: 'synthetic-gap',
  question: 'Does synthetic treatment affect synthetic outcome?',
  reason: 'Synthetic rationale',
  evidence: [{ paperId: papers[0].id, passageId: papers[0].passages[0].id }],
};
const input = { brief, paperIds: papers.map((p) => p.id), gap };
const search = async (query: string) => ({
  papers,
  query,
  retrievedAt: 'synthetic',
  sourceStatuses: [
    {
      source: 'OpenAlex' as const,
      status: 'ok' as const,
      count: 4,
      message: null,
    },
  ],
});
describe('existing-research assessment safety', () => {
  it('searches beyond selected sources, assesses candidates and exposes actual provider diagnostics', async () => {
    const candidate = { ...papers[0], id: 'W999' };
    const lookup = vi.fn(async (query: string) => ({
      ...(await search(query)),
      papers: [candidate],
    }));
    const assessor = vi.fn(syntheticAssessor);
    const result = await performGapCheck(
      brief,
      input.paperIds,
      gap,
      lookup,
      assessor,
    );
    expect(lookup).toHaveBeenCalled();
    expect(lookup.mock.calls.length).toBeLessThanOrEqual(2);
    expect(assessor.mock.calls[0][1][0].id).toBe('W999');
    expect(result.status).toBe(
      'No close match found in the searches completed',
    );
    expect(result.sourceStatuses[0].source).toBe('OpenAlex');
  });
  it('does not call AI for genuinely empty completed searches', async () => {
    const assessor = vi.fn();
    const result = await performGapCheck(
      brief,
      input.paperIds,
      gap,
      async (q) => ({ ...(await search(q)), papers: [] }),
      assessor,
    );
    expect(assessor).not.toHaveBeenCalled();
    expect(result.assessmentNotNeeded).toBe(true);
    expect(result.aiCompleted).toBe(false);
    expect(result.cost?.estimatedUsd).toBe(0);
  });
  it('never turns a failed provider into no close match or empty-search approval', async () => {
    const result = await performGapCheck(
      brief,
      input.paperIds,
      gap,
      async () => {
        throw new Error('synthetic failure');
      },
      syntheticAssessor,
    );
    expect(result.status).toBe('Check incomplete or inconclusive');
    expect(result.assessmentNotNeeded).not.toBe(true);
  });
  it('retains retrieved candidates when assessment is unavailable', async () => {
    const result = await performGapCheck(
      brief,
      input.paperIds,
      gap,
      search,
      async () => {
        throw new Error('synthetic provider failure');
      },
    );
    expect(result.candidates).toHaveLength(4);
    expect(result.aiCompleted).toBe(false);
    expect(result.status).toBe('Check incomplete or inconclusive');
    expect(result.summary).not.toContain('synthetic provider failure');
  });
  it('rejects unknown candidate/passage IDs and uncited different-question conclusions', async () => {
    const valid = await syntheticAssessor(gap, [papers[0]]);
    for (const change of [
      { paperId: 'UNKNOWN' },
      { evidence: [{ paperId: papers[0].id, passageId: 'UNKNOWN' }] },
      { evidence: [] },
    ])
      expect(() =>
        validateGapAssessment(
          { ...valid, matches: [{ ...valid.matches[0], ...change }] },
          [papers[0]],
        ),
      ).toThrow();
  });
  it('metadata alone cannot establish all, part or different', async () => {
    const valid = await syntheticAssessor(gap, [papers[0]]);
    expect(() =>
      validateGapAssessment(valid, [{ ...papers[0], passages: [] }]),
    ).toThrow();
  });
});
describe('server enforces chosen-gap check and explicit review', () => {
  it('blocks absent, unreviewed, changed-question and expired checks before analyzer calls', async () => {
    const analyze = vi.fn();
    const app = createApp({ search, assessGap: syntheticAssessor, analyze });
    await request(app).get('/api/search?q=test');
    expect((await request(app).post('/api/analyze').send(input)).status).toBe(
      409,
    );
    const created = (await request(app).post('/api/gap-check').send(input))
      .body;
    expect(
      (
        await request(app)
          .post('/api/analyze')
          .send({ ...input, checkId: created.checkId })
      ).status,
    ).toBe(409);
    await request(app)
      .post(`/api/gap-check/${created.checkId}/review`)
      .send({ ...input, decision: 'continue' });
    expect(
      (
        await request(app)
          .post('/api/analyze')
          .send({
            ...input,
            gap: { ...gap, question: 'A different chosen question?' },
            checkId: created.checkId,
          })
      ).status,
    ).toBe(409);
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3600001);
    expect(
      (
        await request(app)
          .post('/api/analyze')
          .send({ ...input, checkId: created.checkId })
      ).status,
    ).toBe(409);
    now.mockRestore();
    expect(analyze).not.toHaveBeenCalled();
  });
  it('passes canonical server assessment and accepts resource-only planning edits', async () => {
    const analyze = vi.fn().mockResolvedValue({
      origin: 'live',
      status: 'insufficient',
      summary: 'Synthetic',
      hypotheses: [],
    });
    const app = createApp({ search, assessGap: syntheticAssessor, analyze });
    await request(app).get('/api/search?q=test');
    const checked = await reviewedCheck(app, brief, papers, gap);
    const changed = {
      ...brief,
      resources: { ...brief.resources, equipment: 'Synthetic laptop' },
    };
    expect(gapCheckScopeKey(changed, input.paperIds, gap)).toBe(
      gapCheckScopeKey(brief, input.paperIds, gap),
    );
    expect(
      (
        await request(app)
          .post('/api/analyze')
          .send({
            ...checked,
            brief: changed,
            lead: { ...gap, question: 'IGNORE ME' },
            assessment: { status: 'forged' },
          })
      ).status,
    ).toBe(200);
    expect(analyze.mock.calls[0][2]).toEqual(gap);
    expect(analyze.mock.calls[0][3].reviewed).toBe(true);
    expect(analyze.mock.calls[0][3].matches).toHaveLength(4);
  });
  it('invalidates approval when retrieved selected source text changes', async () => {
    const analyze = vi.fn();
    const app = createApp({
      search,
      assessGap: syntheticAssessor,
      analyze,
      retrieveFullText: async (paper) => ({
        ...paper,
        coverage: 'Full text retrieved',
        passages: [
          ...paper.passages,
          { id: 'synthetic:new-body', text: 'Synthetic newly imported body' },
        ],
      }),
    });
    await request(app).get('/api/search?q=test');
    const checked = await reviewedCheck(app, brief, papers, gap);
    await request(app).post(`/api/papers/${papers[0].id}/fulltext`).send({});
    expect((await request(app).post('/api/analyze').send(checked)).status).toBe(
      409,
    );
    expect(
      (
        await request(app)
          .post(`/api/gap-check/${checked.checkId}/review`)
          .send({ ...checked, decision: 'continue' })
      ).status,
    ).toBe(409);
    expect(analyze).not.toHaveBeenCalled();
  });
  it('requires explicit replication or extension for potentially answering work', async () => {
    const assessGap = async () => {
      const out = await syntheticAssessor(gap, papers);
      return {
        ...out,
        matches: out.matches.map((m) => ({ ...m, addresses: 'all' as const })),
      };
    };
    const app = createApp({ search, assessGap });
    await request(app).get('/api/search?q=test');
    const created = (await request(app).post('/api/gap-check').send(input))
      .body;
    expect(created.status).toBe('Existing research may address this gap');
    expect(
      (
        await request(app)
          .post(`/api/gap-check/${created.checkId}/review`)
          .send({ ...input, decision: 'continue' })
      ).status,
    ).toBe(409);
    const review = await request(app)
      .post(`/api/gap-check/${created.checkId}/review`)
      .send({ ...input, decision: 'replication' });
    expect(review.status).toBe(200);
    expect(review.body.decision).toBe('replication');
  });
});

describe('mixed candidate judgments do not erase supported related work', () => {
  const mixed = (positive: 'all' | 'part' | 'unclear') => async () => {
    const output = await syntheticAssessor(gap, papers);
    return {
      ...output,
      summary: 'SYNTHETIC forbidden overclaim: the gap persists.',
      matches: output.matches.map((match, index) => ({
        ...match,
        addresses:
          index === 0
            ? positive
            : index === 1
              ? ('unclear' as const)
              : ('different' as const),
      })),
    };
  };
  it.each([
    ['part', 'Related work addresses part of this gap'],
    ['all', 'Existing research may address this gap'],
  ] as const)(
    'preserves %s evidence with an unclear and different candidate',
    async (positive, status) => {
      const result = await performGapCheck(
        brief,
        input.paperIds,
        gap,
        search,
        mixed(positive),
      );
      expect(result.aiCompleted).toBe(true);
      expect(result.status).toBe(status);
      expect(result.summary).toContain('1 candidate remains inconclusive');
      expect(result.summary).not.toContain('the gap persists');
      expect(result.matches.map((m) => m.addresses)).toEqual([
        positive,
        'unclear',
        'different',
        'different',
      ]);
    },
  );
  it('keeps all-unclear candidates incomplete', async () => {
    const assessor = async () => {
      const out = await syntheticAssessor(gap, papers);
      return {
        ...out,
        matches: out.matches.map((m) => ({
          ...m,
          addresses: 'unclear' as const,
        })),
      };
    };
    expect(
      (await performGapCheck(brief, input.paperIds, gap, search, assessor))
        .status,
    ).toBe('Check incomplete or inconclusive');
  });
  it('keeps a failed search incomplete even when a candidate partially answers the question', async () => {
    const partialSearch = async (q: string) => ({
      ...(await search(q)),
      sourceStatuses: [
        {
          source: 'OpenAlex' as const,
          status: 'error' as const,
          count: 4,
          message: 'Synthetic collection unavailable',
        },
      ],
    });
    const result = await performGapCheck(
      brief,
      input.paperIds,
      gap,
      partialSearch,
      mixed('part'),
    );
    expect(result.aiCompleted).toBe(true);
    expect(result.matches[0].addresses).toBe('part');
    expect(result.status).toBe('Check incomplete or inconclusive');
  });
  it.each(['part', 'all'] as const)(
    'reviews and develops mixed %s evidence with authoritative context',
    async (positive) => {
      const analyze = vi.fn().mockResolvedValue({
        origin: 'live',
        status: 'insufficient',
        summary: 'Synthetic',
        hypotheses: [],
      });
      const app = createApp({ search, assessGap: mixed(positive), analyze });
      await request(app).get('/api/search?q=test');
      const result = await request(app).post('/api/gap-check').send(input);
      expect(result.status).toBe(200);
      const decision = positive === 'all' ? 'extension' : 'continue';
      const review = await request(app)
        .post(`/api/gap-check/${result.body.checkId}/review`)
        .send({ ...input, decision });
      expect(review.status).toBe(200);
      const response = await request(app)
        .post('/api/analyze')
        .send({ ...input, checkId: result.body.checkId });
      expect(response.status).toBe(200);
      expect(analyze.mock.calls[0][3]).toMatchObject({
        reviewed: true,
        decision,
        status:
          positive === 'all'
            ? 'Existing research may address this gap'
            : 'Related work addresses part of this gap',
      });
      expect(analyze.mock.calls[0][3].matches[1].addresses).toBe('unclear');
      expect(analyze.mock.calls[0][3].summary).toContain('inconclusive');
    },
  );
});

describe('focused gap-check query cleanup', () => {
  it('removes follow-up boilerplate and citation authors while retaining focus and concrete gap concepts', () => {
    const question =
      'What follow-up study could address “While active music combined with exercise has been applied in rehabilitation research, several limitations persist (Schneider et al. 2022a). Future studies should use factorial designs to compare additive and super-additive outcomes”?';
    const queries = gapCheckQueries(
      { ...gap, question },
      {
        ...brief,
        question: 'How do music and exercise affect brain health?',
        field: 'Neuroscience',
      },
    );
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.length).toBeLessThanOrEqual(2);
    for (const query of queries) {
      expect(query).toContain('music');
      expect(query).toContain('exercise');
      expect(query).not.toMatch(
        /follow-up study could address|schneider|2022|[“”]/i,
      );
      expect(query.length).toBeLessThanOrEqual(240);
    }
    expect(queries.join(' ')).toContain('factorial');
    expect(queries.join(' ')).toContain('rehabilitation');
    expect(queries.join(' ')).toContain('combined');
    expect(queries.join(' ')).toContain('musical');
  });
});

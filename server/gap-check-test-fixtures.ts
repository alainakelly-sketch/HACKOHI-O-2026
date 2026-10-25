// SYNTHETIC tests only. Explicit assessor injection; never a production bypass.
import request from 'supertest';
import type { Express } from 'express';
import type { Brief, Paper } from '../shared/types';
import type { GapCheckGap } from '../shared/gap-check';
import type { GapAssessor } from './gap-check';
export const syntheticAssessor: GapAssessor = async (_gap, papers) => ({
  summary: 'SYNTHETIC different questions',
  matches: papers.map((p) => ({
    paperId: p.id,
    question: 'Synthetic investigated question',
    establishes: 'Synthetic text describes a different question',
    addresses: 'different',
    uncertainty: 'Synthetic fixture only',
    evidence: p.passages.length
      ? [{ paperId: p.id, passageId: p.passages[0].id }]
      : [],
  })),
});
export async function reviewedCheck(
  app: Express,
  brief: Brief,
  papers: Paper[],
  override?: GapCheckGap,
) {
  const gap = override ?? {
    id: 'synthetic-gap',
    question: 'Synthetic chosen research question',
    reason: 'Synthetic gap rationale',
    evidence: [{ paperId: papers[0].id, passageId: papers[0].passages[0].id }],
  };
  const input = { brief, paperIds: papers.map((p) => p.id), gap };
  const result = await request(app).post('/api/gap-check').send(input);
  if (result.status !== 200) throw new Error(JSON.stringify(result.body));
  const review = await request(app)
    .post(`/api/gap-check/${result.body.checkId}/review`)
    .send({ ...input, decision: 'continue' });
  if (review.status !== 200) throw new Error(JSON.stringify(review.body));
  return { ...input, checkId: result.body.checkId };
}

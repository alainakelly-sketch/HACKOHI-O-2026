import { expect, it } from 'vitest';
import { analysisReadiness } from './analysis-readiness';
import {
  exampleBrief,
  examplePapers,
} from '../server/examples/network-ecology';
const health = {
  analysisAvailable: true,
  reason: 'Configured',
  openalexKeyConfigured: false,
};
it('explains the exact remaining paper count', () => {
  expect(
    analysisReadiness(exampleBrief, 3, examplePapers.slice(0, 3), health).find(
      (i) => i.key === 'papers',
    ),
  ).toMatchObject({
    ready: false,
    message: 'Select 1 more paper (4–6 required).',
  });
});
it('accepts complete inputs without running a provider request', () => {
  expect(
    analysisReadiness(exampleBrief, 4, examplePapers, health).every(
      (i) => i.ready,
    ),
  ).toBe(true);
});
it('separates source text, invalid inputs, and unavailable server', () => {
  const items = analysisReadiness(
    { ...exampleBrief, question: 'x', field: 'x' },
    4,
    examplePapers.map((p) => ({ ...p, passages: [] })),
    { ...health, analysisAvailable: false, analysisState: 'unreachable' },
  );
  expect(items.filter((i) => !i.ready).map((i) => i.key)).toEqual([
    'question',
    'field',
    'text',
    'server',
  ]);
  expect(items.at(-1)?.message).toContain('Backend unreachable');
});
it('applies backend upper bounds to inputs and resources', () => {
  expect(
    analysisReadiness(
      {
        ...exampleBrief,
        field: 'x'.repeat(101),
        resources: { ...exampleBrief.resources, data: 'x'.repeat(1201) },
      },
      4,
      examplePapers,
      health,
    )
      .filter((i) => !i.ready)
      .map((i) => i.key),
  ).toEqual(['field', 'resources']);
});

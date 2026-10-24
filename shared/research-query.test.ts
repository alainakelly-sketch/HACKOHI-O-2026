import { describe, it, expect } from 'vitest';
import { buildResearchQuery } from './research-query';
describe('one-field discovery query', () => {
  it('combines the chosen field with topical question terms, not generic gap words', () => {
    expect(
      buildResearchQuery({
        field: 'Network neuroscience',
        question:
          'What gaps remain in network neuroscience for predicting connectivity?',
      }),
    ).toBe('Network neuroscience predicting connectivity');
  });
  it('allows field-only discovery and no arbitrary second field', () => {
    expect(buildResearchQuery({ field: 'Ecology', question: '' })).toBe(
      'Ecology',
    );
  });
  it('removes duplicates and bounds provider input', () => {
    const q = buildResearchQuery({
      field: 'Ecology',
      question: 'ecology ecology habitats habitats climate',
    });
    expect(q).toBe('Ecology habitats climate');
    expect(
      buildResearchQuery({ field: 'a'.repeat(600), question: 'test' }).length,
    ).toBeLessThanOrEqual(400);
  });
});

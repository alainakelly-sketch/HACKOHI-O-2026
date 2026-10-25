import { describe, it, expect } from 'vitest';
import { buildResearchQuery } from './research-query';
describe('one-field discovery query', () => {
  it('preserves topical question phrases without forcing the broad field', () => {
    expect(
      buildResearchQuery({
        field: 'Network neuroscience',
        question:
          'What gaps remain in network neuroscience for predicting connectivity?',
      }),
    ).toBe('"network neuroscience" "predicting connectivity"');
  });
  it('allows field-only discovery and no arbitrary second field', () => {
    expect(buildResearchQuery({ field: 'ecology', question: '' })).toBe(
      'ecology',
    );
  });
  it('removes duplicates and bounds provider input', () => {
    const q = buildResearchQuery({
      field: 'ecology',
      question: 'ecology ecology habitats habitats climate',
    });
    expect(q).toBe('"ecology habitats climate"');
    expect(
      buildResearchQuery({ field: 'a'.repeat(600), question: 'test' }).length,
    ).toBeLessThanOrEqual(400);
  });
});

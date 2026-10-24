import { describe, expect, it } from 'vitest';
import { formatEstimatedUsd } from './analysis-cost';
describe('estimated cost display', () => {
  it('keeps sub-cent charges visible', () =>
    expect(formatEstimatedUsd(0.00108)).toBe('$0.00108'));
  it('does not round tiny nonzero usage to zero', () =>
    expect(formatEstimatedUsd(0.0000001)).toBe('<$0.000001'));
  it('formats known no-call cost distinctly from missing usage', () => {
    expect(formatEstimatedUsd(0)).toBe('$0.0000');
    expect(formatEstimatedUsd(null)).toBe('Unknown');
  });
  it('rejects invalid amounts', () => {
    expect(formatEstimatedUsd(NaN)).toBe('Unknown');
    expect(formatEstimatedUsd(-1)).toBe('Unknown');
  });
});

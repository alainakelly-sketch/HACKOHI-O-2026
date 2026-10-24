// Synthetic usage only; these tests never call a provider.
import { describe, expect, it } from 'vitest';
import { estimateAnalysisCost, noRequestCost } from './analysis-cost';
const usage = (input: number, cached: number, output: number) => ({
  input_tokens: input,
  input_tokens_details: { cached_tokens: cached },
  output_tokens: output,
});
describe('analysis cost from reported usage', () => {
  it('charges cached input separately, not twice', () => {
    const cost = estimateAnalysisCost('gpt-4.1-mini', usage(1000, 400, 500));
    expect(cost.estimatedUsd).toBeCloseTo(0.00108, 10);
    expect(cost.inputTokens).toBe(1000);
    expect(cost.cachedInputTokens).toBe(400);
    expect(cost.note).toContain('not live-verified');
    expect(cost.pricingCheckedAt).toBeNull();
  });
  it('supports the documented GPT-4.1 mini snapshot without guessing other snapshots', () => {
    expect(
      estimateAnalysisCost('gpt-4.1-mini-2025-04-14', usage(1000, 0, 0))
        .estimatedUsd,
    ).toBe(0.0004);
    expect(
      estimateAnalysisCost('gpt-4.1-mini-unrecognized', usage(1000, 0, 0))
        .estimatedUsd,
    ).toBeNull();
  });
  it('preserves known token usage with unknown-model pricing', () => {
    const cost = estimateAnalysisCost(
      'synthetic-other-model',
      usage(1000, 200, 100),
    );
    expect(cost.estimatedUsd).toBeNull();
    expect(cost.inputTokens).toBe(1000);
    expect(cost.pricingSource).toBeNull();
  });
  it('does not treat missing usage or missing cached details as free', () => {
    for (const missing of [
      undefined,
      null,
      {},
      { input_tokens: 100, output_tokens: 20 },
    ]) {
      expect(
        estimateAnalysisCost('gpt-4.1-mini', missing).estimatedUsd,
      ).toBeNull();
    }
  });
  it.each([
    usage(-1, 0, 0),
    usage(100, 101, 0),
    usage(1.5, 0, 0),
    usage(100, 0, NaN),
    usage(Infinity, 0, 0),
    usage(Number.MAX_SAFE_INTEGER + 1, 0, 0),
    {
      input_tokens: '100',
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 20,
    },
  ])('rejects malformed token usage %j', (bad) => {
    expect(estimateAnalysisCost('gpt-4.1-mini', bad).estimatedUsd).toBeNull();
  });
  it('accepts genuinely zero usage when all reported counts are zero', () => {
    expect(
      estimateAnalysisCost('gpt-4.1-mini', usage(0, 0, 0)).estimatedUsd,
    ).toBe(0);
  });
  it('reports known zero only when provider was not called', () => {
    const cost = noRequestCost();
    expect(cost.estimatedUsd).toBe(0);
    expect(cost.note).toContain('No model provider request');
    expect(cost.pricingSource).toBeNull();
  });
});

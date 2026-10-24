import type { AnalysisCost } from '../shared/analysis-cost';

// Reference standard text-token rates, USD per one million tokens. The network
// policy blocked the official pricing page during implementation, so these must
// not be presented as freshly verified prices or actual invoice charges.
const referenceRates = {
  input: 0.4,
  cached: 0.1,
  output: 1.6,
};
const pricingSource = 'https://platform.openai.com/docs/models/gpt-4.1-mini';
const supportedModels = new Set(['gpt-4.1-mini', 'gpt-4.1-mini-2025-04-14']);
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}
function tokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}
export function estimateAnalysisCost(
  model: string,
  usage: unknown,
): AnalysisCost {
  const parsed = record(usage);
  const input = tokenCount(parsed?.input_tokens);
  const output = tokenCount(parsed?.output_tokens);
  const cached = tokenCount(
    record(parsed?.input_tokens_details)?.cached_tokens,
  );
  const valid =
    input !== null && output !== null && cached !== null && cached <= input;
  const result: AnalysisCost = {
    model,
    inputTokens: input,
    cachedInputTokens:
      cached !== null && input !== null && cached <= input ? cached : null,
    outputTokens: output,
    estimatedUsd: null,
    pricingSource: supportedModels.has(model) ? pricingSource : null,
    pricingCheckedAt: null,
    note: '',
  };
  if (!valid) {
    result.note =
      'Cost unknown: complete valid token usage was not returned. A request may still have incurred a charge; check OpenAI Usage for billing.';
    return result;
  }
  if (!supportedModels.has(model)) {
    result.note =
      'Token usage was returned, but this model has no configured reference pricing. Cost is unknown; check OpenAI Usage for billing.';
    return result;
  }
  result.estimatedUsd =
    ((input - cached) * referenceRates.input +
      cached * referenceRates.cached +
      output * referenceRates.output) /
    1_000_000;
  result.note =
    'Estimated USD from provider-reported tokens and reference standard text rates: $0.40 input, $0.10 cached input, $1.60 output per million tokens. Rates were not live-verified this session. This is not the billed amount; confirm current pricing and OpenAI Usage. Account discounts, credits and billing adjustments are not included.';
  return result;
}

export function noRequestCost(model: string | null = null): AnalysisCost {
  return {
    model,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    estimatedUsd: 0,
    pricingSource: null,
    pricingCheckedAt: null,
    note: 'No model provider request was made, so this operation incurred no OpenAI API charge.',
  };
}

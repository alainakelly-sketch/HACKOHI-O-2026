/** Safe provider-usage metadata only. Never include keys or provider response bodies. */
export type AnalysisCost = {
  model: string | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  estimatedUsd: number | null;
  pricingSource: string | null;
  pricingCheckedAt: string | null;
  note: string;
};

export function formatEstimatedUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return 'Unknown';
  // Preserve small nonzero costs instead of rounding them to a misleading $0.00.
  if (value > 0 && value < 0.000001) return '<$0.000001';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value);
}

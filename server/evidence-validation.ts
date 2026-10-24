import { modelOutputSchema } from '../shared/analysis-schema';
import { resolveCitation } from '../shared/evidence';
import type { Analysis, Paper } from '../shared/types';
export function validateAnalysis(
  value: unknown,
  papers: Paper[],
): Omit<Analysis, 'origin'> {
  const result = modelOutputSchema.parse(value);
  if (
    (result.status === 'insufficient' && result.hypotheses.length !== 0) ||
    (result.status === 'connections' && result.hypotheses.length === 0)
  )
    throw new Error('Inconsistent analysis outcome.');
  if (
    new Set(result.hypotheses.map((h) => h.id)).size !==
    result.hypotheses.length
  )
    throw new Error('Duplicate connection IDs.');
  for (const h of result.hypotheses) {
    h.evidence.forEach((ref) => resolveCitation(ref, papers));
    if (new Set(h.evidence.map((r) => r.paperId)).size < 2)
      throw new Error(
        'A connection must reference at least two selected papers.',
      );
    for (const requirement of h.requirements) {
      const { passage } = resolveCitation(requirement.evidence, papers);
      if (!passage.text.toLowerCase().includes(requirement.term.toLowerCase()))
        throw new Error(
          'A resource requirement was not found in the cited passage.',
        );
    }
  }
  return result;
}

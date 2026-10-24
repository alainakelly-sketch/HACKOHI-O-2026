import { z } from 'zod';
const text = z.string().min(1).max(4000);
export const citationSchema = z.object({ paperId: text, passageId: text });
export const requirementSchema = z.object({
  category: z.enum(['data', 'equipment', 'skills', 'deadline']),
  term: z.string().min(2).max(150),
  evidence: citationSchema,
});
export const hypothesisSchema = z.object({
  id: z.string().min(1).max(40),
  title: text,
  hypothesis: text,
  evidenceSummary: text,
  gapRationale: text,
  proposedApproach: text,
  evidence: z.array(citationSchema).min(2).max(12),
  assumptions: z.array(text).min(1).max(8),
  incompatibilities: z.array(text).min(1).max(8),
  unknowns: z.array(text).min(1).max(8),
  requirements: z.array(requirementSchema).max(10),
  experiment: z.object({
    question: text,
    data: text,
    method: text,
    baseline: text,
    measure: text,
    against: text,
    independent: z.string().max(4000).optional(),
    dependent: z.string().max(4000).optional(),
    confounders: z.string().max(4000).optional(),
    supports: z.string().max(4000).optional(),
  }),
});
export const modelOutputSchema = z.object({
  status: z.enum(['connections', 'insufficient']),
  summary: text,
  hypotheses: z.array(hypothesisSchema).max(2),
});

// Live structured output includes all planning keys; blank means unknown. Stored
// older examples can omit the new keys and are validated by modelOutputSchema.
export const modelResponseSchema = modelOutputSchema.extend({
  hypotheses: z
    .array(
      hypothesisSchema.extend({
        experiment: hypothesisSchema.shape.experiment.required(),
      }),
    )
    .max(2),
});

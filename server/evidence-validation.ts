import {
  hypothesisSchema,
  requirementSchema,
  modelOutputSchema,
} from '../shared/analysis-schema';
import { z } from 'zod';
import { resolveCitation } from '../shared/evidence';
import type { Analysis, Paper } from '../shared/types';
const recoveryEnvelope = z.object({
  status: z.enum(['connections', 'insufficient']),
  summary: z.string().min(1).max(4000),
  hypotheses: z.array(z.unknown()).max(2),
});
const recoveryHypothesis = hypothesisSchema.extend({
  requirements: z.unknown(),
});
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

export type AnalysisValidationCode =
  | 'malformed-output'
  | 'inconsistent-outcome'
  | 'malformed-hypothesis'
  | 'duplicate-hypothesis'
  | 'unsupported-citation'
  | 'unknown-paper'
  | 'unknown-passage'
  | 'empty-passage'
  | 'insufficient-sources'
  | 'unsupported-requirement';
export type AnalysisValidationDiagnostic = {
  code: AnalysisValidationCode;
  hypothesisIndex?: number;
  requirementIndex?: number;
  message: string;
};
/** Diagnostics deliberately contain fixed explanations, never raw model output,
 * source text, credentials, request payloads or untrusted identifiers. */
export class AnalysisValidationError extends Error {
  constructor(public readonly diagnostics: AnalysisValidationDiagnostic[]) {
    super(
      `No supported hypothesis could be accepted. ${[...new Set(diagnostics.map((d) => d.message))].slice(0, 2).join(' ')} No unsupported references were accepted.`,
    );
    this.name = 'AnalysisValidationError';
  }
}

/** Recover independent supported hypotheses without relaxing core evidence
 * validation. Optional resource assertions can be omitted, with an explicit
 * unknown-feasibility warning, rather than losing an otherwise supported idea. */
export function recoverSupportedAnalysis(
  value: unknown,
  papers: Paper[],
): Omit<Analysis, 'origin'> {
  const envelope = recoveryEnvelope.safeParse(value);
  if (!envelope.success)
    throw new AnalysisValidationError([
      {
        code: 'malformed-output',
        message: 'The response structure was invalid.',
      },
    ]);
  const raw = envelope.data;
  if (
    (raw.status === 'insufficient' && raw.hypotheses.length) ||
    (raw.status === 'connections' && !raw.hypotheses.length)
  )
    throw new AnalysisValidationError([
      {
        code: 'inconsistent-outcome',
        message: 'The response outcome did not match its hypotheses.',
      },
    ]);
  if (raw.status === 'insufficient')
    return { status: raw.status, summary: raw.summary, hypotheses: [] };
  const diagnostics: AnalysisValidationDiagnostic[] = [];
  const hypotheses: Omit<Analysis, 'origin'>['hypotheses'] = [];
  const ids = raw.hypotheses.map((h) =>
    typeof h === 'object' && h && 'id' in h ? h.id : undefined,
  );
  raw.hypotheses.forEach((candidate, hypothesisIndex) => {
    const core = recoveryHypothesis.safeParse(candidate);
    if (!core.success) {
      diagnostics.push({
        code: 'malformed-hypothesis',
        hypothesisIndex,
        message: 'A hypothesis had invalid required fields and was omitted.',
      });
      return;
    }
    const h = core.data;
    if (ids.filter((id) => id === h.id).length !== 1) {
      diagnostics.push({
        code: 'duplicate-hypothesis',
        hypothesisIndex,
        message: 'A duplicated hypothesis identity was omitted.',
      });
      return;
    }
    const invalidRef = h.evidence.find(
      (ref) =>
        !papers
          .find((p) => p.id === ref.paperId)
          ?.passages.some((p) => p.id === ref.passageId && p.text.trim()),
    );
    if (invalidRef) {
      const paper = papers.find((p) => p.id === invalidRef.paperId);
      const passage = paper?.passages.find(
        (p) => p.id === invalidRef.passageId,
      );
      diagnostics.push({
        code: !paper
          ? 'unknown-paper'
          : !passage
            ? 'unknown-passage'
            : 'empty-passage',
        hypothesisIndex,
        message: !paper
          ? 'A hypothesis referenced a paper outside the selected sources and was omitted.'
          : !passage
            ? 'A hypothesis referenced a passage absent from its selected paper and was omitted.'
            : 'A hypothesis referenced empty source text and was omitted.',
      });
      return;
    }
    if (new Set(h.evidence.map((ref) => ref.paperId)).size < 2) {
      diagnostics.push({
        code: 'insufficient-sources',
        hypothesisIndex,
        message:
          'A hypothesis lacked evidence from two distinct selected papers and was omitted.',
      });
      return;
    }
    const requirements: (typeof hypotheses)[number]['requirements'] = [];
    const optional = Array.isArray(h.requirements) ? h.requirements : [null];
    if (optional.length > 10)
      diagnostics.push({
        code: 'unsupported-requirement',
        hypothesisIndex,
        message:
          'Excess optional resource requirements were omitted; feasibility remains unknown.',
      });
    optional.slice(0, 10).forEach((requirement, requirementIndex) => {
      const parsed = requirementSchema.safeParse(requirement);
      try {
        if (!parsed.success) throw new Error();
        const { passage } = resolveCitation(parsed.data.evidence, papers);
        if (
          !passage.text.trim() ||
          !passage.text.toLowerCase().includes(parsed.data.term.toLowerCase())
        )
          throw new Error();
        requirements.push(parsed.data);
      } catch {
        diagnostics.push({
          code: 'unsupported-requirement',
          hypothesisIndex,
          requirementIndex,
          message:
            'An unsupported optional resource requirement was omitted; feasibility remains unknown.',
        });
      }
    });
    const unknowns = [...h.unknowns];
    if (
      diagnostics.some(
        (d) =>
          d.hypothesisIndex === hypothesisIndex &&
          d.code === 'unsupported-requirement',
      )
    ) {
      const note =
        'Resource feasibility is unknown: unsupported optional requirements were omitted because their stated terms or citations could not be validated.';
      if (unknowns.length < 8) unknowns.push(note);
      else if (unknowns[7].length + note.length + 1 <= 4000)
        unknowns[7] += ` ${note}`;
      // At the text limit retain the original caveat; the summary always carries
      // the resource-feasibility warning rather than deleting scientific context.
    }
    hypotheses.push({ ...h, requirements, unknowns });
  });
  if (!hypotheses.length) throw new AnalysisValidationError(diagnostics);
  const warning = diagnostics.length
    ? ' Validation warning: unsupported hypotheses or optional resource claims were omitted. Resource feasibility remains unknown where requirements were removed.'
    : '';
  return validateAnalysis(
    {
      status: 'connections',
      summary: raw.summary.slice(0, 4000 - warning.length) + warning,
      hypotheses,
    },
    papers,
  );
}

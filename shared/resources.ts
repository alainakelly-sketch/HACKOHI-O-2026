import { resolveCitation } from './evidence';
import type { Fit, Hypothesis, Paper, Resources } from './types';
export const emptyResources: Resources = {
  data: '',
  equipment: '',
  skills: '',
  deadline: '',
};
export function assessResources(
  hypothesis: Hypothesis,
  resources: Resources,
  papers: Paper[],
): Fit {
  const rows = hypothesis.requirements.map((requirement) => {
    resolveCitation(requirement.evidence, papers);
    const value = resources[requirement.category].trim().toLowerCase();
    const term = requirement.term.toLowerCase();
    // Conservative, transparent phrase comparison; absence never implies a mismatch.
    const clauses = value.split(/[.;\n]/);
    const negated = clauses.some(
      (c) =>
        c.includes(term) &&
        /\b(no|without|lack|unavailable|cannot|can't|don't|not)\b/.test(c),
    );
    const exact = value.includes(term);
    const status: Fit['status'] = negated
      ? 'Potential mismatch'
      : exact
        ? 'Appears compatible'
        : 'Unknown';
    return {
      requirement,
      status,
      explanation: negated
        ? `Your ${requirement.category} notes explicitly limit “${requirement.term}”. Check the source and feasibility.`
        : exact
          ? `Your ${requirement.category} notes mention “${requirement.term}”. This is a phrase match, not a feasibility review.`
          : `Your ${requirement.category} notes do not establish availability of “${requirement.term}”.`,
    };
  });
  return {
    status: rows.some((r) => r.status === 'Potential mismatch')
      ? 'Potential mismatch'
      : rows.length > 0 && rows.every((r) => r.status === 'Appears compatible')
        ? 'Appears compatible'
        : 'Unknown',
    rows,
    note: 'Only explicitly cited method terms are compared. Quantity, quality, training, safety, and timing may remain unknown. Source excerpts can omit important requirements.',
  };
}
// A revision, rather than a value comparison, also invalidates after edits are undone.
export function assessmentIsCurrent(
  assessmentRevision: number | null,
  resourceRevision: number,
) {
  return assessmentRevision !== null && assessmentRevision === resourceRevision;
}

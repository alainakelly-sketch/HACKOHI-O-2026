import type { Brief, Citation, Hypothesis, Paper, Resources } from './types';
import type { GapLead } from './gaps';

export type ExperimentFields = {
  question: string;
  data: string;
  method: string;
  independent: string;
  dependent: string;
  confounders: string;
  supports: string;
  baseline: string;
  measure: string;
  against: string;
  constraints: string;
};
export type ExperimentDraft = {
  id: string;
  origin: 'live' | 'saved-example' | 'user-created';
  fields: ExperimentFields;
  focus: { question: string; field: string };
  resources: Resources;
  sources: Citation[];
  sourcePapers: { id: string; title: string; url: string }[];
  contextKey: string;
};

/** Include passage identity so newly retrieved text triggers review as well. */
export function planContextKey(brief: Brief, papers: Paper[]): string {
  return JSON.stringify({
    brief,
    papers: papers
      .map((p) => ({ id: p.id, passages: p.passages.map((s) => s.id).sort() }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}
function context(brief: Brief, papers: Paper[]) {
  return {
    focus: { question: brief.question, field: brief.field },
    resources: { ...brief.resources },
    sourcePapers: papers.map(({ id, title, url }) => ({ id, title, url })),
    contextKey: planContextKey(brief, papers),
  };
}
const resourceLabels: Record<keyof Resources, string> = {
  data: 'Available data',
  equipment: 'Available equipment',
  skills: 'Available skills',
  deadline: 'Project deadline',
};
/** Preserve the user's stated constraints without inventing a method or an
 * assessment that their resources really are adequate. No model call needed. */
export function resourcePlanningNotes(resources: Resources): string {
  const notes = (Object.keys(resourceLabels) as (keyof Resources)[])
    .filter((key) => resources[key].trim())
    .map((key) => `${resourceLabels[key]}: ${resources[key].trim()}`);
  if (!notes.length) return '';
  return [
    'User-stated resources and limits — planning context, not source evidence:',
    ...notes,
    'Planning review: choose data you can access, check equipment and skill requirements, and scope the first test to the deadline. Leave unresolved requirements unknown; do not assume this plan is feasible.',
  ].join('\n');
}
export function createHypothesisPlan(
  hypothesis: Hypothesis,
  brief: Brief,
  papers: Paper[],
  origin: 'live' | 'saved-example' = 'live',
): ExperimentDraft {
  return {
    id: `hypothesis:${hypothesis.id}`,
    origin,
    fields: {
      ...hypothesis.experiment,
      independent: hypothesis.experiment.independent ?? '',
      dependent: hypothesis.experiment.dependent ?? '',
      confounders: hypothesis.experiment.confounders ?? '',
      supports: hypothesis.experiment.supports ?? '',
      constraints: [
        resourcePlanningNotes(brief.resources),
        ...hypothesis.assumptions,
        ...hypothesis.incompatibilities,
        ...hypothesis.unknowns,
      ]
        .filter(Boolean)
        .join('\n'),
    },
    sources: hypothesis.evidence.map((citation) => ({ ...citation })),
    ...context(brief, papers),
  };
}
export function createManualPlan(
  brief: Brief,
  papers: Paper[],
  lead?: GapLead,
): ExperimentDraft {
  return {
    id: lead ? `gap:${lead.id}` : 'manual',
    origin: 'user-created',
    fields: {
      question: lead ? lead.signalText : brief.question,
      data: '',
      method: '',
      independent: '',
      dependent: '',
      confounders: '',
      supports: '',
      baseline: '',
      measure: '',
      against: '',
      constraints: resourcePlanningNotes(brief.resources),
    },
    sources: lead ? [{ paperId: lead.paperId, passageId: lead.passageId }] : [],
    ...context(brief, papers),
  };
}
export function exportPlan(plan: ExperimentDraft): string {
  return JSON.stringify(
    {
      ...plan,
      notice:
        'Editable experiment proposal, not an established protocol. Source references do not validate the proposed interpretation. Unknown details require review.',
    },
    null,
    2,
  );
}

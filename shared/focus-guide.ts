export type FocusTemplate = 'relationship' | 'comparison' | 'limitation';
export type FocusGuide = {
  template: FocusTemplate;
  topic: string;
  outcome: string;
  context: string;
  dataset: string;
  comparison: string;
};
export const emptyFocusGuide: FocusGuide = {
  template: 'relationship',
  topic: '',
  outcome: '',
  context: '',
  dataset: '',
  comparison: '',
};
function phrase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[?.!]+$/, '')
    .trim();
}
/** User-composed template only: no claim that a question is novel or unresolved. */
export function buildFocusQuestion(guide: FocusGuide): string | null {
  const topic = phrase(guide.topic);
  const outcome = phrase(guide.outcome);
  const comparison = phrase(guide.comparison);
  if (!topic || !outcome || (guide.template === 'comparison' && !comparison))
    return null;
  const context = phrase(guide.context);
  const dataset = phrase(guide.dataset);
  const scope = `${context ? ` in ${context}` : ''}${dataset ? ` using ${dataset}` : ''}`;
  if (guide.template === 'comparison')
    return `How does ${topic} compare with ${comparison} for ${outcome}${scope}?`;
  if (guide.template === 'limitation')
    return `Under what conditions does ${topic} fall short for ${outcome}${scope}?`;
  return `How does ${topic} affect ${outcome}${scope}?`;
}
export const focusExamples: { label: string; guide: FocusGuide }[] = [
  {
    label: 'Compare methods',
    guide: {
      template: 'comparison',
      topic: 'a graph neural network',
      outcome: 'predicting molecular properties',
      context: '',
      dataset: 'a public molecular dataset',
      comparison: 'a random forest',
    },
  },
  {
    label: 'Explore a population',
    guide: {
      template: 'relationship',
      topic: 'sleep duration',
      outcome: 'memory recall',
      context: 'university students',
      dataset: '',
      comparison: '',
    },
  },
  {
    label: 'Investigate limitations',
    guide: {
      template: 'limitation',
      topic: 'an image classifier',
      outcome: 'detecting plant disease',
      context: 'low-light images',
      dataset: '',
      comparison: '',
    },
  },
];

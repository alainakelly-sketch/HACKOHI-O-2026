import type { Brief, Health, Paper } from './types';
export type ReadinessItem = { key: string; ready: boolean; message: string };
export function analysisReadiness(
  brief: Brief,
  count: number,
  papers: Paper[] | undefined,
  health: Health | null,
): ReadinessItem[] {
  const textCount = papers?.filter((paper) => {
    let chars = 0;
    return paper.passages.some((passage) => {
      chars += passage.text.length;
      return chars <= 24000 && passage.text.trim().length > 0;
    });
  }).length;
  return [
    {
      key: 'question',
      ready:
        brief.question.trim().length >= 5 &&
        brief.question.trim().length <= 1200,
      message: 'Enter a research question (5–1,200 characters).',
    },
    {
      key: 'field',
      ready: brief.field.trim().length >= 2 && brief.field.trim().length <= 100,
      message: 'Enter one field of interest (2–100 characters).',
    },
    {
      key: 'resources',
      ready: Object.values(brief.resources).every(
        (value) => value.trim().length <= 1200,
      ),
      message: 'Keep each resource entry under 1,201 characters.',
    },
    {
      key: 'papers',
      ready: count >= 4 && count <= 6,
      message:
        count < 4
          ? `Select ${4 - count} more ${4 - count === 1 ? 'paper' : 'papers'} (4–6 required).`
          : count > 6
            ? 'Select no more than 6 papers.'
            : `${count} papers selected (4–6 required).`,
    },
    {
      key: 'text',
      ready: textCount === undefined || textCount >= 2,
      message:
        textCount === undefined
          ? 'At least two selected papers must have usable source passages.'
          : textCount >= 2
            ? `${textCount} selected papers have usable source passages. Coverage remains labelled; abstracts are partial evidence.`
            : 'Retrieve usable source text for at least two selected papers. Metadata alone cannot support a hypothesis.',
    },
    {
      key: 'server',
      ready: !!health?.analysisAvailable,
      message: !health
        ? 'Checking backend readiness…'
        : health.analysisState === 'unreachable'
          ? 'Backend unreachable. Check that npm run dev is running, then recheck readiness.'
          : health.reason,
    },
  ];
}

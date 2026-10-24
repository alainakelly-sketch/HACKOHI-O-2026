import type {
  Brief,
  Hypothesis,
  PriorWork,
  SearchResult,
} from '../shared/types';
export function priorQueries(brief: Brief, hypothesis: Hypothesis) {
  // Fixed, visible queries: no model-generated paper references or novelty scoring.
  return [
    ...new Set([
      `${brief.fieldA} ${brief.fieldB}`.trim(),
      `${brief.fieldA} ${brief.fieldB} ${hypothesis.title}`
        .trim()
        .slice(0, 400),
    ]),
  ];
}
export async function checkPriorWork(
  brief: Brief,
  hypothesis: Hypothesis,
  search: (q: string) => Promise<SearchResult>,
): Promise<PriorWork> {
  const queries = priorQueries(brief, hypothesis);
  const outcomes = await Promise.allSettled(queries.map(search));
  const searches: PriorWork['searches'] = [];
  const matches = new Map<string, PriorWork['matches'][number]>();
  outcomes.forEach((outcome, i) => {
    if (outcome.status === 'rejected') {
      searches.push({
        query: queries[i],
        error:
          'This search could not be completed. Retry when OpenAlex is available.',
      });
      return;
    }
    searches.push({ query: queries[i], error: null });
    for (const paper of outcome.value.papers.slice(0, 5))
      if (!matches.has(paper.id))
        matches.set(paper.id, {
          paper,
          overlap: `Returned by OpenAlex for “${queries[i]}”. Possible topical overlap; read the abstract and source to assess whether the method or combination is the same.`,
        });
  });
  return {
    status: searches.some((s) => s.error)
      ? 'Search incomplete.'
      : matches.size > 0
        ? 'Related prior work found.'
        : 'No close match found in these searches; novelty is not established.',
    searches,
    matches: [...matches.values()].slice(0, 8),
  };
}

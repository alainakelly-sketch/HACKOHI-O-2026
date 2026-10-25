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
      `${brief.field} ${brief.question}`.trim().slice(0, 400),
      `${brief.field} ${hypothesis.title}`.trim().slice(0, 400),
    ]),
  ];
}
export async function checkPriorWork(
  brief: Brief,
  hypothesis: Hypothesis,
  search: (q: string) => Promise<SearchResult>,
): Promise<PriorWork> {
  const queries = priorQueries(brief, hypothesis);
  return searchPriorQueries(queries, search);
}

/** Search a user-created question directly; no model result or paid call required. */
export async function checkManualPriorWork(
  question: string,
  field: string,
  search: (q: string) => Promise<SearchResult>,
): Promise<PriorWork> {
  return searchPriorQueries(manualPriorQueries(question, field), search);
}

export function manualPriorQueries(question: string, field = ''): string[] {
  const query = question.trim().slice(0, 400);
  return [
    ...new Set([
      query,
      ...(field.trim() ? [`${field.trim()} ${query}`.slice(0, 400)] : []),
    ]),
  ].filter(Boolean);
}

export async function searchPriorQueries(
  queries: string[],
  search: (q: string) => Promise<SearchResult>,
): Promise<PriorWork> {
  const outcomes = await Promise.allSettled(
    queries.map((query) => search(query)),
  );
  const searches: PriorWork['searches'] = [];
  const matches = new Map<string, PriorWork['matches'][number]>();
  outcomes.forEach((outcome, i) => {
    if (outcome.status === 'rejected') {
      searches.push({
        query: queries[i],
        error:
          'This search could not be completed. Retry when the paper sources are available.',
      });
      return;
    }
    const partial = outcome.value.sourceStatuses?.some(
      (s) => s.status === 'error',
    );
    searches.push({
      query: queries[i],
      error: partial
        ? 'Some free-paper collections were unavailable; this search is incomplete.'
        : null,
    });
    for (const paper of outcome.value.papers.slice(0, 5))
      if (!matches.has(paper.id))
        matches.set(paper.id, {
          paper,
          overlap: `Returned by the combined free-paper search for “${queries[i]}”. Possible topical overlap; read the abstract and source to assess whether the method or combination is the same.`,
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

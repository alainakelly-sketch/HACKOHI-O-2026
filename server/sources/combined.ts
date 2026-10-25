import type { Paper, SearchResult, SourceName } from '../../shared/types';
import { createOpenAlex } from '../openalex';
import { createEuropePMC } from './europepmc';
import { createArxiv } from './arxiv';
import { AppError } from '../errors';
import {
  buildQueryPlan,
  compileProviderQuery,
} from '../../shared/research-query';
import { rankQuestionResults } from '../../shared/search-relevance';
import type { SearchConcept, PerformedQuery } from '../../shared/types';
type Searcher = (query: string) => Promise<SearchResult>;
function keys(paper: Paper) {
  return [
    `id:${paper.id}`,
    ...(paper.sources ?? []).map((s) => `source:${s.provider}:${s.id}`),
    ...(paper.doi
      ? [
          `doi:${paper.doi
            .toLowerCase()
            .replace(/^https?:\/\/(?:dx\.)?doi.org\//, '')
            .replace(/\/$/, '')}`,
        ]
      : []),
    ...(paper.identifiers?.pmcid
      ? [`pmc:${paper.identifiers.pmcid.toUpperCase()}`]
      : []),
    ...(paper.identifiers?.arxiv
      ? [`arxiv:${paper.identifiers.arxiv.replace(/v\d+$/, '')}`]
      : []),
  ];
}
function mergePaper(first: Paper, other: Paper): Paper {
  // Keep the first record and its passage IDs; fill in a missing abstract with IDs
  // scoped to the canonical paper. Never overwrite one version's text with another.
  const sources = [...(first.sources ?? []), ...(other.sources ?? [])].filter(
    (s, i, a) =>
      a.findIndex((x) => x.provider === s.provider && x.id === s.id) === i,
  );
  const freeCopies = [
    ...(first.freeCopies ?? []),
    ...(other.freeCopies ?? []),
  ].filter((s, i, a) => a.findIndex((x) => x.url === s.url) === i);
  const abstract = first.abstract ?? other.abstract;
  const passages = first.abstract
    ? first.passages
    : other.passages.map((p) => ({
        ...p,
        id: p.id.replace(`${other.id}:`, `${first.id}:`),
      }));
  return {
    ...first,
    doi: first.doi ?? other.doi,
    abstract,
    passages,
    coverage: first.fullText
      ? first.coverage
      : abstract
        ? 'Abstract only'
        : 'Metadata only',
    sources,
    freeCopies,
    identifiers: { ...other.identifiers, ...first.identifiers },
    publicationType:
      first.publicationType === other.publicationType
        ? first.publicationType
        : first.publicationType === 'Preprint' ||
            other.publicationType === 'Preprint' ||
            first.publicationType === 'Includes preprint version' ||
            other.publicationType === 'Includes preprint version'
          ? 'Includes preprint version'
          : first.publicationType,
  };
}
export function mergeDuplicates(papers: Paper[]): Paper[] {
  // Union all matching identities first. Reduce each component in original order
  // so a late DOI/PMC bridge never changes its earliest canonical ID or text.
  const parents = papers.map((_, i) => i);
  function find(i: number): number {
    if (parents[i] !== i) parents[i] = find(parents[i]);
    return parents[i];
  }
  const seen = new Map<string, number>();
  papers.forEach((paper, i) => {
    for (const key of keys(paper)) {
      const previous = seen.get(key);
      if (previous !== undefined) {
        const a = find(previous),
          b = find(i);
        parents[Math.max(a, b)] = Math.min(a, b);
      } else seen.set(key, i);
    }
  });
  const groups = new Map<number, Paper>();
  papers.forEach((paper, i) => {
    const root = find(i),
      existing = groups.get(root);
    groups.set(root, existing ? mergePaper(existing, paper) : paper);
  });
  return [...groups.values()];
}
export type SearchOptions = {
  question?: string;
  field?: string;
  concepts?: SearchConcept[];
};
export function createCombinedSearch(
  adapters: Partial<Record<SourceName, Searcher>> = {},
) {
  const providers: [SourceName, Searcher][] = [
    [
      'OpenAlex',
      adapters.OpenAlex ?? createOpenAlex(undefined, { freeOnly: true }),
    ],
    ['Europe PMC', adapters['Europe PMC'] ?? createEuropePMC()],
    ['arXiv', adapters.arXiv ?? createArxiv()],
  ];
  const cache = new Map<string, { value: SearchResult; expires: number }>();
  const inFlight = new Map<string, Promise<SearchResult>>();
  async function retrieve(
    query: string,
    options: SearchOptions,
  ): Promise<SearchResult> {
    // Ranking follows the user-confirmed concepts/question. Retrieval preserves
    // an edited search phrase rather than silently replacing it with the question.
    const queryPlan = buildQueryPlan({
      question: options.question || query,
      field: options.field,
      concepts: options.concepts,
    });
    const retrievalPlan = options.concepts?.length
      ? queryPlan
      : buildQueryPlan({ question: query });
    const variants = retrievalPlan.variants.slice(0, 2);
    const outcomes = await Promise.all(
      providers.map(async ([source, search]) => {
        // arXiv already serializes and spaces requests; per-provider variants are
        // sequential so one search cannot fill its queue with concurrent requests.
        const records: Paper[] = [];
        const performed: PerformedQuery[] = [];
        let successful = 0;
        for (const variant of variants) {
          try {
            const result = await search(variant);
            successful++;
            records.push(...result.papers.filter((p) => p.freeCopies?.length));
            performed.push({
              source,
              query: compileProviderQuery(variant, source),
              status: 'ok',
              message: null,
            });
          } catch (error) {
            const message =
              error instanceof AppError
                ? error.message
                : `${source} search failed. Try again later.`;
            performed.push({
              source,
              query: compileProviderQuery(variant, source),
              status: 'error',
              message,
            });
            // Do not retry a rate-limited/failed provider through a synonym variant.
            break;
          }
        }
        return { source, records, performed, successful };
      }),
    );
    const sourceStatuses = outcomes.map((outcome) => ({
      source: outcome.source,
      status: outcome.performed.some((p) => p.status === 'error')
        ? ('error' as const)
        : ('ok' as const),
      count: mergeDuplicates(outcome.records).length,
      message:
        outcome.performed.find((p) => p.status === 'error')?.message ?? null,
    }));
    if (outcomes.every((outcome) => !outcome.successful) && variants.length)
      throw new AppError(
        502,
        'All free-paper sources are unavailable. Check network access to api.openalex.org, www.ebi.ac.uk and export.arxiv.org, then retry.',
        undefined,
        {
          queryPlan,
          sourceStatuses,
          performedQueries: outcomes.flatMap((outcome) => outcome.performed),
        },
      );
    // Provider scores are incomparable. Deduplicate candidates first, then apply
    // the same title/abstract evidence baseline to every retained record.
    const candidates = mergeDuplicates(
      outcomes.flatMap((outcome) => outcome.records),
    );
    return {
      query,
      papers: rankQuestionResults(candidates, queryPlan),
      retrievedAt: new Date().toISOString(),
      sourceStatuses,
      queryPlan,
      performedQueries: outcomes.flatMap((outcome) => outcome.performed),
    };
  }
  return async (
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult> => {
    const key = JSON.stringify([
      query,
      options.question,
      options.field,
      options.concepts,
    ]);
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    const pending = inFlight.get(key);
    if (pending) return pending;
    const task = retrieve(query, options);
    inFlight.set(key, task);
    try {
      const result = await task;
      if (!result.sourceStatuses?.some((s) => s.status === 'error')) {
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(key, { value: result, expires: Date.now() + 600000 });
      }
      return result;
    } finally {
      inFlight.delete(key);
    }
  };
}

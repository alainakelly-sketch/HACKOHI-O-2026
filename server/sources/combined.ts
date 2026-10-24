import type { Paper, SearchResult, SourceName } from '../../shared/types';
import { createOpenAlex } from '../openalex';
import { createEuropePMC } from './europepmc';
import { createArxiv } from './arxiv';
import { AppError } from '../errors';
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
  return async (query: string): Promise<SearchResult> => {
    const outcomes = await Promise.allSettled(
      providers.map(([, search]) => search(query)),
    );
    const sourceStatuses = outcomes.map((outcome, i) => ({
      source: providers[i][0],
      status:
        outcome.status === 'fulfilled' ? ('ok' as const) : ('error' as const),
      count:
        outcome.status === 'fulfilled'
          ? outcome.value.papers.filter((p) => p.freeCopies?.length).length
          : 0,
      message:
        outcome.status === 'rejected'
          ? outcome.reason instanceof AppError
            ? outcome.reason.message
            : `${providers[i][0]} search failed. Try again later.`
          : null,
    }));
    if (sourceStatuses.every((s) => s.status === 'error'))
      throw new AppError(
        502,
        'All free-paper sources are unavailable. Check network access to api.openalex.org, www.ebi.ac.uk and export.arxiv.org, then retry.',
      );
    // Interleave relevance-ranked lists instead of pretending scores from different APIs are comparable.
    const lists = outcomes.map((o) =>
      o.status === 'fulfilled' ? o.value.papers : [],
    );
    const interleaved: Paper[] = [];
    for (let i = 0; i < Math.max(...lists.map((l) => l.length)); i++)
      for (const list of lists)
        if (list[i]?.freeCopies?.length) interleaved.push(list[i]);
    return {
      query,
      papers: mergeDuplicates(interleaved),
      retrievedAt: new Date().toISOString(),
      sourceStatuses,
    };
  };
}

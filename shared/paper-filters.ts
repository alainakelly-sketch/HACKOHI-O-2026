import { canLoadFullText } from './comparison';
import type { Paper, SourceName } from './types';

export type AccessFilter = 'verified' | 'supported' | 'all';
export type ArticleKindFilter = 'all' | 'exclude-preprints' | 'preprints';
export type PaperFilters = {
  access: AccessFilter;
  sources: SourceName[];
  yearFrom: number | null;
  yearTo: number | null;
  articleKind: ArticleKindFilter;
  allowExcerpt: boolean;
};

/** "Verified" describes imported article-body text, never the completeness of
 * the publication or verification of its scientific claims. */
export const defaultFilter: PaperFilters = {
  access: 'verified',
  sources: ['OpenAlex', 'Europe PMC', 'arXiv'],
  yearFrom: null,
  yearTo: null,
  articleKind: 'all',
  allowExcerpt: false,
};

/** A free link, identifier, coverage label, or metadata object alone is not text. */
export function hasArticleBody(paper: Paper): boolean {
  return paper.passages.some(
    (passage) => passage.kind === 'full-text' && !!passage.text.trim(),
  );
}

function hasImportedBody(paper: Paper, allowExcerpt: boolean): boolean {
  if (!paper.fullText || !hasArticleBody(paper)) return false;
  if (paper.coverage === 'Full text retrieved' && !paper.fullText.truncated)
    return true;
  // Keep inconsistent "full" labels out rather than silently declaring a
  // truncated record complete. The partial-text option only admits labelled excerpts.
  return allowExcerpt && paper.coverage === 'Full text excerpt';
}

function finiteYear(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Pure filtering of the records actually provided. It does not retrieve text,
 * infer peer review, expand collection coverage, or mutate paper/provenance data.
 * An empty sources selection means no selected collections, not all collections. */
export function filterPapers(
  papers: Paper[],
  filters: Partial<PaperFilters> = defaultFilter,
): Paper[] {
  const settings: PaperFilters = {
    access: filters.access ?? defaultFilter.access,
    sources: filters.sources ?? defaultFilter.sources,
    yearFrom: filters.yearFrom ?? null,
    yearTo: filters.yearTo ?? null,
    articleKind: filters.articleKind ?? defaultFilter.articleKind,
    allowExcerpt: filters.allowExcerpt ?? defaultFilter.allowExcerpt,
  };
  const from = finiteYear(settings.yearFrom);
  const to = finiteYear(settings.yearTo);
  const selectedSources = new Set(settings.sources);
  return papers.filter((paper) => {
    if (
      settings.access === 'verified' &&
      !hasImportedBody(paper, settings.allowExcerpt)
    )
      return false;
    if (
      settings.access === 'supported' &&
      !hasArticleBody(paper) &&
      !canLoadFullText(paper)
    )
      return false;

    // The original saved records predate explicit provenance and are OpenAlex
    // records. Do not infer a discovery collection from a DOI or a similar title.
    const providers = paper.sources?.length
      ? paper.sources.map((source) => source.provider)
      : ['OpenAlex' as const];
    if (!providers.some((provider) => selectedSources.has(provider)))
      return false;

    if (from !== null || to !== null) {
      const year = finiteYear(paper.year);
      if (
        year === null ||
        (from !== null && year < from) ||
        (to !== null && year > to)
      )
        return false;
    }

    const includesPreprint =
      paper.publicationType === 'Preprint' ||
      paper.publicationType === 'Includes preprint version';
    if (settings.articleKind === 'preprints' && !includesPreprint) return false;
    if (settings.articleKind === 'exclude-preprints' && includesPreprint)
      return false;
    return true;
  });
}

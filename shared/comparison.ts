import type { Paper, Passage } from './types';
export function canLoadFullText(paper: Paper) {
  return (
    !paper.fullText && !!(paper.identifiers?.pmcid || paper.identifiers?.arxiv)
  );
}
export function comparisonPassages(
  paper: Paper,
  mode: 'abstract' | 'methods' | 'findings' | 'all',
  query: string,
): Passage[] {
  const keyword = query.trim().toLocaleLowerCase();
  return paper.passages.filter((p) => {
    const kind = p.kind ?? 'abstract';
    const section = (p.section ?? '').toLowerCase();
    if (mode === 'abstract' && kind !== 'abstract') return false;
    if (
      mode === 'methods' &&
      (kind !== 'full-text' ||
        !/(method|material|experiment|implementation|procedure)/.test(section))
    )
      return false;
    if (
      mode === 'findings' &&
      (kind !== 'full-text' ||
        !/(result|finding|discussion|conclusion|limitation)/.test(section))
    )
      return false;
    return !keyword || p.text.toLocaleLowerCase().includes(keyword);
  });
}

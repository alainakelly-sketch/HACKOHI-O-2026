import type { Citation, Paper } from './types';
export function resolveCitation(ref: Citation, papers: Paper[]) {
  const paper = papers.find((p) => p.id === ref.paperId);
  const passage = paper?.passages.find((p) => p.id === ref.passageId);
  if (!paper || !passage)
    throw new Error(
      'Analysis referenced an unknown paper or passage. No result was accepted.',
    );
  return { paper, passage };
}

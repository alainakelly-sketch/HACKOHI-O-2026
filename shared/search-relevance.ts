import type { Paper, PaperRelevance, QueryPlan, SearchConcept } from './types';
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[-–—]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
function matches(text: string, concept: SearchConcept) {
  const value = ` ${normalize(text)} `;
  return concept.terms.some((term) => value.includes(` ${normalize(term)} `));
}
export function assessQuestionRelevance(
  paper: Paper,
  plan: QueryPlan,
): PaperRelevance {
  const concepts = plan.concepts;
  const titleMatches = concepts.filter((c) => matches(paper.title, c));
  const abstractMatches = concepts.filter((c) =>
    matches(paper.abstract || '', c),
  );
  const matched = concepts.filter(
    (c) => titleMatches.includes(c) || abstractMatches.includes(c),
  );
  const missing = concepts.filter((c) => !matched.includes(c));
  const sentences = paper.abstract
    ? [
        ...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(
          paper.abstract,
        ),
      ].map((item) => item.segment.trim())
    : [];
  const combinedSentence = sentences.find(
    (sentence) =>
      concepts.length >= 2 &&
      concepts.every((c) => matches(sentence, c)) &&
      !/\b(?:previous|prior|earlier)\s+(?:studies|research|work)|\b(?:background|introduction)\s*:|\b(?:did|do|does|will)\s+not\s+(?:measure|assess|test|evaluate|investigate|study)/i.test(
        sentence,
      ),
  );
  const titleDirect =
    concepts.length >= 2 && titleMatches.length === concepts.length;
  const direct =
    !!paper.abstract &&
    concepts.length >= 2 &&
    missing.length === 0 &&
    !!combinedSentence;
  const classification: PaperRelevance['classification'] = direct
    ? 'Directly addresses the question'
    : matched.length
      ? 'Related background or potentially transferable method'
      : 'Relevance unclear';
  let explanation: string;
  if (direct)
    explanation = `${titleDirect ? 'The title' : 'An abstract sentence'} mentions all interpreted concepts together. This is a lexical match; check the study outcome and design before treating it as direct evidence.`;
  else if (!paper.abstract)
    explanation = matched.length
      ? `The title mentions ${matched.map((c) => c.label).join(', ')}, but no abstract is available to check the relationship${missing.length ? ` or ${missing.map((c) => c.label).join(', ')}` : ''}.`
      : 'No abstract is available and the title does not establish the interpreted concepts. Relevance remains unclear.';
  else if (matched.length)
    explanation = missing.length
      ? `The title or abstract mentions ${matched.map((c) => c.label).join(', ')}, but does not establish ${missing.map((c) => c.label).join(', ')}. Keep as background, not direct evidence.`
      : 'The concepts appear in the title or abstract, but a qualifying study-specific abstract sentence connecting them was not identified. Inspect the source before treating it as direct evidence.';
  else
    explanation =
      'The available title and abstract do not establish the interpreted concepts. This may be unrelated or use terminology outside the supported vocabulary.';
  const evidence: PaperRelevance['evidence'] = [];
  if (titleMatches.length) evidence.push({ field: 'title', text: paper.title });
  if (paper.abstract) {
    const selected =
      combinedSentence ||
      sentences.find((sentence) => matched.some((c) => matches(sentence, c)));
    if (selected) evidence.push({ field: 'abstract', text: selected });
  }
  return {
    classification,
    explanation,
    matchedConcepts: matched.map((c) => c.label),
    missingConcepts: missing.map((c) => c.label),
    evidence,
  };
}
export function rankQuestionResults(papers: Paper[], plan: QueryPlan): Paper[] {
  const ranked = papers.map((paper, index) => ({
    paper: { ...paper, relevance: assessQuestionRelevance(paper, plan) },
    index,
  }));
  const tier = (classification: string) =>
    classification === 'Directly addresses the question'
      ? 2
      : classification ===
          'Related background or potentially transferable method'
        ? 1
        : 0;
  ranked.sort(
    (a, b) =>
      tier(b.paper.relevance.classification) -
        tier(a.paper.relevance.classification) ||
      b.paper.relevance.matchedConcepts.length -
        a.paper.relevance.matchedConcepts.length ||
      plan.concepts.filter((c) => matches(b.paper.title, c)).length -
        plan.concepts.filter((c) => matches(a.paper.title, c)).length ||
      a.index - b.index,
  );
  return ranked.map((item) => item.paper);
}

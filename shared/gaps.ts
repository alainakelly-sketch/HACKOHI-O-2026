import type { Paper, Passage } from './types';
import { buildResearchQuery } from './research-query';

/** A lead is an author-stated issue in one retrieved passage, never a verified
 * field-wide research gap. Quotes and signal sentences are source text. */
export type GapLead = {
  id: string;
  paperId: string;
  passageId: string;
  quote: string;
  signalText: string;
  kind: 'abstract' | 'full-text';
  section: string;
  category: 'reported-limitation' | 'future-work' | 'unanswered-question';
  label: string;
  followUp: string;
  searchQuery: string;
};
export type GapScan = {
  status: 'leads-found' | 'insufficient-evidence';
  candidates: GapLead[];
  coverage: {
    paperCount: number;
    fullTextPapers: number;
    abstractOnlyPapers: number;
    metadataOnlyPapers: number;
    excerptPapers: number;
  };
  scope: { question: string; field: string };
  summary: string;
  caution: string;
};

const stopWords = new Set(
  'a an the and or of in on to for with from by at as is are was were be been being this that these those what which how why when where can could would should does do did has have had may might will we our i my me it its they their them paper papers study studies research field question topic interested interest want help identify gap gaps work use using about into within between across'.split(
    ' ',
  ),
);
function terms(text: string): string[] {
  return [
    ...new Set(
      (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
        .filter((word) => word.length >= 3 && !stopWords.has(word))
        .map((word) =>
          word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word,
        ),
    ),
  ];
}
const excludedSection =
  /\b(?:references?|bibliography|cited literature|acknowledg(?:e)?ments?)\b/i;
const backgroundSection =
  /\b(?:introduction|background|related work|literature review|prior work|motivation)\b/i;
const futureSignal =
  /\b(?:future|further|additional)\s+(?:work|research|studies|investigations)\b/i;
const unresolvedSignal =
  /\b(?:remains?|remain)\s+(?:unclear|unknown|uncertain|unexplored|unresolved|an? open question)\b|\b(?:is|are)\s+(?:still\s+)?(?:unclear|unknown|uncertain|unresolved)\b|\blittle is known\b|\bnot yet\s+(?:known|understood|established|explored|investigated)\b|\b(?:has|have) not\s+(?:yet\s+)?been\s+(?:studied|investigated|evaluated|established)\b/i;
const limitationSignal =
  /\b(?:a|an|the|our|this|these|several|important|major|key)\s+(?:[\p{L}-]+\s+){0,3}limitations?\b|\blimited\s+(?:by|to)\b|\blimitations?\s+(?:of|include|includes|is|are)\b|\bdid not\s+(?:evaluate|assess|test|consider|include|investigate)\b|\bnot\s+(?:evaluated|assessed|tested|investigated)\b/iu;
const negativeLimitation =
  /\bnot\s+limited\s+(?:by|to)\b|\b(?:address(?:ed|es)?|resolv(?:e|ed|es)|overcame|overcome|overcomes)\s+(?:this|that|the|these|those|a|an|our)?\s*(?:[\p{L}-]+\s+){0,2}limitations?\b|\b(?:no|not|without)\s+(?:[\p{L}-]+\s+){0,2}limitations?\b|\blimitations?\s+(?:is|are|was|were)\s+(?:not present|absent|resolved|addressed|overcome)\b/iu;
const negativeFuture =
  /\bno\s+(?:future|further|additional)\s+(?:work|research|studies|investigations)\b|\bnot\s+(?:planning|proposing|recommending|suggesting|considering)\s+(?:any\s+)?(?:future|further|additional)\s+(?:work|research|studies|investigations)\b|\b(?:do|does|did)\s+not\s+(?:propose|recommend|suggest|identify|plan)\s+(?:any\s+)?(?:future|further|additional)\s+(?:work|research|studies|investigations)\b|\b(?:no|not)\s+(?:(?:additional|further|future)\s+)?(?:work|research|studies|investigations)\s+(?:(?:is|are|was|were)\s+)?(?:needed|required|necessary)\b|\b(?:future|further|additional)\s+(?:work|research|studies|investigations)\s+(?:is|are|was|were)\s+(?:not\s+(?:needed|required|necessary)|(?:already\s+)?completed)\b/i;
const sectionLimitationDetail =
  /\b(?:small|short|single|limited|lack|only|bias|unable|unavailable|uncertain|unknown)\b|\b(?:could|did) not\b/i;

const concreteIssue =
  /\b(?:sample|cohort|population|long[-‐– ]term|randomi[sz]ed|factorial|interaction|mechanisms?|insufficient|lack|limited to|did not|have not|has not|cannot determine|could not|unable)\b/i;
/** Domain words alone do not turn an introductory limitation notice into a
 * testable issue. Exact source evidence remains unchanged. */
export function isGenericGapNotice(text: string): boolean {
  return (
    /\blimitations?\s+(?:(?:still|remain(?:s)?)\s+)?(?:persist|remain|exist)|\b(?:has|have)\s+(?:some|several|various)\s+limitations?\b/i.test(
      text,
    ) && !concreteIssue.test(text)
  );
}
function signal(
  passage: Passage,
): { category: GapLead['category']; text: string } | null {
  if (excludedSection.test(passage.section ?? '')) return null;
  const candidates: {
    category: GapLead['category'];
    text: string;
    priority: number;
  }[] = [];
  for (const item of new Intl.Segmenter('en', {
    granularity: 'sentence',
  }).segment(passage.text)) {
    const sentence = item.segment.trim();
    if (sentence.length < 20) continue;
    let category: GapLead['category'] | null = null;
    if (futureSignal.test(sentence) && !negativeFuture.test(sentence))
      category = 'future-work';
    else if (unresolvedSignal.test(sentence)) category = 'unanswered-question';
    else if (
      !negativeLimitation.test(sentence) &&
      (limitationSignal.test(sentence) ||
        (/\blimitations?\b/i.test(passage.section ?? '') &&
          sectionLimitationDetail.test(sentence)))
    )
      category = 'reported-limitation';
    if (category)
      candidates.push({
        category,
        text: sentence,
        priority:
          (isGenericGapNotice(sentence) ? -20 : 0) +
          (concreteIssue.test(sentence) ? 3 : 0) +
          (category === 'future-work'
            ? 2
            : category === 'unanswered-question'
              ? 1
              : 0),
      });
  }
  candidates.sort((a, b) => b.priority - a.priority);
  const best = candidates[0];
  return best ? { category: best.category, text: best.text } : null;
}
const labels: Record<GapLead['category'], string> = {
  'reported-limitation': 'Author-reported limitation',
  'future-work': 'Author-proposed future work',
  'unanswered-question': 'Author-stated unresolved question',
};
const followUps: Record<GapLead['category'], string> = {
  'reported-limitation':
    "Read this paper's results and conclusions first to check whether it addresses the reported issue. Then check whether this limitation still matters for your question and whether later studies have addressed it. A limitation of one study is not automatically a gap in the field.",
  'future-work':
    'Check whether this proposed follow-up was completed in later work, and whether it fits your question and resources. A future-work statement is not proof that the work remains undone.',
  'unanswered-question':
    "Read this paper's results and conclusions first, then check later studies for an answer and clarify which population, method, or setting the uncertainty applies to. This passage does not establish that the whole field lacks an answer.",
};

/** Free, local text scan. It does not synthesize scientific conclusions, query
 * external services, infer missing methods, or rank novelty. Relevance only
 * changes ordering of exact author-stated leads within the selected sources. */
export function scanGapLeads(
  papers: Paper[],
  question: string,
  field: string,
): GapScan {
  const unique = [...new Map(papers.map((p) => [p.id, p])).values()];
  const coverage: GapScan['coverage'] = {
    paperCount: unique.length,
    fullTextPapers: 0,
    abstractOnlyPapers: 0,
    metadataOnlyPapers: 0,
    excerptPapers: 0,
  };
  const ranked: {
    lead: GapLead;
    relevance: number;
    full: boolean;
    background: boolean;
    order: number;
  }[] = [];
  const focus = new Set(terms(`${question} ${field}`));
  const seen = new Set<string>();
  let order = 0;
  for (const paper of unique) {
    const hasBody = paper.passages.some(
      (p) => p.kind === 'full-text' && !!p.text.trim(),
    );
    if (hasBody) coverage.fullTextPapers++;
    else if (paper.passages.some((p) => p.text.trim()))
      coverage.abstractOnlyPapers++;
    else coverage.metadataOnlyPapers++;
    if (paper.coverage === 'Full text excerpt' || paper.fullText?.truncated)
      coverage.excerptPapers++;
    for (const passage of paper.passages) {
      if (seen.has(`${paper.id}\0${passage.id}`)) continue;
      seen.add(`${paper.id}\0${passage.id}`);
      const match = signal(passage);
      if (!match) continue;
      const full = passage.kind === 'full-text';
      const background = backgroundSection.test(passage.section ?? '');
      const relevance = terms(`${paper.title} ${passage.text}`).filter((word) =>
        focus.has(word),
      ).length;
      const searchQuery = buildResearchQuery({ field, question: match.text });
      ranked.push({
        full,
        background,
        relevance,
        order: order++,
        lead: {
          id: `lead:${paper.id}:${passage.id}:${match.category}`,
          paperId: paper.id,
          passageId: passage.id,
          quote: passage.text,
          signalText: match.text,
          kind: full ? 'full-text' : 'abstract',
          section: passage.section ?? (full ? 'Article body' : 'Abstract'),
          category: match.category,
          label: background
            ? 'Background issue · may be addressed in this paper'
            : labels[match.category],
          followUp: background
            ? "This statement appears in introductory or background material and may describe prior work that this paper itself addresses. Read this paper's methods, results and conclusions first to check what it resolves, then check later research. Do not treat a background problem statement as a currently open research gap."
            : followUps[match.category],
          searchQuery,
        },
      });
    }
  }
  // Relevance is a routing aid, never a scientific confidence or novelty score.
  ranked.sort(
    (a, b) =>
      Number(a.background) - Number(b.background) ||
      Number(b.full) - Number(a.full) ||
      b.relevance - a.relevance ||
      a.order - b.order,
  );
  const usedSignals = new Set<string>();
  const candidates = ranked
    .filter(({ lead }) => {
      const key = `${lead.paperId}\0${lead.signalText.toLowerCase().replace(/\s+/g, ' ').trim()}`;
      if (usedSignals.has(key)) return false;
      usedSignals.add(key);
      return true;
    })
    .slice(0, 12)
    .map((r) => r.lead);
  const caution =
    'Possible leads from selected retrieved text, not confirmed research gaps. Background issues may already be addressed in this paper; authors may discuss earlier work, and later studies may already answer these questions. Missing text and search coverage limit what can be concluded.';
  return {
    status: candidates.length ? 'leads-found' : 'insufficient-evidence',
    candidates,
    coverage,
    scope: { question, field },
    summary: candidates.length
      ? `Found ${candidates.length} author-stated issue${candidates.length === 1 ? '' : 's'} to investigate in your selected sources. Read each paper's findings and check later work before treating any as a research gap.`
      : unique.length
        ? 'No explicit author-stated gap leads were found in the retrieved passages. This does not mean the field has no gaps. Retrieve more readable text, inspect limitations and discussion sections, or select other papers.'
        : 'Select papers and retrieve readable source text to look for author-stated limitations, future work, and unresolved questions.',
    caution,
  };
}

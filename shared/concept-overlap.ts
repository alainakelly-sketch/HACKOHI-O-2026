import type { Paper } from './types';
import type { DiscoveryEvidence } from './discovery';
import { scanGapLeads } from './gaps';

export type ConceptTheme = {
  id: string;
  label: string;
  evidence: DiscoveryEvidence[];
  paperIds: string[];
  missing: string;
  question: string;
};
export type ConceptOverlap = {
  id: string;
  label: string;
  leftId: string;
  rightId: string;
  kind: 'overlap' | 'missing-bridge';
  evidence: DiscoveryEvidence[];
  paperIds: string[];
  known: string;
  missing: string;
  rationale: string;
  question: string;
};
export type PaperFit = {
  paperId: string;
  label: 'Strong fit' | 'Moderate fit' | 'Weak fit';
  matchedTerms: string[];
  missingTerms: string[];
  reason: string;
};
export type ConceptOverlapReport = {
  themes: ConceptTheme[];
  overlaps: ConceptOverlap[];
  fits: PaperFit[];
  weakWarning: boolean;
};

// Lexical screening only: these labels are neither semantic relevance scores nor
// claims that a source establishes a relationship. Keep source text untrusted.
const stem = (word: string) =>
  word.length > 4 && word.endsWith('s') && !word.endsWith('ss')
    ? word.slice(0, -1)
    : word;
const stop = new Set(
  'a an the and or of in on to for with from by at as is are was were be been being this that these those what which how why when where can could would should does do did has have had may might will we our i my me it its they their them paper papers study studies research field question topic interested interest want help identify gap gaps work use used uses using about into within between across based result results show shows showed found finding findings suggest suggests suggested effect effects influence affect affects associated association relationship relationships evidence analysis analyses scientific science new novel article articles abstract conclusion conclusions introduction background limitation limitations future further include includes included including also however therefore compared compare comparison respectively respectively significant significantly increase increased decrease decreased improve improved reduce reduced demonstrate demonstrated demonstrate demonstrate test tested investigate investigated evaluate evaluated approach approaches method methods data dataset datasets participants sample samples synthetic test previous prior reported report author authors observed obtained present presents measured measure measuring assessment assessed assessment assessed performed perform conducted conduct demonstrated determined determine collected collection examined examination examination evaluated evaluation described describe proposed propose objective objectives aim aims aim aim small large larger smaller size longer shorter additional task tasks daily during'
    .split(' ')
    .map(stem),
);
const excluded = /\b(?:references?|bibliography|acknowledg(?:e)?ments?)\b/i;
const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map(stem);
}
function meaningful(word: string) {
  return word.length > 2 && !stop.has(word) && !/^\d+$/.test(word);
}
function terms(text: string) {
  return [...new Set(tokens(text).filter(meaningful))];
}
function hash(text: string) {
  let value = 2166136261;
  for (const char of text)
    value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0).toString(36);
}
type Sentence = { text: string; words: string[]; evidence: DiscoveryEvidence };
function sourceSentences(paper: Paper): Sentence[] {
  const body = paper.passages.some(
    (p) => p.kind === 'full-text' && p.text.trim(),
  );
  let remaining = 30000;
  return paper.passages
    .filter(
      (p) =>
        !excluded.test(p.section ?? '') && (!body || p.kind === 'full-text'),
    )
    .slice(0, 150)
    .flatMap((passage) => {
      if (remaining <= 0 || !passage.text.trim()) return [];
      // Segment the bounded prefix without inventing or rewriting source text.
      const text = passage.text.slice(0, remaining);
      remaining -= text.length;
      return [...segmenter.segment(text)]
        .slice(0, 80)
        .map((item) => {
          const quote = item.segment.trim();
          return {
            text: quote,
            words: tokens(quote),
            evidence: {
              reference: { paperId: paper.id, passageId: passage.id },
              quote,
              kind:
                passage.kind === 'full-text'
                  ? ('full-text' as const)
                  : ('abstract' as const),
              section:
                passage.section ||
                (passage.kind === 'full-text' ? 'Article body' : 'Abstract'),
            },
          };
        })
        .filter((item) => item.text.length >= 15);
    });
}
function contains(words: string[], phrase: string[]) {
  return words.some((_, i) => phrase.every((word, j) => words[i + j] === word));
}
function uniqueEvidence(
  items: DiscoveryEvidence[],
  limit = 8,
): DiscoveryEvidence[] {
  const seen = new Set<string>();
  const deduped = items.filter((item) => {
    const key = `${item.reference.paperId}:${item.reference.passageId}:${item.quote}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Keep at least one representative per paper before filling with additional
  // passages. An early verbose paper must not hide later supporting sources.
  const papers = new Set<string>();
  const representatives = deduped.filter((item) => {
    if (papers.has(item.reference.paperId)) return false;
    papers.add(item.reference.paperId);
    return true;
  });
  const first = new Set(representatives);
  return [
    ...representatives,
    ...deduped.filter((item) => !first.has(item)),
  ].slice(0, limit);
}
function ids(evidence: DiscoveryEvidence[]) {
  return [...new Set(evidence.map((item) => item.reference.paperId))];
}

export function buildConceptOverlap(
  papers: Paper[],
  question: string,
  field: string,
): ConceptOverlapReport {
  const uniquePapers = [...new Map(papers.map((p) => [p.id, p])).values()];
  const sentences = uniquePapers.flatMap(sourceSentences);
  const focusTerms = terms(question);
  const query = new Set([...focusTerms, ...terms(field)]);
  const fits: PaperFit[] = uniquePapers.map((paper) => {
    const body = new Set(
      terms(
        `${paper.title} ${sourceSentences(paper)
          .map((item) => item.text)
          .join(' ')}`,
      ),
    );
    const matchedTerms = focusTerms.filter((term) => body.has(term));
    const missingTerms = focusTerms.filter((term) => !body.has(term));
    const ratio = focusTerms.length
      ? matchedTerms.length / focusTerms.length
      : 0;
    const label: PaperFit['label'] =
      matchedTerms.length >= 2 && ratio >= 0.65
        ? 'Strong fit'
        : matchedTerms.length && ratio >= 0.3
          ? 'Moderate fit'
          : 'Weak fit';
    const reason = !focusTerms.length
      ? 'Question fit cannot be assessed without specific research-question terms. This badge is provisional.'
      : `${matchedTerms.length} of ${focusTerms.length} question terms appear in the title or retrieved text. Word matching does not confirm scientific relevance${paper.coverage === 'Metadata only' ? '; only metadata is available' : ''}.`;
    return { paperId: paper.id, label, matchedTerms, missingTerms, reason };
  });
  type Candidate = {
    key: string;
    words: string[];
    label: string;
    evidence: DiscoveryEvidence[];
    score: number;
  };
  const candidates = new Map<string, Candidate>();
  for (const sentence of sentences) {
    const words = sentence.words;
    const rawTokens = [...sentence.text.matchAll(/[\p{L}\p{N}]+/gu)];
    for (let i = 0; i < words.length; i++) {
      for (const width of [2, 1]) {
        const phrase = words.slice(i, i + width);
        if (phrase.length !== width || phrase.some((word) => !meaningful(word)))
          continue;
        if (width === 2) {
          const leftToken = rawTokens[i],
            rightToken = rawTokens[i + 1];
          const separator = sentence.text.slice(
            leftToken.index! + leftToken[0].length,
            rightToken.index!,
          );
          if (!/^[\s-]+$/.test(separator)) continue;
        }
        const key = phrase.join(' ');
        let candidate = candidates.get(key);
        if (!candidate) {
          // Labels are the original source spelling, not a generated concept.
          const raw = sentence.text.match(/[\p{L}\p{N}]+/gu) ?? [];
          candidate = {
            key,
            words: phrase,
            label: raw.slice(i, i + width).join(' '),
            evidence: [],
            score: 0,
          };
          candidates.set(key, candidate);
        }
        candidate.evidence.push(sentence.evidence);
      }
    }
  }
  for (const candidate of candidates.values()) {
    candidate.evidence = uniqueEvidence(candidate.evidence, 18);
    const paperCount = ids(candidate.evidence).length;
    const relevance = candidate.words.filter((word) => query.has(word)).length;
    candidate.score =
      paperCount * 5 +
      relevance * 4 +
      (contains(tokens(question), candidate.words) ? 8 : 0) +
      (candidate.words.length === 2 ? 5 : 0) +
      Math.min(candidate.evidence.length, 4);
  }
  const ranked = [...candidates.values()]
    .filter(
      (candidate) =>
        ids(candidate.evidence).length >= 2 ||
        candidate.words.some((word) => query.has(word)),
    )
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  // Prefer non-redundant phrases: avoid 'sleep' beside 'sleep duration' and
  // near-duplicate bigrams such as 'adult patient' / 'patient cohort'.
  function select(pool: Candidate[]) {
    const selected: Candidate[] = [];
    for (const candidate of pool) {
      if (
        selected.some((other) =>
          candidate.words.some((word) => other.words.includes(word)),
        )
      )
        continue;
      selected.push(candidate);
      if (selected.length === 5) break;
    }
    return selected;
  }
  const relevant = ranked.filter((candidate) =>
    candidate.words.some((word) => query.has(word)),
  );
  const relevantThemes = select(relevant);
  // Three grounded focus themes are more useful than padding the map with
  // incidental recurring words just to reach five nodes.
  const chosen =
    relevantThemes.length >= 3
      ? relevantThemes
      : select([...relevant, ...ranked]);
  const gaps = scanGapLeads(uniquePapers, question, field).candidates;
  const themes: ConceptTheme[] = chosen.map((candidate) => {
    const relevantGaps = gaps.filter((gap) =>
      contains(tokens(gap.signalText), candidate.words),
    );
    const evidence = uniqueEvidence([
      ...candidate.evidence.slice(0, 6),
      ...relevantGaps.slice(0, 2).map((gap) => ({
        reference: { paperId: gap.paperId, passageId: gap.passageId },
        quote: gap.signalText,
        kind: gap.kind,
        section: gap.section,
      })),
    ]);
    return {
      id: `theme-${hash(candidate.key)}`,
      label: candidate.label,
      evidence,
      paperIds: ids(evidence),
      missing: relevantGaps.length
        ? `Authors identify a limitation or follow-up involving this theme in ${new Set(relevantGaps.map((g) => g.paperId)).size} selected source(s). Inspect the passages; later work may have addressed it.`
        : 'No explicit unresolved issue was identified for this theme in the screened passages. Missing detail is not evidence of a field-wide gap.',
      question: question.trim()
        ? `For the research focus “${question.trim()}”, what remains to be tested about ${candidate.label}?`
        : `What remains to be tested about ${candidate.label} in ${field.trim() || 'this research area'}?`,
    };
  });
  const pairs: { node: ConceptOverlap; score: number }[] = [];
  for (let i = 0; i < chosen.length; i++) {
    for (let j = i + 1; j < chosen.length; j++) {
      const left = chosen[i],
        right = chosen[j];
      const coMentioned = uniqueEvidence(
        sentences
          .filter(
            (sentence) =>
              contains(sentence.words, left.words) &&
              contains(sentence.words, right.words),
          )
          .map((sentence) => sentence.evidence),
      );
      const kind = coMentioned.length
        ? ('overlap' as const)
        : ('missing-bridge' as const);
      const pairIssues = gaps.filter(
        (gap) =>
          contains(tokens(gap.signalText), left.words) ||
          contains(tokens(gap.signalText), right.words),
      );
      const issueEvidence: DiscoveryEvidence[] = pairIssues
        .slice(0, 2)
        .map((gap) => ({
          reference: { paperId: gap.paperId, passageId: gap.passageId },
          quote: gap.signalText,
          kind: gap.kind,
          section: gap.section,
        }));
      const evidence = coMentioned.length
        ? uniqueEvidence([...coMentioned.slice(0, 6), ...issueEvidence])
        : uniqueEvidence([
            ...themes[i].evidence.slice(0, 2),
            ...themes[j].evidence.slice(0, 2),
          ]);
      pairs.push({
        score: coMentioned.length ? 100 + ids(coMentioned).length : 0,
        node: {
          id: `overlap-${hash(`${left.key}|${right.key}`)}`,
          label: `${left.label} × ${right.label}`,
          leftId: themes[i].id,
          rightId: themes[j].id,
          kind,
          evidence,
          paperIds: ids(evidence),
          known: coMentioned.length
            ? `Both themes are mentioned together in the supporting sentences from ${ids(coMentioned).length} selected paper(s). Co-mention does not establish a causal or tested relationship.`
            : 'Each theme appears in the selected evidence, but no sentence mentioning both was identified in the screened text.',
          missing: pairIssues.length
            ? 'Authors flag limitations or follow-up work involving at least one of these themes. Inspect the cited issue statements; they do not establish that the combination is untested.'
            : coMentioned.length
              ? 'Whether the relationship has been directly tested for your question is unknown. Inspect the methods, population and results, then check related work.'
              : 'A direct bridge was not identified by this lexical screen. It may exist elsewhere in these articles, in omitted text, or in other literature.',
          rationale: pairIssues.length
            ? 'An author-stated issue offers a source-backed starting point for a question involving these themes. The proposed connection is still an inference; check scientific fit and later prior work before treating it as a gap.'
            : coMentioned.length
              ? 'This overlap can help narrow a question. A research gap requires a specific unresolved issue and a broader prior-work check; co-mention alone is insufficient.'
              : 'This is a question to investigate, not a detected research gap. First establish that the themes are relevant and that connecting them is scientifically meaningful.',
          question: question.trim()
            ? `For the research focus “${question.trim()}”, what test could clarify the relationship between ${left.label} and ${right.label}?`
            : `What test could clarify the relationship between ${left.label} and ${right.label} in ${field.trim() || 'this research area'}?`,
        },
      });
    }
  }
  // At most one absence-based suggestion; do not flood the map with speculative gaps.
  const sorted = pairs.sort(
    (a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id),
  );
  const overlapNodes = sorted
    .filter((pair) => pair.node.kind === 'overlap')
    .slice(0, 3)
    .map((pair) => pair.node);
  const relevantIds = new Set(
    themes
      .filter((_, index) => chosen[index].words.some((word) => query.has(word)))
      .map((theme) => theme.id),
  );
  const bridge = sorted.find(
    (pair) =>
      pair.node.kind === 'missing-bridge' &&
      relevantIds.has(pair.node.leftId) &&
      relevantIds.has(pair.node.rightId),
  );
  if (bridge) overlapNodes.push(bridge.node);
  return {
    themes,
    overlaps: overlapNodes,
    fits,
    weakWarning:
      focusTerms.length > 0 &&
      fits.filter((fit) => fit.label === 'Weak fit').length >= 2,
  };
}

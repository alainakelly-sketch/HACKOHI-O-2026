import type { Citation, Paper, Passage, Resources } from './types';

export type ResourceMatchStatus =
  'likely-match' | 'potential-mismatch' | 'unknown';
export type ResourceMatchEvidence = {
  reference: Citation;
  quote: string;
  kind: 'abstract' | 'full-text';
  term: string;
};
export type ResourceMatchRow = {
  category: keyof Resources;
  status: ResourceMatchStatus;
  message: string;
  evidence?: ResourceMatchEvidence;
};
export type ResourcePaperAssessment = {
  paperId: string;
  status: ResourceMatchStatus;
  rows: ResourceMatchRow[];
  note: string;
};
const caveat =
  'A text-based resource screen, not a feasibility assessment. A reported method can sometimes be adapted. Missing information stays Unknown; it is not proof of compatibility.';
const categories: (keyof Resources)[] = [
  'data',
  'equipment',
  'skills',
  'deadline',
];
export function hasResourceNotes(resources: Resources): boolean {
  return categories.some((key) => resources[key].trim().length > 0);
}
const aliases: Record<string, string[]> = {
  gpu: ['gpu', 'gpus', 'graphics processing unit', 'graphics processing units'],
  laptop: ['laptop', 'laptops'],
  laboratory: ['lab', 'labs', 'laboratory', 'laboratories'],
  microscope: ['microscope', 'microscopes'],
  python: ['python'],
  matlab: ['matlab'],
  'public data': [
    'public data',
    'public dataset',
    'public datasets',
    'publicly available data',
    'publicly available dataset',
    'publicly available datasets',
    'open dataset',
    'open datasets',
    'open data',
  ],
  'private data': [
    'private data',
    'private dataset',
    'private datasets',
    'proprietary data',
    'proprietary dataset',
    'proprietary datasets',
  ],
};
function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function mentions(text: string, term: string) {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped(term)}(?![\\p{L}\\p{N}])`,
    'iu',
  ).test(text);
}
function matchingTerm(text: string, terms: string[]) {
  return terms.find((term) => mentions(text, term));
}
const denied =
  /\b(?:no|without|lack(?:ing)?|unavailable|cannot|can't|don't have|do not have|not available|not have|not know|don't know|not)\b/i;
const sourceNegation =
  /\b(?:no|without|not|never|unnecessary|unavailable|didn't|did not|do not|does not|not required)\b/i;
// A concept mentioned only in background is not a demonstrated resource need.
const methodCue =
  /\b(?:we (?:used|use|trained|train|collected|collect|implemented|implement|conducted|conduct|ran|run|performed|perform|employed|employ)|(?:our|this) (?:method|study|experiment|model|implementation) (?:uses|used|requires|required)|(?:training|experiments?|implementation|analysis) (?:uses|used|requires|required|was performed|were performed)|requires?|required)\b/i;
const ignoreHeading =
  /\b(?:references?|bibliography|related work|background|introduction|acknowledg(?:e)?ments?)\b/i;
type Constraint = { terms: string[]; unavailable: boolean; label: string };
function constraints(note: string): Constraint[] {
  const result: Constraint[] = [];
  // Clauses separated by punctuation have independent negation. We do not infer
  // unavailable resources from the mere absence of a resource in the notes.
  for (const clause of note
    .split(
      /[,;\n.!]+|\bbut\b|\b(?:and|with)\s+(?=(?:no|without|lack|unavailable|cannot|can't|not)\b)/i,
    )
    .map((x) => x.trim())
    .filter(Boolean)) {
    const unavailable = denied.test(clause);
    let recognized = false;
    for (const [label, terms] of Object.entries(aliases)) {
      if (!matchingTerm(clause, terms)) continue;
      // Ambiguous coordination after a negation is not interpreted as a new
      // independent availability claim ("no GPU and Python").
      const termAt = clause
        .toLowerCase()
        .indexOf(matchingTerm(clause, terms)!.toLowerCase());
      if (unavailable && /\b(?:and|or)\b/i.test(clause.slice(0, termAt))) {
        recognized = true;
        continue;
      }
      result.push({ label, terms, unavailable });
      recognized = true;
      if (label === 'public data' && /\bonly\b/i.test(clause) && !unavailable)
        result.push({
          label: 'private data',
          terms: aliases['private data'],
          unavailable: true,
        });
    }
    if (!recognized) {
      const cleaned = clause
        .toLowerCase()
        .replace(
          /\b(?:i|we|have|has|access|to|available|only|no|without|lack|lacking|unavailable|can|cannot|can't|use|using|skills?|know|don't|do|not)\b/g,
          ' ',
        )
        .replace(/\s+/g, ' ')
        .trim();
      // A literal phrase is supported, but vague prose is not turned into a
      // scientific capability taxonomy. Exact phrase matches remain necessary.
      if (cleaned.length >= 3 && cleaned.split(' ').length <= 5)
        result.push({ label: cleaned, terms: [cleaned], unavailable });
    }
  }
  return result;
}
export function suggestedResourceMode(
  resources: Resources,
): 'matches' | 'unknown' {
  return (['data', 'equipment', 'skills'] as const).some((key) =>
    constraints(resources[key]).some((item) => !item.unavailable),
  )
    ? 'matches'
    : 'unknown';
}
function methodUsesTerm(quote: string, term: string): boolean {
  const index = quote.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0 || sourceNegation.test(quote)) return false;
  const before = quote.slice(0, index);
  // Do not assign a comparison/background resource to the authors' own method.
  if (
    /\b(?:previous|prior|earlier|other studies|other work|related work|comparison with|compare|compared|comparing|versus|unlike)\b/i.test(
      before,
    )
  )
    return false;
  const action = methodCue.exec(before);
  if (action && before.length - action.index <= 160) return true;
  const after = quote.slice(index + term.length);
  return /^\s+(?:was|were|is|are)\s+(?:used|required|employed)\b/i.test(after);
}
type SourceSentence = { passage: Passage; quote: string };
// Imported Paper records are immutable and replaced when retrieval completes.
// Reuse segmentation while users type; WeakMap does not retain old workspaces.
const sentenceCache = new WeakMap<Paper, SourceSentence[]>();
const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
function sentences(paper: Paper): SourceSentence[] {
  const cached = sentenceCache.get(paper);
  if (cached) return cached;
  const result = paper.passages.flatMap((passage) => {
    if (ignoreHeading.test(passage.section ?? '')) return [];
    return [...segmenter.segment(passage.text)]
      .map((sentence) => ({ passage, quote: sentence.segment.trim() }))
      .filter(({ quote }) => quote.length > 0);
  });
  sentenceCache.set(paper, result);
  return result;
}
function sourceEvidence(
  paper: Paper,
  passage: Passage,
  quote: string,
  term: string,
): ResourceMatchEvidence {
  return {
    reference: { paperId: paper.id, passageId: passage.id },
    quote,
    kind: passage.kind === 'full-text' ? 'full-text' : 'abstract',
    term,
  };
}
const numberWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};
function duration(text: string) {
  const match = text
    .toLowerCase()
    .match(
      /\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(hours?|days?|weeks?)\b/,
    );
  if (!match) return null;
  const amount = numberWords[match[1]] ?? Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    hours:
      amount *
      (match[2].startsWith('week') ? 168 : match[2].startsWith('day') ? 24 : 1),
    term: match[0],
  };
}
function deadlineRow(paper: Paper, note: string): ResourceMatchRow {
  const available = duration(note);
  if (available) {
    for (const { passage, quote } of sentences(paper)) {
      if (
        !/\b(?:training|experiment|data collection|incubation|simulation|computation|processing|analysis)\s+(?:(?:process|procedure|run)\s+)?(?:took|takes|required|requires|lasted|lasts)\b/i.test(
          quote,
        ) ||
        sourceNegation.test(quote)
      )
        continue;
      const reported = duration(quote);
      if (!reported) continue;
      // A short component is never proof the whole project fits a deadline.
      if (reported.hours > available.hours)
        return {
          category: 'deadline',
          status: 'potential-mismatch',
          message: `A source-reported procedure took ${reported.term}, longer than your ${available.term} deadline. Adaptation may be possible.`,
          evidence: sourceEvidence(paper, passage, quote, reported.term),
        };
    }
  }
  return {
    category: 'deadline',
    status: 'unknown',
    message:
      'The available text does not establish whether the complete project fits your deadline. Only an explicit procedure duration longer than a stated hours/days/weeks deadline is screened out.',
  };
}
export function assessPaperResources(
  paper: Paper,
  resources: Resources,
): ResourcePaperAssessment {
  if (!hasResourceNotes(resources))
    return { paperId: paper.id, status: 'unknown', rows: [], note: caveat };
  const rows: ResourceMatchRow[] = [];
  const sourceSentences = sentences(paper);
  for (const category of categories) {
    const note = resources[category].trim();
    if (!note) continue;
    if (category === 'deadline') {
      rows.push(deadlineRow(paper, note));
      continue;
    }
    const items = constraints(note);
    const matches: ResourceMatchRow[] = [];
    for (const item of items) {
      for (const { passage, quote } of sourceSentences) {
        const term = matchingTerm(quote, item.terms);
        if (!term || !methodUsesTerm(quote, term)) continue;
        matches.push({
          category,
          status: item.unavailable ? 'potential-mismatch' : 'likely-match',
          message: item.unavailable
            ? `Your ${category} notes exclude “${item.label}”, while this source reports using or requiring it. Read the method before excluding an adaptable study.`
            : `Your ${category} notes mention “${item.label}”; this source reports using or requiring the same term. Other requirements remain unknown.`,
          evidence: sourceEvidence(paper, passage, quote, term),
        });
        break;
      }
    }
    const mismatch = matches.filter(
      (row) => row.status === 'potential-mismatch',
    );
    rows.push(
      ...(mismatch.length
        ? mismatch
        : matches.length
          ? matches
          : [
              {
                category,
                status: 'unknown' as const,
                message: `No explicit method statement matches your ${category} notes in the available passages. This paper's resource fit is Unknown.`,
              },
            ]),
    );
  }
  return {
    paperId: paper.id,
    status: rows.some((row) => row.status === 'potential-mismatch')
      ? 'potential-mismatch'
      : rows.some((row) => row.status === 'likely-match')
        ? 'likely-match'
        : 'unknown',
    rows,
    note: caveat,
  };
}
export function filterByResources(
  papers: Paper[],
  resources: Resources,
  options: { hideMismatches?: boolean } = {},
) {
  const active = hasResourceNotes(resources);
  if (!active)
    return {
      papers,
      assessments: [] as ResourcePaperAssessment[],
      hidden: [] as Paper[],
      active: false,
    };
  const assessments = papers.map((paper) =>
    assessPaperResources(paper, resources),
  );
  const mismatches = new Set(
    assessments
      .filter((item) => item.status === 'potential-mismatch')
      .map((item) => item.paperId),
  );
  const hide = options.hideMismatches !== false;
  return {
    papers: hide ? papers.filter((paper) => !mismatches.has(paper.id)) : papers,
    assessments,
    hidden: hide ? papers.filter((paper) => mismatches.has(paper.id)) : [],
    active: true,
  };
}

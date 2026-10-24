import type { Citation, Paper, Passage } from './types';

export type OverviewEvidence = {
  reference: Citation;
  excerpt: string;
  section: string;
  truncated: boolean;
  leadingOmitted: boolean;
};
export type ComparisonOverviewResult = {
  status: 'ready' | 'need-more-papers' | 'need-body-text';
  papers: { id: string; title: string; hasBody: boolean }[];
  shared: { term: string; evidence: OverviewEvidence[] }[];
  distinct: {
    paperId: string;
    terms: { term: string; evidence: OverviewEvidence }[];
  }[];
  matrix: {
    key: 'aim' | 'methods' | 'findings' | 'limitations';
    label: string;
    cells: { paperId: string; evidence: OverviewEvidence | null }[];
  }[];
  caution: string;
};

const generic = new Set(
  'future further investigate investigated investigating investigation larger smaller describe describes described measured aims objectives purpose limitation limitations require requires required a an the and or nor but of in on to for from with by at as is are was were be been being it its this that these those we our they their them you your has have had can could would should may might will not no also than then such only some other more most very using used use based approach method methods model models results result study studies paper papers proposed show shows shown data analysis research work including include found figure table section supplementary information et al which where when how what between both each into during after before over under through across within all new respectively however therefore thus previous present recent different similar demonstrate demonstrated provide provides proposed development application performance compared comparison evaluate evaluated evaluation'.split(
    ' ',
  ),
);
const excluded = /\b(?:references?|bibliography|acknowledg(?:e)?ments?)\b/i;
function body(paper: Paper) {
  return paper.passages.filter(
    (p) =>
      p.kind === 'full-text' &&
      p.text.trim() &&
      !excluded.test(p.section ?? ''),
  );
}
function evidence(
  paper: Paper,
  passage: Passage,
  cue?: RegExp,
): OverviewEvidence {
  const limit = 300;
  let start = 0;
  let end = Math.min(limit, passage.text.length);
  if (cue) {
    const sentence = [
      ...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(
        passage.text,
      ),
    ].find((part) => cue.test(part.segment));
    if (sentence) {
      start = sentence.index;
      end = sentence.index + sentence.segment.length;
      if (end - start > limit) {
        const match = cue.exec(sentence.segment);
        // Keep the actual author cue visible even in an unusually long
        // sentence. This remains an exact substring of the cited passage.
        start = Math.max(start, sentence.index + (match?.index ?? 0) - 70);
        end = Math.min(end, start + limit);
      }
    }
  }
  return {
    reference: { paperId: paper.id, passageId: passage.id },
    excerpt: passage.text.slice(start, end),
    section: passage.section || 'Article body',
    truncated: end < passage.text.length,
    leadingOmitted: start > 0,
  };
}
function terms(passages: Passage[]) {
  const found = new Map<string, { count: number; passage: Passage }>();
  for (const passage of passages) {
    // Token spans retain source spelling as displayed while matching by a
    // normalized key. Phrases never cross punctuation or sentence boundaries.
    const sentences = [
      ...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(
        passage.text,
      ),
    ];
    for (const sentence of sentences) {
      const tokens = [
        ...sentence.segment.matchAll(/[\p{L}][\p{L}\p{N}-]{2,}/gu),
      ];
      for (let i = 0; i < tokens.length; i++) {
        const first = tokens[i][0].toLowerCase();
        if (generic.has(first) || first.length < 4) continue;
        const candidates = [first];
        const next = tokens[i + 1];
        if (
          next &&
          !generic.has(next[0].toLowerCase()) &&
          next[0].length >= 3
        ) {
          const gap = sentence.segment.slice(
            tokens[i].index! + tokens[i][0].length,
            next.index,
          );
          if (/^\s+$/.test(gap))
            candidates.push(`${first} ${next[0].toLowerCase()}`);
        }
        for (const key of candidates) {
          const old = found.get(key);
          found.set(key, {
            count: (old?.count ?? 0) + 1,
            passage: old?.passage ?? passage,
          });
        }
      }
    }
  }
  return found;
}
const rows = [
  {
    key: 'aim' as const,
    label: 'Aim / purpose',
    heading: /\b(?:aims?|objectives?|purpose)\b/i,
    phrase:
      /\b(?:we aim|our aim|the aim|our objective|the objective|this study aims|this paper aims|the purpose)\b/i,
  },
  {
    key: 'methods' as const,
    label: 'Methods',
    heading:
      /\b(?:methods?|materials?|procedure|implementation|experimental setup)\b/i,
    phrase:
      /\b(?:we used|we use|we trained|we collected|we measured|we conducted|we employed)\b/i,
  },
  {
    key: 'findings' as const,
    label: 'Findings',
    heading: /\b(?:results?|findings?|conclusions?)\b/i,
    phrase:
      /\b(?:we found|we find|our results|results show|results indicate|we observed|we conclude)\b/i,
  },
  {
    key: 'limitations' as const,
    label: 'Limitations / future work',
    heading: /\b(?:limitations?|future work)\b/i,
    phrase:
      /\b(?:our limitation|a limitation of this|limitations of this|limitations of our|this study is limited|we did not|future work|further research)\b/i,
  },
];
const caution =
  'This free overview compares words and quoted source passages, not scientific agreement or equivalent methods. Distinct terms were not seen in the other retrieved bodies; that does not mean those papers never discuss them. Missing sections and omitted figures, tables or supplements limit the comparison.';
export function buildComparisonOverview(
  input: Paper[],
): ComparisonOverviewResult {
  const papers = [...new Map(input.map((p) => [p.id, p])).values()].slice(0, 6);
  const bodies = papers.map(body),
    maps = bodies.map(terms);
  const sharedKeys = [...new Set(maps.flatMap((m) => [...m.keys()]))].filter(
    (key) => maps.filter((m) => m.has(key)).length >= 2,
  );
  sharedKeys.sort((a, b) => {
    const covered = (key: string) => maps.filter((m) => m.has(key)).length;
    const frequency = (key: string) =>
      maps.reduce((n, m) => n + (m.get(key)?.count ?? 0), 0);
    return (
      covered(b) - covered(a) ||
      Number(b.includes(' ')) - Number(a.includes(' ')) ||
      frequency(b) - frequency(a) ||
      a.localeCompare(b)
    );
  });
  // Avoid using both a phrase and its component words as repetitive summaries.
  const shared: ComparisonOverviewResult['shared'] = [];
  for (const term of sharedKeys) {
    if (shared.some((s) => s.term.includes(term) || term.includes(s.term)))
      continue;
    shared.push({
      term,
      evidence: papers.flatMap((p, i) => {
        const item = maps[i].get(term);
        return item ? [evidence(p, item.passage)] : [];
      }),
    });
    if (shared.length === 4) break;
  }
  const distinct = papers.map((paper, i) => {
    const keys = [...maps[i].keys()].filter((key) =>
      maps.every((map, j) => j === i || !map.has(key)),
    );
    keys.sort(
      (a, b) =>
        Number(b.includes(' ')) - Number(a.includes(' ')) ||
        maps[i].get(b)!.count - maps[i].get(a)!.count ||
        a.localeCompare(b),
    );
    const selected: { term: string; evidence: OverviewEvidence }[] = [];
    for (const term of keys) {
      if (selected.some((s) => s.term.includes(term) || term.includes(s.term)))
        continue;
      selected.push({
        term,
        evidence: evidence(paper, maps[i].get(term)!.passage),
      });
      if (selected.length === 3) break;
    }
    return { paperId: paper.id, terms: selected };
  });
  const matrix = rows.map((row) => ({
    key: row.key,
    label: row.label,
    cells: papers.map((paper, i) => {
      const headingPassage = bodies[i].find((p) =>
        row.heading.test(p.section ?? ''),
      );
      const passage =
        headingPassage ?? bodies[i].find((p) => row.phrase.test(p.text));
      return {
        paperId: paper.id,
        evidence: passage
          ? evidence(paper, passage, headingPassage ? undefined : row.phrase)
          : null,
      };
    }),
  }));
  const count = bodies.filter((p) => p.length).length;
  return {
    status:
      papers.length < 2
        ? 'need-more-papers'
        : count < 2
          ? 'need-body-text'
          : 'ready',
    papers: papers.map((p, i) => ({
      id: p.id,
      title: p.title,
      hasBody: !!bodies[i].length,
    })),
    shared,
    distinct,
    matrix,
    caution,
  };
}

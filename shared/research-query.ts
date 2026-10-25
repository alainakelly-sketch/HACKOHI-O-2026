import type { QueryPlan, SearchConcept, SourceName } from './types';

/** A small inspectable vocabulary, not model-generated search instructions. */
const related = [
  [
    'time perception',
    'perceived duration',
    'duration estimates',
    'estimates of duration',
    'temporal perception',
    'duration estimation',
    'perceived time',
  ],
  ['music', 'musical', 'musical tempo'],
  [
    'water leak',
    'water leaks',
    'water leakage',
    'leak detection',
    'leakage detection',
  ],
  ['household', 'households', 'residential', 'domestic', 'homes'],
  ['urban heat', 'urban heat island', 'urban temperature', 'city heat'],
  [
    'vegetation',
    'green space',
    'green spaces',
    'urban greening',
    'tree canopy',
  ],
  [
    'detection',
    'detecting',
    'detected',
    'detect',
    'identification',
    'monitoring',
  ],
  ['memory recall', 'memory performance', 'memory retention'],
  ['sleep duration', 'sleep length', 'sleep time'],
] as const;
const generic = new Set(
  'what which how why when where who is are was were a an the and or in on of to for from with by can could would should does do did may might will have has had i my we our me help research study studies field question gap gaps identify find explore investigate interested limitations limitation limited remain remains remaining unknown unanswered understand understanding future further additional work this that these those it its they their them such also some any another other authors author several including need needs needed still unclear affect affects effect effects influence influences impact impacts reduce reduces reduced improve improves improved increase increases increased decrease decreases decreased change changes get gets relationship relationships between during'.split(
    ' ',
  ),
);
const words = (text: string) =>
  text.toLowerCase().match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) ?? [];
const clean = (text: string) => words(text).join(' ');
function phrasePattern(phrase: string) {
  return new RegExp(`(?:^|\\s)${phrase.split(' ').join('\\s+')}(?=\\s|$)`, 'i');
}

export function buildQueryPlan({
  question,
  field = '',
  concepts,
}: {
  question: string;
  field?: string;
  concepts?: SearchConcept[];
}): QueryPlan {
  if (concepts?.length) {
    const corrected = concepts
      .slice(0, 8)
      .map((concept) => ({
        label: clean(concept.label).slice(0, 80),
        terms: [
          ...new Set(
            [concept.label, ...concept.terms].map(clean).filter(Boolean),
          ),
        ].slice(0, 5),
      }))
      .filter((c) => c.label);
    return finish(question, corrected);
  }
  const quoted = [...question.matchAll(/"([^"\n]+)"/g)];
  if (quoted.length) {
    const residual = question.replace(/"[^"\n]+"/g, ' ');
    const explicit = quoted.map((match) => {
      const label = clean(match[1]);
      const group = related.find((terms) =>
        terms.some((term) => clean(term) === label),
      );
      return {
        at: match.index!,
        concept: {
          label,
          terms: [...new Set([label, ...(group ?? [])])].slice(0, 5),
        },
      };
    });
    const rest = buildQueryPlan({ question: residual, field: '' }).concepts.map(
      (concept) => ({
        at: question.toLowerCase().indexOf(concept.label),
        concept,
      }),
    );
    return finish(
      question,
      [...explicit, ...rest]
        .sort((a, b) => a.at - b.at)
        .map((item) => item.concept),
    );
  }
  const input = clean(question || field).slice(0, 1200);
  let remainder = ` ${input} `;
  const found: { at: number; concept: SearchConcept }[] = [];
  // Longest vocabulary phrases are matched first, so 'time perception' is never
  // split into two independent sufficient concepts and 'urban heat' stays intact.
  const entries = related
    .flatMap((group) => group.map((term) => ({ term, group })))
    .sort((a, b) => b.term.length - a.term.length);
  for (const { term, group } of entries) {
    const match = phrasePattern(term).exec(remainder);
    if (!match) continue;
    const at = input.indexOf(term);
    const existing = found.find((item) =>
      item.concept.terms.some((alias) => group.includes(alias as never)),
    );
    if (!existing)
      found.push({
        at,
        concept: {
          label: term,
          terms: [...new Set([term, ...group])].slice(0, 5),
        },
      });
    remainder = remainder.replace(
      new RegExp(`\\b${term}\\b`, 'gi'),
      ' '.repeat(term.length),
    );
  }
  const leftover = remainder
    .split(/\s+/)
    .filter((word) => word.length > 2 && !generic.has(word));
  const unique = [...new Set(leftover)];
  // Preserve unknown concepts too; no arbitrary first-four-word truncation.
  // Adjacent meaningful words form short phrases rather than a bag of words.
  const segments = question.split(
    /\b(?:affects?|effects?|influences?|impacts?|between|during|using|versus|vs|and|on|in|for|with)\b|[?,;:]/i,
  );
  for (const segment of segments) {
    const retained = words(segment).filter((word) => unique.includes(word));
    if (!retained.length) continue;
    const label = [...new Set(retained)].join(' ');
    if (label && !found.some((item) => item.concept.label === label))
      found.push({
        at: input.indexOf(retained[0]),
        concept: { label, terms: [label] },
      });
    retained.forEach((word) => {
      const i = unique.indexOf(word);
      if (i >= 0) unique.splice(i, 1);
    });
  }
  for (const word of unique)
    found.push({
      at: input.indexOf(word),
      concept: { label: word, terms: [word] },
    });
  found.sort((a, b) => a.at - b.at);
  // Eight concept groups is a visible request bound, not silent keyword dropping.
  const interpreted = found.map((item) => item.concept);
  return finish(
    question,
    interpreted.length
      ? interpreted
      : input
        ? [{ label: input, terms: [input] }]
        : [],
  );
}
function finish(question: string, concepts: SearchConcept[]): QueryPlan {
  const quote = (text: string) => (text.includes(' ') ? `"${text}"` : text);
  const primary = concepts
    .map((c) => quote(c.label))
    .join(' ')
    .slice(0, 400);
  const alternate = concepts
    .map((c) =>
      quote(
        c.terms.filter((term) => term !== c.label)[
          c.label.includes(' ') && c.terms.length > 2 ? 1 : 0
        ] || c.label,
      ),
    )
    .join(' ')
    .slice(0, 400);
  return {
    question,
    concepts,
    variants: [...new Set([primary, alternate].filter(Boolean))].slice(0, 2),
    note: 'Editable lexical concepts and a small related-term vocabulary. The research question remains unchanged; a shared word alone is not direct evidence.',
  };
}
export function buildResearchQuery({
  field,
  question,
}: {
  field: string;
  question: string;
}) {
  return buildQueryPlan({ field, question }).variants[0] ?? '';
}
/** Provider syntax stays at the adapter boundary. OpenAlex receives plain text:
 * its search engine handles relevance, while PMC/arXiv explicitly AND concepts. */
export function compileProviderQuery(
  query: string,
  provider: SourceName,
): string {
  const concepts = buildQueryPlan({ question: query }).concepts;
  if (provider === 'OpenAlex') return concepts.map((c) => c.label).join(' ');
  const clauses = concepts.map((concept) => {
    const phrase = clean(concept.label);
    return provider === 'arXiv' ? `all:"${phrase}"` : `"${phrase}"`;
  });
  const compiled = clauses.join(' AND ');
  return provider === 'Europe PMC'
    ? `(${compiled}) AND OPEN_ACCESS:Y`
    : compiled;
}

import type { Citation, Paper, Passage } from './types';
import { scanGapLeads } from './gaps';

export type DiscoveryEvidence = {
  reference: Citation;
  quote: string;
  kind: 'abstract' | 'full-text';
  section: string;
};
export type ProfileField =
  | 'sample'
  | 'population'
  | 'dataset'
  | 'method'
  | 'metric'
  | 'limitation'
  | 'futureWork';
export type PaperProfile = {
  paperId: string;
  fields: Record<ProfileField, DiscoveryEvidence | null>;
};
export type EvidenceTension = {
  id: string;
  topic: string;
  label: string;
  claims: [DiscoveryEvidence, DiscoveryEvidence];
  context: {
    field: 'population' | 'dataset' | 'method';
    left: DiscoveryEvidence | null;
    right: DiscoveryEvidence | null;
  }[];
  followUp: string;
  searchQuery: string;
};
export type EvidencePattern = {
  id: string;
  field: ProfileField;
  label: string;
  evidence: DiscoveryEvidence[];
  unknownPaperIds: string[];
  caution: string;
};
export type DiscoveryReport = {
  profiles: PaperProfile[];
  tensions: EvidenceTension[];
  patterns: EvidencePattern[];
  caution: string;
};
const excluded =
  /\b(?:references?|bibliography|introduction|background|related work|literature review|acknowledg(?:e)?ments?)\b/i;
const findingHeading = /\b(?:results?|findings?|conclusions?|discussion)\b/i;
const findingVoice =
  /\b(?:we (?:found|observed|showed|show|demonstrated|demonstrate)|our (?:results|findings) (?:show|indicate|suggest|reveal)|results (?:show|indicate|suggest|reveal))\b/i;
const attribution =
  /\b(?:previous|prior|earlier|other studies|other researchers|previously reported|it has been reported)\b/i;
const uncertain =
  /\b(?:not|no|never|without|didn't|did not|doesn't|does not|cannot|can't|could|would|might|may|hypothesi[sz]e|hypothetical|future|expected|expect|predict|predicted|nonsignificant|non-significant|simulat(?:ed|ion) example)\b/i;
const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
type SourceSentence = { passage: Passage; evidence: DiscoveryEvidence };
const sentenceCache = new WeakMap<Paper, SourceSentence[]>();
function sentences(paper: Paper): SourceSentence[] {
  const cached = sentenceCache.get(paper);
  if (cached) return cached;
  const hasBody = paper.passages.some(
    (p) => p.kind === 'full-text' && p.text.trim(),
  );
  const result = paper.passages.flatMap((passage) => {
    if (
      excluded.test(passage.section ?? '') ||
      (hasBody && passage.kind !== 'full-text')
    )
      return [];
    return [...segmenter.segment(passage.text)].flatMap((sentence) => {
      const quote = sentence.segment.trim();
      return quote
        ? [
            {
              passage,
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
            },
          ]
        : [];
    });
  });
  sentenceCache.set(paper, result);
  return result;
}
const fieldCues: Partial<Record<ProfileField, RegExp>> = {
  sample:
    /\b(?:n\s*=\s*\d+|(?:sample size|cohort size)\s*(?:of|was|is|=|:)\s*\d+|\d+[\d,]*\s+(?:participants|patients|subjects|samples|respondents|individuals|volunteers))\b/i,
  population:
    /\b(?:(?:we (?:recruited|enrolled|included)|participants were|patients were|our cohort|the study population|the study included)\b|(?:adult|pediatric|paediatric|elderly|adolescent|underrepresented)\s+(?:patients|participants|population|cohort))\b/i,
  dataset:
    /\b(?:we (?:used|use|collected|collect|analy[sz]ed|evaluate(?:d)? on)|(?:our|the) (?:study|analysis|experiments?) (?:uses?|used))\b[^.!?]{0,180}\b(?:data(?:set|base)?s?|corpus|cohort|benchmark)\b/i,
  method:
    /\bwe (?:used|use|implemented|trained|collected|measured|conducted|employed|performed)\b|\b(?:our|this) (?:method|study|analysis|experiment) (?:uses?|used|employs?|employed)\b/i,
  metric:
    /\b(?:evaluat(?:ed|e|ion)|measur(?:ed|e)|assess(?:ed|ment)|report(?:ed)?)\b[^.!?]{0,120}\b(?:accuracy|sensitivity|specificity|precision|recall|F1|AUROC|AUC|error rate|mean squared error|RMSE|latency)\b/i,
};
const profileCache = new WeakMap<Paper, PaperProfile>();
function profile(paper: Paper): PaperProfile {
  const old = profileCache.get(paper);
  if (old) return old;
  const source = sentences(paper);
  const fields: PaperProfile['fields'] = {
    sample: null,
    population: null,
    dataset: null,
    method: null,
    metric: null,
    limitation: null,
    futureWork: null,
  };
  for (const [key, cue] of Object.entries(fieldCues)) {
    const found = source.find(
      ({ evidence }) =>
        !attribution.test(evidence.quote) &&
        !/\b(?:not|no|didn't|did not|does not|future|would|might)\b/i.test(
          evidence.quote,
        ) &&
        cue!.test(evidence.quote),
    );
    fields[key as ProfileField] = found?.evidence ?? null;
  }
  const gapSources = source.length
    ? [
        {
          ...paper,
          passages: paper.passages.filter((p) =>
            source.some((s) => s.passage.id === p.id),
          ),
        },
      ]
    : [];
  const leads = scanGapLeads(gapSources, '', '').candidates;
  for (const [key, category] of [
    ['limitation', 'reported-limitation'],
    ['futureWork', 'future-work'],
  ] as const) {
    const lead = leads.find((item) => item.category === category);
    if (lead)
      fields[key] = {
        reference: { paperId: lead.paperId, passageId: lead.passageId },
        quote: lead.signalText,
        kind: lead.kind,
        section: lead.section,
      };
  }
  const result = { paperId: paper.id, fields };
  profileCache.set(paper, result);
  return result;
}
type DirectionalFinding = {
  topic: string;
  direction: 'up' | 'down';
  evidence: DiscoveryEvidence;
  anchor: string[];
};
const outcome =
  /\b(?:diagnostic accuracy|classification accuracy|prediction accuracy|accuracy|sensitivity|specificity|precision|recall|error rate|response time|latency|performance)\b/gi;
const up =
  /\b(?:increase(?:s|d)?|increasing|improve(?:s|d)?|improving|higher|greater|better)\b/i;
const down =
  /\b(?:decrease(?:s|d)?|decreasing|reduce(?:s|d)?|reducing|lower|worse|worsen(?:s|ed)?|decline(?:s|d)?)\b/i;
const generic = new Set(
  'adult adults pediatric paediatric patients participants subjects cohort population populations overall subgroup samples sample children elderly underrepresented we our the this that their they a an and or in on at of for to with from by was were is are be been results result findings finding study studies research model models method methods found observed showed show demonstrated demonstrate indicate indicates revealed reveals showed compared comparison versus control baseline group groups using used approach approaches significantly significant diagnostic classification prediction accuracy sensitivity specificity precision recall error rate response time latency performance increased increase improved improve higher greater better decreased decrease reduced reduce lower worse worsened declined'.split(
    ' ',
  ),
);
function anchors(text: string): string[] {
  return [
    ...new Set(
      (text.toLowerCase().match(/[\p{L}][\p{L}\p{N}-]{2,}/gu) ?? []).filter(
        (word) => !generic.has(word),
      ),
    ),
  ];
}
function findings(paper: Paper): DirectionalFinding[] {
  return sentences(paper)
    .flatMap(({ passage, evidence }) => {
      if (
        (!findingHeading.test(passage.section ?? '') &&
          !findingVoice.test(evidence.quote)) ||
        attribution.test(evidence.quote) ||
        uncertain.test(evidence.quote)
      )
        return [];
      // Sentence-level opposing directions are ambiguous (e.g. increased accuracy
      // but reduced latency). Never assign a direction to a metric by guesswork.
      if (up.test(evidence.quote) === down.test(evidence.quote)) return [];
      const found = [...evidence.quote.matchAll(outcome)];
      if (found.length !== 1) return [];
      const metricIndex = found[0].index!;
      const beforeMetric = evidence.quote.slice(0, metricIndex);
      const afterMetric = evidence.quote.slice(
        metricIndex + found[0][0].length,
      );
      // A direction elsewhere in a sentence (e.g. higher memory usage) is not
      // a direction of the reported outcome. Require a nearby grammatical link.
      const linkedBefore =
        /\b(?:increase(?:s|d)?|improve(?:s|d)?|higher|greater|better|decrease(?:s|d)?|reduce(?:s|d)?|lower|worse|worsen(?:s|ed)?|decline(?:s|d)?)(?:\s+[\p{L}-]+){0,2}\s+$/iu.test(
          beforeMetric,
        );
      const linkedAfter =
        /^\s+(?:(?:was|were|is|are|became|remained)\s+)?(?:significantly\s+)?(?:increase(?:s|d)?|improve(?:s|d)?|higher|greater|better|decrease(?:s|d)?|reduce(?:s|d)?|lower|worse|worsen(?:s|ed)?|decline(?:s|d)?)\b/iu.test(
          afterMetric,
        );
      if (!linkedBefore && !linkedAfter) return [];

      return [
        {
          topic: found[0][0].toLowerCase(),
          direction: up.test(evidence.quote)
            ? ('up' as const)
            : ('down' as const),
          evidence,
          anchor: anchors(evidence.quote),
        },
      ];
    })
    .slice(0, 20);
}
function stableId(parts: string[]) {
  let h = 2166136261;
  for (const char of parts.join('|'))
    h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}
/** Conservative lexical leads among selected sources. Never field-wide claims. */
export function buildDiscoveryReport(input: Paper[]): DiscoveryReport {
  const papers = [...new Map(input.map((p) => [p.id, p])).values()].slice(0, 6);
  const profiles = papers.map(profile);
  const directional = papers.map(findings);
  const tensions: EvidenceTension[] = [];
  for (let i = 0; i < papers.length; i++)
    for (let j = i + 1; j < papers.length; j++) {
      let added = false;
      for (const left of directional[i])
        for (const right of directional[j]) {
          if (
            added ||
            tensions.length >= 4 ||
            left.topic !== right.topic ||
            left.direction === right.direction
          )
            continue;
          const shared = left.anchor.filter((term) =>
            right.anchor.includes(term),
          );
          if (shared.length < 2) continue;
          const scopeGroups = [
            /\b(?:overall|entire cohort|all participants)\b/i,
            /\b(?:subgroup|underrepresented|minority)\b/i,
            /\badult\b/i,
            /\b(?:pediatric|paediatric|children)\b/i,
          ];
          const leftScope = scopeGroups.map((scope) =>
            scope.test(left.evidence.quote),
          );
          const rightScope = scopeGroups.map((scope) =>
            scope.test(right.evidence.quote),
          );
          const scopeDifference =
            (leftScope[0] && rightScope[1]) ||
            (leftScope[1] && rightScope[0]) ||
            (leftScope[2] && rightScope[3]) ||
            (leftScope[3] && rightScope[2]);
          const claims: EvidenceTension['claims'] = [
            left.evidence,
            right.evidence,
          ];
          tensions.push({
            id: `tension:${stableId([papers[i].id, papers[j].id, left.evidence.reference.passageId, right.evidence.reference.passageId, left.topic])}`,
            topic: left.topic,
            label: `${scopeDifference ? 'Possible scope difference' : 'Possible disagreement'} to review: ${left.topic}`,
            claims,
            context: (['population', 'dataset', 'method'] as const).map(
              (field) => ({
                field,
                left: profiles[i].fields[field],
                right: profiles[j].fields[field],
              }),
            ),
            followUp: `Check whether these studies actually test the same intervention, outcome, population and baseline. If comparable, a follow-up could test whether changing one documented context alters ${left.topic}. Choose the context and protocol yourself; this text screen does not establish a contradiction.`,
            searchQuery: [
              ...shared.slice(0, 3),
              left.topic,
              'replication',
            ].join(' '),
          });
          added = true;
        }
    }
  const patterns: EvidencePattern[] = [];
  if (papers.length >= 2)
    for (const field of [
      'sample',
      'population',
      'dataset',
      'method',
      'metric',
      'limitation',
      'futureWork',
    ] as ProfileField[]) {
      const evidence = profiles.flatMap((p) =>
        p.fields[field] ? [p.fields[field]!] : [],
      );
      const unknownPaperIds = profiles
        .filter((p) => !p.fields[field])
        .map((p) => p.paperId);
      if (!evidence.length) continue;
      patterns.push({
        id: `reported:${field}`,
        field,
        label: `${evidence.length} of ${papers.length} selected sources have an extractable ${field === 'sample' ? 'sample-size' : field === 'futureWork' ? 'future-work' : field} statement`,
        evidence,
        unknownPaperIds,
        caution:
          'This is reporting coverage in the selected retrieved text, not evidence that other populations, datasets or conditions have never been tested. Missing statements may exist elsewhere in the paper or in other studies.',
      });
    }
  return {
    profiles,
    tensions,
    patterns,
    caution:
      'Free local text screening of at most six selected sources. Opposite wording is only a possible disagreement: datasets, populations, metrics, baselines and omitted text can explain it. Profile fields contain source statements, not validated study facts. No field-wide gap, novelty or scientific strength is established.',
  };
}

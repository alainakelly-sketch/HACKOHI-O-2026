import type { Analysis, Citation, Paper, Passage } from './types';
import type { GapLead } from './gaps';

/** One view model shared by the findings list and supplementary map. Source
 * records and citation IDs remain authoritative; this adapter never runs AI. */
export type GapFinding = {
  id: string;
  origin: 'author-stated' | 'ai-inferred' | 'saved-example';
  title: string;
  question: string;
  known: string;
  unresolved: string;
  rationale: string;
  uncertainty: string[];
  evidence: Citation[];
  sourceLead?: GapLead;
  hypothesisId?: string;
  analysisId?: string;
  ready: boolean;
};
const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
const issueCue =
  /\b(?:limitations?|future work|further work|remains? (?:unclear|unknown)|should|could|might)\b/i;
function source(papers: Paper[], reference: Citation) {
  const paper = papers.find((item) => item.id === reference.paperId);
  const passage = paper?.passages.find(
    (item) => item.id === reference.passageId && item.text.trim(),
  );
  return paper && passage ? { paper, passage } : null;
}
function refs(items: Citation[]): Citation[] {
  return [
    ...new Map(
      items.map((item) => [`${item.paperId}:${item.passageId}`, { ...item }]),
    ).values(),
  ];
}
function excerpt(text: string, length = 280) {
  const trimmed = text.trim();
  if (trimmed.length <= length) return trimmed;
  const cut = trimmed.slice(0, length);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), length - 30))}…`;
}
function contextualPassage(paper: Paper, lead: GapLead): Passage | undefined {
  const body = paper.passages.some(
    (item) => item.kind === 'full-text' && item.text.trim(),
  );
  return paper.passages.find(
    (item) =>
      item.id !== lead.passageId &&
      (!body || item.kind === 'full-text') &&
      item.text.trim() &&
      /\b(?:methods?|results?|findings?)\b/i.test(item.section || '') &&
      !issueCue.test(item.text),
  );
}
function issueLabel(text: string): string {
  // Remove only introductory boilerplate from the display label. The complete
  // author statement remains unchanged in unresolved and stored passages.
  const trimmed = text
    .trim()
    .replace(
      /^(?:a|an|the|our|this)(?:\s+(?:main|key|major|important))?\s+limitations?(?:\s+of\s+(?:this|the|our)\s+(?:study|research|work))?\s+(?:is|was|are|were)(?:\s+that)?\s+/i,
      '',
    )
    .replace(
      /^(?:future|further|additional)\s+(?:work|research|studies)\s+(?:should|could|can)\s+/i,
      '',
    );
  return trimmed || text.trim();
}
function specificIssue(text: string): boolean {
  const detail =
    text
      .toLowerCase()
      .replace(
        /\b(?:a|an|the|this|that|these|those|our|study|studies|research|paper|has|have|had|is|are|was|were|its|some|several|important|major|key|limitations?|limited|future|further|work|should|could|may|might|need|needs|needed|test|tested|testing|investigate|investigated|address|addressed|consider|considered|of|in|on|to|for|with|and|as|be|by|not|yet|remains?|unclear|unknown|issue|issues)\b/g,
        ' ',
      )
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(detail).size >= 2;
}
function coverageNotes(papers: Paper[], citations: Citation[]) {
  const onlyAbstracts =
    citations.length > 0 &&
    citations.every(
      (reference) => source(papers, reference)?.passage.kind !== 'full-text',
    );
  return onlyAbstracts
    ? [
        'Only abstract passages are available for this finding; methods or results elsewhere in the article may change the interpretation.',
      ]
    : [];
}
export function buildGapFindings(
  leads: GapLead[],
  analysis: Analysis | null,
  analysisId: string,
  papers: Paper[],
): GapFinding[] {
  const findings: GapFinding[] = [];
  for (const lead of leads) {
    const reference = { paperId: lead.paperId, passageId: lead.passageId };
    const located = source(papers, reference);
    const validSignal = !!located?.passage.text.includes(
      lead.signalText.trim(),
    );
    const detailed = specificIssue(lead.signalText);
    const background =
      /\b(?:introduction|background|related work|prior work)\b/i.test(
        lead.section,
      );
    const context = located
      ? contextualPassage(located.paper, lead)
      : undefined;
    // Context is a quoted source statement, not a generated scientific conclusion.
    const evidence = refs([
      ...(located ? [reference] : []),
      ...(context ? [{ paperId: lead.paperId, passageId: context.id }] : []),
    ]);
    const uncertainty = [
      'This author-stated issue is a candidate in the selected evidence, not proof of a field-wide gap. Check related work before treating it as open.',
      ...coverageNotes(papers, evidence),
      ...(background
        ? [
            'The issue appears in background material and may already be addressed by this paper. Check its findings before treating it as unresolved.',
          ]
        : []),
      ...(!context
        ? [
            'Retrieved methods/results context is insufficient to establish exactly what was already tested.',
          ]
        : []),
      ...(!validSignal
        ? [
            'The issue text or citation is no longer present in the current retrieved sources. Select current evidence before developing it.',
          ]
        : []),
      ...(!detailed
        ? [
            'Insufficient detail: the source flags limitations or future work without specifying a useful unresolved point.',
          ]
        : []),
    ];
    findings.push({
      id: lead.id,
      origin: 'author-stated',
      title: detailed
        ? excerpt(issueLabel(lead.signalText), 180)
        : 'Insufficient detail for a candidate gap',
      question: `What follow-up study could address “${issueLabel(lead.signalText).replace(/[.!?]+$/, '')}”?`,
      known: context
        ? `The selected source reports: “${excerpt(context.text)}”`
        : 'The retrieved text contains an author-stated issue, but not enough methods/results context to establish what was already tested.',
      unresolved: validSignal
        ? lead.signalText
        : 'The supporting issue passage is unavailable in the current evidence.',
      rationale: detailed
        ? lead.followUp
        : 'A useful follow-up requires the actual limitation, affected population/method, or outcome. Retrieve more source context before proposing a gap.',
      uncertainty,
      evidence,
      sourceLead: lead,
      ready: validSignal && detailed && !background,
    });
  }
  if (analysis?.status === 'connections') {
    for (const hypothesis of analysis.hypotheses) {
      const unique = refs(hypothesis.evidence);
      const valid = unique.filter((reference) => source(papers, reference));
      const invalid = valid.length !== unique.length;
      const statements = valid.slice(0, 2).map((reference) => {
        const item = source(papers, reference)!;
        const sentence = [...segmenter.segment(item.passage.text)]
          .find((item) => !issueCue.test(item.segment))
          ?.segment.trim();
        return `${item.paper.title}: “${excerpt(sentence || item.passage.text)}”`;
      });
      findings.push({
        id: `${analysisId}:hypothesis:${hypothesis.id}`,
        origin:
          analysis.origin === 'saved-example' ? 'saved-example' : 'ai-inferred',
        title: hypothesis.title,
        question: hypothesis.hypothesis,
        known: statements.length
          ? `Retrieved source statements: ${statements.join(' ')} These passages support inspection; they do not independently validate the interpretation.`
          : 'No current retrieved source statement is available to inspect.',
        unresolved:
          hypothesis.gapRationale ||
          'The proposed unresolved point was not specified. More evidence is needed.',
        rationale:
          hypothesis.proposedApproach ||
          'The proposal needs an explicit source-supported rationale before it can guide a useful experiment.',
        uncertainty: [
          ...new Set([
            ...(analysis.origin === 'saved-example'
              ? [
                  'This is a saved, manually prepared example, not a live AI result.',
                ]
              : [
                  'This candidate is a PaperBridge model inference, not a published finding or confirmed research gap.',
                ]),
            ...hypothesis.assumptions,
            ...hypothesis.incompatibilities,
            ...hypothesis.unknowns,
            ...coverageNotes(papers, valid),
            ...(invalid || !valid.length
              ? [
                  'Some supporting source references are missing from the current selected evidence. Review or regenerate with current sources before planning.',
                ]
              : []),
            'A related-work check is still required; these selected papers cannot establish novelty.',
          ]),
        ],
        evidence: valid,
        hypothesisId: hypothesis.id,
        analysisId,
        ready: valid.length > 0 && !invalid && !!hypothesis.gapRationale.trim(),
      });
    }
  }
  return [...new Map(findings.map((item) => [item.id, item])).values()];
}

import { useRef, useState } from 'react';
import type { GapFinding } from '../../shared/gap-findings';
import type { Citation, Paper, Passage } from '../../shared/types';
import { Notice } from './Primitives';
import './concept-map.css';

type SourceEntry = { paper: Paper; references: Citation[] };
const passageScope = (passage: Passage) =>
  passage.kind === 'full-text'
    ? 'Article body'
    : passage.kind === 'abstract'
      ? 'Abstract only'
      : 'Retrieved passage · scope unspecified';
const citationKey = (reference: Citation) =>
  `${reference.paperId}:${reference.passageId}`;
const short = (text: string, length = 110) =>
  text.length > length ? `${text.slice(0, length)}…` : text;

/** A secondary explanation of the selected canonical finding. This component
 * derives no gaps, relationships or new evidence; expansion is display-only. */
export function GapVisualMap({
  finding,
  findings,
  papers,
  onSelect,
  onInspect,
}: {
  finding: GapFinding | null;
  findings: GapFinding[];
  papers: Paper[];
  onSelect: (id: string) => void;
  onInspect: (reference: Citation, label?: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedEvidence, setSelectedEvidence] = useState<{
    findingId: string;
    reference: Citation;
  } | null>(null);
  const lastEvidenceButton = useRef<HTMLButtonElement | null>(null);
  const prefix = finding?.id ?? '';
  const branchKey = (branch: string) => `${prefix}:${branch}`;
  const isExpanded = (branch: string) => expanded.has(branchKey(branch));
  function toggle(branch: string) {
    const key = branchKey(branch);
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function closeDrawer() {
    setSelectedEvidence(null);
    lastEvidenceButton.current?.focus({ preventScroll: true });
  }
  const sources: SourceEntry[] = [];
  let missingReferences = 0;
  for (const reference of finding?.evidence ?? []) {
    const paper = papers.find((item) => item.id === reference.paperId);
    const passage = paper?.passages.find(
      (item) => item.id === reference.passageId && item.text.trim(),
    );
    if (!paper || !passage) {
      missingReferences++;
      continue;
    }
    const source = sources.find((item) => item.paper.id === paper.id);
    if (source) {
      if (
        !source.references.some(
          (item) => citationKey(item) === citationKey(reference),
        )
      )
        source.references.push(reference);
    } else sources.push({ paper, references: [reference] });
  }
  const inspectedReference =
    selectedEvidence &&
    finding &&
    selectedEvidence.findingId === finding.id &&
    finding.evidence.some(
      (item) => citationKey(item) === citationKey(selectedEvidence.reference),
    )
      ? selectedEvidence.reference
      : null;
  const inspectedPaper = inspectedReference
    ? papers.find((item) => item.id === inspectedReference.paperId)
    : undefined;
  const inspectedPassage = inspectedPaper?.passages.find(
    (item) => item.id === inspectedReference?.passageId,
  );
  const valid =
    !!finding?.ready && sources.length > 0 && missingReferences === 0;
  const origin =
    finding?.origin === 'author-stated'
      ? 'Author-stated issue'
      : finding?.origin === 'saved-example'
        ? 'Saved example · manually prepared inference'
        : 'AI-proposed inference · untested';
  const relationshipLabel =
    sources.length > 1
      ? 'How the cited sources connect'
      : 'How the source leads to this question';
  const evidenceDrawer =
    finding &&
    (inspectedReference && inspectedPaper && inspectedPassage ? (
      <section
        className="gap-map-drawer"
        aria-label="Map evidence details"
        data-paper-id={inspectedPaper.id}
        data-passage-id={inspectedPassage.id}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            closeDrawer();
          }
        }}
      >
        <div className="gap-map-drawer-heading">
          <h4>{inspectedPaper.title}</h4>
          <button type="button" className="text-button" onClick={closeDrawer}>
            Close evidence details
          </button>
        </div>
        <span className="gap-map-role">
          Source states · {passageScope(inspectedPassage)} ·{' '}
          {inspectedPassage.section || 'Supporting passage'}
        </span>
        <blockquote>{inspectedPassage.text}</blockquote>
        <div className="gap-map-source-links">
          <a href={inspectedPaper.url} target="_blank" rel="noreferrer">
            Open original paper
          </a>
          <button
            type="button"
            className="text-button"
            onClick={() => onInspect(inspectedReference, finding.title)}
          >
            Open evidence inspector
          </button>
        </div>
      </section>
    ) : null);
  return (
    <section
      className="panel gap-visual-map"
      aria-labelledby="gap-map-title"
      data-finding-id={finding?.id}
    >
      <div className="gap-map-heading">
        <div>
          <h2 id="gap-map-title">Selected gap</h2>
          <p>
            This is the same finding and source evidence shown in Gap findings.
          </p>
        </div>
        {findings.length > 1 ? (
          <label className="gap-map-chooser">
            Choose finding to visualize
            <select
              value={finding?.id ?? ''}
              onChange={(event) => onSelect(event.target.value)}
            >
              {!finding ? (
                <option value="">Choose an existing finding</option>
              ) : null}
              {findings.map((item) => (
                <option key={item.id} value={item.id}>
                  {short(item.title, 120)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {!finding ? (
        <Notice>
          No supported candidate is selected. Return to Gap findings to review
          the available evidence. The map does not create extra gaps.
        </Notice>
      ) : !valid ? (
        <Notice>
          Insufficient source detail to explain this candidate as a gap. Review
          its evidence and uncertainty in Gap findings; no connection has been
          invented to fill the map.
        </Notice>
      ) : (
        <>
          <div className="gap-map-toolbar">
            <span>Expand a branch to inspect its part of the finding.</span>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setExpanded(
                  (current) =>
                    new Set(
                      [...current].filter(
                        (key) => !key.startsWith(`${prefix}:`),
                      ),
                    ),
                );
                setSelectedEvidence(null);
              }}
            >
              Collapse all
            </button>
          </div>
          <div
            className="gap-map-canvas"
            aria-label="Selected gap explanation map"
          >
            <article className="gap-map-question" data-gap-id={finding.id}>
              <span className="gap-map-role">
                Candidate research question · {origin}
              </span>
              <h3>{finding.question}</h3>
              <p>
                Candidate in the selected evidence; a wider research gap is not
                established.
              </p>
            </article>
            <div className="gap-map-branches">
              <section
                className="gap-map-branch gap-map-sources"
                aria-label="Supporting source branches"
              >
                <h4>Source contributions</h4>
                {sources.map(({ paper, references }, index) => {
                  const key = `source:${paper.id}`;
                  const panelId = `gap-source-${index}`;
                  return (
                    <div
                      className="gap-map-source"
                      key={paper.id}
                      data-paper-id={paper.id}
                    >
                      <button
                        type="button"
                        className="gap-map-node source-node"
                        aria-expanded={isExpanded(key)}
                        aria-controls={panelId}
                        onClick={() => toggle(key)}
                      >
                        <span className="gap-map-role">
                          Retrieved source · {paper.year ?? 'Year unavailable'}
                        </span>
                        <strong>{paper.title}</strong>
                        <span className="gap-map-node-hint">
                          Supporting passages{' '}
                          <span aria-hidden="true">
                            {isExpanded(key) ? '−' : '+'}
                          </span>
                        </span>
                      </button>
                      <div
                        id={panelId}
                        className="gap-map-source-children"
                        hidden={!isExpanded(key)}
                      >
                        {references.map((reference) => {
                          const passage = paper.passages.find(
                            (item) => item.id === reference.passageId,
                          )!;
                          const selected =
                            inspectedReference &&
                            citationKey(inspectedReference) ===
                              citationKey(reference);
                          return (
                            <button
                              type="button"
                              className="gap-map-evidence-node"
                              key={citationKey(reference)}
                              data-paper-id={paper.id}
                              data-passage-id={passage.id}
                              aria-expanded={!!selected}
                              onClick={(event) => {
                                lastEvidenceButton.current =
                                  event.currentTarget;
                                setSelectedEvidence(
                                  selected
                                    ? null
                                    : { findingId: finding.id, reference },
                                );
                              }}
                            >
                              <span className="gap-map-role">
                                Source states · {passageScope(passage)}
                              </span>
                              <strong>
                                {passage.section || 'Supporting passage'}
                              </strong>
                              <span>{short(passage.text)}</span>
                            </button>
                          );
                        })}
                        {inspectedPaper?.id === paper.id
                          ? evidenceDrawer
                          : null}
                      </div>
                    </div>
                  );
                })}
              </section>
              <section className="gap-map-branch">
                <button
                  type="button"
                  className="gap-map-node relationship-node"
                  aria-expanded={isExpanded('relationship')}
                  aria-controls="gap-relationship-details"
                  onClick={() => toggle('relationship')}
                >
                  <span className="gap-map-role">
                    {finding.origin === 'author-stated'
                      ? 'Source statements'
                      : 'Proposed source interpretation'}
                  </span>
                  <strong>{relationshipLabel}</strong>
                  <span className="gap-map-node-hint">
                    {finding.origin === 'author-stated'
                      ? 'What is known in this source'
                      : 'What the citations may support'}{' '}
                    <span aria-hidden="true">
                      {isExpanded('relationship') ? '−' : '+'}
                    </span>
                  </span>
                </button>
                <div
                  id="gap-relationship-details"
                  className="gap-map-branch-details"
                  hidden={!isExpanded('relationship')}
                >
                  <p>{short(finding.known, 420)}</p>
                  <p className="gap-map-caution">
                    {finding.origin === 'author-stated'
                      ? 'This author-stated issue is a starting point, not evidence of an untested relationship across the field.'
                      : 'The connection is PaperBridge’s proposed interpretation of the cited sources; a matching passage does not prove the interpretation.'}
                  </p>
                </div>
              </section>
              <section className="gap-map-branch">
                <button
                  type="button"
                  className="gap-map-node unresolved-node"
                  aria-expanded={isExpanded('unresolved')}
                  aria-controls="gap-unresolved-details"
                  onClick={() => toggle('unresolved')}
                >
                  <span className="gap-map-role">
                    Unresolved in this evidence
                  </span>
                  <strong>{short(finding.unresolved, 150)}</strong>
                  <span className="gap-map-node-hint">
                    Why follow up{' '}
                    <span aria-hidden="true">
                      {isExpanded('unresolved') ? '−' : '+'}
                    </span>
                  </span>
                </button>
                <div
                  id="gap-unresolved-details"
                  className="gap-map-branch-details"
                  hidden={!isExpanded('unresolved')}
                >
                  <p>{finding.unresolved}</p>
                  <h4>Why investigate this</h4>
                  <p>{finding.rationale}</p>
                  <ul>
                    {finding.uncertainty.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

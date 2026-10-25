import { useMemo, useState } from 'react';
import { FileText, GitBranch, FlaskConical } from 'lucide-react';
import type { Citation, Paper } from '../../shared/types';
import { buildDiscoveryReport } from '../../shared/discovery';
import type { DiscoveryEvidence } from '../../shared/discovery';
import { scanGapLeads } from '../../shared/gaps';
import { Notice } from './Primitives';
import './discovery.css';

export type DiscoveryLead = {
  id: string;
  title: string;
  question: string;
  reason: string;
  sources: Citation[];
  searchQuery: string;
};
type ChosenNode = { kind: 'paper' | 'tension' | 'gap'; id: string };
const fieldLabels = {
  sample: 'Sample size',
  population: 'Population',
  dataset: 'Dataset / conditions',
  method: 'Method',
  metric: 'Evaluation measure',
  limitation: 'Author-stated limitation',
  futureWork: 'Author-recommended future work',
};
export function DiscoveryPanel({
  papers,
  focus,
  onInspect,
  onPlan,
  onHypothesis,
}: {
  papers: Paper[];
  focus: { question: string; field: string };
  onInspect: (citation: Citation, label?: string) => void;
  onPlan: (lead: DiscoveryLead) => void;
  onHypothesis: (lead: DiscoveryLead) => void;
}) {
  const [chosen, setChosen] = useState<ChosenNode | null>(null);
  const report = useMemo(() => buildDiscoveryReport(papers), [papers]);
  const gapSources = useMemo(
    () =>
      papers
        .map((paper) => ({
          ...paper,
          passages: paper.passages.filter(
            (passage) => passage.kind === 'full-text',
          ),
        }))
        .filter((paper) => paper.passages.length),
    [papers],
  );
  const scan = useMemo(
    () => scanGapLeads(gapSources, focus.question, focus.field),
    [gapSources, focus.question, focus.field],
  );
  const gaps = scan.candidates.slice(0, 6);
  const tension =
    chosen?.kind === 'tension'
      ? report.tensions.find((item) => item.id === chosen.id)
      : undefined;
  const gap =
    chosen?.kind === 'gap'
      ? gaps.find((item) => item.id === chosen.id)
      : undefined;
  const selectedPaper =
    chosen?.kind === 'paper'
      ? papers.find((paper) => paper.id === chosen.id)
      : undefined;
  const profile = selectedPaper
    ? report.profiles.find((item) => item.paperId === selectedPaper.id)
    : undefined;
  const lead: DiscoveryLead | null = tension
    ? {
        id: tension.id,
        title: tension.label,
        question: `What could explain the different reported findings about ${tension.topic}?`,
        reason: tension.followUp,
        sources: tension.claims.map((claim) => claim.reference),
        searchQuery: tension.searchQuery,
      }
    : gap
      ? {
          id: gap.id,
          title: gap.label,
          question: `What small study could investigate this author-stated issue: ${gap.signalText}`,
          reason: gap.followUp,
          sources: [{ paperId: gap.paperId, passageId: gap.passageId }],
          searchQuery: gap.searchQuery,
        }
      : null;
  const linked = new Set(
    lead?.sources.map((citation) => citation.paperId) ?? [],
  );
  const title = (id: string) =>
    papers.find((paper) => paper.id === id)?.title ?? id;
  const bodyCount = papers.filter((paper) =>
    paper.passages.some(
      (passage) => passage.kind === 'full-text' && passage.text.trim(),
    ),
  ).length;
  function quote(
    evidence: DiscoveryEvidence,
    label = 'Discovery supporting passage',
  ) {
    return (
      <div className="discovery-quote">
        <span className="source-label">
          SOURCE STATES ·{' '}
          {evidence.kind === 'full-text' ? 'ARTICLE BODY' : 'ABSTRACT ONLY'} ·{' '}
          {evidence.section}
        </span>
        <blockquote>{evidence.quote}</blockquote>
        <button
          className="text-button"
          onClick={() => onInspect(evidence.reference, label)}
        >
          Inspect complete source passage
        </button>
      </div>
    );
  }
  function choose(node: ChosenNode, scroll = true) {
    setChosen(node);
    if (scroll)
      requestAnimationFrame(() =>
        document
          .querySelector('.discovery-panel .discovery-selection')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
  }
  const clip = (text: string, limit = 160) =>
    text.length > limit ? `${text.slice(0, limit)}…` : text;
  return (
    <section
      className="panel discovery-panel"
      aria-labelledby="discovery-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="discovery-title">Evidence mind map</h2>
          <p className="muted">
            Explore first. Choose one direction to develop.
          </p>
        </div>
        <GitBranch size={20} aria-hidden="true" />
      </div>
      <div
        className="discovery-summary"
        aria-label="Current selected-source coverage"
      >
        <span>{papers.length} selected papers</span>
        <span>{bodyCount} with article-body text</span>
        <span>{report.tensions.length + gaps.length} candidate leads</span>
      </div>
      {!papers.length ? (
        <Notice>Select papers first to explore their evidence.</Notice>
      ) : (
        <>
          <p className="discovery-scope">
            Selected sources only · leads require review, not confirmed gaps or
            contradictions.
          </p>
          <section
            className="discovery-map-disclosure"
            aria-label="Evidence mind map"
          >
            <h3>Research focus</h3>
            <p className="mind-map-focus">
              {focus.question || focus.field || 'Your selected evidence'}
            </p>
            <p className="muted">
              Papers → source-supported leads → a question to test. Select a
              node to see its evidence.
            </p>
            <svg
              className="mind-map-branches"
              viewBox="0 0 900 50"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M450 0 V20 M150 50 V20 H750 V50 M450 20 V50"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            <div className="discovery-map">
              <div className="discovery-map-lane">
                <h4>
                  <FileText size={15} />
                  Selected sources
                </h4>
                {papers.map((paper, index) => (
                  <button
                    key={paper.id}
                    className={`discovery-node paper ${selectedPaper?.id === paper.id ? 'active' : ''} ${linked.has(paper.id) ? 'linked' : ''}`}
                    aria-pressed={selectedPaper?.id === paper.id}
                    onClick={() => choose({ kind: 'paper', id: paper.id })}
                  >
                    <small>
                      Paper {index + 1} · {paper.year ?? 'Year unavailable'}
                    </small>
                    <strong>{paper.title}</strong>
                    <span>
                      {paper.coverage}
                      {linked.has(paper.id) ? ' · supports selected lead' : ''}
                    </span>
                  </button>
                ))}
              </div>
              <div className="discovery-map-lane">
                <h4>Possible finding tensions</h4>
                {report.tensions.map((item) => (
                  <button
                    key={item.id}
                    className={`discovery-node tension ${tension?.id === item.id ? 'active' : ''}`}
                    onClick={() => choose({ kind: 'tension', id: item.id })}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.topic}</span>
                  </button>
                ))}
                {!report.tensions.length ? (
                  <p className="muted">None paired by this scan.</p>
                ) : null}
              </div>
              <div className="discovery-map-lane">
                <h4>Author-stated gap leads</h4>
                {gaps.map((item) => (
                  <button
                    key={item.id}
                    className={`discovery-node gap ${gap?.id === item.id ? 'active' : ''}`}
                    onClick={() => choose({ kind: 'gap', id: item.id })}
                  >
                    <small>{item.label}</small>
                    <strong>{clip(item.signalText)}</strong>
                    <span>{title(item.paperId)}</span>
                  </button>
                ))}
                {!gaps.length ? (
                  <p className="muted">
                    None identified in imported body text.
                  </p>
                ) : null}
              </div>
            </div>
            <details className="discovery-context-map">
              <summary>Reported methods and datasets</summary>
              <div className="discovery-claim-pair">
                {(['method', 'dataset'] as const).map((field) => (
                  <section key={field}>
                    <h4>{fieldLabels[field]}</h4>
                    {report.profiles
                      .filter((p) => p.fields[field])
                      .map((item) => {
                        const evidence = item.fields[field]!;
                        return (
                          <button
                            className="discovery-node context"
                            key={`${item.paperId}:${field}`}
                            onClick={() => {
                              choose(
                                { kind: 'paper', id: item.paperId },
                                false,
                              );
                              onInspect(
                                evidence.reference,
                                `Reported ${field}`,
                              );
                            }}
                          >
                            <small>{title(item.paperId)}</small>
                            <strong>{clip(evidence.quote)}</strong>
                          </button>
                        );
                      })}
                  </section>
                ))}
              </div>
            </details>
          </section>
          {lead ? (
            <section
              className="discovery-selection"
              aria-label="Selected research lead"
            >
              <span className="source-label">
                {tension
                  ? 'PAPERBRIDGE CANDIDATE · NOT A CONFIRMED CONTRADICTION'
                  : 'AUTHOR-STATED ISSUE · NOT A CONFIRMED FIELD-WIDE GAP'}
              </span>
              <h3>Question to investigate</h3>
              <p className="discovery-question">{lead.question}</p>
              <div className="discovery-actions">
                <button className="primary" onClick={() => onPlan(lead)}>
                  <FlaskConical size={15} />
                  Draft an experiment · free
                </button>
                <button
                  className="secondary"
                  onClick={() => onHypothesis(lead)}
                >
                  Develop this hypothesis
                </button>
              </div>
              <p className="panel-footnote">
                Drafting and opening the AI step are free. Only explicit AI
                generation can incur a charge.
              </p>
              <details>
                <summary>
                  Supporting evidence · {lead.sources.length} source{' '}
                  {lead.sources.length === 1 ? 'passage' : 'passages'}
                </summary>
                {tension ? (
                  <>
                    <div className="discovery-claim-pair">
                      {tension.claims.map((claim, index) => (
                        <article
                          key={`${claim.reference.paperId}:${claim.reference.passageId}`}
                        >
                          <h4>Finding {index + 1}</h4>
                          <p>{title(claim.reference.paperId)}</p>
                          {quote(claim, 'Possible finding tension')}
                        </article>
                      ))}
                    </div>
                    <details>
                      <summary>
                        Could population, dataset, or method differences explain
                        this?
                      </summary>
                      {tension.context.map((context) => (
                        <div key={context.field} className="discovery-context">
                          <h4>{fieldLabels[context.field]}</h4>
                          <div className="discovery-claim-pair">
                            {[context.left, context.right].map(
                              (evidence, index) => (
                                <div key={index}>
                                  <strong>Finding {index + 1} source</strong>
                                  {evidence ? (
                                    quote(evidence)
                                  ) : (
                                    <p className="muted">
                                      Context unknown from retrieved text.
                                    </p>
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ))}
                    </details>
                  </>
                ) : gap ? (
                  <>
                    <h4>{title(gap.paperId)}</h4>
                    <div className="discovery-quote">
                      <span className="source-label">
                        SOURCE STATES · ARTICLE BODY · {gap.section}
                      </span>
                      <blockquote>{gap.signalText}</blockquote>
                      <button
                        className="text-button"
                        onClick={() => onInspect(lead.sources[0], gap.label)}
                      >
                        Inspect complete source passage
                      </button>
                    </div>
                  </>
                ) : null}
              </details>
              <details>
                <summary>Why this is a lead</summary>
                <p>{lead.reason}</p>
                <p className="muted">
                  The question is a planning prompt. Check related work and
                  feasibility before treating it as open.
                </p>
              </details>
            </section>
          ) : null}
          {selectedPaper && profile ? (
            <section
              className="discovery-selection"
              aria-label="Selected paper details"
            >
              <h3>{selectedPaper.title}</h3>
              <p className="muted">
                {selectedPaper.year ?? 'Year unavailable'} ·{' '}
                {selectedPaper.coverage} ·{' '}
                <a href={selectedPaper.url} target="_blank" rel="noreferrer">
                  Original source
                </a>
              </p>
              <div className="discovery-profile">
                {Object.entries(fieldLabels).map(([field, label]) => {
                  const evidence =
                    profile.fields[field as keyof typeof fieldLabels];
                  return (
                    <details key={field}>
                      <summary>
                        {label}{' '}
                        <span className="muted">
                          ·{' '}
                          {evidence
                            ? 'Source statement available'
                            : 'Not identified'}
                        </span>
                      </summary>
                      {evidence ? (
                        quote(evidence, label)
                      ) : (
                        <p className="muted">
                          Not identified in retrieved text; check the original
                          paper.
                        </p>
                      )}
                    </details>
                  );
                })}
              </div>
            </section>
          ) : null}
          <details className="discovery-patterns">
            <summary>Reporting patterns & missing details</summary>
            <p className="muted">
              Reporting coverage in these passages is not field-wide evidence of
              what has never been tested.
            </p>
            {report.patterns.length ? (
              report.patterns.map((pattern) => (
                <details key={pattern.id}>
                  <summary>{pattern.label}</summary>
                  {pattern.evidence.map((evidence) => (
                    <div
                      key={`${evidence.reference.paperId}:${evidence.reference.passageId}`}
                    >
                      <strong>{title(evidence.reference.paperId)}</strong>
                      {quote(evidence)}
                    </div>
                  ))}
                  {pattern.unknownPaperIds.length ? (
                    <p className="muted">
                      Not identified for:{' '}
                      {pattern.unknownPaperIds.map(title).join('; ')}.
                    </p>
                  ) : null}
                  <p className="muted">{pattern.caution}</p>
                </details>
              ))
            ) : (
              <p className="muted">No reporting pattern established.</p>
            )}
          </details>
          <details className="discovery-coverage">
            <summary>Scan scope & limitations</summary>
            <p>{report.caution}</p>
            <ul>
              {papers.map((paper) => (
                <li key={paper.id}>
                  <strong>{paper.title}</strong> · {paper.coverage}.{' '}
                  {paper.fullText?.note ??
                    'Full article-body coverage is not established.'}
                </li>
              ))}
            </ul>
            <p className="muted">
              Extracted text can omit figures, tables and supplements. Original
              links and passage IDs remain available through evidence
              inspection.
            </p>
          </details>
        </>
      )}
    </section>
  );
}

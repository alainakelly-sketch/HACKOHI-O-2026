import { useMemo, useState } from 'react';
import { ArrowRight, FileText, GitBranch, FlaskConical } from 'lucide-react';
import type { Citation, Paper } from '../../shared/types';
import { buildDiscoveryReport } from '../../shared/discovery';
import type { DiscoveryEvidence } from '../../shared/discovery';
import { scanGapLeads } from '../../shared/gaps';
import { PriorWorkCheck } from './PriorWorkCheck';
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
  return (
    <section
      className="panel discovery-panel"
      aria-labelledby="discovery-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="discovery-title">Follow the evidence</h2>
          <p className="muted">Free discovery scan · selected papers only</p>
        </div>
        <GitBranch size={21} aria-hidden="true" />
      </div>
      <p className="discovery-intro">
        Look for a reported disagreement, inspect its context, then turn a lead
        into a question you can test. These are leads for review, not confirmed
        discoveries.
      </p>
      <div
        className="discovery-summary"
        aria-label="Current selected-source coverage"
      >
        <span>
          <strong>{papers.length}</strong> selected papers
        </span>
        <span>
          <strong>{bodyCount}</strong> with article-body text
        </span>
        <span>
          <strong>{report.tensions.length}</strong> possible finding tensions
        </span>
        <span>
          <strong>{gaps.length}</strong> displayed author-stated leads
        </span>
      </div>
      {!papers.length ? (
        <Notice>
          Select papers in the Papers tab first. The discovery view will use
          only their retrieved text. Missing sources will not be treated as
          evidence that a field has no research.
        </Notice>
      ) : (
        <>
          <div className="discovery-map-heading">
            <h3>Your evidence map</h3>
            <p id="discovery-map-note">
              Click a node to inspect it. A lead links only to the papers whose
              passages support it. An empty lane or missing connection does not
              establish a research gap.
            </p>
          </div>
          <div className="discovery-map" aria-describedby="discovery-map-note">
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
            <ArrowRight
              className="discovery-map-arrow"
              aria-hidden="true"
              size={22}
            />
            <div className="discovery-map-lane">
              <h4>Possible finding tensions</h4>
              {report.tensions.length ? (
                report.tensions.map((item) => (
                  <button
                    key={item.id}
                    className={`discovery-node tension ${tension?.id === item.id ? 'active' : ''}`}
                    aria-pressed={tension?.id === item.id}
                    onClick={() => choose({ kind: 'tension', id: item.id })}
                  >
                    <small>
                      Review required · {item.claims.length} source statements
                    </small>
                    <strong>{item.label}</strong>
                    <span>{item.topic}</span>
                  </button>
                ))
              ) : (
                <p className="discovery-map-empty">
                  No explicit opposing findings were paired by this scan. This
                  does not prove agreement.
                </p>
              )}
            </div>
            <div className="discovery-map-lane">
              <h4>Author-stated gap leads</h4>
              {gaps.length ? (
                gaps.map((item) => (
                  <button
                    key={item.id}
                    className={`discovery-node gap ${gap?.id === item.id ? 'active' : ''}`}
                    aria-pressed={gap?.id === item.id}
                    onClick={() => choose({ kind: 'gap', id: item.id })}
                  >
                    <small>{item.label}</small>
                    <strong>{item.signalText}</strong>
                    <span>{title(item.paperId)}</span>
                  </button>
                ))
              ) : (
                <p className="discovery-map-empty">
                  No explicit body-text lead was detected. Select sources with
                  readable limitations or future-work passages.
                </p>
              )}
            </div>
          </div>
          <details className="discovery-context-map">
            <summary>Explore reported method and dataset nodes</summary>
            <p>
              These nodes quote reported source details. Selecting one opens its
              paper and exact evidence. They are not inferred requirements or
              complete study descriptions.
            </p>
            <div className="discovery-claim-pair">
              {(['method', 'dataset'] as const).map((field) => (
                <section key={field}>
                  <h4>
                    {field === 'method' ? 'Methods' : 'Datasets / conditions'}
                  </h4>
                  {report.profiles
                    .filter((p) => p.fields[field])
                    .map((profile) => {
                      const item = profile.fields[field]!;
                      return (
                        <button
                          className={`discovery-node context ${linked.has(profile.paperId) ? 'linked' : ''}`}
                          key={`${profile.paperId}:${field}`}
                          onClick={() => {
                            choose(
                              { kind: 'paper', id: profile.paperId },
                              false,
                            );
                            onInspect(item.reference, `Reported ${field}`);
                          }}
                        >
                          <small>
                            {title(profile.paperId)} ·{' '}
                            {item.kind === 'full-text'
                              ? 'Article body'
                              : 'Abstract only'}
                          </small>
                          <strong>
                            {item.quote.slice(0, 180)}
                            {item.quote.length > 180 ? '…' : ''}
                          </strong>
                        </button>
                      );
                    })}
                  {!report.profiles.some((p) => p.fields[field]) ? (
                    <p className="muted">
                      No explicit {field} statement identified in these
                      retrieved passages.
                    </p>
                  ) : null}
                </section>
              ))}
            </div>
          </details>
          {lead ? (
            <p className="discovery-link-trace">
              Selected lead →{' '}
              {lead.sources.map((reference) => (
                <button
                  key={`${reference.paperId}:${reference.passageId}`}
                  className="text-button"
                  onClick={() =>
                    onInspect(reference, 'Lead-to-source connection')
                  }
                >
                  {title(reference.paperId)} · inspect supporting passage
                </button>
              ))}
            </p>
          ) : null}
          {!selectedPaper && !lead ? (
            <p className="discovery-help">
              Choose a source or lead above to open its evidence and next steps.
            </p>
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
              <dl className="discovery-profile">
                {Object.entries(fieldLabels).map(([field, label]) => {
                  const evidence =
                    profile.fields[field as keyof typeof fieldLabels];
                  return (
                    <div key={field}>
                      <dt>{label}</dt>
                      <dd>
                        {evidence ? (
                          quote(evidence, label)
                        ) : (
                          <p className="muted">
                            Not identified in the retrieved text. Check the
                            original paper; this is not proof the detail is
                            absent.
                          </p>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          ) : null}
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
              <h3>{lead.title}</h3>
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
                    <p>
                      Different settings can produce different outcomes. The
                      statements below are source reports, not a determination
                      that the studies are comparable.
                    </p>
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
              <h4>Question to investigate</h4>
              <p>{lead.question}</p>
              <p className="discovery-reason">{lead.reason}</p>
              <p className="muted">
                The question is a planning prompt, not a source claim. Check
                later work and feasibility before treating it as open.
              </p>
              <div className="discovery-actions">
                <button className="primary" onClick={() => onPlan(lead)}>
                  <FlaskConical size={15} />
                  Draft an experiment · free
                </button>
                <button
                  className="secondary"
                  onClick={() => onHypothesis(lead)}
                >
                  Use this question in AI hypotheses
                </button>
              </div>
              <p className="panel-footnote">
                Drafting is manual and free. Opening AI hypotheses does not
                generate a result; its separate generation button can incur an
                OpenAI charge.
              </p>
              <PriorWorkCheck
                key={lead.id}
                initialQuery={lead.searchQuery}
                field={focus.field}
              />
            </section>
          ) : null}
          <details className="discovery-patterns">
            <summary>
              Patterns and missing detail across these selected papers
            </summary>
            <p>
              Only retrieved statements are compared. “Not identified” describes
              this collection and extraction, not the state of an entire field.
            </p>
            {report.patterns.length ? (
              report.patterns.map((pattern) => (
                <article key={pattern.id}>
                  <h4>{pattern.label}</h4>
                  <p>{pattern.caution}</p>
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
                      Detail not identified for:{' '}
                      {pattern.unknownPaperIds.map(title).join('; ')}.
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <p>
                No cross-paper pattern was established from the retrieved
                statements.
              </p>
            )}
          </details>
          <details className="discovery-coverage">
            <summary>What was scanned and what is missing?</summary>
            <p>{report.caution}</p>
            <ul>
              {papers.map((paper) => (
                <li key={paper.id}>
                  <strong>{paper.title}</strong> · {paper.coverage} ·{' '}
                  {
                    paper.passages.filter((passage) => passage.text.trim())
                      .length
                  }{' '}
                  stored passages.{' '}
                  {paper.fullText?.note ??
                    'Full article-body coverage is not established here.'}
                </li>
              ))}
            </ul>
            <p>
              Page numbers are not invented when the source provides paragraph
              text only. Passage IDs and original links remain available in the
              evidence inspector. Figures, tables, supplements and unavailable
              text may change the interpretation.
            </p>
          </details>
        </>
      )}
    </section>
  );
}

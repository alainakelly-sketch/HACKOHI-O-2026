import { ArrowUpRight } from 'lucide-react';
import type {
  Brief,
  Citation,
  Fit,
  Hypothesis,
  Paper,
  PriorWork,
} from '../../shared/types';
import { resolveCitation } from '../../shared/evidence';
import { Busy, Notice } from './Primitives';
import './evidence-inspector.css';

export type EvidenceInspection = {
  reference: Citation;
  label: string;
  explanation?: string;
};
function SourceQuote({
  reference,
  papers,
}: {
  reference: Citation;
  papers: Paper[];
}) {
  try {
    const { paper, passage } = resolveCitation(reference, papers);
    return (
      <div className="source-quote">
        <div className="source-label">
          SOURCE STATES ·{' '}
          {passage.kind === 'full-text'
            ? passage.section || 'ARTICLE BODY'
            : 'ABSTRACT ONLY'}
        </div>
        <blockquote>{passage.text}</blockquote>
        <a
          href={
            passage.kind === 'full-text'
              ? paper.fullText?.url || paper.url
              : paper.doi || paper.url
          }
          target="_blank"
          rel="noreferrer"
        >
          Open original source <ArrowUpRight size={12} />
        </a>
        <details className="source-metadata">
          <summary>Source details</summary>
          <p>
            <strong>{paper.title}</strong>
          </p>
          <p className="muted">
            {paper.year ?? 'Publication year unavailable'} ·{' '}
            {paper.authors.length
              ? paper.authors.slice(0, 3).join(', ')
              : 'Authors unavailable'}
          </p>
          <p className="muted">
            {passage.kind === 'full-text'
              ? 'Retrieved body passage'
              : 'Abstract only'}{' '}
            · Section: {passage.section ?? 'Abstract'}.
          </p>
          <p className="muted">
            Page numbers are unavailable in this extracted text.
          </p>
          <code>{passage.id}</code>
        </details>
      </div>
    );
  } catch {
    return (
      <Notice error>
        Source text is unavailable. This reference cannot be displayed.
      </Notice>
    );
  }
}
function SourceDisclosure({
  reference,
  papers,
  index,
}: {
  reference: Citation;
  papers: Paper[];
  index: number;
}) {
  let title = 'Source unavailable';
  let coverage = '';
  try {
    const resolved = resolveCitation(reference, papers);
    title = resolved.paper.title;
    coverage =
      resolved.passage.kind === 'full-text' ? 'Article body' : 'Abstract only';
  } catch {
    /* SourceQuote presents the explicit unavailable state. */
  }
  return (
    <details className="evidence-source-disclosure">
      <summary>
        <span>
          Source {index + 1} · {title}
        </span>
        <small>{coverage}</small>
      </summary>
      <SourceQuote reference={reference} papers={papers} />
    </details>
  );
}
function TextList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="evidence-note-list">
      <h4>{title}</h4>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
export function EvidencePanel({
  hypothesis,
  papers,
  brief,
  fit,
  staleFit,
  onAssess,
  prior,
  priorBusy,
  priorError,
  onPrior,
  inspection = null,
}: {
  hypothesis: Hypothesis | null;
  papers: Paper[];
  brief: Brief;
  fit: Fit | null;
  staleFit: boolean;
  onAssess: () => void;
  prior: PriorWork | null;
  priorBusy: boolean;
  priorError: string;
  onPrior: () => void;
  inspection?: EvidenceInspection | null;
}) {
  return (
    <aside
      className="panel evidence-panel"
      id="evidence-inspector"
      aria-labelledby="evidence-title"
    >
      <h2 id="evidence-title">Evidence & limitations</h2>
      {inspection ? (
        <div className="evidence-content explicit-evidence">
          <h3 className="inspected-evidence-title">{inspection.label}</h3>
          <SourceQuote reference={inspection.reference} papers={papers} />
          {inspection.explanation ? (
            <details className="inspector-disclosure">
              <summary>How to interpret this passage</summary>
              <p>{inspection.explanation}</p>
            </details>
          ) : null}
          <p className="inspector-caution">
            A source passage supports inspection, not scientific verification or
            proof of a gap.
          </p>
        </div>
      ) : !hypothesis ? (
        <p className="inspector-empty">
          Select a finding or source to inspect its supporting evidence.
        </p>
      ) : (
        <div className="evidence-content hypothesis-evidence">
          <div className="inspector-summary">
            <span className="source-label">
              EVIDENCE SUMMARY · {hypothesis.evidence.length} PASSAGES
            </span>
            <p>
              {hypothesis.evidenceSummary.length > 260
                ? `${hypothesis.evidenceSummary.slice(0, 260).trimEnd()}…`
                : hypothesis.evidenceSummary}
            </p>
            {brief.field ? (
              <small>Selected-source scope: {brief.field}</small>
            ) : null}
          </div>
          <div className="evidence-source-list">
            {hypothesis.evidence.map((reference, index) => (
              <SourceDisclosure
                key={`${reference.paperId}:${reference.passageId}:${index}`}
                reference={reference}
                papers={papers}
                index={index}
              />
            ))}
          </div>
          <details className="inspector-disclosure">
            <summary>Reasoning & proposed approach</summary>
            <div className="inference">
              <div className="source-label">PAPERBRIDGE INFERS · UNTESTED</div>
              {hypothesis.evidenceSummary.length > 260 ? (
                <section>
                  <h4>Full evidence summary</h4>
                  <p>{hypothesis.evidenceSummary}</p>
                </section>
              ) : null}
              <section>
                <h4>Why investigate this?</h4>
                <p>{hypothesis.gapRationale}</p>
              </section>
              <section>
                <h4>Proposed approach</h4>
                <p>{hypothesis.proposedApproach}</p>
              </section>
            </div>
          </details>
          <details className="inspector-disclosure">
            <summary>Assumptions & limitations</summary>
            <TextList title="Assumptions" items={hypothesis.assumptions} />
            <TextList
              title="Potential incompatibilities"
              items={hypothesis.incompatibilities}
            />
            <TextList title="Unknowns" items={hypothesis.unknowns} />
          </details>
          <details className="inspector-disclosure resource-assessment">
            <summary>
              Resource fit{' '}
              <small>
                {staleFit ? 'Needs review' : (fit?.status ?? 'Not checked')}
              </small>
            </summary>
            <p className="muted">
              Compares cited method terms with your notes; it does not establish
              full feasibility.
            </p>
            {staleFit ? (
              <Notice>
                Resources changed. Reassess before using the previous result.
              </Notice>
            ) : null}
            <button className="secondary" onClick={onAssess}>
              {fit || staleFit ? 'Reassess resources' : 'Assess resources'}
            </button>
            {fit ? (
              <div className="fit-result">
                <strong
                  className={`fit-status ${fit.status === 'Potential mismatch' ? 'mismatch' : ''}`}
                >
                  {fit.status}
                </strong>
                {!fit.rows.length ? (
                  <p>
                    No explicit cited method requirements were identified.
                    Resource fit is unknown.
                  </p>
                ) : (
                  fit.rows.map((row, index) => (
                    <details className="fit-row" key={index}>
                      <summary>
                        {row.requirement.term} · {row.status}
                      </summary>
                      <p>{row.explanation}</p>
                      <SourceQuote
                        reference={row.requirement.evidence}
                        papers={papers}
                      />
                    </details>
                  ))
                )}
                <p className="muted">{fit.note}</p>
              </div>
            ) : null}
          </details>
          <details className="inspector-disclosure prior-work">
            <summary>
              Related prior work{' '}
              <small>
                {priorBusy
                  ? 'Searching'
                  : priorError
                    ? 'Search incomplete'
                    : prior
                      ? 'Results available'
                      : 'Not checked'}
              </small>
            </summary>
            <p className="muted">
              Search related papers before treating this proposal as new.
            </p>
            <button
              className="secondary"
              onClick={onPrior}
              disabled={priorBusy}
            >
              {priorBusy ? (
                <Busy>Checking prior work</Busy>
              ) : prior ? (
                'Repeat prior-work search'
              ) : (
                'Check related prior work'
              )}
            </button>
            {priorError ? <Notice error>{priorError}</Notice> : null}
            {prior ? (
              <>
                <p className="prior-status">{prior.status}</p>
                <details className="prior-query-disclosure">
                  <summary>Search terms used</summary>
                  <ul className="query-list">
                    {prior.searches.map((search) => (
                      <li key={search.query}>
                        <q>{search.query}</q>
                        {search.error ? (
                          <p className="error-text">{search.error}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </details>
                {prior.matches.map((match) => (
                  <article className="prior-match" key={match.paper.id}>
                    <a
                      href={match.paper.doi || match.paper.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {match.paper.title} <ArrowUpRight size={12} />
                    </a>
                    <p className="paper-meta">
                      {match.paper.year ?? 'Year unavailable'} ·{' '}
                      {match.paper.coverage}
                    </p>
                    <details>
                      <summary>Overlap & available abstract</summary>
                      <p>{match.overlap}</p>
                      {match.paper.abstract ? (
                        <p>{match.paper.abstract}</p>
                      ) : (
                        <p className="muted">No abstract available.</p>
                      )}
                    </details>
                  </article>
                ))}
              </>
            ) : null}
          </details>
          <p className="inspector-caution">
            Source-linked does not mean scientifically verified. The hypothesis
            remains untested.
          </p>
        </div>
      )}
    </aside>
  );
}

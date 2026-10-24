import { FileText, ArrowUpRight } from 'lucide-react';
import type {
  Brief,
  Citation,
  Fit,
  Hypothesis,
  Paper,
  PriorWork,
} from '../../shared/types';
import { resolveCitation } from '../../shared/evidence';
import { Busy, Empty, Notice } from './Primitives';
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
          {paper.title} <ArrowUpRight size={12} />
        </a>
        <code>{passage.id}</code>
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
function TextList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="evidence-section">
      <h3>{title}</h3>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
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
}) {
  return (
    <aside className="panel evidence-panel" aria-labelledby="evidence-title">
      <h2 id="evidence-title">Evidence & limitations</h2>
      {!hypothesis ? (
        <Empty title="Inspect a gap hypothesis" icon={<FileText size={30} />}>
          Use “Compare source text” to read papers for free. Optional AI
          connection passages, assumptions and unknowns appear here.
        </Empty>
      ) : (
        <div className="evidence-content">
          <p className="evidence-intro">
            Scope: {brief.field}. A matching passage does not prove a gap exists
            or that the interpretation is correct.
          </p>
          <div className="evidence-section">
            <h3>Supporting passages</h3>
            {hypothesis.evidence.map((ref, i) => (
              <SourceQuote
                key={`${ref.passageId}-${i}`}
                reference={ref}
                papers={papers}
              />
            ))}
          </div>
          <div className="inference">
            <div className="source-label">PAPERBRIDGE INFERS</div>
            <h3>Evidence and the proposed gap</h3>
            <h4>What the selected sources support</h4>
            <p>{hypothesis.evidenceSummary}</p>
            <h4>Why this may be worth investigating</h4>
            <p>{hypothesis.gapRationale}</p>
            <h4>Proposed approach</h4>
            <p>{hypothesis.proposedApproach}</p>
          </div>
          <div className="hypothesis-note">
            <div className="source-label">UNTESTED HYPOTHESIS</div>
            <p>{hypothesis.hypothesis}</p>
          </div>
          <TextList title="Assumptions" items={hypothesis.assumptions} />
          <TextList
            title="Potential incompatibilities"
            items={hypothesis.incompatibilities}
          />
          <TextList title="Unknowns" items={hypothesis.unknowns} />
          <section className="evidence-section resource-assessment">
            <h3>Does this fit my resources?</h3>
            <p className="muted">
              Compares cited method terms with your notes. It cannot establish
              full feasibility.
            </p>
            {staleFit ? (
              <Notice>
                Resources changed. The previous assessment is invalid. Reassess
                to see current results.
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
                    No explicit method requirements were identified in the cited
                    abstracts. Resource fit is unknown.
                  </p>
                ) : (
                  fit.rows.map((row, i) => (
                    <div className="fit-row" key={i}>
                      <strong>
                        {row.requirement.term} · {row.status}
                      </strong>
                      <p>{row.explanation}</p>
                      <SourceQuote
                        reference={row.requirement.evidence}
                        papers={papers}
                      />
                    </div>
                  ))
                )}
                <p className="muted">{fit.note}</p>
              </div>
            ) : null}
          </section>
          <section className="evidence-section prior-work">
            <h3>Check related prior work</h3>
            <p className="muted">
              Searches the proposed combination across free-paper collections.
              Retrieval is not proof of novelty or equivalence.
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
                <h4>Search terms used</h4>
                <ul className="query-list">
                  {prior.searches.map((s) => (
                    <li key={s.query}>
                      <q>{s.query}</q>
                      {s.error ? <p className="error-text">{s.error}</p> : null}
                    </li>
                  ))}
                </ul>
                <p className="muted">
                  Closest retrieved candidates in interleaved source relevance
                  order; overlap needs human review.
                </p>
                {prior.matches.map((m) => (
                  <article className="prior-match" key={m.paper.id}>
                    <a
                      href={m.paper.doi || m.paper.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {m.paper.title} <ArrowUpRight size={12} />
                    </a>
                    <div className="paper-meta">
                      {m.paper.year ?? 'Year unavailable'} · {m.paper.coverage}
                    </div>
                    <p>{m.overlap}</p>
                    {m.paper.abstract ? (
                      <details>
                        <summary>Available abstract</summary>
                        <p>{m.paper.abstract}</p>
                      </details>
                    ) : (
                      <p className="muted">No abstract available.</p>
                    )}
                  </article>
                ))}
              </>
            ) : null}
          </section>
        </div>
      )}
    </aside>
  );
}

import type { Citation, Paper } from '../../shared/types';
import type { GapFinding } from '../../shared/gap-findings';
import { Notice } from './Primitives';
import { PriorWorkCheck } from './PriorWorkCheck';
import './gap-findings.css';
export function findingOrigin(finding: GapFinding) {
  return finding.origin === 'author-stated'
    ? 'Author-stated issue'
    : finding.origin === 'saved-example'
      ? 'Saved example · manually prepared'
      : 'PaperBridge inference · AI-developed';
}
export function GapFindings({
  findings,
  papers,
  selectedId,
  onSelect,
  onInspect,
  onDevelop,
  onPlan,
  field = '',
  onInspectHypothesis,
}: {
  field?: string;
  findings: GapFinding[];
  papers: Paper[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onInspect: (citation: Citation, label: string) => void;
  onDevelop: (finding: GapFinding) => void;
  onPlan: (finding: GapFinding) => void;
  onInspectHypothesis?: (id: string) => void;
}) {
  const finding = findings.find((item) => item.id === selectedId) ?? null;
  return (
    <section className="gap-findings" aria-labelledby="gap-findings-title">
      <h2 id="gap-findings-title">Gap findings</h2>
      {!findings.length ? (
        <Notice>
          No supported candidate is available yet. Select relevant papers with
          explicit limitations, unanswered questions or future-work detail. More
          readable source text may be needed; an empty result does not mean the
          field has no gaps.
        </Notice>
      ) : (
        <>
          <div
            className="finding-choices"
            role="radiogroup"
            aria-label="Candidate gaps"
          >
            {findings.map((item) => (
              <label
                key={item.id}
                className={`finding-choice ${item.id === selectedId ? 'selected' : ''}`}
                data-finding-id={item.id}
              >
                <input
                  type="radio"
                  name="candidate-gap"
                  checked={item.id === selectedId}
                  aria-label={`Select gap finding: ${item.title}`}
                  onChange={() => onSelect(item.id)}
                />
                <span className="finding-choice-copy">
                  <span>{findingOrigin(item)}</span>
                  <strong>{item.title}</strong>
                  {!item.ready ? <small>More evidence needed</small> : null}
                </span>
              </label>
            ))}
          </div>
          {finding ? (
            <article
              className="finding-detail"
              role="region"
              aria-label="Selected gap finding"
              data-finding-id={finding.id}
            >
              <p className="finding-origin">{findingOrigin(finding)}</p>
              <h3>{finding.title}</h3>
              <dl className="finding-explanation">
                <div>
                  <dt>What the sources establish</dt>
                  <dd>{finding.known}</dd>
                </div>
                <div>
                  <dt>What remains unresolved</dt>
                  <dd>{finding.unresolved}</dd>
                </div>
                <div>
                  <dt>Why investigate this</dt>
                  <dd>{finding.rationale}</dd>
                </div>
              </dl>
              {finding.origin !== 'author-stated' ? (
                <p className="finding-question">
                  <strong>Candidate research question</strong>
                  <span>{finding.question}</span>
                </p>
              ) : null}
              {!finding.ready ? (
                <Notice>
                  Insufficient evidence to develop this candidate. Inspect the
                  source detail or select another finding.
                </Notice>
              ) : null}
              <button
                type="button"
                className="primary finding-next"
                disabled={!finding.ready}
                onClick={() =>
                  finding.origin === 'author-stated'
                    ? onDevelop(finding)
                    : onPlan(finding)
                }
              >
                {finding.origin === 'author-stated'
                  ? 'Develop this gap'
                  : 'Plan experiment'}
              </button>
              <details className="finding-evidence">
                <summary>
                  Supporting passages & sources · {finding.evidence.length}
                </summary>
                {finding.evidence.map((reference) => {
                  const paper = papers.find(
                    (item) => item.id === reference.paperId,
                  );
                  const passage = paper?.passages.find(
                    (item) => item.id === reference.passageId,
                  );
                  return paper && passage ? (
                    <article
                      key={`${reference.paperId}:${reference.passageId}`}
                      className="finding-source"
                      data-paper-id={reference.paperId}
                      data-passage-id={reference.passageId}
                    >
                      <a href={paper.url} target="_blank" rel="noreferrer">
                        {paper.title}
                      </a>
                      <p className="muted">
                        {paper.year ?? 'Year unavailable'} ·{' '}
                        {passage.kind === 'full-text'
                          ? 'Article-body passage'
                          : 'Abstract only'}{' '}
                        · {passage.section || 'Section unavailable'}
                      </p>
                      <blockquote>{passage.text}</blockquote>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => onInspect(reference, finding.title)}
                      >
                        Inspect evidence
                      </button>
                    </article>
                  ) : null;
                })}
              </details>
              <details className="finding-uncertainty">
                <summary>Uncertainty & limitations</summary>
                <ul>
                  {finding.uncertainty.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
                {finding.origin !== 'author-stated' &&
                finding.hypothesisId &&
                onInspectHypothesis ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onInspectHypothesis(finding.hypothesisId!)}
                  >
                    Inspect evidence &amp; limitations
                  </button>
                ) : null}
              </details>
              <details className="finding-prior">
                <summary>Check related work</summary>
                <PriorWorkCheck
                  key={finding.id}
                  field={field}
                  initialQuery={
                    finding.sourceLead?.searchQuery ?? finding.title
                  }
                />
              </details>
            </article>
          ) : (
            <Notice>
              Choose a finding to inspect its evidence and next step.
            </Notice>
          )}
        </>
      )}
    </section>
  );
}

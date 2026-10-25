import { useEffect, useState } from 'react';
import type { GapFinding } from '../../shared/gap-findings';
import type { GapCheckResult } from '../../shared/gap-check';
import type { Citation } from '../../shared/types';
import { resolveCitation } from '../../shared/evidence';
import { Busy, Notice } from './Primitives';
import './gap-research-check.css';

type ReviewDecision = 'continue' | 'replication' | 'extension';
const INCOMPLETE = 'Check incomplete or inconclusive';
const NO_MATCH = 'No close match found in the searches completed';
const relation = {
  all: 'May address the whole question',
  part: 'Addresses part of the question',
  unclear: 'Available evidence is inconclusive',
  different: 'Related topic, different question or outcome',
};

/** Controlled selected-gap workflow. Only explicit callbacks may search,
 * assess, approve or develop; rendering and disclosure are local and free. */
export function GapResearchCheck({
  finding,
  question,
  onQuestionChange,
  result,
  busy,
  error = '',
  stale = false,
  reviewBusy = false,
  onCheck,
  onReview,
  onDevelop,
  onPlan,
  aiAvailable,
  onInspect,
}: {
  finding: GapFinding;
  question: string;
  onQuestionChange: (value: string) => void;
  result: GapCheckResult | null;
  busy: boolean;
  error?: string;
  stale?: boolean;
  reviewBusy?: boolean;
  onCheck: () => void;
  onReview: (decision: ReviewDecision) => void;
  onDevelop: () => void;
  onPlan: () => void;
  aiAvailable: boolean;
  onInspect?: (reference: Citation) => void;
}) {
  const [decision, setDecision] = useState<ReviewDecision | ''>('');
  useEffect(() => setDecision(''), [result?.checkId, finding.id, stale]);
  const current = !!result && !stale;
  const complete =
    current &&
    (result.aiCompleted || result.assessmentNotNeeded === true) &&
    result.status !== INCOMPLETE;
  const approved = complete && result.reviewed;
  const addressesWhole =
    current && result.matches.some((match) => match.addresses === 'all');
  const candidates = result?.candidates ?? [];
  const assessedIds = new Set(
    result?.matches.map((match) => match.paperId) ?? [],
  );
  const manualCandidates = candidates.filter(
    (paper) => !assessedIds.has(paper.id),
  );
  function source(reference: Citation) {
    try {
      const { paper, passage } = resolveCitation(reference, candidates);
      return (
        <article
          className="gap-check-passage"
          key={`${reference.paperId}:${reference.passageId}`}
          data-paper-id={reference.paperId}
          data-passage-id={reference.passageId}
        >
          <a href={paper.url} target="_blank" rel="noreferrer">
            {paper.title}
          </a>
          <p className="muted">
            {passage.kind === 'full-text'
              ? 'Article-body passage'
              : passage.kind === 'abstract' ||
                  paper.coverage === 'Abstract only'
                ? 'Abstract only'
                : 'Retrieved text · scope unspecified'}{' '}
            · {passage.section || 'Section unavailable'}
          </p>
          <blockquote>{passage.text}</blockquote>
          {onInspect ? (
            <button
              type="button"
              className="text-button"
              onClick={() => onInspect(reference)}
            >
              Inspect research-check evidence
            </button>
          ) : null}
        </article>
      );
    } catch {
      return (
        <Notice key={`${reference.paperId}:${reference.passageId}`} error>
          Supporting passage is unavailable. This reference cannot establish
          overlap.
        </Notice>
      );
    }
  }
  return (
    <section
      className="gap-research-check"
      aria-labelledby="gap-research-check-title"
      data-gap-id={finding.id}
    >
      <h4 id="gap-research-check-title">
        Check existing research before developing this gap
      </h4>
      <details className="gap-check-question">
        <summary>Review or refine the gap question</summary>
        <label htmlFor="gap-check-question-input">Gap question to check</label>
        <textarea
          id="gap-check-question-input"
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          rows={3}
          maxLength={1200}
        />
        <p className="muted">
          Changing this wording or the research scope requires a new check.
          Source statements remain unchanged.
        </p>
      </details>
      {stale ? (
        <Notice>
          The gap or research scope changed. This check is stale; check existing
          research again before developing a hypothesis.
        </Notice>
      ) : null}
      {error ? (
        <Notice error>
          {error} The check is incomplete; this is not a no-match result.
        </Notice>
      ) : null}
      {!approved ? (
        <div className="gap-check-action">
          <button
            type="button"
            className={complete ? 'secondary' : 'primary'}
            onClick={onCheck}
            disabled={
              busy || reviewBusy || !finding.ready || question.trim().length < 5
            }
          >
            {busy ? (
              <Busy>Checking existing research</Busy>
            ) : (
              'Check existing research'
            )}
          </button>
          {!approved ? (
            <p className="muted">
              Searches beyond your selected papers.{' '}
              {aiAvailable
                ? 'The configured AI assesses retrieved text; this explicit check may incur an API charge.'
                : 'AI assessment is unavailable. Retrieved candidates will remain available for manual review, but the AI check cannot be completed.'}
            </p>
          ) : null}
        </div>
      ) : null}
      {result ? (
        <div
          className={`gap-check-results ${stale ? 'stale' : ''}`}
          aria-label="Existing research check results"
        >
          <p className="gap-check-status" role="status">
            {stale ? 'Previous check · needs updating' : result.status}
          </p>
          <p>{result.summary}</p>
          {result.status === NO_MATCH ? (
            <Notice>
              No close match in these searches is not proof of novelty.
              Coverage, terminology and available text are limited.
            </Notice>
          ) : null}
          {result.assessmentNotNeeded ? (
            <Notice>
              No studies were returned to assess; no AI request was made. This
              completed search does not establish novelty.
            </Notice>
          ) : !result.aiCompleted ? (
            <Notice>
              AI assessment has not been completed. The papers below are
              retrieved candidates for manual review, not AI-assessed answers to
              the gap.
            </Notice>
          ) : null}
          {addressesWhole && !stale ? (
            <p className="gap-check-overlap-warning">
              Existing research may already answer this question. Refine and
              recheck it, or deliberately choose a replication or extension
              below; do not present it as an untouched discovery.
            </p>
          ) : null}
          <div className="gap-check-matches">
            {result.matches.map((match) => {
              const paper = candidates.find(
                (item) => item.id === match.paperId,
              );
              if (!paper) return null;
              return (
                <article
                  className="gap-check-match"
                  key={match.paperId}
                  data-paper-id={match.paperId}
                >
                  <h5>
                    <a href={paper.url} target="_blank" rel="noreferrer">
                      {paper.title}
                    </a>
                  </h5>
                  <p className="muted">
                    {paper.year ?? 'Year unavailable'} · {paper.coverage}
                  </p>
                  <p className="gap-check-relation">
                    {relation[match.addresses]}
                  </p>
                  <dl>
                    <div>
                      <dt>Question investigated</dt>
                      <dd>{match.question}</dd>
                    </div>
                    <div>
                      <dt>What the available text establishes</dt>
                      <dd>{match.establishes}</dd>
                    </div>
                    <div>
                      <dt>What remains uncertain or different</dt>
                      <dd>{match.uncertainty}</dd>
                    </div>
                  </dl>
                  <details>
                    <summary>
                      Supporting passages · {match.evidence.length}
                    </summary>
                    {match.evidence.length ? (
                      match.evidence.map(source)
                    ) : (
                      <p>
                        No supporting passage was identified; a title alone
                        cannot establish that the gap is addressed.
                      </p>
                    )}
                  </details>
                </article>
              );
            })}
          </div>
          {manualCandidates.length ? (
            <details className="gap-check-manual" open={!result.aiCompleted}>
              <summary>
                {result.aiCompleted
                  ? 'Other retrieved candidates'
                  : 'Retrieved candidates for manual review'}{' '}
                · {manualCandidates.length}
              </summary>
              {manualCandidates.map((paper) => (
                <article
                  className="gap-check-match"
                  key={paper.id}
                  data-paper-id={paper.id}
                >
                  <h5>
                    <a href={paper.url} target="_blank" rel="noreferrer">
                      {paper.title}
                    </a>
                  </h5>
                  <p className="muted">
                    {paper.year ?? 'Year unavailable'} · {paper.coverage}
                  </p>
                  {paper.abstract ? (
                    <details>
                      <summary>
                        Available abstract · not a complete paper
                      </summary>
                      <p>{paper.abstract}</p>
                    </details>
                  ) : (
                    <p>
                      No abstract is available. Whether this study addresses the
                      gap remains uncertain.
                    </p>
                  )}
                </article>
              ))}
            </details>
          ) : null}
          <details className="gap-check-method">
            <summary>Queries, sources & check time</summary>
            <p>Checked: {result.checkedAt}</p>
            <ul>
              {result.searches.map((search, index) => (
                <li key={`${index}:${search.query}`}>
                  <code>{search.query}</code>
                  {search.error ? (
                    <span> — Incomplete: {search.error}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <ul>
              {result.sourceStatuses.map((source, index) => (
                <li key={`${source.source}:${index}`}>
                  {source.source}:{' '}
                  {source.status === 'ok'
                    ? 'Search completed'
                    : `Unavailable or incomplete${source.message ? ` — ${source.message}` : ''}`}
                </li>
              ))}
            </ul>
            <p>
              Only retrieved text was assessed. Search scope cannot establish
              field-wide novelty or scientific verification.
            </p>
          </details>
          {complete && !approved ? (
            <div className="gap-check-review">
              <label htmlFor="gap-check-decision">
                How will you use this check?
              </label>
              <select
                id="gap-check-decision"
                value={decision}
                onChange={(event) =>
                  setDecision(event.target.value as ReviewDecision | '')
                }
                disabled={reviewBusy || busy}
              >
                <option value="">Choose after reviewing the matches</option>
                {!addressesWhole ? (
                  <option value="continue">
                    Develop the remaining candidate question · novelty unproven
                  </option>
                ) : null}
                <option value="replication">
                  Replication of existing research · not a novel gap
                </option>
                <option value="extension">
                  Extension of existing research · specify the remaining
                  distinction
                </option>
              </select>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  if (decision) onReview(decision);
                }}
                disabled={!decision || reviewBusy || busy}
              >
                {reviewBusy ? (
                  <Busy>Saving review</Busy>
                ) : (
                  'I have reviewed this check'
                )}
              </button>
            </div>
          ) : null}
          {approved ? (
            <div className="gap-check-next">
              <p className="muted">
                Reviewed
                {result.decision === 'replication'
                  ? ' · replication, not a novel gap'
                  : result.decision === 'extension'
                    ? ' · extension of existing research'
                    : ' · candidate follow-up, novelty not established'}
                .
              </p>
              <button
                type="button"
                className="primary"
                onClick={
                  finding.origin === 'author-stated' ? onDevelop : onPlan
                }
                disabled={busy || reviewBusy}
              >
                {finding.origin === 'author-stated'
                  ? 'Develop hypothesis'
                  : 'Plan experiment'}
              </button>
              <button
                type="button"
                className="text-button"
                onClick={onCheck}
                disabled={busy || reviewBusy}
              >
                Check existing research again
              </button>
              <p className="muted">
                A new check may incur another API charge when AI assessment is
                enabled.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

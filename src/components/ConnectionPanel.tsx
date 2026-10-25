import { GitBranch, ArrowRight } from 'lucide-react';
import type { Analysis, Brief, Health, Paper } from '../../shared/types';
import { analysisReadiness } from '../../shared/analysis-readiness';
import { Busy, Notice } from './Primitives';
import './workflow-cards.css';
export function analysisLabel(origin: Analysis['origin']) {
  return origin === 'live'
    ? 'Live model analysis · untested hypotheses'
    : 'Saved example · manually prepared, not a live AI result';
}
export function ConnectionPanel({
  generationOnly = false,
  researchCheckReady = false,
  researchCheckMessage,
  onReviewCheck,
  reviewCheckAction = 'Go to research check',
  brief,
  analysis,
  activeId,
  health,
  count,
  busy,
  error,
  onAnalyze,
  onSelect,
  papers,
  onRecheck,
  readinessBusy = false,
  onPlan,
  resourcesChanged = false,
  onEditResources,
}: {
  generationOnly?: boolean;
  researchCheckReady?: boolean;
  researchCheckMessage?: string;
  onReviewCheck?: () => void;
  reviewCheckAction?: string;
  brief: Brief;
  analysis: Analysis | null;
  activeId: string | null;
  health: Health | null;
  count: number;
  papers?: Paper[];
  onRecheck?: () => void;
  readinessBusy?: boolean;
  onPlan?: (id: string) => void;
  resourcesChanged?: boolean;
  onEditResources?: () => void;
  busy: boolean;
  error: string;
  onAnalyze: () => void;
  onSelect: (id: string) => void;
}) {
  const missing = analysisReadiness(brief, count, papers, health).filter(
    (item) => !item.ready,
  );
  if (!researchCheckReady)
    missing.push({
      key: 'research-check',
      ready: false,
      message:
        researchCheckMessage ||
        'Check existing research for the selected gap and review the matches first.',
    });
  const complete = missing.length === 0;
  const resourceNotes = Object.entries(brief.resources).filter(([, value]) =>
    value.trim(),
  );
  const setup = (
    <div className="hypothesis-setup">
      {missing.length ? (
        <div className="analysis-readiness" aria-live="polite">
          <h3>What’s needed</h3>
          <ul>
            {missing.map((item) => (
              <li key={item.key}>{item.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="hypothesis-ready">
          {count} papers ready · your resource notes will guide the proposal.
        </p>
      )}
      <div className="hypothesis-generate-row">
        <button
          className="primary"
          id={generationOnly ? 'generate-hypothesis' : undefined}
          disabled={!complete || busy || readinessBusy}
          onClick={onAnalyze}
        >
          {busy ? (
            <Busy>Analyzing</Busy>
          ) : (
            <>
              <GitBranch size={15} />
              {generationOnly
                ? 'Generate hypothesis'
                : analysis
                  ? 'Analyze again'
                  : 'Develop AI gap hypotheses'}
            </>
          )}
        </button>
        {!researchCheckReady && onReviewCheck ? (
          <button type="button" className="secondary" onClick={onReviewCheck}>
            {reviewCheckAction}
          </button>
        ) : null}
        {onRecheck && (!health?.analysisAvailable || readinessBusy) ? (
          <button
            className="text-button"
            onClick={onRecheck}
            disabled={readinessBusy}
          >
            {readinessBusy ? 'Checking server…' : 'Recheck server readiness'}
          </button>
        ) : null}
      </div>
      <p className="panel-footnote">
        This button sends selected source text to OpenAI and may incur a charge.
        You can also draft an experiment from a free gap lead.
      </p>
    </div>
  );
  if (generationOnly)
    return (
      <section className="gap-ai-setup" aria-label="AI gap development">
        {analysis && resourcesChanged ? (
          <Notice>
            Resource notes changed after this analysis. Existing findings and
            edited drafts are kept; generate again only when you choose.
          </Notice>
        ) : null}
        {error ? <Notice error>{error}</Notice> : null}
        {analysis?.status === 'insufficient' ? (
          <Notice>Insufficient evidence: {analysis.summary}</Notice>
        ) : null}
        {analysis ? (
          <details>
            <summary>Analysis notes</summary>
            <p>{analysisLabel(analysis.origin)}</p>
            <p>{analysis.summary}</p>
          </details>
        ) : null}
        {setup}
      </section>
    );
  return (
    <section
      className="panel connection-panel concise-hypotheses"
      id="connections"
      aria-labelledby="connections-title"
    >
      <div className="panel-heading">
        <h2 id="connections-title">Your hypothesis</h2>
        {onEditResources ? (
          <button
            className="text-button edit-planning-resources"
            onClick={onEditResources}
          >
            Edit planning resources
          </button>
        ) : null}
      </div>
      {analysis && resourcesChanged ? (
        <Notice>
          Resource notes changed after this analysis. Review the existing
          hypotheses or explicitly generate again. Your edited drafts are kept.
        </Notice>
      ) : null}
      {error ? <Notice error>{error}</Notice> : null}
      {analysis ? (
        <>
          <p
            className={`analysis-origin ${analysis.origin === 'saved-example' ? 'example' : ''}`}
          >
            {analysisLabel(analysis.origin)}
          </p>
          {analysis.status === 'insufficient' ? (
            <>
              <Notice>
                Insufficient evidence. Select more relevant sources with
                readable text before trying again.
              </Notice>
              <p className="analysis-summary">{analysis.summary}</p>
            </>
          ) : (
            <div className="connection-cards">
              {analysis.hypotheses.map((hypothesis, index) => (
                <article
                  className={`hypothesis-result-card ${activeId === hypothesis.id ? 'selected' : ''}`}
                  key={hypothesis.id}
                >
                  <span className="hypothesis-card-label">
                    Hypothesis {index + 1}
                  </span>
                  <h3>{hypothesis.title}</h3>
                  <p className="hypothesis-claim">
                    {hypothesis.hypothesis.length > 260
                      ? `${hypothesis.hypothesis.slice(0, 260)}…`
                      : hypothesis.hypothesis}
                  </p>
                  {hypothesis.hypothesis.length > 260 ? (
                    <details className="hypothesis-full-claim">
                      <summary>Read full hypothesis</summary>
                      <p>{hypothesis.hypothesis}</p>
                    </details>
                  ) : null}
                  <div className="hypothesis-result-actions">
                    {onPlan ? (
                      <button
                        className="primary"
                        onClick={() => onPlan(hypothesis.id)}
                      >
                        Plan an experiment <ArrowRight size={14} />
                      </button>
                    ) : null}
                    <button
                      className="text-button"
                      onClick={() => onSelect(hypothesis.id)}
                      aria-pressed={activeId === hypothesis.id}
                    >
                      Inspect evidence & limitations
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {analysis.status !== 'insufficient' ? (
            <details className="hypothesis-analysis-notes">
              <summary>Analysis notes</summary>
              <p>{analysis.summary}</p>
            </details>
          ) : null}
        </>
      ) : (
        <p className="hypothesis-empty-summary">
          Turn your selected evidence into a small, testable proposal.
        </p>
      )}
      <details className="hypothesis-resource-context">
        <summary>Resources guiding the next hypothesis and experiment</summary>
        {resourceNotes.length ? (
          <dl>
            {resourceNotes.map(([key, value]) => (
              <div key={key}>
                <dt>
                  {key === 'deadline'
                    ? 'Project deadline'
                    : key === 'data'
                      ? 'Available data'
                      : key === 'equipment'
                        ? 'Available equipment'
                        : 'Available skills'}
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>
            No resource constraints entered. Add optional notes in Resources.
          </p>
        )}
        <p>
          Notes guide proposals, not paper search. Editing them does not
          regenerate a result.
        </p>
      </details>
      {analysis ? (
        <details className="hypothesis-regenerate">
          <summary>Generate a new hypothesis</summary>
          {setup}
        </details>
      ) : (
        setup
      )}
    </section>
  );
}

import { GitBranch, ArrowRight } from 'lucide-react';
import type { Analysis, Brief, Health, Paper } from '../../shared/types';
import { analysisReadiness } from '../../shared/analysis-readiness';
import { Busy, Notice } from './Primitives';
export function analysisLabel(origin: Analysis['origin']) {
  return origin === 'live'
    ? 'Live model analysis · untested hypotheses'
    : 'Saved example · manually prepared, not a live AI result';
}
export function ConnectionPanel({
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
}: {
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
  busy: boolean;
  error: string;
  onAnalyze: () => void;
  onSelect: (id: string) => void;
}) {
  const readiness = analysisReadiness(brief, count, papers, health);
  const complete = readiness.every((item) => item.ready);
  return (
    <section
      className="panel connection-panel"
      id="connections"
      aria-labelledby="connections-title"
    >
      <div className="panel-heading">
        <h2 id="connections-title">Optional AI gap hypotheses</h2>
        <button
          className="primary"
          disabled={!complete || busy || readinessBusy}
          onClick={onAnalyze}
        >
          {busy ? (
            <Busy>Analyzing</Busy>
          ) : (
            <>
              <GitBranch size={15} />
              {analysis ? 'Analyze again' : 'Develop AI gap hypotheses'}
            </>
          )}
        </button>
      </div>
      <details
        className="hypothesis-resource-context"
        open={Object.values(brief.resources).some((value) => value.trim())}
      >
        <summary>Resources guiding the next hypothesis and experiment</summary>
        <p>
          Your notes guide the proposed approach, data choices, equipment,
          skills and scope. They do not hide papers. Unknown feasibility stays
          unknown.
        </p>
        <dl>
          {Object.entries(brief.resources)
            .filter(([, value]) => value.trim())
            .map(([key, value]) => (
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
        {!Object.values(brief.resources).some((value) => value.trim()) ? (
          <p>
            No resource constraints entered. Add them in Focus if you want to
            tailor a proposal.
          </p>
        ) : null}
        <p>
          Editing notes does not regenerate a result or make a paid request. Use
          the generation button explicitly when you want a new AI proposal.
        </p>
      </details>
      {analysis && resourcesChanged ? (
        <Notice>
          Resource notes changed after this analysis. These existing hypotheses
          have not been regenerated. Review their fit or explicitly generate
          again; your edited experiment drafts are kept.
        </Notice>
      ) : null}
      <div className="analysis-readiness" aria-live="polite">
        <h3>Before generating</h3>
        <ul>
          {readiness.map((item) => (
            <li key={item.key}>
              {item.ready ? '✓' : '○'} {item.message}
            </li>
          ))}
        </ul>
        {onRecheck ? (
          <button
            className="secondary"
            onClick={onRecheck}
            disabled={readinessBusy}
          >
            {readinessBusy ? 'Checking server…' : 'Recheck server readiness'}
          </button>
        ) : null}
        <p className="panel-footnote">
          Search, comparison, gap scanning and user-created experiment drafts
          work without paid AI. Rechecking readiness does not make a model
          request.
        </p>
      </div>
      {!analysis ? (
        <div className="ai-gap-empty">
          <h3>{brief.field || 'Your field of interest'}</h3>
          <p>
            Free author-stated gap leads are available in the Gap leads tab.
            Optional AI can help develop a testable hypothesis from the selected
            evidence.
          </p>
        </div>
      ) : (
        <>
          <p
            className={`analysis-origin ${analysis.origin === 'saved-example' ? 'example' : ''}`}
          >
            {analysisLabel(analysis.origin)}
          </p>
          <p className="analysis-summary">{analysis.summary}</p>
          {analysis.status === 'insufficient' ? (
            <Notice>
              Insufficient evidence. No gap hypothesis or experiment was
              generated. Try selecting more relevant papers with readable source
              text.
            </Notice>
          ) : (
            <div className="connection-cards">
              {analysis.hypotheses.map((h, i) => (
                <div key={h.id}>
                  <button
                    className={`connection-card ${activeId === h.id ? 'active' : ''}`}
                    onClick={() => onSelect(h.id)}
                    aria-pressed={activeId === h.id}
                  >
                    <span className="connection-number">0{i + 1}</span>
                    <div>
                      <strong>{h.title}</strong>
                      <p>{h.hypothesis}</p>
                      <span>
                        Inspect evidence & limitations <ArrowRight size={13} />
                      </span>
                    </div>
                  </button>
                  {onPlan ? (
                    <button className="secondary" onClick={() => onPlan(h.id)}>
                      Plan an experiment
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {error ? <Notice error>{error}</Notice> : null}
      {!health ? (
        <Notice>Checking server configuration…</Notice>
      ) : !health.analysisAvailable ? (
        <Notice>
          <strong>AI analysis is optional.</strong> Read source text and scan
          gap leads for free. {health.reason} Live requests never fall back to
          saved examples.
        </Notice>
      ) : (
        <p className="panel-footnote">{health.reason}</p>
      )}
      {!complete ? (
        <p className="panel-footnote">
          To analyze: enter a question and one field, then select 4–6 papers.
        </p>
      ) : null}
    </section>
  );
}

import { GitBranch, ArrowRight } from 'lucide-react';
import type { Analysis, Brief, Health } from '../../shared/types';
import { BridgeMark, Busy, Notice } from './Primitives';
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
}: {
  brief: Brief;
  analysis: Analysis | null;
  activeId: string | null;
  health: Health | null;
  count: number;
  busy: boolean;
  error: string;
  onAnalyze: () => void;
  onSelect: (id: string) => void;
}) {
  const complete =
    brief.question.trim().length >= 5 &&
    brief.fieldA.trim().length >= 2 &&
    brief.fieldB.trim().length >= 2 &&
    count >= 4 &&
    count <= 6;
  return (
    <section
      className="panel connection-panel"
      id="connections"
      aria-labelledby="connections-title"
    >
      <div className="panel-heading">
        <h2 id="connections-title">Optional AI connections</h2>
        <button
          className="primary"
          disabled={!complete || !health?.analysisAvailable || busy}
          onClick={onAnalyze}
        >
          {busy ? (
            <Busy>Analyzing</Busy>
          ) : (
            <>
              <GitBranch size={15} />
              {analysis ? 'Analyze again' : 'Generate AI connections'}
            </>
          )}
        </button>
      </div>
      {!analysis ? (
        <div className="bridge-view">
          <div className="field-node">
            <strong>Field A</strong>
            <span>{brief.fieldA || 'Not specified'}</span>
          </div>
          <div className="bridge-line">
            <BridgeMark small />
            <span>Potential connection</span>
          </div>
          <div className="field-node">
            <strong>Field B</strong>
            <span>{brief.fieldB || 'Not specified'}</span>
          </div>
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
              Insufficient evidence. No connection or experiment was generated.
              Try selecting more relevant papers with readable source text.
            </Notice>
          ) : (
            <div className="connection-cards">
              {analysis.hypotheses.map((h, i) => (
                <button
                  key={h.id}
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
          <strong>AI connections are optional.</strong> Compare source text
          above for free. {health.reason} Live requests never fall back to saved
          examples.
        </Notice>
      ) : (
        <p className="panel-footnote">{health.reason}</p>
      )}
      {!complete ? (
        <p className="panel-footnote">
          To analyze: enter a question and two fields, then select 4–6 papers.
        </p>
      ) : null}
    </section>
  );
}

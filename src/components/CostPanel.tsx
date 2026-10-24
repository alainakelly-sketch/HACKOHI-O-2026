import './workflow-cards.css';
import { formatEstimatedUsd } from '../../shared/analysis-cost';
import type { AnalysisCost } from '../../shared/analysis-cost';
export type UsageEntry = {
  id: string;
  time: string;
  status: 'running' | 'complete' | 'error' | 'interrupted';
  cost: AnalysisCost | null;
};
export function CostPanel({ entries }: { entries: UsageEntry[] }) {
  const known = entries.filter(
    (entry) => typeof entry.cost?.estimatedUsd === 'number',
  );
  const total = known.reduce(
    (sum, entry) => sum + entry.cost!.estimatedUsd!,
    0,
  );
  const unknown = entries.filter(
    (entry) => entry.status !== 'running' && entry.cost?.estimatedUsd == null,
  ).length;
  const latest = entries.at(-1);
  const running = entries.some((entry) => entry.status === 'running');
  return (
    <section
      className="panel cost-panel compact-cost-panel"
      aria-labelledby="cost-title"
    >
      <div className="panel-heading">
        <h2 id="cost-title">OpenAI usage & estimated cost</h2>
        <a
          href="https://platform.openai.com/usage"
          target="_blank"
          rel="noreferrer"
        >
          Check actual OpenAI charges ↗
        </a>
      </div>
      <p className="cost-total" role="status">
        Estimated cost recorded this session:{' '}
        <strong>{formatEstimatedUsd(total)} USD</strong>
        {unknown ? ` + ${unknown} run(s) with unknown cost` : ''}
        {running ? ' · analysis in progress' : ''}
      </p>
      {latest && latest.status !== 'running' ? (
        <p className="cost-latest">
          Last AI run:{' '}
          <strong>
            {latest.cost?.estimatedUsd == null
              ? 'Cost unknown — check OpenAI Usage'
              : `${formatEstimatedUsd(latest.cost.estimatedUsd)} USD estimated`}
          </strong>
        </p>
      ) : null}
      {!entries.length ? (
        <p className="cost-latest">
          No AI runs recorded. Search and manual planning make no OpenAI
          requests.
        </p>
      ) : (
        <details>
          <summary>Cost of each AI run ({entries.length})</summary>
          <ol className="cost-runs">
            {entries.map((entry, index) => (
              <li key={entry.id}>
                <div>
                  <strong>
                    Run {index + 1} ·{' '}
                    {entry.status === 'complete'
                      ? 'Response received'
                      : entry.status === 'running'
                        ? 'Running'
                        : entry.status === 'interrupted'
                          ? 'Interrupted'
                          : 'Failed'}
                  </strong>
                  <span>{new Date(entry.time).toLocaleTimeString()}</span>
                </div>
                <p>
                  {entry.status === 'running'
                    ? 'Waiting for usage; cost is not known yet.'
                    : entry.cost?.estimatedUsd == null
                      ? 'Cost unknown — this does not mean the request was free. Check OpenAI Usage.'
                      : `Estimated ${formatEstimatedUsd(entry.cost.estimatedUsd)} USD`}
                </p>
                {entry.cost ? (
                  <>
                    <p className="muted">
                      {entry.cost.model ??
                        (entry.cost.estimatedUsd === 0 &&
                        entry.cost.inputTokens === 0
                          ? 'No model called'
                          : 'Model unavailable')}{' '}
                      · Input: {entry.cost.inputTokens ?? 'unknown'} tokens ·
                      Cached input: {entry.cost.cachedInputTokens ?? 'unknown'}{' '}
                      · Output: {entry.cost.outputTokens ?? 'unknown'} tokens
                    </p>
                    <p className="muted">{entry.cost.note}</p>
                    {entry.cost.pricingSource ? (
                      <a
                        href={entry.cost.pricingSource}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Model pricing reference ↗
                      </a>
                    ) : null}
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        </details>
      )}
      <details className="cost-explanation">
        <summary>How estimates work</summary>
        <p>
          Search, resource notes, comparison, free gap scans and manual plans:
          $0 in OpenAI API charges. Only generating AI hypotheses calls OpenAI.
        </p>
        <p className="muted">
          Based on returned token usage and reference model prices, not your
          bill. Reference rates have not been live-verified here. This session
          history clears on reload and excludes other apps and unseen requests.
        </p>
        <p>
          Each generation can incur a charge. Failed or interrupted requests may
          still be billed; unknown costs are not zero.
        </p>
      </details>
    </section>
  );
}

import { FlaskConical, Download } from 'lucide-react';
import type { Hypothesis } from '../../shared/types';
import { Empty, Notice } from './Primitives';
const labels = {
  question: 'Research question',
  data: 'Required data',
  method: 'Proposed method',
  baseline: 'Baseline comparison',
  measure: 'Evaluation measure',
  against: 'What would count against it?',
};
export function ExperimentPanel({
  hypothesis,
  resourcesChanged,
  onExport,
}: {
  hypothesis: Hypothesis | null;
  resourcesChanged: boolean;
  onExport: () => void;
}) {
  return (
    <section
      className="panel experiment-panel"
      id="experiment"
      aria-labelledby="experiment-title"
    >
      <div className="panel-heading">
        <h2 id="experiment-title">First experiment</h2>
        {hypothesis ? (
          <button className="text-button" onClick={onExport}>
            <Download size={14} />
            Export workspace
          </button>
        ) : null}
      </div>
      {!hypothesis ? (
        <Empty title="No experiment plan yet" icon={<FlaskConical size={24} />}>
          Inspect a proposed gap hypothesis to develop a small, testable first
          step.
        </Empty>
      ) : (
        <>
          <p className="panel-footnote">
            Proposed experiment · not an established protocol. Review
            feasibility, ethics, and safety with your team.
          </p>
          {resourcesChanged ? (
            <Notice>
              Your resources changed after this plan was generated. Reassess
              resource fit and review the plan before using it.
            </Notice>
          ) : null}
          <dl className="experiment-grid">
            {Object.entries(labels).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{hypothesis.experiment[key as keyof typeof labels]}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}

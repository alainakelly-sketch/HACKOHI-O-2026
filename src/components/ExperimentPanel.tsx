import { useState } from 'react';
import { FlaskConical, Download, Copy } from 'lucide-react';
import type { Citation } from '../../shared/types';
import type {
  ExperimentDraft,
  ExperimentFields,
} from '../../shared/experiment-plan';
import { exportPlan } from '../../shared/experiment-plan';
import { Empty, Notice } from './Primitives';
const fields: { key: keyof ExperimentFields; label: string; hint: string }[] = [
  {
    key: 'question',
    label: 'Research question / hypothesis',
    hint: 'What specific claim or question will you test?',
  },
  {
    key: 'data',
    label: 'Required data',
    hint: 'Identify a dataset, population, or measurements. Leave unknown details blank.',
  },
  {
    key: 'method',
    label: 'Proposed method',
    hint: 'Describe a small first test. Confirm feasibility before writing a protocol.',
  },
  {
    key: 'independent',
    label: 'Independent variables',
    hint: 'What will you change or compare? Specify levels only when you can justify them; leave unknown details blank.',
  },
  {
    key: 'dependent',
    label: 'Dependent variables',
    hint: 'What outcome will you measure? Connect it to the research question and evaluation measure.',
  },
  {
    key: 'confounders',
    label: 'Possible confounding factors',
    hint: 'What else could explain the result? Note controls or checks that still need to be decided.',
  },
  {
    key: 'supports',
    label: 'What result would support the hypothesis',
    hint: 'Describe the direction of evidence you would expect. Supporting a hypothesis would not prove it.',
  },
  {
    key: 'baseline',
    label: 'Baseline or comparison',
    hint: 'What existing approach, control, or reference will you compare against?',
  },
  {
    key: 'measure',
    label: 'Evaluation measure',
    hint: 'What measurable outcome would distinguish the alternatives?',
  },
  {
    key: 'against',
    label: 'What result would count against the hypothesis',
    hint: 'Describe a result that would weaken the claim.',
  },
  {
    key: 'constraints',
    label: 'Resource constraints and unresolved questions',
    hint: 'List unknowns, unavailable resources, and questions for your team.',
  },
];
export function ExperimentPanel({
  plan,
  needsReview,
  onChange,
  onStartManual,
  onInspect,
  onReview,
}: {
  plan: ExperimentDraft | null;
  needsReview: boolean;
  onChange: (plan: ExperimentDraft) => void;
  onStartManual: () => void;
  onInspect?: (citation: Citation) => void;
  onReview?: () => void;
}) {
  const [copyMessage, setCopyMessage] = useState('');
  function download() {
    if (!plan) return;
    const url = URL.createObjectURL(
      new Blob([exportPlan(plan)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'paperbridge-experiment-plan.json';
    link.click();
    URL.revokeObjectURL(url);
  }
  async function copy() {
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(exportPlan(plan));
      setCopyMessage('Current edited plan copied.');
    } catch {
      setCopyMessage(
        'Copy is unavailable in this browser. Use Export current plan to save the same edited content.',
      );
    }
  }
  return (
    <section
      className="panel experiment-panel"
      id="experiment"
      aria-labelledby="experiment-title"
    >
      <div className="panel-heading">
        <h2 id="experiment-title">First experiment</h2>
        {plan ? (
          <div className="button-row">
            <button className="text-button" onClick={copy}>
              <Copy size={14} />
              Copy current plan
            </button>
            <button className="text-button" onClick={download}>
              <Download size={14} />
              Export current plan
            </button>
          </div>
        ) : null}
      </div>
      {!plan ? (
        <>
          <Empty
            title="No experiment plan yet"
            icon={<FlaskConical size={24} />}
          >
            Choose “Plan an experiment” on a hypothesis or gap lead, or start
            your own draft below. No paid AI is needed for a manual plan.
          </Empty>
          <button className="primary" onClick={onStartManual}>
            Start my own experiment draft
          </button>
        </>
      ) : (
        <>
          <p className="panel-footnote">
            <strong>
              {plan.origin === 'user-created'
                ? 'User-created draft · not AI-generated'
                : plan.origin === 'saved-example'
                  ? 'Saved example · manually prepared'
                  : 'AI-generated proposal · editable'}
            </strong>
            . This is a proposal, not an established protocol. Blank fields need
            your input; no method is inferred for manual drafts. Variable
            definitions, possible confounders, and supporting-result criteria
            are left for you to specify when they have not been generated.
          </p>
          {needsReview ? (
            <Notice>
              Your research focus, selected source text, or resources changed.
              Your edits have been kept. Review this plan and reassess resource
              fit before using it.
              {onReview ? (
                <button className="text-button" onClick={onReview}>
                  I have reviewed this plan against the current workspace
                </button>
              ) : null}
            </Notice>
          ) : null}
          {plan.id !== 'manual' ? (
            <button className="secondary" onClick={onStartManual}>
              Open my own experiment draft
            </button>
          ) : null}
          <div className="experiment-grid">
            {fields.map(({ key, label, hint }) => (
              <div key={key} className="resource-field">
                <label htmlFor={`plan-${key}`}>{label}</label>
                <textarea
                  id={`plan-${key}`}
                  aria-describedby={`plan-${key}-hint`}
                  rows={key === 'method' ? 5 : 3}
                  value={plan.fields[key]}
                  placeholder={hint}
                  onChange={(event) => {
                    setCopyMessage('');
                    onChange({
                      ...plan,
                      fields: { ...plan.fields, [key]: event.target.value },
                    });
                  }}
                />
                <small id={`plan-${key}-hint`}>{hint}</small>
              </div>
            ))}
          </div>
          <details>
            <summary>
              Research focus, resources, and source references carried into this
              draft
            </summary>
            <p>
              <strong>Field:</strong> {plan.focus.field || 'Not provided'}
              <br />
              <strong>Research focus:</strong>{' '}
              {plan.focus.question || 'Not provided'}
            </p>
            <dl>
              {Object.entries(plan.resources).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value || 'Not provided'}</dd>
                </div>
              ))}
            </dl>
            <p>
              These are the resources recorded when the draft was created;
              compare them with your current focus before planning.
            </p>
            {plan.sources.length ? (
              <ul>
                {plan.sources.map((citation) => (
                  <li key={`${citation.paperId}:${citation.passageId}`}>
                    <button
                      className="text-button"
                      onClick={() => onInspect?.(citation)}
                    >
                      Inspect source passage {citation.passageId}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No supporting passage is attached to this user-created draft.
              </p>
            )}
            <ul>
              {plan.sourcePapers.map((paper) => (
                <li key={paper.id}>
                  <a href={paper.url} target="_blank" rel="noreferrer">
                    {paper.title}
                  </a>
                </li>
              ))}
            </ul>
          </details>
          {copyMessage ? <p role="status">{copyMessage}</p> : null}
        </>
      )}
    </section>
  );
}

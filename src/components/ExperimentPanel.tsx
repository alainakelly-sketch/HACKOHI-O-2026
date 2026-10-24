import { useState } from 'react';
import { FlaskConical, Download, Copy } from 'lucide-react';
import type { Citation, Resources } from '../../shared/types';
import type {
  ExperimentDraft,
  ExperimentFields,
} from '../../shared/experiment-plan';
import {
  exportPlan,
  resourcePlanningNotes,
} from '../../shared/experiment-plan';
import { Empty, Notice } from './Primitives';
import './experiment-editor.css';
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
  currentResources,
}: {
  plan: ExperimentDraft | null;
  needsReview: boolean;
  onChange: (plan: ExperimentDraft) => void;
  onStartManual: () => void;
  onInspect?: (citation: Citation) => void;
  onReview?: () => void;
  currentResources?: Resources;
}) {
  const [copyMessage, setCopyMessage] = useState('');
  const planningResources = currentResources ?? plan?.resources;
  const resourceEntries = Object.entries(planningResources ?? {}).filter(
    ([, value]) => value.trim(),
  );
  const resourceLabels: Record<string, string> = {
    data: 'Available data',
    equipment: 'Available equipment',
    skills: 'Available skills',
    deadline: 'Project deadline',
  };
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
  function renderField(key: keyof ExperimentFields) {
    if (!plan) return null;
    const field = fields.find((item) => item.key === key)!;
    return (
      <div key={key} className={`plan-field plan-field-${key}`}>
        <label htmlFor={`plan-${key}`}>{field.label}</label>
        <textarea
          id={`plan-${key}`}
          aria-describedby={`plan-${key}-hint`}
          rows={key === 'method' ? 4 : key === 'question' ? 2 : 3}
          value={plan.fields[key]}
          placeholder={field.hint}
          onChange={(event) => {
            setCopyMessage('');
            onChange({
              ...plan,
              fields: { ...plan.fields, [key]: event.target.value },
            });
          }}
        />
        <span className="sr-only" id={`plan-${key}-hint`}>
          {field.hint}
        </span>
      </div>
    );
  }
  const origin =
    plan?.origin === 'user-created'
      ? 'User-created draft · not AI-generated'
      : plan?.origin === 'saved-example'
        ? 'Saved example · manually prepared'
        : 'AI-generated proposal · editable';
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
        <div className="experiment-start">
          <Empty
            title="No experiment plan yet"
            icon={<FlaskConical size={24} />}
          >
            Choose a hypothesis or start a free draft.
          </Empty>
          <button className="primary" onClick={onStartManual}>
            Start my own experiment draft
          </button>
        </div>
      ) : (
        <>
          <p className="plan-origin">
            <strong>{origin}</strong>
            <span>Untested proposal</span>
          </p>
          {needsReview ? (
            <Notice>
              Your research focus, selected source text, or resources changed.
              Your edits have been kept. Review this plan before using it.
              {onReview ? (
                <button className="text-button" onClick={onReview}>
                  I have reviewed this plan against the current workspace
                </button>
              ) : null}
            </Notice>
          ) : null}
          <div className="plan-essential-fields">
            {renderField('question')}
            {renderField('method')}
            {renderField('measure')}
          </div>
          <div className="plan-detail-groups">
            <details className="plan-disclosure">
              <summary>
                Design details{' '}
                <span>Data, baseline, variables & confounders</span>
              </summary>
              <div className="plan-secondary-fields">
                {(
                  [
                    'data',
                    'baseline',
                    'independent',
                    'dependent',
                    'confounders',
                  ] as const
                ).map(renderField)}
              </div>
            </details>
            <details className="plan-disclosure">
              <summary>
                Success & failure criteria{' '}
                <span>What would support or weaken the hypothesis?</span>
              </summary>
              <div className="plan-secondary-fields">
                {renderField('supports')}
                {renderField('against')}
              </div>
            </details>
            <details className="plan-disclosure">
              <summary>Constraints & open questions</summary>
              <div className="plan-secondary-fields">
                {renderField('constraints')}
              </div>
            </details>
          </div>
        </>
      )}
      <details className="planning-resource-context plan-disclosure">
        <summary>
          Planning resources{' '}
          <span>
            {resourceEntries.length
              ? `${resourceEntries.length} notes`
              : 'Optional'}
          </span>
        </summary>
        <div className="plan-disclosure-content">
          <p className="panel-footnote">
            Your stated resources guide the proposal; they are not source
            evidence.
          </p>
          {resourceEntries.length ? (
            <dl>
              {resourceEntries.map(([key, value]) => (
                <div key={key}>
                  <dt>{resourceLabels[key] ?? key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="panel-footnote">
              No resource limits provided. Add optional notes in Resources to
              tailor the plan.
            </p>
          )}
          {plan && needsReview ? (
            <p className="panel-footnote">
              These current notes may differ from the creation-time snapshot.
              Updating them does not regenerate the plan.
            </p>
          ) : null}
          {plan &&
          resourceEntries.length > 0 &&
          !plan.fields.constraints.includes(
            resourcePlanningNotes(planningResources!),
          ) ? (
            <button
              className="secondary"
              onClick={() =>
                onChange({
                  ...plan,
                  fields: {
                    ...plan.fields,
                    constraints: [
                      plan.fields.constraints,
                      resourcePlanningNotes(planningResources!),
                    ]
                      .filter(Boolean)
                      .join('\n\n'),
                  },
                })
              }
            >
              Add current resource notes to this plan · free
            </button>
          ) : null}
        </div>
      </details>
      {plan ? (
        <>
          <details className="plan-disclosure plan-source-context">
            <summary>
              Sources & draft context{' '}
              <span>{plan.sources.length} supporting passages</span>
            </summary>
            <div className="plan-disclosure-content">
              <p>
                <strong>{plan.focus.field || 'Field not provided'}</strong>
                <br />
                {plan.focus.question || 'Research focus not provided'}
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
                <p>No supporting passage is attached to this draft.</p>
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
              <details className="plan-snapshot">
                <summary>
                  Resources recorded when this draft was created
                </summary>
                <dl>
                  {Object.entries(plan.resources).map(([key, value]) => (
                    <div key={key}>
                      <dt>{resourceLabels[key] ?? key}</dt>
                      <dd>{value || 'Not provided'}</dd>
                    </div>
                  ))}
                </dl>
              </details>
              <p className="panel-footnote">
                Blank fields need your input. This draft is not an established
                protocol or a feasibility assessment.
              </p>
            </div>
          </details>
          {plan.id !== 'manual' ? (
            <button
              className="text-button start-another-draft"
              onClick={onStartManual}
            >
              Open my own experiment draft
            </button>
          ) : null}
          {copyMessage ? <p role="status">{copyMessage}</p> : null}
        </>
      ) : null}
    </section>
  );
}

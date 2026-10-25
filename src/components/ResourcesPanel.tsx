import type { Resources } from '../../shared/types';
const fields: {
  key: keyof Resources;
  label: string;
  hint: string;
  placeholder: string;
}[] = [
  {
    key: 'data',
    label: 'Available data',
    hint: 'What can you access?',
    placeholder: 'Public datasets, existing measurements…',
  },
  {
    key: 'equipment',
    label: 'Available equipment',
    hint: 'Include anything you cannot use.',
    placeholder: 'Laptop only; no GPU or lab access…',
  },
  {
    key: 'skills',
    label: 'Available skills',
    hint: 'What can you and your team do?',
    placeholder: 'Python, statistics, beginner microscopy…',
  },
  {
    key: 'deadline',
    label: 'Project deadline',
    hint: 'How much time do you have?',
    placeholder: 'One day, two weeks…',
  },
];
export function ResourcesPanel({
  resources,
  onChange,
  onContinue,
  embedded = false,
}: {
  resources: Resources;
  onChange: (key: keyof Resources, value: string) => void;
  onContinue: () => void;
  embedded?: boolean;
}) {
  const filled = Object.values(resources).some((value) => value.trim());
  return (
    <section
      className="panel resources-panel"
      aria-labelledby="resources-title"
    >
      <div className="panel-heading">
        <h2 id="resources-title">Resources for your hypothesis</h2>
        <span className="optional-label">Optional</span>
      </div>
      <p className="resources-intro">
        Tell PaperBridge what a realistic first experiment looks like for you.
        These notes guide new hypotheses and plans; they do not filter papers.
      </p>
      <div className="resource-input-grid">
        {fields.map((field) => (
          <label
            className="resource-input"
            key={field.key}
            htmlFor={`resource-${field.key}`}
          >
            <span>{field.label}</span>
            <small id={`resource-${field.key}-hint`}>{field.hint}</small>
            <textarea
              id={`resource-${field.key}`}
              aria-label={field.label}
              aria-describedby={`resource-${field.key}-hint`}
              rows={2}
              maxLength={1200}
              placeholder={field.placeholder}
              value={resources[field.key]}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="resources-next">
        <p>
          No AI request is made when you edit these notes. Existing drafts stay
          unchanged.
        </p>
        <button className="primary" onClick={onContinue}>
          {embedded
            ? 'Use these resource notes'
            : filled
              ? 'Continue to hypotheses'
              : 'Skip for now'}
        </button>
      </div>
    </section>
  );
}

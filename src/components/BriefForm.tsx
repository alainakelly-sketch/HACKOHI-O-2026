import type { Brief, Resources } from '../../shared/types';
const fields: { key: keyof Resources; label: string; placeholder: string }[] = [
  {
    key: 'data',
    label: 'Available data',
    placeholder: 'Public datasets, measurements…',
  },
  {
    key: 'equipment',
    label: 'Available equipment',
    placeholder: 'Laptop, GPU, lab instruments…',
  },
  {
    key: 'skills',
    label: 'Available skills',
    placeholder: 'Python, microscopy, statistics…',
  },
  {
    key: 'deadline',
    label: 'Project deadline',
    placeholder: 'One day, two weeks…',
  },
];
export function BriefForm({
  brief,
  onCore,
  onResources,
}: {
  brief: Brief;
  onCore: (key: 'question' | 'fieldA' | 'fieldB', value: string) => void;
  onResources: (key: keyof Resources, value: string) => void;
}) {
  return (
    <section
      className="panel brief-panel"
      id="question"
      aria-labelledby="question-title"
    >
      <h2 id="question-title">Research question</h2>
      <label className="sr-only" htmlFor="question-input">
        Research question
      </label>
      <textarea
        id="question-input"
        value={brief.question}
        onChange={(e) => onCore('question', e.target.value)}
        maxLength={1200}
        rows={4}
        placeholder="What question would you like to explore?"
      />
      <div className="char-count">{brief.question.length} / 1200</div>
      <label htmlFor="field-a">Field A</label>
      <input
        id="field-a"
        value={brief.fieldA}
        maxLength={100}
        onChange={(e) => onCore('fieldA', e.target.value)}
        placeholder="e.g. Network science"
      />
      <label htmlFor="field-b">Field B</label>
      <input
        id="field-b"
        value={brief.fieldB}
        maxLength={100}
        onChange={(e) => onCore('fieldB', e.target.value)}
        placeholder="e.g. Ecology"
      />
      <details open className="resources">
        <summary>
          Resources <span>Optional</span>
        </summary>
        <p className="muted">
          Ground the idea in what you have. Include limitations, too.
        </p>
        {fields.map((f) => (
          <div key={f.key} className="resource-field">
            <label htmlFor={f.key}>{f.label}</label>
            <textarea
              id={f.key}
              rows={1}
              maxLength={1200}
              placeholder={f.placeholder}
              value={brief.resources[f.key]}
              onChange={(e) => onResources(f.key, e.target.value)}
            />
          </div>
        ))}
      </details>
    </section>
  );
}

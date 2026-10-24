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
  onFindPapers,
  searching,
}: {
  brief: Brief;
  onCore: (key: 'question' | 'field', value: string) => void;
  onResources: (key: keyof Resources, value: string) => void;
  onFindPapers: () => void;
  searching: boolean;
}) {
  return (
    <section
      className="panel brief-panel"
      id="question"
      aria-labelledby="question-title"
    >
      <h2 id="question-title">Research focus</h2>
      <label className="sr-only" htmlFor="question-input">
        Research question
      </label>
      <textarea
        id="question-input"
        value={brief.question}
        onChange={(e) => onCore('question', e.target.value)}
        maxLength={1200}
        rows={4}
        placeholder="What interests you within this field? What is uncertain or worth investigating?"
      />
      <div className="char-count">{brief.question.length} / 1200</div>
      <label htmlFor="research-field">Your field of interest</label>
      <input
        id="research-field"
        value={brief.field}
        maxLength={100}
        onChange={(e) => onCore('field', e.target.value)}
        placeholder="e.g. Neuroscience, ecology, education"
      />
      <p className="focus-help">
        Your field and question suggest editable search terms and help order the
        gap leads. You do not need a second field.
      </p>
      <button
        className="primary focus-search"
        onClick={onFindPapers}
        disabled={searching || brief.field.trim().length < 2}
      >
        {searching ? 'Finding papers…' : 'Find papers for this focus'}
      </button>
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

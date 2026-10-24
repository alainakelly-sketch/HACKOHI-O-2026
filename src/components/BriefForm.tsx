import { useState } from 'react';
import {
  buildFocusQuestion,
  emptyFocusGuide,
  focusExamples,
} from '../../shared/focus-guide';
import type { FocusGuide, FocusTemplate } from '../../shared/focus-guide';
import './focus-guide.css';
import type { Brief } from '../../shared/types';
export function BriefForm({
  brief,
  onCore,
  onFindPapers,
  searching,
}: {
  brief: Brief;
  onCore: (key: 'question' | 'field', value: string) => void;
  onFindPapers: () => void;
  searching: boolean;
}) {
  const [guide, setGuide] = useState<FocusGuide>(() => ({
    ...emptyFocusGuide,
  }));
  const [guideApplied, setGuideApplied] = useState(false);
  const guidedQuestion = buildFocusQuestion(guide);
  function updateGuide(key: keyof FocusGuide, value: string) {
    setGuide((current) => ({ ...current, [key]: value }));
    setGuideApplied(false);
  }
  return (
    <section
      className="panel brief-panel"
      id="question"
      aria-labelledby="question-title"
    >
      <h2 id="question-title">Research focus</h2>
      <label className="focus-field-label" htmlFor="question-input">
        Research question
      </label>
      <textarea
        id="question-input"
        value={brief.question}
        onChange={(e) => onCore('question', e.target.value)}
        maxLength={1200}
        rows={4}
        placeholder="For example: How does sleep duration affect memory recall in university students?"
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
        Choose one field and a question you want to explore. You can refine them
        later.
      </p>
      <details className="focus-guide">
        <summary>Help me shape a question</summary>
        <p>
          Start with something you are interested in. These are editable
          question templates, not AI findings or evidence that a question is
          unexplored. Opening this guide does not change your research focus.
        </p>
        <div
          className="focus-example-buttons"
          aria-label="Example question starters"
        >
          {focusExamples.map((example) => (
            <button
              className="secondary"
              key={example.label}
              onClick={() => {
                setGuide({ ...example.guide });
                setGuideApplied(false);
              }}
            >
              {example.label}
            </button>
          ))}
        </div>
        <label htmlFor="focus-template">
          What would you like to investigate?
        </label>
        <select
          id="focus-template"
          value={guide.template}
          onChange={(event) =>
            updateGuide('template', event.target.value as FocusTemplate)
          }
        >
          <option value="relationship">Test a relationship</option>
          <option value="comparison">Compare two approaches</option>
          <option value="limitation">Investigate possible limitations</option>
        </select>
        <div className="focus-guide-fields">
          <label htmlFor="guide-topic">
            Topic, approach, or factor
            <input
              id="guide-topic"
              value={guide.topic}
              maxLength={180}
              onChange={(event) => updateGuide('topic', event.target.value)}
              placeholder="e.g. sleep duration or a graph neural network"
            />
          </label>
          <label htmlFor="guide-outcome">
            Outcome to investigate
            <input
              id="guide-outcome"
              value={guide.outcome}
              maxLength={180}
              onChange={(event) => updateGuide('outcome', event.target.value)}
              placeholder="e.g. memory recall or prediction accuracy"
            />
          </label>
          {guide.template === 'comparison' ? (
            <label htmlFor="guide-comparison">
              Other approach to compare
              <input
                id="guide-comparison"
                value={guide.comparison}
                maxLength={180}
                onChange={(event) =>
                  updateGuide('comparison', event.target.value)
                }
                placeholder="e.g. an existing baseline method"
              />
            </label>
          ) : null}
          <label htmlFor="guide-context">
            Population or conditions <span>Optional</span>
            <input
              id="guide-context"
              value={guide.context}
              maxLength={180}
              onChange={(event) => updateGuide('context', event.target.value)}
              placeholder="e.g. university students or low-light images"
            />
          </label>
          <label htmlFor="guide-dataset">
            Dataset or evidence to use <span>Optional</span>
            <input
              id="guide-dataset"
              value={guide.dataset}
              maxLength={180}
              onChange={(event) => updateGuide('dataset', event.target.value)}
              placeholder="Name a dataset if you already have one"
            />
          </label>
        </div>
        <div className="focus-question-preview" aria-live="polite">
          <strong>Question draft · user-composed template</strong>
          <p>
            {guidedQuestion ??
              'Add a topic and outcome to preview a question. Comparison questions also need a second approach.'}
          </p>
        </div>
        <button
          className="secondary"
          disabled={!guidedQuestion}
          onClick={() => {
            if (!guidedQuestion) return;
            onCore('question', guidedQuestion);
            setGuideApplied(true);
          }}
        >
          Use this question
        </button>
        <p
          className="focus-guide-note"
          role={guideApplied ? 'status' : undefined}
        >
          {guideApplied
            ? 'Question applied. You can edit it above, then search for papers.'
            : 'Use this question replaces the question above only when you click it. It does not start a search or an AI request.'}
        </p>
      </details>
      <button
        className="primary focus-search"
        onClick={onFindPapers}
        disabled={searching || brief.field.trim().length < 2}
      >
        {searching ? 'Finding papers…' : 'Find papers for this focus'}
      </button>
    </section>
  );
}

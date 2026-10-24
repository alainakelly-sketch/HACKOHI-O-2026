import { useMemo, useState } from 'react';
import type { Citation, Paper } from '../../shared/types';
import { buildComparisonOverview } from '../../shared/comparison-overview';
import type { OverviewEvidence } from '../../shared/comparison-overview';
import './comparison-overview.css';

const aspects = [
  {
    key: 'aim',
    label: 'Question',
    prompt: 'What is each paper trying to find out?',
  },
  {
    key: 'methods',
    label: 'Method',
    prompt: 'How did each study approach the question?',
  },
  { key: 'findings', label: 'Findings', prompt: 'What did each study report?' },
  {
    key: 'limitations',
    label: 'Limitations',
    prompt: 'What still needs investigation?',
  },
] as const;
export function ComparisonOverview({
  papers,
  onInspect,
}: {
  papers: Paper[];
  onInspect: (reference: Citation) => void;
}) {
  const [chosen, setChosen] = useState<[string, string]>(['', '']);
  const [aspect, setAspect] =
    useState<(typeof aspects)[number]['key']>('methods');
  // Prefer readable sources initially. Explicit choices remain selected as text arrives.
  const ordered = useMemo(
    () =>
      [...papers].sort(
        (a, b) =>
          Number(b.passages.some((p) => p.kind === 'full-text')) -
          Number(a.passages.some((p) => p.kind === 'full-text')),
      ),
    [papers],
  );
  const first = papers.find((p) => p.id === chosen[0]) ?? ordered[0];
  const second =
    papers.find((p) => p.id === chosen[1] && p.id !== first?.id) ??
    ordered.find((p) => p.id !== first?.id);
  const pair = useMemo(
    () => [first, second].filter((p): p is Paper => !!p),
    [first, second],
  );
  const result = useMemo(() => buildComparisonOverview(pair), [pair]);
  const currentAspect = aspects.find((a) => a.key === aspect)!;
  const row = result.matrix.find((r) => r.key === aspect)!;
  const label = (id: string) => (id === first?.id ? 'Paper A' : 'Paper B');
  function quote(item: OverviewEvidence) {
    return (
      <>
        <details className="overview-source-excerpt">
          <summary>Read source excerpt</summary>
          <blockquote>
            {item.leadingOmitted ? '…' : ''}
            {item.excerpt}
            {item.truncated ? '…' : ''}
          </blockquote>
          <small>{item.section}</small>
        </details>
        <button
          className="text-button"
          onClick={() => onInspect(item.reference)}
        >
          Inspect full passage
        </button>
      </>
    );
  }
  return (
    <section
      className="comparison-overview"
      aria-labelledby="comparison-overview-title"
    >
      <h3 id="comparison-overview-title" className="sr-only">
        Similarities & differences overview
      </h3>
      <p className="overview-explanation">
        Choose two sources and one aspect to compare.
      </p>
      {papers.length >= 2 ? (
        <div className="overview-pair-picker">
          {[first, second].map((paper, i) => (
            <label key={i}>
              <span>Paper {i === 0 ? 'A' : 'B'}</span>
              <select
                aria-label={`Comparison paper ${i === 0 ? 'A' : 'B'}`}
                value={paper?.id ?? ''}
                onChange={(event) => {
                  const id = event.target.value;
                  if (i === 0)
                    setChosen([id, id === second?.id ? first!.id : second!.id]);
                  else setChosen([first!.id, id]);
                }}
              >
                {papers.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={i === 1 && p.id === first?.id}
                  >
                    {p.title}
                  </option>
                ))}
              </select>
              <small>
                {paper?.year ?? 'Year unavailable'} · {paper?.coverage}
              </small>
            </label>
          ))}
        </div>
      ) : null}
      {result.status !== 'ready' ? (
        <p className="overview-unavailable" role="status">
          {result.status === 'need-more-papers'
            ? 'Select at least two papers in Papers, then return here.'
            : 'These two papers need readable article-body text. Retrieve their text below or choose another pair. Abstracts are not substituted.'}
        </p>
      ) : (
        <>
          <section className="overview-common">
            <h4>What they have in common</h4>
            <p className="overview-helper">
              Shared terms in the retrieved text.
            </p>
            {result.shared.length ? (
              <ul className="overview-shared-list">
                {result.shared.map((item) => (
                  <li key={item.term}>
                    <strong>{item.term}</strong>
                    <details className="overview-term-sources">
                      <summary>Sources ({item.evidence.length})</summary>
                      <span>
                        {item.evidence.map((ref) => (
                          <button
                            key={ref.reference.paperId}
                            className="text-button"
                            onClick={() => onInspect(ref.reference)}
                            aria-label={`Inspect ${item.term} in ${label(ref.reference.paperId)}`}
                          >
                            {label(ref.reference.paperId)} evidence
                          </button>
                        ))}
                      </span>
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="overview-missing">
                No clear shared terms found. The papers may still be related.
              </p>
            )}
          </section>
          <section className="overview-differences">
            <h4>How they differ</h4>

            <div
              className="overview-aspect-picker"
              role="group"
              aria-label="What to compare"
            >
              {aspects.map((item) => (
                <button
                  key={item.key}
                  aria-pressed={aspect === item.key}
                  onClick={() => setAspect(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <h5 className="overview-aspect-prompt">{currentAspect.prompt}</h5>
            {row.cells.every((cell) => !!cell.evidence) &&
            row.cells[0].evidence!.excerpt.trim().toLowerCase() ===
              row.cells[1].evidence!.excerpt.trim().toLowerCase() ? (
              <p className="overview-helper">
                These excerpts use the same wording. This view does not
                establish a difference between them.
              </p>
            ) : null}
            <div className="overview-evidence-pair">
              {row.cells.map((cell) => (
                <article key={cell.paperId}>
                  <span className="overview-paper-badge">
                    {label(cell.paperId)}
                  </span>
                  <h5>{pair.find((p) => p.id === cell.paperId)?.title}</h5>
                  {cell.evidence ? (
                    quote(cell.evidence)
                  ) : (
                    <p className="overview-missing">
                      No clear {currentAspect.label.toLowerCase()} passage
                      found. Check the original paper.
                    </p>
                  )}
                </article>
              ))}
            </div>
            <details className="overview-distinct-details">
              <summary>Other differences in wording</summary>
              <p className="overview-helper">
                These terms appear in only one of the two retrieved texts. This
                is not proof that the other study lacks the topic or uses a
                different method.
              </p>
              <div className="overview-evidence-pair">
                {result.distinct.map((item) => (
                  <div key={item.paperId}>
                    <strong>{label(item.paperId)}</strong>
                    {item.terms.length ? (
                      <ul>
                        {item.terms.map((term) => (
                          <li key={term.term}>
                            <button
                              className="text-button"
                              onClick={() => onInspect(term.evidence.reference)}
                            >
                              {term.term} · inspect evidence
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="overview-missing">
                        No distinct terms found.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </section>
        </>
      )}
      <p className="overview-essential-caveat">
        Shared wording does not establish agreement; missing text does not prove
        absence.
      </p>
      <details className="overview-how">
        <summary>Comparison limits</summary>
        <p className="overview-caution">
          {result.caution} Excerpts follow source headings or explicit
          statements; they are not generated scientific summaries.
        </p>
      </details>
    </section>
  );
}

import { useMemo } from 'react';
import type { Citation, Paper } from '../../shared/types';
import { buildComparisonOverview } from '../../shared/comparison-overview';

/** Free, deterministic comparison of stored article passages, never a model call. */
export function PaperSynthesis({
  papers,
  onInspect,
}: {
  papers: Paper[];
  onInspect: (reference: Citation) => void;
}) {
  const comparison = useMemo(() => buildComparisonOverview(papers), [papers]);
  return (
    <section
      className="paper-synthesis"
      aria-labelledby="paper-synthesis-title"
    >
      <h2 id="paper-synthesis-title">Your papers, compared</h2>
      <p className="muted">
        Updates automatically as your selected source text changes. No AI
        charge.
      </p>
      {comparison.status !== 'ready' ? (
        <p>
          {comparison.status === 'need-more-papers'
            ? 'Select at least two papers to compare them.'
            : 'At least two papers need retrieved article text for this comparison. Abstract-only papers remain selected; their full articles have not been compared.'}
        </p>
      ) : (
        <>
          <div className="synthesis-columns">
            <div>
              <h3>Shared topics</h3>
              {comparison.shared.length ? (
                <ul>
                  {comparison.shared.slice(0, 3).map((item) => (
                    <li key={item.term}>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => onInspect(item.evidence[0].reference)}
                      >
                        {item.term}
                      </button>{' '}
                      <span className="muted">
                        · {item.evidence.length} papers
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No clear shared terms found in the retrieved text.</p>
              )}
            </div>
            <div>
              <h3>Differences in focus</h3>
              {!comparison.distinct.some((item) => item.terms.length) ? (
                <p>
                  No clear differences in focus identified in the available
                  article text.
                </p>
              ) : null}
              <ul>
                {comparison.distinct
                  .filter((item) => item.terms.length)
                  .map((item) => {
                    const paper = papers.find((p) => p.id === item.paperId)!;
                    return (
                      <li key={item.paperId}>
                        <span
                          className="synthesis-paper-title"
                          title={paper.title}
                        >
                          {paper.title}
                        </span>
                        {item.terms.length ? (
                          item.terms.slice(0, 2).map((term) => (
                            <button
                              type="button"
                              className="text-button synthesis-term"
                              key={term.term}
                              onClick={() => onInspect(term.evidence.reference)}
                            >
                              {term.term}
                            </button>
                          ))
                        ) : (
                          <span className="muted">
                            No distinct topic identified in available body text.
                          </span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>
          <p className="muted">
            These are text patterns, not proof that the studies agree or
            disagree. Click a topic to inspect its source passage.
          </p>
        </>
      )}
    </section>
  );
}

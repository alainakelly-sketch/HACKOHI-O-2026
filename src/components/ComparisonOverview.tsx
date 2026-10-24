import { useMemo } from 'react';
import type { Citation, Paper } from '../../shared/types';
import { buildComparisonOverview } from '../../shared/comparison-overview';
import type { OverviewEvidence } from '../../shared/comparison-overview';
import './comparison-overview.css';
export function ComparisonOverview({
  papers,
  onInspect,
}: {
  papers: Paper[];
  onInspect: (reference: Citation) => void;
}) {
  const result = useMemo(() => buildComparisonOverview(papers), [papers]);
  const title = (id: string) =>
    result.papers.find((p) => p.id === id)?.title ?? id;
  function inspect(item: OverviewEvidence) {
    onInspect(item.reference);
  }
  return (
    <section
      className="comparison-overview"
      aria-labelledby="comparison-overview-title"
    >
      <h3 id="comparison-overview-title">
        Similarities & differences overview
      </h3>
      <p className="overview-explanation">
        Free, text-based comparison. Shared words show common topics; quoted
        sections help you judge whether the methods and findings really agree.
      </p>
      {result.status !== 'ready' ? (
        <p className="overview-unavailable" role="status">
          {result.status === 'need-more-papers'
            ? 'Select at least two papers to compare similarities and differences.'
            : 'Retrieve article-body text for at least two selected papers. Abstracts are not used as a substitute in this overview.'}
        </p>
      ) : (
        <>
          <div className="overview-topics">
            <section>
              <h4>In common</h4>
              <p className="overview-helper">
                Topics explicitly mentioned in two or more retrieved bodies.
              </p>
              {result.shared.length ? (
                <ul>
                  {result.shared.map((item) => (
                    <li key={item.term}>
                      <strong>{item.term}</strong>
                      <span> · {item.evidence.length} sources</span>
                      <div>
                        {item.evidence.map((ref, i) => (
                          <button
                            className="text-button"
                            key={`${ref.reference.paperId}-${ref.reference.passageId}`}
                            onClick={() => inspect(ref)}
                            aria-label={`Inspect ${item.term} in ${title(ref.reference.paperId)}`}
                          >
                            Source {i + 1}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  No clear shared terms were found. This does not establish that
                  the papers are unrelated.
                </p>
              )}
            </section>
            <section>
              <h4>Distinct emphases</h4>
              <p className="overview-helper">
                Terms seen in this text but not in the other retrieved bodies.
                These are textual differences, not proof that a paper lacks a
                topic.
              </p>
              {result.distinct.map((item) => (
                <div className="distinct-topic" key={item.paperId}>
                  <strong>{title(item.paperId)}</strong>
                  {item.terms.length ? (
                    <ul>
                      {item.terms.map((term) => (
                        <li key={term.term}>
                          <button
                            className="text-button"
                            onClick={() => inspect(term.evidence)}
                          >
                            {term.term} · inspect source
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      No distinct terms established from available body text.
                    </p>
                  )}
                </div>
              ))}
            </section>
          </div>
          <h4 className="overview-matrix-title">
            Compare what the sources state
          </h4>
          <p className="overview-helper">
            Exact source excerpts, not generated conclusions. Missing text stays
            unavailable.
          </p>
          <div
            className="overview-table-wrap"
            tabIndex={0}
            aria-label="Comparison of aims, methods, findings and limitations; scroll horizontally for more papers"
          >
            <table style={{ minWidth: 105 + result.papers.length * 260 }}>
              <thead>
                <tr>
                  <th scope="col">Aspect</th>
                  {result.papers.map((p) => (
                    <th scope="col" key={p.id}>
                      {p.title}
                      {!p.hasBody ? <span>Body text unavailable</span> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.matrix.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    {row.cells.map((cell) => (
                      <td key={cell.paperId}>
                        {cell.evidence ? (
                          <>
                            <span className="overview-section-name">
                              {cell.evidence.section}
                            </span>
                            <blockquote>
                              {cell.evidence.leadingOmitted ? '…' : ''}
                              {cell.evidence.excerpt}
                              {cell.evidence.truncated ? '…' : ''}
                            </blockquote>
                            <button
                              className="text-button"
                              onClick={() => inspect(cell.evidence!)}
                            >
                              Inspect full passage
                            </button>
                          </>
                        ) : (
                          <span className="overview-missing">
                            No clearly labelled section or explicit statement
                            was found in the retrieved body. Read the original
                            before concluding it is absent.
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="overview-caution">{result.caution}</p>
    </section>
  );
}

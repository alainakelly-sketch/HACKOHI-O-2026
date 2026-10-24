import { useState } from 'react';
import { Columns2, ArrowUpRight, Download } from 'lucide-react';
import type { Paper } from '../../shared/types';
import { comparisonPassages, canLoadFullText } from '../../shared/comparison';
import { Busy, Empty, Notice } from './Primitives';
export function ComparisonPanel({
  papers,
  onLoad,
  busy,
  errors,
  onExport,
}: {
  papers: Paper[];
  onLoad: (paper: Paper) => void;
  busy: Set<string>;
  errors: Record<string, string>;
  onExport: () => void;
}) {
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState<'abstract' | 'methods' | 'findings' | 'all'>(
      'abstract',
    ),
    [query, setQuery] = useState('');
  return (
    <section
      className="panel comparison-panel"
      id="comparison"
      aria-labelledby="comparison-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="comparison-title">Compare source text</h2>
          <p className="muted">Free · no AI key required</p>
        </div>
        <button
          className="primary"
          disabled={papers.length < 2}
          onClick={() => setOpen((v) => !v)}
        >
          <Columns2 size={15} />
          {open ? 'Close comparison' : 'Compare selected papers'}
        </button>
      </div>
      {!open || papers.length < 2 ? (
        <p className="panel-footnote">
          Select 2–6 papers from any collection to read them side by side.
          Optional AI connections are separate below.
        </p>
      ) : (
        <>
          <p className="comparison-intro">
            These are passages from the retrieved text, not AI summaries.
            Compare what the sources actually say. Free-copy links may provide
            more than the text available here.
          </p>
          <button className="text-button source-export" onClick={onExport}>
            <Download size={13} />
            Export sources (JSON)
          </button>
          <div className="comparison-controls">
            <div>
              <label htmlFor="comparison-mode">Show</label>
              <select
                id="comparison-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                <option value="abstract">Abstracts</option>
                <option value="methods">Methods sections</option>
                <option value="findings">
                  Findings & limitations sections
                </option>
                <option value="all">All retrieved passages</option>
              </select>
            </div>
            <div>
              <label htmlFor="comparison-phrase">Find a phrase</label>
              <input
                id="comparison-phrase"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search within selected source text"
                maxLength={200}
              />
            </div>
          </div>
          <div
            className="comparison-columns"
            tabIndex={0}
            aria-label="Side-by-side source text; scroll horizontally for more papers"
          >
            {papers.map((paper) => {
              const passages = comparisonPassages(paper, mode, query);
              return (
                <article className="comparison-paper" key={paper.id}>
                  <header>
                    <span className="coverage">{paper.coverage}</span>
                    <h3>{paper.title}</h3>
                    <p className="paper-meta">
                      {paper.year ?? 'Year unavailable'} ·{' '}
                      {(paper.sources ?? [{ provider: 'OpenAlex' }])
                        .map((s) => s.provider)
                        .join(' + ')}
                    </p>
                    <a
                      href={
                        paper.fullText?.url ||
                        paper.freeCopies?.[0]?.url ||
                        paper.url
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Read at source <ArrowUpRight size={12} />
                    </a>
                  </header>
                  {!paper.fullText && canLoadFullText(paper) ? (
                    <button
                      className="secondary"
                      onClick={() => onLoad(paper)}
                      disabled={busy.has(paper.id)}
                    >
                      {busy.has(paper.id) ? (
                        <Busy>Retrieving text</Busy>
                      ) : (
                        'Retrieve free full text'
                      )}
                    </button>
                  ) : null}
                  {!paper.fullText && !canLoadFullText(paper) ? (
                    <p className="muted">
                      {paper.freeCopies?.length
                        ? 'A free copy is linked. This repository’s text cannot be imported yet; open the free copy to read it.'
                        : 'No supported free full-text copy is known for this record.'}
                    </p>
                  ) : null}
                  {errors[paper.id] ? (
                    <Notice error>{errors[paper.id]}</Notice>
                  ) : null}
                  {paper.fullText ? (
                    <div className="text-scope">
                      <p>
                        {paper.fullText.note}
                        {paper.fullText.truncated
                          ? ' Only an excerpt fit the reading limit.'
                          : ''}
                      </p>
                      {paper.fullText.license ? (
                        <details>
                          <summary>License supplied by source</summary>
                          <p>{paper.fullText.license}</p>
                        </details>
                      ) : (
                        <p>
                          Reuse license not established here; check the
                          original.
                        </p>
                      )}
                    </div>
                  ) : null}
                  <div className="comparison-passages">
                    {passages.length ? (
                      passages.map((p) => (
                        <div className="comparison-passage" key={p.id}>
                          <span className="source-label">
                            {p.section ?? 'Abstract'} ·{' '}
                            {p.kind === 'full-text'
                              ? 'SOURCE BODY TEXT'
                              : 'ABSTRACT'}
                          </span>
                          <blockquote>{p.text}</blockquote>
                          <code>{p.id}</code>
                        </div>
                      ))
                    ) : (
                      <Empty
                        title={
                          query
                            ? 'No matching passages'
                            : 'This section is not available'
                        }
                      >
                        {mode === 'methods' || mode === 'findings'
                          ? 'Retrieve readable full text first. Section headings may differ; try “All retrieved passages.”'
                          : 'No text was retrieved for this view. Try a different filter or open the free copy.'}
                      </Empty>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

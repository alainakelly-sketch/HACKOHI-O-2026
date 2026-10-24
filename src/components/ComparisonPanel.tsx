import { useEffect, useRef, useState } from 'react';
import { Columns2, ArrowUpRight, Download } from 'lucide-react';
import type { Paper, Citation } from '../../shared/types';
import { comparisonPassages, canLoadFullText } from '../../shared/comparison';
import { Busy, Empty, Notice } from './Primitives';
import './comparison.css';
import { ComparisonOverview } from './ComparisonOverview';
export function ComparisonPanel({
  papers,
  onLoad,
  busy,
  errors,
  onExport,
  onInspect,
  onGoPapers,
}: {
  papers: Paper[];
  onLoad: (paper: Paper) => void | Promise<void>;
  busy: Set<string>;
  errors: Record<string, string>;
  onExport: () => void;
  onInspect?: (reference: Citation) => void;
  onGoPapers?: () => void;
}) {
  const selectionKey = papers.map((paper) => paper.id).join('|');
  const [mode, setMode] = useState<
    'body' | 'abstract' | 'methods' | 'findings' | 'all'
  >('body');
  const [query, setQuery] = useState('');
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState('');
  const batchRunning = useRef(false);
  const currentSelection = useRef(selectionKey);
  useEffect(() => {
    currentSelection.current = selectionKey;
  }, [selectionKey]);
  const bodyReady = papers.filter((paper) =>
    paper.passages.some((p) => p.kind === 'full-text'),
  ).length;
  const remaining = papers.filter(
    (paper) => canLoadFullText(paper) && !busy.has(paper.id),
  );
  async function retrieveSelected() {
    if (batchRunning.current) return;
    batchRunning.current = true;
    setBatchBusy(true);
    setBatchError('');
    const startedFor = selectionKey;
    try {
      for (const paper of remaining) {
        if (currentSelection.current !== startedFor) break;
        // Root owns request sharing and errors. Waiting here keeps this explicit
        // batch to one retrieval at a time instead of starting every source.
        await onLoad(paper);
      }
    } catch {
      setBatchError(
        'Selected-text retrieval could not complete. Check the per-paper status and retry, or open the source copy.',
      );
    } finally {
      batchRunning.current = false;
      setBatchBusy(false);
    }
  }
  return (
    <section
      className="panel comparison-panel"
      id="comparison"
      aria-labelledby="comparison-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="comparison-title">Compare papers</h2>
          <p className="muted">Free · no AI key required</p>
        </div>
        {onGoPapers ? (
          <button className="secondary" onClick={onGoPapers}>
            <Columns2 size={15} />
            Change selected papers
          </button>
        ) : null}
      </div>
      {papers.length < 1 ? (
        <p className="panel-footnote">
          Choose a paper to read, or two papers to compare.
        </p>
      ) : (
        <>
          <ComparisonOverview
            papers={papers}
            onInspect={onInspect ?? (() => {})}
          />
          <details className="full-source-reader" open={papers.length === 1}>
            <summary>
              Read full retrieved passages · optional deeper reading
            </summary>
            <p className="comparison-intro">
              Stored source passages. Abstracts are shown only when selected.
            </p>
            <div className="reading-status" role="status">
              <strong>
                {bodyReady} of {papers.length} selected{' '}
                {papers.length === 1 ? 'paper has' : 'papers have'} article-body
                text.
              </strong>
              <span>
                {papers.some((p) => busy.has(p.id))
                  ? 'Retrieving remaining text…'
                  : bodyReady < papers.length
                    ? 'Some body text is unavailable.'
                    : ''}
              </span>
            </div>
            {remaining.length > 0 ? (
              <button
                className="secondary retrieve-selected"
                onClick={retrieveSelected}
                disabled={batchBusy}
              >
                {batchBusy ? (
                  <Busy>Retrieving selected full texts</Busy>
                ) : (
                  'Retrieve selected full texts'
                )}
              </button>
            ) : null}
            {batchError ? <Notice error>{batchError}</Notice> : null}
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
                  <option value="body">Article body — retrieved text</option>
                  <option value="abstract">Abstracts only</option>
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
              className={`comparison-columns ${papers.length === 1 ? 'single-reader' : ''}`}
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
                    {busy.has(paper.id) ? (
                      <div
                        className="paper-reading-state loading"
                        role="status"
                      >
                        <Busy>Retrieving article-body text…</Busy>
                        <p>The abstract is not being shown as full text.</p>
                      </div>
                    ) : paper.fullText ? (
                      <div className="paper-reading-state ready">
                        {paper.fullText.truncated
                          ? 'Body excerpt ready'
                          : 'Article body ready'}
                      </div>
                    ) : errors[paper.id] ? (
                      <div className="paper-reading-state failed">
                        Body retrieval failed · no full text was imported
                      </div>
                    ) : canLoadFullText(paper) ? (
                      <div className="paper-reading-state waiting">
                        Article body not retrieved yet
                      </div>
                    ) : (
                      <div className="paper-reading-state unavailable">
                        In-app article body unavailable for this record
                      </div>
                    )}
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
                      <details className="text-scope">
                        <summary>Extraction scope & license</summary>
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
                      </details>
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
                            <details className="passage-identifier">
                              <summary>Passage ID</summary>
                              <code>{p.id}</code>
                            </details>
                          </div>
                        ))
                      ) : (
                        <Empty
                          title={
                            query
                              ? 'No matching passages'
                              : mode === 'body'
                                ? busy.has(paper.id)
                                  ? 'Retrieving article body'
                                  : paper.fullText
                                    ? 'No readable body passages'
                                    : 'Article body is not available here yet'
                                : mode === 'abstract'
                                  ? 'No abstract was retrieved'
                                  : 'This section is not available'
                          }
                        >
                          {query
                            ? 'No stored passages in this view contain that phrase. Try another phrase or view.'
                            : mode === 'body' && !paper.fullText
                              ? busy.has(paper.id)
                                ? 'Keep this workspace open while the source responds. The reader will display its body text when retrieval succeeds.'
                                : errors[paper.id]
                                  ? 'The source could not provide importable body text. Retry retrieval, or open the source’s free copy. Choose “Abstracts only” explicitly if you want to read the abstract instead.'
                                  : canLoadFullText(paper)
                                    ? 'Use “Retrieve free full text” above. The reader will display article-body passages automatically when ready.'
                                    : 'Open “Read at source” to read the free copy. This repository or PDF format cannot currently be imported. Choose “Abstracts only” explicitly to read an available abstract.'
                              : mode === 'methods' || mode === 'findings'
                                ? 'Source headings can vary. Retrieve article body first, then try “Article body” if this section heading is absent.'
                                : 'No text was retrieved for this view. Open the source copy to inspect it.'}
                        </Empty>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </details>
        </>
      )}
    </section>
  );
}

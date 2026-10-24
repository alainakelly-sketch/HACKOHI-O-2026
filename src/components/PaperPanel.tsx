import { ArrowUpRight, Search, FileSearch, X } from 'lucide-react';
import { useState } from 'react';
import type { Paper, SearchSourceStatus } from '../../shared/types';
import { canLoadFullText } from '../../shared/comparison';
import { Busy, Empty, Notice } from './Primitives';
export function PaperRow({
  paper,
  selected,
  disabled,
  onToggle,
  onLoad,
  textBusy,
  textError,
}: {
  paper: Paper;
  selected?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  onLoad?: () => void;
  textBusy?: boolean;
  textError?: string;
}) {
  return (
    <article className={`paper-row ${selected ? 'selected' : ''}`}>
      <div className="paper-top">
        {onToggle ? (
          <input
            aria-label={`Select ${paper.title}`}
            type="checkbox"
            checked={!!selected}
            disabled={disabled}
            onChange={onToggle}
          />
        ) : null}
        <div>
          <div className="paper-meta">
            <span>{paper.year ?? 'Year unavailable'}</span>
            <span className="coverage">{paper.coverage}</span>
            <code>{paper.id}</code>
          </div>
          <h3>{paper.title}</h3>
          <p className="collection-label">
            {(paper.sources ?? [{ provider: 'OpenAlex' }])
              .map((s) => s.provider)
              .filter((v, i, a) => a.indexOf(v) === i)
              .join(' + ')}
            {paper.publicationType === 'Preprint'
              ? ' · Preprint / arXiv manuscript; check review status'
              : paper.publicationType === 'Includes preprint version'
                ? ' · Includes a preprint / manuscript version'
                : ''}
          </p>
          {paper.sources && paper.sources.length > 1 ? (
            <details className="version-links">
              <summary>
                Grouped records / versions ({paper.sources.length})
              </summary>
              <p>
                These records share a DOI, PMC identifier or arXiv identifier.
                Manuscript versions may differ; grouping does not mean their
                text is identical.
              </p>
              {paper.sources.map((s) => (
                <a
                  key={`${s.provider}-${s.id}`}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.provider}: {s.id}
                </a>
              ))}
            </details>
          ) : null}
          <p className="authors">
            {paper.authors.join(', ') || 'Authors unavailable'}
          </p>
          <div className="free-copy-links">
            {(paper.freeCopies ?? []).slice(0, 3).map((copy) => (
              <a
                key={copy.url}
                href={copy.url}
                target="_blank"
                rel="noreferrer"
              >
                Free {copy.format === 'PDF' ? 'PDF' : 'copy'}{' '}
                <ArrowUpRight size={12} /> <span>{copy.via}</span>
              </a>
            ))}
          </div>
          <div className="paper-links">
            <a href={paper.url} target="_blank" rel="noreferrer">
              Source record <ArrowUpRight size={12} />
            </a>
            {paper.doi ? (
              <a href={paper.doi} target="_blank" rel="noreferrer">
                Publisher record / DOI <ArrowUpRight size={12} />
              </a>
            ) : null}
          </div>
        </div>
      </div>
      {paper.abstract ? (
        <details className="abstract">
          <summary>Read available abstract</summary>
          <p>{paper.abstract}</p>
          <p className="muted">
            {paper.fullText
              ? 'This panel shows the abstract; retrieved article-body text is available in the comparison.'
              : 'Abstract only. Full text has not been retrieved into this workspace.'}
          </p>
        </details>
      ) : (
        <p className="missing">
          No abstract available. Metadata alone cannot support a connection.
        </p>
      )}
      {onLoad && canLoadFullText(paper) ? (
        <button
          className="secondary text-load"
          onClick={onLoad}
          disabled={textBusy}
        >
          {textBusy ? <Busy>Retrieving text</Busy> : 'Retrieve free full text'}
        </button>
      ) : null}
      {paper.fullText ? (
        <p className="text-loaded">
          Article-body text is ready in “Compare source text”.
        </p>
      ) : null}
      {textError ? <Notice error>{textError}</Notice> : null}
    </article>
  );
}
export function PaperPanel({
  papers,
  selected,
  loading,
  error,
  searched,
  lastQuery,
  onSearch,
  onToggle,
  sourceStatuses = [],
  onLoad,
  textBusy,
  textErrors,
}: {
  papers: Paper[];
  selected: Paper[];
  loading: boolean;
  error: string;
  searched: boolean;
  lastQuery: string;
  onSearch: (query: string) => void;
  onToggle: (paper: Paper) => void;
  sourceStatuses?: SearchSourceStatus[];
  onLoad: (paper: Paper) => void;
  textBusy: Set<string>;
  textErrors: Record<string, string>;
}) {
  const [query, setQuery] = useState('');
  const [readableOnly, setReadableOnly] = useState(false);
  const visible = readableOnly
    ? papers.filter((p) => p.fullText || canLoadFullText(p))
    : papers;
  return (
    <section
      className="panel paper-panel"
      id="papers"
      aria-labelledby="papers-title"
    >
      <div className="panel-heading">
        <h2 id="papers-title">Paper selection</h2>
        <span className="muted">
          {selected.length} selected{' '}
          <span className="wide-only">(up to 6)</span>
        </span>
      </div>
      <p className="collection-note">
        Search free papers together: arXiv · Europe PMC / PubMed Central ·
        OpenAlex, including repository links.
      </p>
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 2) onSearch(query.trim());
        }}
      >
        <div className="input-icon">
          <Search size={17} />
          <label className="sr-only" htmlFor="paper-search">
            Search papers
          </label>
          <input
            id="paper-search"
            value={query}
            maxLength={400}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a topic, method, or keyword…"
          />
        </div>
        <button
          className="primary"
          disabled={loading || query.trim().length < 2}
        >
          {loading ? <Busy>Searching</Busy> : 'Search'}
        </button>
      </form>
      <label className="readable-filter">
        <input
          type="checkbox"
          checked={readableOnly}
          onChange={(e) => setReadableOnly(e.target.checked)}
        />
        Show only records with supported in-app text retrieval
      </label>
      {sourceStatuses.length ? (
        <div className="source-statuses" aria-label="Search collection status">
          {sourceStatuses.map((s) => (
            <div
              key={s.source}
              className={s.status === 'error' ? 'source-failed' : ''}
            >
              <strong>{s.source}</strong>
              <span>
                {s.status === 'ok'
                  ? `${s.count} free-linked records`
                  : 'Unavailable — search incomplete'}
              </span>
              {s.message ? <p>{s.message}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      {selected.length ? (
        <div className="selection-tray" aria-label="Selected papers">
          {selected.map((p) => (
            <button
              key={p.id}
              onClick={() => onToggle(p)}
              title={`Remove ${p.title}`}
            >
              <span>{p.title}</span>
              <X size={12} />
            </button>
          ))}
        </div>
      ) : null}
      {error ? (
        <Notice error>
          {error}{' '}
          <button className="text-button" onClick={() => onSearch(lastQuery)}>
            Retry search
          </button>
        </Notice>
      ) : null}
      {loading ? (
        <div className="loading-area" role="status">
          <Busy>Searching the free-paper collections…</Busy>
        </div>
      ) : null}
      {!loading && papers.length ? (
        <>
          <p className="results-caption">
            {lastQuery
              ? `${papers.length} combined records for “${lastQuery}” · interleaved source relevance, duplicates grouped`
              : `${papers.length} saved source records from OpenAlex · not a live search`}
          </p>
          <div className="paper-list">
            {visible.map((p) => (
              <PaperRow
                key={p.id}
                paper={p}
                selected={selected.some((s) => s.id === p.id)}
                disabled={
                  selected.length >= 6 && !selected.some((s) => s.id === p.id)
                }
                onToggle={() => onToggle(p)}
                onLoad={() => onLoad(p)}
                textBusy={textBusy.has(p.id)}
                textError={textErrors[p.id]}
              />
            ))}
          </div>
          {!visible.length ? (
            <p className="panel-footnote">
              No results match this filter. Turn it off to see linked free PDFs
              and repositories.
            </p>
          ) : null}
        </>
      ) : null}
      {!loading && !papers.length && !error ? (
        <Empty
          title={searched ? 'No papers found' : 'Find your starting papers'}
          icon={<FileSearch size={30} />}
        >
          {searched
            ? 'Try a shorter term, a specific method, or search each field separately.'
            : 'Search across your two fields. Select 2–6 papers for free side-by-side reading.'}
        </Empty>
      ) : null}
      <p className="panel-footnote">
        Free links are reported by the source and may change. Not every free
        paper is indexed, and not every free copy can be imported here. Your
        selection stays while you search.
      </p>
    </section>
  );
}

import { ArrowUpRight, Search, FileSearch, X } from 'lucide-react';
import { useState } from 'react';
import type { Paper } from '../../shared/types';
import { Busy, Empty, Notice } from './Primitives';
export function PaperRow({
  paper,
  selected,
  disabled,
  onToggle,
}: {
  paper: Paper;
  selected?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
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
          <p className="authors">
            {paper.authors.join(', ') || 'Authors unavailable'}
          </p>
          <div className="paper-links">
            <a href={paper.url} target="_blank" rel="noreferrer">
              OpenAlex record <ArrowUpRight size={12} />
            </a>
            {paper.doi ? (
              <a href={paper.doi} target="_blank" rel="noreferrer">
                Publisher / DOI <ArrowUpRight size={12} />
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
            Abstract only. Full text has not been retrieved.
          </p>
        </details>
      ) : (
        <p className="missing">
          No abstract available. Metadata alone cannot support a connection.
        </p>
      )}
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
}: {
  papers: Paper[];
  selected: Paper[];
  loading: boolean;
  error: string;
  searched: boolean;
  lastQuery: string;
  onSearch: (query: string) => void;
  onToggle: (paper: Paper) => void;
}) {
  const [query, setQuery] = useState('');
  return (
    <section
      className="panel paper-panel"
      id="papers"
      aria-labelledby="papers-title"
    >
      <div className="panel-heading">
        <h2 id="papers-title">Paper selection</h2>
        <span className="muted">
          {selected.length} selected <span className="wide-only">(4–6)</span>
        </span>
      </div>
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
          <Busy>Searching OpenAlex for real papers…</Busy>
        </div>
      ) : null}
      {!loading && papers.length ? (
        <>
          <p className="results-caption">
            {lastQuery
              ? `${papers.length} retrieved results for “${lastQuery}” · OpenAlex relevance order`
              : `${papers.length} saved source records from OpenAlex · not a live search`}
          </p>
          <div className="paper-list">
            {papers.map((p) => (
              <PaperRow
                key={p.id}
                paper={p}
                selected={selected.some((s) => s.id === p.id)}
                disabled={
                  selected.length >= 6 && !selected.some((s) => s.id === p.id)
                }
                onToggle={() => onToggle(p)}
              />
            ))}
          </div>
        </>
      ) : null}
      {!loading && !papers.length && !error ? (
        <Empty
          title={searched ? 'No papers found' : 'Find your starting papers'}
          icon={<FileSearch size={30} />}
        >
          {searched
            ? 'Try a shorter term, a specific method, or search each field separately.'
            : 'Search across your two fields. Select 4–6 papers to compare their available evidence.'}
        </Empty>
      ) : null}
      <p className="panel-footnote">
        Search each field separately if needed. Your selection stays while you
        search.
      </p>
    </section>
  );
}

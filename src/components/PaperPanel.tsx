import { ArrowUpRight, Search, FileSearch, X } from 'lucide-react';
import type { Paper, SearchSourceStatus, SourceName } from '../../shared/types';
import { defaultFilter, filterPapers } from '../../shared/paper-filters';
import type { PaperFilters } from '../../shared/paper-filters';
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
  const body = paper.passages.filter(
    (p) => p.kind === 'full-text' && p.text.trim(),
  );
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
      {body.length ? (
        <div className="body-preview">
          <strong>Article body retrieved · {body.length} paragraphs</strong>
          <p>
            {body[0].text.slice(0, 240)}
            {body[0].text.length > 240 ? '…' : ''}
          </p>
          <button
            className="secondary"
            disabled={disabled}
            onClick={() => {
              if (!selected) onToggle?.();
              document
                .getElementById('comparison')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            Read article body
          </button>
        </div>
      ) : null}
      {paper.abstract ? (
        <details className="abstract">
          <summary>Abstract preview (not the article body)</summary>
          <p>{paper.abstract}</p>
          <p className="muted">
            {paper.fullText
              ? 'This panel shows the abstract; retrieved article-body text is available in the comparison.'
              : 'Abstract only. Body text has not been retrieved yet. Selecting a supported record starts retrieval.'}
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
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  verification,
  onCheckText,
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
  query: string;
  onQueryChange: (value: string) => void;
  filters: PaperFilters;
  onFiltersChange: (next: PaperFilters) => void;
  verification: { running: boolean; checked: number; total: number };
  onCheckText: () => void;
}) {
  const visible = filterPapers(papers, filters);
  const failed = papers.filter((p) => !!textErrors[p.id]);
  const update = (patch: Partial<PaperFilters>) =>
    onFiltersChange({ ...filters, ...patch });
  const collections: SourceName[] = ['OpenAlex', 'Europe PMC', 'arXiv'];
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
        Search your focus across free papers: arXiv · Europe PMC / PubMed
        Central · OpenAlex, including repository links.
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
            onChange={(e) => onQueryChange(e.target.value)}
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
      <details className="paper-filters">
        <summary>
          Filters ·{' '}
          {filters.access === 'verified'
            ? 'Retrieved article body only'
            : filters.access === 'supported'
              ? 'Supported routes'
              : 'All free-copy records'}
        </summary>
        <label htmlFor="article-access">Text availability</label>
        <select
          id="article-access"
          value={filters.access}
          onChange={(e) =>
            update({ access: e.target.value as PaperFilters['access'] })
          }
        >
          <option value="verified">Retrieved article body only</option>
          <option value="supported">
            Supported retrieval route — not checked
          </option>
          <option value="all">
            All free-copy records — may be abstract-only
          </option>
        </select>
        <p className="filter-explanation">
          The default admits only article-body text actually imported into this
          workspace. A free link or identifier alone does not qualify. Figures,
          tables and supplements are still separate at the source.
        </p>
        {filters.access === 'verified' ? (
          <label className="filter-check">
            <input
              type="checkbox"
              checked={filters.allowExcerpt}
              onChange={(e) => update({ allowExcerpt: e.target.checked })}
            />
            Include labelled partial-text excerpts
          </label>
        ) : null}
        <fieldset>
          <legend>Show collections</legend>
          <div className="collection-checks">
            {collections.map((source) => (
              <label key={source}>
                <input
                  type="checkbox"
                  checked={filters.sources.includes(source)}
                  onChange={(e) =>
                    update({
                      sources: e.target.checked
                        ? [...filters.sources, source]
                        : filters.sources.filter((s) => s !== source),
                    })
                  }
                />
                {source === 'Europe PMC' ? 'Europe PMC / PMC' : source}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="filter-years">
          <div>
            <label htmlFor="year-from">Year from</label>
            <input
              id="year-from"
              type="number"
              min={1000}
              max={3000}
              placeholder="Any"
              value={filters.yearFrom ?? ''}
              onChange={(e) =>
                update({
                  yearFrom: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
          <div>
            <label htmlFor="year-to">Year to</label>
            <input
              id="year-to"
              type="number"
              min={1000}
              max={3000}
              placeholder="Any"
              value={filters.yearTo ?? ''}
              onChange={(e) =>
                update({
                  yearTo: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
        </div>
        <label htmlFor="article-kind">Publication versions</label>
        <select
          id="article-kind"
          value={filters.articleKind}
          onChange={(e) =>
            update({
              articleKind: e.target.value as PaperFilters['articleKind'],
            })
          }
        >
          <option value="all">All records</option>
          <option value="exclude-preprints">
            Exclude identified preprints / mixed versions
          </option>
          <option value="preprints">
            Only identified preprints / mixed versions
          </option>
        </select>
        <p className="filter-explanation">
          Excluding preprints does not establish peer review.
        </p>
        <button
          className="text-button"
          onClick={() =>
            onFiltersChange({
              ...defaultFilter,
              sources: [...defaultFilter.sources],
            })
          }
        >
          Reset filters
        </button>
      </details>
      {verification.running ? (
        <Notice>
          <Busy>
            Checking article text: {verification.checked} of{' '}
            {verification.total}
          </Busy>{' '}
          Retrieved papers appear as soon as they are ready. Checks are limited
          to 12 records per batch.
        </Notice>
      ) : null}
      {papers.length > 0 ? (
        <button
          className="secondary check-article-text"
          onClick={onCheckText}
          disabled={verification.running}
        >
          Check more article texts
        </button>
      ) : null}
      {failed.length ? (
        <details className="retrieval-failures">
          <summary>
            {failed.length} text retrieval check{failed.length === 1 ? '' : 's'}{' '}
            failed — inspect or retry
          </summary>
          {failed.map((p) => (
            <div key={p.id}>
              <strong>{p.title}</strong>
              <p>{textErrors[p.id]}</p>
              <button
                className="text-button"
                disabled={textBusy.has(p.id)}
                onClick={() => onLoad(p)}
              >
                {textBusy.has(p.id) ? 'Retrying…' : 'Retry this article'}
              </button>
            </div>
          ))}
        </details>
      ) : null}
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
          <span className="selection-note">
            Filters change search results; selected papers stay until you remove
            their chips.
          </span>
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
              ? `${visible.length} shown of ${papers.length} combined records for “${lastQuery}” · duplicates grouped`
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
              {verification.running
                ? 'Article-body checks are still running; no matching retrieved text is ready yet.'
                : !filters.sources.length
                  ? 'Choose at least one collection above.'
                  : filters.access === 'verified'
                    ? 'No imported article body matches these filters yet. Check more article texts, review failed retrievals, or change Text availability to see free-copy links.'
                    : 'No records match these filters. Widen the year range, collections, or publication-version setting.'}
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
            : 'Search within your field of interest. Select 2–6 papers for free side-by-side reading.'}
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

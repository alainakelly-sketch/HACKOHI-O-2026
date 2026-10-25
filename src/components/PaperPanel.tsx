import { useMemo, useState } from 'react';
import { ArrowUpRight, Search, FileSearch, X } from 'lucide-react';
import type {
  Paper,
  Resources,
  SearchSourceStatus,
  SourceName,
  SearchResult,
} from '../../shared/types';
import { defaultFilter, filterPapers } from '../../shared/paper-filters';
import type { PaperFilters } from '../../shared/paper-filters';
import { canLoadFullText } from '../../shared/comparison';
import { Busy, Empty, Notice } from './Primitives';
import './search-cards.css';
type Concepts = { label: string; terms: string[] }[];
function QueryInterpretation({
  plan,
  query,
  onSearch,
  loading,
}: {
  plan: NonNullable<SearchResult['queryPlan']>;
  query: string;
  onSearch: (query: string, concepts?: Concepts) => void;
  loading: boolean;
}) {
  const [draft, setDraft] = useState(() =>
    plan.concepts
      .map((concept) =>
        [
          concept.label,
          ...concept.terms.filter(
            (term) => term.toLowerCase() !== concept.label.toLowerCase(),
          ),
        ].join(' | '),
      )
      .join('\n'),
  );
  const concepts = draft
    .split('\n')
    .map((line) =>
      line
        .split('|')
        .map((term) => term.trim())
        .filter(Boolean),
    )
    .filter((terms) => terms.length)
    .slice(0, 6)
    .map((terms) => ({
      label: terms[0],
      terms: [...new Set(terms)].slice(0, 8),
    }));
  return (
    <section
      className="query-interpretation"
      aria-label="Interpreted search concepts"
    >
      <span className="query-label">Searching for these concepts together</span>
      <div className="query-concepts">
        {plan.concepts.map((concept) => (
          <span key={concept.label}>{concept.label}</span>
        ))}
      </div>
      <details>
        <summary>Edit interpreted concepts</summary>
        <p>
          One concept per line. Add related terms with |. These corrections
          affect search only; your research question stays unchanged.
        </p>
        <label htmlFor="search-concepts">Concepts and related terms</label>
        <textarea
          id="search-concepts"
          aria-label="Concepts and related terms"
          rows={Math.max(2, Math.min(6, plan.concepts.length))}
          maxLength={1200}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="button"
          className="secondary"
          disabled={loading || !concepts.length || query.trim().length < 2}
          onClick={() => onSearch(query, concepts)}
        >
          Apply concepts &amp; search
        </button>
        <p className="filter-explanation">{plan.note}</p>
        <strong>Planned search phrases</strong>
        <ul>
          {plan.variants.map((variant, index) => (
            <li key={`${index}:${variant}`}>{variant}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
export function PaperRow({
  paper,
  selected,
  disabled,
  onToggle,
  onRead,
  onLoad,
  textBusy,
  textError,
}: {
  paper: Paper;
  selected?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  onRead?: () => void;
  onLoad?: () => void;
  textBusy?: boolean;
  textError?: string;
}) {
  const body = paper.passages.filter(
    (passage) => passage.kind === 'full-text' && passage.text.trim(),
  );
  const providers = [
    ...new Set(
      (paper.sources ?? [{ provider: 'OpenAlex' }]).map(
        (source) => source.provider,
      ),
    ),
  ];
  return (
    <article
      className={`paper-row compact-paper ${selected ? 'selected' : ''}`}
    >
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
        <div className="paper-heading-copy">
          <h3>{paper.title}</h3>
          <div className="paper-meta">
            <span>{paper.year ?? 'Year unavailable'}</span>
            <span className="coverage">
              {body.length
                ? 'Article body retrieved'
                : paper.abstract
                  ? 'Abstract only'
                  : 'Metadata only'}
              {paper.coverage === 'Full text excerpt' ? ' · excerpt' : ''}
            </span>
            {!body.length && (textError || !canLoadFullText(paper)) ? (
              <span className="retrieval-status">
                {textError ? 'Retrieval failed' : 'Retrieval unsupported'}
              </span>
            ) : null}
            {paper.publicationType === 'Preprint' ||
            paper.publicationType === 'Includes preprint version' ? (
              <span>Includes preprint</span>
            ) : null}
          </div>
        </div>
      </div>
      {paper.relevance ? (
        <div className="paper-relevance">
          <span
            className={`relevance-tag relevance-${paper.relevance.classification.startsWith('Directly') ? 'direct' : paper.relevance.classification.startsWith('Related') ? 'background' : 'unclear'}`}
          >
            {paper.relevance.classification}
          </span>
          <p>{paper.relevance.explanation}</p>
          <details>
            <summary>Why this match?</summary>
            {paper.relevance.evidence.map((evidence, index) => (
              <div key={`${evidence.field}:${index}`}>
                <strong>
                  {evidence.field === 'title' ? 'Title' : 'Abstract'} states
                </strong>
                <blockquote>{evidence.text}</blockquote>
              </div>
            ))}
            {paper.relevance.missingConcepts.length ? (
              <p>
                Not established by available title/abstract:{' '}
                {paper.relevance.missingConcepts.join(', ')}.
              </p>
            ) : null}
            <p className="filter-explanation">
              Text matching helps order discovery results; it does not verify
              scientific claims.
            </p>
          </details>
        </div>
      ) : null}
      <div className="paper-quick-actions">
        {body.length ? (
          <button
            className="text-button"
            disabled={disabled}
            onClick={() => {
              if (!selected) onToggle?.();
              onRead?.();
            }}
          >
            Read article body
          </button>
        ) : onLoad && canLoadFullText(paper) ? (
          <button className="text-button" onClick={onLoad} disabled={textBusy}>
            {textBusy ? (
              <Busy>Retrieving text</Busy>
            ) : (
              'Retrieve free full text'
            )}
          </button>
        ) : null}
        <a href={paper.url} target="_blank" rel="noreferrer">
          Source record <ArrowUpRight size={12} />
        </a>
      </div>
      {textBusy && body.length ? (
        <p role="status">
          <Busy>Retrieving text</Busy>
        </p>
      ) : null}
      {textError ? <Notice error>{textError}</Notice> : null}
      <details className="paper-details">
        <summary>Paper details</summary>
        <dl className="paper-facts">
          <div>
            <dt>Authors</dt>
            <dd>{paper.authors.join(', ') || 'Unavailable'}</dd>
          </div>
          <div>
            <dt>Found in</dt>
            <dd>{providers.join(' + ')}</dd>
          </div>
          <div>
            <dt>Source ID</dt>
            <dd>
              <code>{paper.id}</code>
            </dd>
          </div>
        </dl>
        {paper.abstract ? (
          <details className="abstract">
            <summary>Abstract only</summary>
            <p>{paper.abstract}</p>
          </details>
        ) : (
          <p className="missing">No abstract available.</p>
        )}
        {body.length ? (
          <details className="body-preview">
            <summary>
              Article-body preview · {body.length} paragraphs retrieved
            </summary>
            <p>
              {body[0].text.slice(0, 240)}
              {body[0].text.length > 240 ? '…' : ''}
            </p>
          </details>
        ) : null}
        <div className="free-copy-links">
          {(paper.freeCopies ?? []).slice(0, 3).map((copy) => (
            <a key={copy.url} href={copy.url} target="_blank" rel="noreferrer">
              Free {copy.format === 'PDF' ? 'PDF' : 'copy'}{' '}
              <ArrowUpRight size={12} />
              <span>{copy.via}</span>
            </a>
          ))}
        </div>
        {paper.doi ? (
          <a href={paper.doi} target="_blank" rel="noreferrer">
            Publisher record / DOI <ArrowUpRight size={12} />
          </a>
        ) : null}
        {paper.sources && paper.sources.length > 1 ? (
          <details className="version-links">
            <summary>Grouped versions ({paper.sources.length})</summary>
            <p>
              Shared identifiers group these records; manuscript text may
              differ.
            </p>
            {paper.sources.map((source) => (
              <a
                key={`${source.provider}:${source.id}`}
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.provider}: {source.id}
              </a>
            ))}
          </details>
        ) : null}
        {paper.fullText ? (
          <p className="muted">{paper.fullText.note}</p>
        ) : (
          <p className="muted">
            Article-body text has not been imported. Free-copy links open the
            original.
          </p>
        )}
      </details>
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
  onRead,
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
  queryPlan,
  performedQueries = [],
}: {
  papers: Paper[];
  selected: Paper[];
  loading: boolean;
  error: string;
  searched: boolean;
  lastQuery: string;
  onSearch: (query: string, concepts?: Concepts) => void;
  onToggle: (paper: Paper) => void;
  onRead?: () => void;
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
  resources: Resources;
  queryPlan?: SearchResult['queryPlan'];
  performedQueries?: SearchResult['performedQueries'];
}) {
  const visible = useMemo(
    () => filterPapers(papers, filters),
    [papers, filters],
  );
  const direct = visible.filter(
    (paper) =>
      paper.relevance?.classification === 'Directly addresses the question',
  );
  const background = visible.filter(
    (paper) =>
      paper.relevance?.classification ===
      'Related background or potentially transferable method',
  );
  const unclear = visible.filter(
    (paper) =>
      !paper.relevance ||
      paper.relevance.classification === 'Relevance unclear',
  );
  const failed = papers.filter((p) => !!textErrors[p.id]);
  const update = (patch: Partial<PaperFilters>) =>
    onFiltersChange({ ...filters, ...patch });
  const collections: SourceName[] = ['OpenAlex', 'Europe PMC', 'arXiv'];
  function renderPaper(p: Paper) {
    return (
      <PaperRow
        key={p.id}
        paper={p}
        selected={selected.some((s) => s.id === p.id)}
        disabled={selected.length >= 6 && !selected.some((s) => s.id === p.id)}
        onToggle={() => onToggle(p)}
        onRead={onRead}
        onLoad={() => onLoad(p)}
        textBusy={textBusy.has(p.id)}
        textError={textErrors[p.id]}
      />
    );
  }
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
        Find relevant papers, then choose the sources to explore.
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
      {queryPlan ? (
        <QueryInterpretation
          key={JSON.stringify(queryPlan)}
          plan={queryPlan}
          query={query}
          onSearch={onSearch}
          loading={loading}
        />
      ) : null}
      <details className="paper-filters">
        <summary>
          Filters ·{' '}
          {filters.access === 'verified'
            ? 'Ready for full-text analysis'
            : filters.access === 'supported'
              ? 'Supported routes'
              : 'Discovery — best topic matches'}
        </summary>
        <label htmlFor="article-access">Discovery and text access</label>
        <select
          id="article-access"
          value={filters.access}
          onChange={(e) =>
            update({ access: e.target.value as PaperFilters['access'] })
          }
        >
          <option value="verified">Ready for full-text analysis</option>
          <option value="supported">
            Supported retrieval route — not checked
          </option>
          <option value="all">Discovery — best topic matches</option>
        </select>
        <p className="filter-explanation">
          Discovery includes relevant abstracts and metadata. Ready for
          full-text analysis requires article-body text actually imported into
          this workspace. A free link alone does not qualify. Access filters do
          not measure topic relevance.
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
          Ready papers appear as text arrives.
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
      {performedQueries.length ? (
        <details className="performed-queries">
          <summary>Searches actually performed</summary>
          <ul>
            {performedQueries.map((search, index) => (
              <li key={`${search.source}:${index}`}>
                <strong>{search.source}</strong>
                <code>{search.query}</code>
                <span>
                  {search.status === 'ok'
                    ? 'Completed'
                    : 'Failed — search incomplete'}
                </span>
                {search.message ? <p>{search.message}</p> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {sourceStatuses.length ? (
        <details className="collection-details">
          <summary>
            Search collections ·{' '}
            {sourceStatuses.filter((source) => source.status === 'ok').length}{' '}
            of {sourceStatuses.length} available
            {sourceStatuses.some((source) => source.status === 'error')
              ? ' · search incomplete'
              : ''}
          </summary>
          <div
            className="source-statuses"
            aria-label="Search collection status"
          >
            {sourceStatuses.map((source) => (
              <div
                key={source.source}
                className={source.status === 'error' ? 'source-failed' : ''}
              >
                <strong>{source.source}</strong>
                <span>
                  {source.status === 'ok'
                    ? `${source.count} free-linked records`
                    : 'Unavailable — search incomplete'}
                </span>
                {source.message ? <p>{source.message}</p> : null}
              </div>
            ))}
          </div>
        </details>
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
            Selection is kept when you search again.
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
              ? `${visible.length} discovery records of ${papers.length} retrieved for “${lastQuery}” · ordered by question relevance; duplicates grouped`
              : `${papers.length} saved source records from OpenAlex · not a live search`}
          </p>
          {filters.access !== 'all' &&
          filterPapers(papers, { ...filters, access: 'all' }).length >
            visible.length ? (
            <Notice>
              {filterPapers(papers, { ...filters, access: 'all' }).length -
                visible.length}{' '}
              records are hidden by your text-access requirement. This does not
              mean relevant research is absent.{' '}
              <button
                type="button"
                className="text-button"
                onClick={() => update({ access: 'all' })}
              >
                Show discovery matches
              </button>
            </Notice>
          ) : null}
          <div className="paper-list">
            {direct.length ? (
              <section className="relevance-group">
                <h3>Directly addresses the question</h3>
                <p className="group-description">
                  Best matches by title and abstract. Inspect the source before
                  treating it as direct evidence.
                </p>
                {direct.map(renderPaper)}
              </section>
            ) : null}
            {background.length ? (
              <details className="relevance-group" open={!direct.length}>
                <summary>
                  Related background or potentially transferable method ·{' '}
                  {background.length}
                </summary>
                <p className="group-description">
                  Useful context or methods; not established as direct evidence
                  for the full question.
                </p>
                {background.map(renderPaper)}
              </details>
            ) : null}
            {unclear.length ? (
              <details
                className="relevance-group"
                open={!direct.length && !background.length}
              >
                <summary>Relevance unclear · {unclear.length}</summary>
                <p className="group-description">
                  Available text does not clearly support all the question's
                  concepts.
                </p>
                {unclear.map(renderPaper)}
              </details>
            ) : null}
          </div>
          {!visible.length ? (
            <p className="panel-footnote">
              {verification.running
                ? 'Article-body checks are still running; no matching retrieved text is ready yet.'
                : !filters.sources.length
                  ? 'Choose at least one collection above.'
                  : filters.access === 'verified'
                    ? 'No imported article body matches this access requirement yet. Relevant research may still be available as abstracts or metadata. Choose Discovery to inspect it, or check more article texts.'
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
            ? 'Review the interpreted concepts or try a focused related phrase. An empty search does not establish that no relevant research exists.'
            : 'Search within your field of interest. Select 2–6 papers for free side-by-side reading.'}
        </Empty>
      ) : null}
      <p className="panel-footnote">
        Coverage varies by source. Use the original paper to check omitted
        material.
      </p>
    </section>
  );
}

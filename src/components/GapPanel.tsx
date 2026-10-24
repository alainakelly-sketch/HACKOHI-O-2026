import { useMemo, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import type { Paper } from '../../shared/types';
import { scanGapLeads } from '../../shared/gaps';
import type { GapLead } from '../../shared/gaps';
import { Busy, Notice } from './Primitives';
export type GapEvidenceScope = 'body' | 'include-abstracts';
/** Make evidence scope explicit; body mode never silently scans an abstract. */
export function gapScanSources(
  papers: Paper[],
  scope: GapEvidenceScope,
): Paper[] {
  if (scope === 'include-abstracts') return papers;
  return papers
    .filter((p) =>
      p.passages.some((x) => x.kind === 'full-text' && x.text.trim()),
    )
    .map((p) => ({
      ...p,
      passages: p.passages.filter((x) => x.kind === 'full-text'),
    }));
}
export function GapPanel({
  papers,
  question,
  field,
  busy,
  onSearch,
  onRetrieve,
  onInspect,
  onPlan,
  onGoPapers,
}: {
  papers: Paper[];
  question: string;
  field: string;
  busy: Set<string>;
  onSearch: (query: string) => void;
  onRetrieve?: () => Promise<void> | void;
  onInspect?: (lead: GapLead) => void;
  onPlan?: (lead: GapLead) => void;
  onGoPapers?: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const [scope, setScope] = useState<GapEvidenceScope>('body');
  const [retrieving, setRetrieving] = useState(false);
  const [retrieveError, setRetrieveError] = useState('');
  const sources = useMemo(() => gapScanSources(papers, scope), [papers, scope]);
  const scan = useMemo(
    () => scanGapLeads(sources, question, field),
    [sources, question, field],
  );
  const bodyCount = papers.filter((p) =>
    p.passages.some((x) => x.kind === 'full-text' && x.text.trim()),
  ).length;
  const loading = papers.some((p) => busy.has(p.id));
  const retrievable = papers.some(
    (p) =>
      !p.passages.some((x) => x.kind === 'full-text' && x.text.trim()) &&
      (p.identifiers?.pmcid || p.identifiers?.arxiv),
  );
  async function retrieve() {
    if (!onRetrieve || retrieving || loading) return;
    setRetrieving(true);
    setRetrieveError('');
    try {
      await onRetrieve();
    } catch {
      setRetrieveError(
        'Selected article text could not be retrieved. Check each paper’s retrieval status in the reader, then retry or open its free copy.',
      );
    } finally {
      setRetrieving(false);
    }
  }
  return (
    <section className="panel gap-panel" id="gaps" aria-labelledby="gap-title">
      <div className="panel-heading">
        <div>
          <h2 id="gap-title">Possible research gap leads</h2>
          <p className="muted">
            Free · based on author-stated issues in selected sources
          </p>
        </div>
        <button className="primary" onClick={() => setOpened((v) => !v)}>
          {opened ? 'Hide gap leads' : 'Find gap leads'}
        </button>
      </div>
      <p className="gap-explainer">
        This free text scan finds explicit phrases about limitations, future
        work, and unresolved questions.{' '}
        {field.trim()
          ? `Your focus in ${field.trim()} helps order the leads.`
          : 'Adding a field or question is optional and helps order the leads.'}{' '}
        It is not scientific synthesis and does not prove an issue remains
        unresolved.
      </p>
      <label className="gap-evidence-filter" htmlFor="gap-evidence-scope">
        Evidence to scan
      </label>
      <select
        id="gap-evidence-scope"
        value={scope}
        onChange={(e) => setScope(e.target.value as GapEvidenceScope)}
        style={{
          maxWidth: '100%',
          width: '100%',
          padding: '9px',
          border: '1px solid #dfe5ef',
          borderRadius: '6px',
          background: '#fff',
          color: '#17213c',
        }}
      >
        <option value="body">Retrieved article body only</option>
        <option value="include-abstracts">
          Include abstracts too — limited evidence
        </option>
      </select>
      {papers.length ? (
        <p className="coverage-summary">
          {papers.length} selected sources · {bodyCount} with readable body text
          · {papers.length - bodyCount} without body text ·{' '}
          {scope === 'body'
            ? 'Abstracts excluded from this scan.'
            : 'Abstract-only evidence is included and labelled.'}
        </p>
      ) : (
        <p className="panel-footnote">
          Select at least one paper to scan its text. You can click Find gap
          leads for step-by-step guidance. No field or AI key is required.
        </p>
      )}
      {!field.trim() && papers.length ? (
        <p className="panel-footnote">
          You can scan now without a field. Add your research focus to help
          order the results.
        </p>
      ) : null}
      {loading || retrieving ? (
        <Notice>
          <Busy>Waiting for article-body retrieval.</Busy> Ready sources can
          already be scanned. An opened scan updates as text arrives.
        </Notice>
      ) : null}
      {scope === 'body' && papers.length > 0 && bodyCount === 0 ? (
        <Notice>
          No retrieved article-body text is available to scan yet.{' '}
          {retrievable
            ? 'Retrieve selected article text first, or explicitly choose “Include abstracts too” for a more limited scan.'
            : 'These records have no imported body text. Open their free-copy links or select a paper with supported in-app retrieval; abstracts are not used automatically.'}
        </Notice>
      ) : null}
      {onRetrieve && retrievable ? (
        <button
          className="secondary"
          onClick={retrieve}
          disabled={retrieving || loading}
        >
          {retrieving ? (
            <Busy>Retrieving article text</Busy>
          ) : (
            'Retrieve selected article text'
          )}
        </button>
      ) : null}
      {retrieveError ? <Notice error>{retrieveError}</Notice> : null}
      {opened && papers.length === 0 ? (
        <Notice>
          <div>
            <strong>Select papers before scanning.</strong>
            <p>
              In Paper selection, check the box beside at least one paper title.
              Wait for its article-body text to arrive, then return here. No gap
              scan has run yet.
            </p>
            <button className="secondary" onClick={onGoPapers}>
              Go to papers
            </button>
          </div>
        </Notice>
      ) : null}
      {opened && papers.length ? (
        <>
          <Notice>{scan.caution}</Notice>
          <p className="gap-summary" role="status">
            {scope === 'body' && !sources.length
              ? 'No article-body scan has run because no readable body text is available. This is not a finding that your field has no gaps.'
              : scan.summary}
          </p>
          <div className="gap-candidates">
            {scan.candidates.map((lead) => {
              const paper = papers.find((p) => p.id === lead.paperId)!;
              return (
                <article className="gap-lead" key={lead.id}>
                  <div className="source-label">
                    {lead.label} ·{' '}
                    {lead.kind === 'full-text'
                      ? 'ARTICLE BODY'
                      : 'ABSTRACT ONLY'}
                  </div>
                  <h3>{paper.title}</h3>
                  <p className="muted">
                    {paper.year ?? 'Year unavailable'} · {lead.section}
                  </p>
                  <blockquote>{lead.signalText}</blockquote>
                  <details>
                    <summary>Inspect complete supporting passage</summary>
                    <blockquote>{lead.quote}</blockquote>
                    <code>{lead.passageId}</code>
                  </details>
                  <a
                    href={
                      lead.kind === 'full-text'
                        ? paper.fullText?.url || paper.url
                        : paper.url
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read original source <ArrowUpRight size={12} />
                  </a>
                  {onInspect ? (
                    <button
                      className="secondary"
                      onClick={() => onInspect(lead)}
                    >
                      Inspect evidence
                    </button>
                  ) : null}
                  {onPlan ? (
                    <button className="primary" onClick={() => onPlan(lead)}>
                      Draft an experiment from this lead
                    </button>
                  ) : null}
                  <h4>Before treating this as a gap</h4>
                  <p>{lead.followUp}</p>
                  <button
                    className="secondary"
                    onClick={() => {
                      onSearch(lead.searchQuery);
                      document.getElementById('papers')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      });
                    }}
                  >
                    <Search size={13} />
                    Search for follow-up work
                  </button>
                  <details className="gap-query">
                    <summary>Search terms</summary>
                    <p>{lead.searchQuery}</p>
                  </details>
                </article>
              );
            })}
          </div>
        </>
      ) : null}
      {!opened ? (
        <p className="panel-footnote">
          Select sources, retrieve article-body text, then scan. The default
          excludes abstracts; you can deliberately include them using the
          evidence filter. No AI key or field is required.
        </p>
      ) : null}
    </section>
  );
}

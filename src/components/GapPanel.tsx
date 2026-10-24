import { useMemo, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import type { Paper } from '../../shared/types';
import { scanGapLeads } from '../../shared/gaps';
import { Busy, Notice } from './Primitives';
export function GapPanel({
  papers,
  question,
  field,
  busy,
  onSearch,
}: {
  papers: Paper[];
  question: string;
  field: string;
  busy: Set<string>;
  onSearch: (query: string) => void;
}) {
  const [opened, setOpened] = useState(false);
  const scan = useMemo(
    () => scanGapLeads(papers, question, field),
    [papers, question, field],
  );
  const loading = papers.some((p) => busy.has(p.id));
  return (
    <section className="panel gap-panel" id="gaps" aria-labelledby="gap-title">
      <div className="panel-heading">
        <div>
          <h2 id="gap-title">Possible research gap leads</h2>
          <p className="muted">
            Free · based on author-stated issues in selected sources
          </p>
        </div>
        <button
          className="primary"
          disabled={!papers.length || !field.trim()}
          onClick={() => setOpened((v) => !v)}
        >
          {opened ? 'Hide gap leads' : 'Find gap leads'}
        </button>
      </div>
      <p className="gap-explainer">
        Your question sets the focus. This scan surfaces explicit limitations,
        future work, and unresolved questions to investigate within{' '}
        {field.trim() || 'your field'}. It does not prove that later research
        has not addressed them.
      </p>
      {loading ? (
        <Notice>
          <Busy>Supported article text is still arriving.</Busy> Leads update
          when more text becomes available.
        </Notice>
      ) : null}
      {opened && papers.length ? (
        <>
          <p className="coverage-summary">
            {scan.coverage.paperCount} selected sources ·{' '}
            {scan.coverage.fullTextPapers} with body text ·{' '}
            {scan.coverage.abstractOnlyPapers} abstract-only ·{' '}
            {scan.coverage.metadataOnlyPapers} metadata-only
          </p>
          <Notice>{scan.caution}</Notice>
          <p className="gap-summary" role="status">
            {scan.summary}
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
          Select sources, retrieve body text when possible, then scan.
          Abstract-only leads are clearly marked. No AI key or second field is
          needed.
        </p>
      ) : null}
    </section>
  );
}

import { useMemo, useRef, useState } from 'react';
import type { Citation, Paper } from '../../shared/types';
import { buildDiscoveryReport } from '../../shared/discovery';
import type { DiscoveryEvidence } from '../../shared/discovery';
import { buildConceptOverlap } from '../../shared/concept-overlap';
import { scanGapLeads } from '../../shared/gaps';
import type { GapLead } from '../../shared/gaps';
import { Notice } from './Primitives';
import './concept-map.css';

export type DiscoveryLead = {
  id: string;
  title: string;
  question: string;
  reason: string;
  sources: Citation[];
  searchQuery: string;
};
type Choice = {
  kind: 'theme' | 'overlap' | 'conflict' | 'gap';
  id: string;
  branchId: string;
};
const contextLabels = {
  population: 'Population',
  dataset: 'Dataset / conditions',
  method: 'Method',
  metric: 'Measure',
};
function words(text: string) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map((word) =>
    word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word,
  );
}

export function DiscoveryPanel({
  papers,
  focus,
  gapLeads,
  onInspect,
  onPlan,
  onHypothesis,
}: {
  papers: Paper[];
  focus: { question: string; field: string };
  /** Shared IDs/records from the independently readable research-gap results. */
  gapLeads?: GapLead[];
  onInspect: (citation: Citation, label?: string) => void;
  onPlan: (lead: DiscoveryLead) => void;
  onHypothesis: (lead: DiscoveryLead) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [chosen, setChosen] = useState<Choice | null>(null);
  const [compact, setCompact] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const leafButton = useRef<HTMLButtonElement | null>(null);
  const concepts = useMemo(
    () => buildConceptOverlap(papers, focus.question, focus.field),
    [papers, focus.question, focus.field],
  );
  const discovery = useMemo(() => buildDiscoveryReport(papers), [papers]);
  const fallbackGaps = useMemo(
    () =>
      scanGapLeads(
        papers.map((paper) => ({
          ...paper,
          passages: paper.passages.filter(
            (passage) => passage.kind === 'full-text',
          ),
        })),
        focus.question,
        focus.field,
      ).candidates,
    [papers, focus.question, focus.field],
  );
  const gaps = gapLeads ?? fallbackGaps;
  const overlaps = concepts.overlaps.filter((item) => item.kind === 'overlap');
  const theme =
    chosen?.kind === 'theme'
      ? concepts.themes.find((item) => item.id === chosen.id)
      : undefined;
  const overlap =
    chosen?.kind === 'overlap'
      ? overlaps.find((item) => item.id === chosen.id)
      : undefined;
  const conflict =
    chosen?.kind === 'conflict'
      ? discovery.tensions.find((item) => item.id === chosen.id)
      : undefined;
  const gap =
    chosen?.kind === 'gap'
      ? gaps.find((item) => item.id === chosen.id)
      : undefined;
  const evidence: DiscoveryEvidence[] =
    theme?.evidence ??
    overlap?.evidence ??
    conflict?.claims ??
    (gap
      ? [
          {
            reference: { paperId: gap.paperId, passageId: gap.passageId },
            quote: gap.signalText,
            kind: gap.kind,
            section: gap.section,
          },
        ]
      : []);
  const title =
    theme?.label ?? overlap?.label ?? conflict?.label ?? gap?.label ?? '';
  const known =
    overlap?.known ??
    (theme
      ? `These selected sources mention ${theme.label}. Their exact statements and reported study contexts are below. Shared wording alone does not establish agreement.`
      : gap
        ? 'The cited author explicitly states a limitation, unresolved issue or future-work direction.'
        : 'The screen paired differently worded reported findings about the same measure; their study contexts may differ.');
  const missing =
    theme?.missing ??
    overlap?.missing ??
    (gap
      ? 'Whether later work has addressed this issue, and whether it applies to your question, remain to be checked.'
      : 'Whether population, data or method differences explain these findings remains uncertain.');
  const rationale =
    overlap?.rationale ??
    gap?.followUp ??
    (theme
      ? 'Compare the supporting source statements and their contexts before narrowing a follow-up question. A recurring theme is not itself a research gap.'
      : (conflict?.followUp ?? ''));
  const question =
    theme?.question ??
    overlap?.question ??
    (gap
      ? `What small study could investigate this author-stated issue: ${gap.signalText}`
      : conflict
        ? `What could explain the different reported findings about ${conflict.topic}?`
        : '');
  const lead: DiscoveryLead | null =
    title && evidence.length
      ? {
          id: gap?.id ?? conflict?.id ?? chosen?.id ?? '',
          title,
          question,
          reason: `${rationale}\n${missing}`,
          sources: Array.from(
            new Map(
              evidence.map((item) => [
                `${item.reference.paperId}:${item.reference.passageId}`,
                item.reference,
              ]),
            ).values(),
          ),
          searchQuery: gap?.searchQuery ?? conflict?.searchQuery ?? title,
        }
      : null;
  const paperIds = new Set(evidence.map((item) => item.reference.paperId));
  // Deriving current records above prevents removed/changed source content from
  // leaving cached quotations in the drawer. Branch expansion is display state.
  function toggleTheme(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (chosen?.branchId === id) setChosen(null);
  }
  function choose(choice: Choice, button: HTMLButtonElement) {
    leafButton.current = button;
    setChosen((current) =>
      current?.id === choice.id &&
      current.branchId === choice.branchId &&
      current.kind === choice.kind
        ? null
        : choice,
    );
  }
  function closeDetails() {
    setChosen(null);
    leafButton.current?.focus({ preventScroll: true });
  }
  function renderEvidence(item: DiscoveryEvidence) {
    const paper = papers.find((source) => source.id === item.reference.paperId);
    return (
      <article
        className="concept-source"
        key={`${item.reference.paperId}:${item.reference.passageId}:${item.quote}`}
        data-paper-id={item.reference.paperId}
        data-passage-id={item.reference.passageId}
      >
        <a href={paper?.url} target="_blank" rel="noreferrer">
          {paper?.title ?? 'Source unavailable'}
        </a>
        <span className="concept-eyebrow">
          {item.kind === 'full-text' ? 'Article-body passage' : 'Abstract only'}{' '}
          · {item.section}
        </span>
        <blockquote>{item.quote}</blockquote>
        <button
          type="button"
          className="text-button"
          onClick={() => onInspect(item.reference, title)}
        >
          Inspect complete source passage
        </button>
      </article>
    );
  }
  function drawer(branchId: string) {
    if (!lead || chosen?.branchId !== branchId) return null;
    return (
      <section
        className="concept-details"
        aria-label="Concept details"
        data-gap-id={gap?.id}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            closeDetails();
          }
        }}
      >
        <div className="concept-detail-heading">
          <div>
            <span className="concept-eyebrow">
              {gap
                ? 'Author-stated issue · not a confirmed field-wide gap'
                : conflict
                  ? 'Possible finding difference · requires review'
                  : theme
                    ? 'Source-supported theme'
                    : 'Co-mentioned themes · interpretation requires review'}
            </span>
            <h3>{title}</h3>
          </div>
          <button type="button" className="text-button" onClick={closeDetails}>
            Close details
          </button>
        </div>
        <div className="concept-findings">
          <div>
            <h4>What is known</h4>
            <p>{known}</p>
          </div>
          <div>
            <h4>What is missing</h4>
            <p>{missing}</p>
          </div>
        </div>
        <details className="concept-why">
          <summary>What overlaps or differs</summary>
          <p>
            {overlap
              ? 'Both theme terms occur in the same cited sentences. This establishes co-mention only, not a causal or tested relationship.'
              : conflict
                ? 'Directional finding statements differ. Study population, data or methodology may explain the difference; this is not a confirmed contradiction.'
                : theme
                  ? 'The sources share this theme. Inspect the source statements and study contexts below to distinguish similar wording from comparable methods or findings.'
                  : 'This issue is stated in the cited source. It is not automatically shared by other papers or unanswered in the wider literature.'}
          </p>
          {!gap ? (
            <div className="concept-contexts">
              {discovery.profiles
                .filter((profile) => paperIds.has(profile.paperId))
                .map((profile) => (
                  <details key={profile.paperId}>
                    <summary>
                      {papers.find((paper) => paper.id === profile.paperId)
                        ?.title ?? profile.paperId}
                    </summary>
                    {(
                      Object.keys(
                        contextLabels,
                      ) as (keyof typeof contextLabels)[]
                    ).map((field) => (
                      <div key={field}>
                        <h4>{contextLabels[field]}</h4>
                        {profile.fields[field] ? (
                          renderEvidence(profile.fields[field]!)
                        ) : (
                          <p className="muted">
                            Not identified in retrieved text.
                          </p>
                        )}
                      </div>
                    ))}
                  </details>
                ))}
            </div>
          ) : null}
        </details>
        <details className="concept-why">
          <summary>Why investigate this</summary>
          <p>{rationale}</p>
          <p>
            Check related prior work before calling this a gap. These selected
            excerpts cannot establish novelty.
          </p>
        </details>
        <div className="concept-question">
          <span className="concept-eyebrow">
            Follow-up question · untested proposal
          </span>
          <p>{question}</p>
        </div>
        <div className="concept-actions">
          <button
            type="button"
            className="primary"
            onClick={() => onHypothesis(lead)}
          >
            Develop into a hypothesis
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => onPlan(lead)}
          >
            Draft a test without AI
          </button>
        </div>
        <p className="concept-scope">
          Opening the hypothesis step is free. Generating an AI result requires
          a separate click.
        </p>
        <details
          className="concept-evidence"
          key={`${lead.id}:${chosen.branchId}`}
        >
          <summary>
            Supporting papers & passages · {paperIds.size}{' '}
            {paperIds.size === 1 ? 'paper' : 'papers'}
          </summary>
          {evidence.map(renderEvidence)}
        </details>
      </section>
    );
  }
  return (
    <details className="panel concept-panel explore-connections">
      <summary className="explore-connections-title">
        Explore connections <span>Optional expandable map</span>
      </summary>
      <div className="concept-map-content">
        <div className="panel-heading">
          <div>
            <h2 id="discovery-title">Theme overlap map</h2>
            <p className="muted">
              Expand a theme, then a comparison. Research gap results remain
              available below.
            </p>
          </div>
        </div>
        {!papers.length ? (
          <Notice>Select papers in Search to explore their connections.</Notice>
        ) : (
          <>
            {concepts.weakWarning ? (
              <div className="concept-fit-warning" role="status">
                <strong>
                  These papers may not strongly match your question.
                </strong>
                <p>
                  Several sources have few matching question terms. Review paper
                  fit before developing a hypothesis.
                </p>
              </div>
            ) : null}
            <div className="concept-map-controls">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setExpanded(new Set());
                  setChosen(null);
                }}
              >
                Collapse all
              </button>
              <button
                type="button"
                className="secondary"
                aria-pressed={compact}
                onClick={() => {
                  setCompact((current) => !current);
                  viewport.current?.scrollTo({
                    top: 0,
                    left: 0,
                    behavior: 'auto',
                  });
                }}
              >
                {compact ? 'Restore spacing' : 'Fit map'}
              </button>
              <span>Expand/collapse is local and free.</span>
            </div>
            <div
              className={`concept-map-viewport ${compact ? 'compact-map' : ''}`}
              ref={viewport}
            >
              <div
                className="concept-board"
                aria-label="Themes and their connections"
              >
                <article className="concept-focus">
                  <span className="concept-eyebrow">Your research focus</span>
                  <h3>
                    {focus.question ||
                      focus.field ||
                      'Add a research question to assess fit'}
                  </h3>
                </article>
                <div className="concept-branches">
                  {concepts.themes.map((item, index) => {
                    const open = expanded.has(item.id);
                    const relatedOverlaps = overlaps.filter(
                      (overlapItem) =>
                        overlapItem.leftId === item.id ||
                        overlapItem.rightId === item.id,
                    );
                    const relatedGaps = gaps.filter((gapItem) =>
                      words(item.label).every((word) =>
                        words(gapItem.signalText).includes(word),
                      ),
                    );
                    return (
                      <article
                        className={`concept-branch ${open ? 'expanded' : ''}`}
                        key={item.id}
                      >
                        <button
                          type="button"
                          className="concept-node theme-node"
                          aria-label={`Explore theme: ${item.label}`}
                          aria-expanded={open}
                          aria-controls={`branch-${item.id}`}
                          onClick={() => toggleTheme(item.id)}
                        >
                          <span className="concept-eyebrow">
                            Theme {index + 1}
                          </span>
                          <strong>{item.label}</strong>
                          <span>
                            {item.paperIds.length}{' '}
                            {item.paperIds.length === 1 ? 'paper' : 'papers'}{' '}
                            <b className="concept-toggle" aria-hidden="true">
                              {open ? '−' : '+'}
                            </b>
                          </span>
                        </button>
                        <div
                          className="concept-children"
                          id={`branch-${item.id}`}
                          hidden={!open}
                        >
                          <button
                            type="button"
                            className="concept-node concept-leaf source-comparison"
                            aria-expanded={
                              chosen?.kind === 'theme' &&
                              chosen.id === item.id &&
                              chosen.branchId === item.id
                            }
                            onClick={(event) =>
                              choose(
                                {
                                  kind: 'theme',
                                  id: item.id,
                                  branchId: item.id,
                                },
                                event.currentTarget,
                              )
                            }
                          >
                            <span className="concept-eyebrow">
                              {item.paperIds.length > 1
                                ? 'Compare source statements'
                                : 'Source statements'}
                            </span>
                            <strong>
                              {item.paperIds.length > 1
                                ? `How sources describe ${item.label}`
                                : `What the source says about ${item.label}`}
                            </strong>
                            <span>
                              Statements, study contexts & uncertainty
                            </span>
                          </button>
                          {chosen?.kind === 'theme' && drawer(item.id)}
                          {relatedOverlaps.map((overlapItem) => (
                            <div key={overlapItem.id}>
                              <button
                                type="button"
                                className="concept-node concept-leaf overlap-node"
                                aria-label={`Explore overlap: ${overlapItem.label}`}
                                aria-expanded={
                                  chosen?.kind === 'overlap' &&
                                  chosen.id === overlapItem.id &&
                                  chosen.branchId === item.id
                                }
                                onClick={(event) =>
                                  choose(
                                    {
                                      kind: 'overlap',
                                      id: overlapItem.id,
                                      branchId: item.id,
                                    },
                                    event.currentTarget,
                                  )
                                }
                              >
                                <span className="concept-eyebrow">
                                  Co-mentioned in source text
                                </span>
                                <strong>{overlapItem.label}</strong>
                                <span>Explore overlap & evidence</span>
                              </button>
                              {chosen?.kind === 'overlap' &&
                                chosen.id === overlapItem.id &&
                                drawer(item.id)}
                            </div>
                          ))}
                          {relatedGaps.map((gapItem) => (
                            <div key={gapItem.id}>
                              <button
                                type="button"
                                className="concept-node concept-leaf gap-node"
                                data-gap-id={gapItem.id}
                                data-paper-id={gapItem.paperId}
                                data-passage-id={gapItem.passageId}
                                aria-label={`Explore gap lead: ${gapItem.signalText.slice(0, 90)}`}
                                aria-expanded={
                                  chosen?.kind === 'gap' &&
                                  chosen.id === gapItem.id &&
                                  chosen.branchId === item.id
                                }
                                onClick={(event) =>
                                  choose(
                                    {
                                      kind: 'gap',
                                      id: gapItem.id,
                                      branchId: item.id,
                                    },
                                    event.currentTarget,
                                  )
                                }
                              >
                                <span className="concept-eyebrow">
                                  Author-stated issue
                                </span>
                                <strong>
                                  {gapItem.signalText.slice(0, 110)}
                                  {gapItem.signalText.length > 110 ? '…' : ''}
                                </strong>
                                <span>Same lead as the research-gap list</span>
                              </button>
                              {chosen?.kind === 'gap' &&
                                chosen.id === gapItem.id &&
                                drawer(item.id)}
                            </div>
                          ))}
                          {!relatedOverlaps.length && !relatedGaps.length ? (
                            <p className="concept-branch-empty">
                              No shared-theme comparison or author-stated issue
                              was identified for this branch. Source statements
                              remain available above.
                            </p>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
                {!concepts.themes.length ? (
                  <Notice>
                    No reliable shared themes were identified in the screened
                    text. Review paper fit or choose more closely related
                    sources.
                  </Notice>
                ) : null}
                {discovery.tensions.length > 0 ? (
                  <div className="concept-conflicts">
                    <h3>Conflicts to review</h3>
                    <p className="concept-scope">
                      Possible differences in reported findings, not confirmed
                      contradictions.
                    </p>
                    {discovery.tensions.map((item) => (
                      <div key={item.id}>
                        <button
                          type="button"
                          className="concept-node concept-conflict-node"
                          aria-expanded={
                            chosen?.kind === 'conflict' && chosen.id === item.id
                          }
                          onClick={(event) =>
                            choose(
                              {
                                kind: 'conflict',
                                id: item.id,
                                branchId: 'conflicts',
                              },
                              event.currentTarget,
                            )
                          }
                        >
                          {item.label}
                        </button>
                        {chosen?.kind === 'conflict' &&
                          chosen.id === item.id &&
                          drawer('conflicts')}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <p className="concept-scope">
              Lines group source-supported themes and their children; co-mention
              is not proof of a tested relationship. No gaps are invented to
              fill empty branches.
            </p>
            <details className="concept-paper-fits">
              <summary>
                Selected papers & question fit · {papers.length}
              </summary>
              <p className="concept-scope">
                Lexical matching aids only, not scientific relevance or quality
                ratings.
              </p>
              {papers.map((paper) => {
                const fit = concepts.fits.find(
                  (item) => item.paperId === paper.id,
                );
                return (
                  <article className="concept-paper-fit" key={paper.id}>
                    <div>
                      <a href={paper.url} target="_blank" rel="noreferrer">
                        {paper.title}
                      </a>
                      <span className="muted">
                        {paper.year ?? 'Year unavailable'} · {paper.coverage}
                      </span>
                    </div>
                    <details>
                      <summary>
                        <span
                          className={`fit-badge fit-${fit?.label.split(' ')[0].toLowerCase()}`}
                        >
                          {fit?.label ?? 'Weak fit'}
                        </span>
                        <span className="sr-only">
                          {' '}
                          — explain fit for {paper.title}
                        </span>
                      </summary>
                      <p>{fit?.reason}</p>
                      {fit?.matchedTerms.length ? (
                        <p>Matched: {fit.matchedTerms.join(', ')}</p>
                      ) : null}
                      {fit?.missingTerms.length ? (
                        <p>Not matched: {fit.missingTerms.join(', ')}</p>
                      ) : null}
                    </details>
                  </article>
                );
              })}
            </details>
            <details className="concept-method">
              <summary>How to read this map</summary>
              <ul>
                <li>
                  Themes come from retrieved text, with fewer nodes when
                  evidence is sparse. Only sentence-supported overlaps appear.
                </li>
                <li>
                  Shared terms do not prove causal relationships, equivalent
                  methods or scientific agreement. Different wording is not
                  automatically a contradiction.
                </li>
                <li>
                  Theme screening uses up to 30,000 characters per paper, the
                  first 150 eligible passages and the first 80 sentences per
                  passage. Body text is preferred over abstracts.
                </li>
                <li>
                  Author-stated gap nodes reuse the same IDs and passages as the
                  separate Research gap leads section. Absence in selected
                  excerpts is not a field-wide gap.
                </li>
              </ul>
            </details>
          </>
        )}
      </div>
    </details>
  );
}

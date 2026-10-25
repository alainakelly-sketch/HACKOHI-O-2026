import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Citation, Paper } from '../../shared/types';
import { buildDiscoveryReport } from '../../shared/discovery';
import type { DiscoveryEvidence } from '../../shared/discovery';
import { buildConceptOverlap } from '../../shared/concept-overlap';
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
type ConceptReport = ReturnType<typeof buildConceptOverlap>;
type Choice = { kind: 'theme' | 'overlap' | 'conflict'; id: string };
type Edge = {
  id: string;
  path: string;
  active: boolean;
  contextual: boolean;
  speculative: boolean;
};

function ConceptBoard({
  report,
  question,
  chosen,
  onChoose,
}: {
  report: ConceptReport;
  question: string;
  chosen: Choice | null;
  onChoose: (choice: Choice) => void;
}) {
  const board = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<{
    width: number;
    height: number;
    edges: Edge[];
  }>({ width: 1, height: 1, edges: [] });
  useLayoutEffect(() => {
    const element = board.current;
    if (!element) return;
    let frame = 0;
    function measure() {
      if (!element) return;
      const bounds = element.getBoundingClientRect();
      const nodes = new Map(
        Array.from(
          element.querySelectorAll<HTMLElement>('[data-map-node]'),
        ).map((node) => [node.dataset.mapNode!, node.getBoundingClientRect()]),
      );
      const connections = [
        ...report.themes.map((theme) => ({
          from: 'focus',
          to: theme.id,
          contextual: true,
          speculative: false,
        })),
        ...report.overlaps.flatMap((overlap) =>
          [overlap.leftId, overlap.rightId].map((id) => ({
            from: overlap.id,
            to: id,
            contextual: false,
            speculative: overlap.kind === 'missing-bridge',
          })),
        ),
      ];
      const selectedOverlap = report.overlaps.find(
        (item) => chosen?.kind === 'overlap' && item.id === chosen.id,
      );
      const edges = connections.flatMap((connection) => {
        const from = nodes.get(connection.from),
          to = nodes.get(connection.to);
        if (!from || !to) return [];
        const right = to.x > from.x;
        const x1 = (right ? from.right : from.left) - bounds.left;
        const x2 = (right ? to.left : to.right) - bounds.left;
        const y1 = from.top + from.height / 2 - bounds.top;
        const y2 = to.top + to.height / 2 - bounds.top;
        const bend = (x2 - x1) / 2;
        return [
          {
            id: `${connection.from}:${connection.to}`,
            path: `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`,
            contextual: connection.contextual,
            speculative: connection.speculative,
            active:
              (!connection.contextual &&
                (chosen?.id === connection.from ||
                  chosen?.id === connection.to)) ||
              (connection.contextual &&
                (chosen?.id === connection.to ||
                  selectedOverlap?.leftId === connection.to ||
                  selectedOverlap?.rightId === connection.to)),
          },
        ];
      });
      setDrawing({ width: bounds.width, height: bounds.height, edges });
    }
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    resize.observe(element);
    element
      .querySelectorAll('[data-map-node]')
      .forEach((node) => resize.observe(node));
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, [report, chosen]);
  const linked = new Set(
    report.overlaps.find((item) => item.id === chosen?.id)
      ? [
          report.overlaps.find((item) => item.id === chosen?.id)!.leftId,
          report.overlaps.find((item) => item.id === chosen?.id)!.rightId,
        ]
      : [],
  );
  const themeNode = (theme: ConceptReport['themes'][number], index: number) => (
    <button
      type="button"
      key={theme.id}
      data-map-node={theme.id}
      aria-label={`Explore theme: ${theme.label}`}
      aria-pressed={chosen?.kind === 'theme' && chosen.id === theme.id}
      className={`concept-node theme-node ${linked.has(theme.id) ? 'connected' : ''}`}
      onClick={() => onChoose({ kind: 'theme', id: theme.id })}
    >
      <span className="concept-eyebrow">Theme {index + 1}</span>
      <strong>{theme.label}</strong>
      <span>
        {theme.paperIds.length}{' '}
        {theme.paperIds.length === 1 ? 'paper' : 'papers'} · View evidence
      </span>
    </button>
  );
  return (
    <div
      className="concept-board"
      ref={board}
      aria-label="Themes and their connections"
    >
      <svg
        className="concept-connectors"
        viewBox={`0 0 ${drawing.width} ${drawing.height}`}
        aria-hidden="true"
      >
        {drawing.edges.map((edge) => (
          <path
            key={edge.id}
            d={edge.path}
            className={`${edge.contextual ? 'context-edge' : 'overlap-edge'} ${edge.speculative ? 'speculative-edge' : ''} ${edge.active ? 'selected-edge' : ''}`}
          />
        ))}
      </svg>
      <div className="theme-stack theme-stack-left">
        {report.themes
          .filter((_, i) => i % 2 === 0)
          .map((theme) => themeNode(theme, report.themes.indexOf(theme)))}
      </div>
      <div className="concept-center">
        <article className="concept-focus" data-map-node="focus">
          <span className="concept-eyebrow">Your research question</span>
          <h3>{question || 'Add a research question to assess fit'}</h3>
        </article>
        {report.overlaps.length > 0 ? (
          <div className="overlap-stack">
            <span className="concept-eyebrow">Between these themes</span>
            {report.overlaps.map((overlap) => (
              <button
                type="button"
                key={overlap.id}
                data-map-node={overlap.id}
                aria-label={`Explore overlap: ${overlap.label}`}
                aria-pressed={
                  chosen?.kind === 'overlap' && chosen.id === overlap.id
                }
                className={`concept-node overlap-node ${overlap.kind}`}
                onClick={() => onChoose({ kind: 'overlap', id: overlap.id })}
              >
                <span className="concept-eyebrow">
                  {overlap.kind === 'overlap'
                    ? 'Co-mentioned in source text'
                    : 'Bridge to investigate'}
                </span>
                <strong>{overlap.label}</strong>
                <span>
                  {overlap.kind === 'overlap'
                    ? 'What connects them?'
                    : 'No shared sentence identified'}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="theme-stack theme-stack-right">
        {report.themes
          .filter((_, i) => i % 2 === 1)
          .map((theme) => themeNode(theme, report.themes.indexOf(theme)))}
      </div>
    </div>
  );
}

export function DiscoveryPanel({
  papers,
  focus,
  onInspect,
  onPlan,
  onHypothesis,
}: {
  papers: Paper[];
  focus: { question: string; field: string };
  onInspect: (citation: Citation, label?: string) => void;
  onPlan: (lead: DiscoveryLead) => void;
  onHypothesis: (lead: DiscoveryLead) => void;
}) {
  const [chosen, setChosen] = useState<Choice | null>(null);
  const details = useRef<HTMLElement>(null);
  const concepts = useMemo(
    () => buildConceptOverlap(papers, focus.question, focus.field),
    [papers, focus.question, focus.field],
  );
  const discovery = useMemo(() => buildDiscoveryReport(papers), [papers]);
  const theme =
    chosen?.kind === 'theme'
      ? concepts.themes.find((item) => item.id === chosen.id)
      : undefined;
  const overlap =
    chosen?.kind === 'overlap'
      ? concepts.overlaps.find((item) => item.id === chosen.id)
      : undefined;
  const conflict =
    chosen?.kind === 'conflict'
      ? discovery.tensions.find((item) => item.id === chosen.id)
      : undefined;
  const evidence =
    theme?.evidence ?? overlap?.evidence ?? conflict?.claims ?? [];
  const title = theme?.label ?? overlap?.label ?? conflict?.label ?? '';
  const paperIds = new Set(evidence.map((item) => item.reference.paperId));
  const known =
    overlap?.known ??
    (theme
      ? `This theme occurs in ${theme.paperIds.length} selected ${theme.paperIds.length === 1 ? 'paper' : 'papers'}. The passages below show what those sources state; a shared term alone does not establish agreement.`
      : 'The scan paired differently worded reported findings about the same measure. Their study contexts may differ.');
  const missing =
    theme?.missing ??
    overlap?.missing ??
    'Whether population, data or method differences explain these findings remains to be checked.';
  const rationale =
    overlap?.rationale ??
    (theme
      ? 'Use the grouped source statements to choose a question worth checking. Mentioning a theme does not establish an unanswered research question.'
      : (conflict?.followUp ?? ''));
  const question =
    theme?.question ??
    overlap?.question ??
    (conflict
      ? `What could explain the different reported findings about ${conflict.topic}?`
      : '');
  const lead: DiscoveryLead | null =
    title && evidence.length
      ? {
          id: `concept:${chosen?.id}`,
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
          searchQuery: title,
        }
      : null;
  function choose(choice: Choice) {
    setChosen(choice);
    // Keep keyboard focus on the selected node; move only the viewport.
    requestAnimationFrame(() =>
      details.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
    );
  }
  function renderEvidence(item: DiscoveryEvidence) {
    const paper = papers.find((source) => source.id === item.reference.paperId);
    return (
      <article
        className="concept-source"
        key={`${item.reference.paperId}:${item.reference.passageId}:${item.quote}`}
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
  return (
    <section className="panel concept-panel" aria-labelledby="discovery-title">
      <div className="panel-heading">
        <div>
          <h2 id="discovery-title">Theme overlap map</h2>
          <p className="muted">
            Follow a theme to its sources. Explore an overlap before proposing a
            gap.
          </p>
        </div>
      </div>
      {!papers.length ? (
        <Notice>Select papers in Search to build your map.</Notice>
      ) : (
        <>
          {concepts.weakWarning ? (
            <div className="concept-fit-warning" role="status">
              <strong>
                These papers may not strongly match your question.
              </strong>
              <p>
                Several papers have few matching question terms. Review their
                fit below or return to Search before developing a hypothesis.
              </p>
            </div>
          ) : null}
          <div className="concept-legend">
            <span>
              <i className="legend-theme" />
              Theme from source text
            </span>
            <span>
              <i className="legend-overlap" />
              Co-mentioned themes
            </span>
            <span>
              <i className="legend-bridge" />
              Connection to investigate
            </span>
          </div>
          {concepts.themes.length ? (
            <ConceptBoard
              report={concepts}
              question={focus.question || focus.field}
              chosen={chosen}
              onChoose={choose}
            />
          ) : (
            <div className="concept-empty-map">
              <article className="concept-focus">
                <span className="concept-eyebrow">Your research question</span>
                <h3>
                  {focus.question ||
                    focus.field ||
                    'Add a research question to assess fit'}
                </h3>
              </article>
              <Notice>
                No reliable shared themes were identified in the screened text.
                Review paper fit below or select more closely related sources
                with abstracts or article text.
              </Notice>
            </div>
          )}
          <p className="concept-scope">
            Text-based map of selected passages, not a scientific relationship
            graph. A missing bridge is not proof of a research gap.
          </p>
          {lead ? (
            <section
              className="concept-details"
              aria-label="Concept details"
              ref={details}
            >
              <div className="concept-detail-heading">
                <div>
                  <span className="concept-eyebrow">
                    {theme
                      ? 'Theme'
                      : overlap?.kind === 'missing-bridge'
                        ? 'Possible missing bridge'
                        : conflict
                          ? 'Possible conflict · requires context review'
                          : 'Theme overlap'}
                  </span>
                  <h3>{title}</h3>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setChosen(null)}
                >
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
                <summary>Why investigate this</summary>
                <p>{rationale}</p>
                <p>
                  Check related prior work before calling this a gap; these
                  selected excerpts cannot establish novelty.
                </p>
              </details>
              <div className="concept-question">
                <span className="concept-eyebrow">
                  Question to develop · untested
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
                Opening the hypothesis step is free. AI generation requires a
                separate click.
              </p>
              <details className="concept-evidence" key={lead.id}>
                <summary>
                  Supporting papers & passages · {paperIds.size}{' '}
                  {paperIds.size === 1 ? 'paper' : 'papers'}
                </summary>
                {evidence.map(renderEvidence)}
              </details>
            </section>
          ) : concepts.themes.length ? (
            <p className="concept-selection-hint">
              Select a theme or overlap to see what supports it and what remains
              unknown.
            </p>
          ) : null}
          {discovery.tensions.length > 0 ? (
            <details className="concept-conflicts">
              <summary>
                Conflicts to review · {discovery.tensions.length}
              </summary>
              <p className="muted">
                Possible differences in reported findings, not confirmed
                contradictions.
              </p>
              {discovery.tensions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="concept-conflict-node"
                  onClick={() => choose({ kind: 'conflict', id: item.id })}
                >
                  {item.label}
                </button>
              ))}
            </details>
          ) : null}
          <details className="concept-paper-fits" open>
            <summary>Selected papers & question fit · {papers.length}</summary>
            <p className="concept-scope">
              Fit estimates question-word coverage in titles and retrieved
              passages. They do not assess study quality, semantic relevance or
              feasibility.
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
                Themes are recurring words or phrases extracted locally from
                retrieved text. Fewer than three may appear when evidence is
                sparse.
              </li>
              <li>
                Solid connectors link a theme pair to sentences that mention
                both. Co-mention does not prove a causal relationship or
                agreement.
              </li>
              <li>
                Dashed bridge cards mark pairs without an identified shared
                sentence. Cross-sentence relationships, the full papers or wider
                literature may connect them.
              </li>
              <li>
                Screening uses up to 30,000 characters per paper, the first 150
                eligible passages and the first 80 sentences per passage.
                Article-body text is preferred over abstracts. Dotted
                question-to-theme connectors organize the map; they do not
                certify relevance.
              </li>
              <li>
                Related limitation statements are grouped under themes.
                Abstracts stay labeled; figures, tables and supplements may be
                missing.
              </li>
            </ul>
          </details>
        </>
      )}
    </section>
  );
}

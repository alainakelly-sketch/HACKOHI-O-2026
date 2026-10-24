import { useEffect, useRef, useState } from 'react';
import {
  CircleHelp,
  FileText,
  GitBranch,
  FlaskConical,
  Info,
  ArrowUpRight,
  Columns2,
} from 'lucide-react';
import type {
  Analysis,
  Brief,
  Fit,
  Health,
  Paper,
  PriorWork,
  Resources,
  SearchResult,
  SearchSourceStatus,
  Citation,
} from '../shared/types';
import {
  assessResources,
  assessmentIsCurrent,
  emptyResources,
} from '../shared/resources';
import { api } from './lib/api';
import { BridgeMark, Notice } from './components/Primitives';
import { BriefForm } from './components/BriefForm';
import { PaperPanel } from './components/PaperPanel';
import { ConnectionPanel } from './components/ConnectionPanel';
import type { EvidenceInspection } from './components/EvidencePanel';
import type { GapLead } from '../shared/gaps';
import {
  defaultFilter,
  filterPapers,
  hasArticleBody,
} from '../shared/paper-filters';
import type { PaperFilters } from '../shared/paper-filters';
import { EvidencePanel } from './components/EvidencePanel';
import { ComparisonPanel } from './components/ComparisonPanel';
import { GapPanel } from './components/GapPanel';
import { buildResearchQuery } from '../shared/research-query';
import { canLoadFullText } from '../shared/comparison';
import { ExperimentPanel } from './components/ExperimentPanel';
const nav = [
  { id: 'question', label: 'Focus', icon: CircleHelp },
  { id: 'papers', label: 'Papers', icon: FileText },
  { id: 'comparison', label: 'Compare', icon: Columns2 },
  { id: 'gaps', label: 'Gap leads', icon: CircleHelp },
  { id: 'connections', label: 'AI gaps', icon: GitBranch },
  { id: 'experiment', label: 'Experiment', icon: FlaskConical },
];
export default function App() {
  const [exampleMode] = useState(
    () =>
      new URLSearchParams(window.location.search).get('example') ===
      'network-ecology',
  );
  const [exampleError, setExampleError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<PaperFilters>(() => ({
    ...defaultFilter,
    sources: [...defaultFilter.sources],
  }));
  const [verification, setVerification] = useState({
    running: false,
    checked: 0,
    total: 0,
  });
  const verificationRun = useRef(0);
  const [inspection, setInspection] = useState<EvidenceInspection | null>(null);
  const selectedIds = useRef(new Set<string>());
  const textPending = useRef(new Map<string, Promise<void>>());
  const [brief, setBrief] = useState<Brief>({
    question: '',
    field: '',
    resources: { ...emptyResources },
  });
  const [papers, setPapers] = useState<Paper[]>([]),
    [selected, setSelected] = useState<Paper[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<SearchSourceStatus[]>(
    [],
  );
  const [textBusy, setTextBusy] = useState<Set<string>>(new Set());
  const [textErrors, setTextErrors] = useState<Record<string, string>>({});
  const textControllers = useRef(new Map<string, AbortController>());
  const [health, setHealth] = useState<Health | null>(null);
  const [searchBusy, setSearchBusy] = useState(false),
    [searchError, setSearchError] = useState(''),
    [lastQuery, setLastQuery] = useState(''),
    [searched, setSearched] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null),
    [analysisId, setAnalysisId] = useState(''),
    [activeId, setActiveId] = useState<string | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false),
    [analysisError, setAnalysisError] = useState('');
  const [prior, setPrior] = useState<PriorWork | null>(null),
    [priorBusy, setPriorBusy] = useState(false),
    [priorError, setPriorError] = useState('');
  const [resourceRevision, setResourceRevision] = useState(0),
    [planRevision, setPlanRevision] = useState(0);
  const [assessment, setAssessment] = useState<{
    revision: number;
    hypothesisId: string;
    value: Fit;
  } | null>(null);
  const [activeNav, setActiveNav] = useState('question');
  const searchController = useRef<AbortController | null>(null),
    analysisController = useRef<AbortController | null>(null),
    priorController = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    selectedIds.current = new Set(selected.map((p) => p.id));
  }, [selected]);
  useEffect(() => {
    const controller = new AbortController();
    api<Health>('/api/health', undefined, controller.signal)
      .then(setHealth)
      .catch((e) => {
        if (!controller.signal.aborted)
          setHealth({
            analysisAvailable: false,
            reason: e instanceof Error ? e.message : 'Backend unavailable.',
            openalexKeyConfigured: false,
          });
      });
    return () => {
      controller.abort();
      textControllers.current.forEach((c) => c.abort());
      searchController.current?.abort();
      analysisController.current?.abort();
      priorController.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!exampleMode) return;
    const controller = new AbortController();
    api<{
      analysisId: string;
      result: Analysis;
      brief: Brief;
      papers: Paper[];
    }>('/api/example', undefined, controller.signal)
      .then((example) => {
        if (controller.signal.aborted) return;
        setBrief(example.brief);
        setPapers(example.papers);
        setSelected(example.papers);
        setAnalysis(example.result);
        setAnalysisId(example.analysisId);
        setActiveId(example.result.hypotheses[0]?.id ?? null);
        setActiveNav('connections');
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setExampleError(
            e instanceof Error ? e.message : 'Example could not load.',
          );
      });
    return () => controller.abort();
  }, [exampleMode]);
  function clearAnalysis() {
    generation.current++;
    analysisController.current?.abort();
    priorController.current?.abort();
    setAnalysis(null);
    setInspection(null);
    setAnalysisId('');
    setActiveId(null);
    setAssessment(null);
    setPrior(null);
    setPriorError('');
    setAnalysisError('');
    setAnalysisBusy(false);
    setPriorBusy(false);
  }
  function onCore(key: 'question' | 'field', value: string) {
    clearAnalysis();
    setBrief((b) => ({ ...b, [key]: value }));
  }
  function onResources(key: keyof Resources, value: string) {
    setBrief((b) => ({ ...b, resources: { ...b.resources, [key]: value } }));
    setResourceRevision((r) => r + 1);
    if (analysisBusy) {
      generation.current++;
      analysisController.current?.abort();
      setAnalysisBusy(false);
      setAnalysisError(
        'Resources changed during analysis. Run analysis again with the updated brief.',
      );
    }
  }
  function toggle(paper: Paper) {
    clearAnalysis();
    const alreadySelected = selected.some((p) => p.id === paper.id);
    if (alreadySelected) {
      setSelected((items) => items.filter((p) => p.id !== paper.id));
      return;
    }
    if (selected.length >= 6) return;
    setSelected((items) => [...items, paper]);
    if (canLoadFullText(paper) && !textErrors[paper.id])
      void loadFullText(paper);
  }
  function searchFocus() {
    const query = buildResearchQuery(brief);
    if (query.length >= 2) {
      setSearchQuery(query);
      void search(query);
      document
        .getElementById('papers')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  async function search(query: string) {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    verificationRun.current++;
    setVerification({ running: false, checked: 0, total: 0 });
    setLastQuery(query);
    setSearchQuery(query);
    setSearchBusy(true);
    setSearchError('');
    setSourceStatuses([]);
    setPapers([]);
    setSearched(true);
    setActiveNav('papers');
    try {
      const result = await api<SearchResult>(
        `/api/search?q=${encodeURIComponent(query)}`,
        undefined,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setPapers(result.papers);
        setSourceStatuses(result.sourceStatuses ?? []);
        if (filters.access === 'verified')
          void verifyPapers(result.papers, controller.signal);
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setSearchError(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      if (!controller.signal.aborted) setSearchBusy(false);
    }
  }
  function loadFullText(paper: Paper): Promise<void> {
    const existing = textPending.current.get(paper.id);
    if (existing) return existing;
    if (paper.fullText && hasArticleBody(paper)) return Promise.resolve();
    const pending = requestFullText(paper);
    textPending.current.set(paper.id, pending);
    void pending.finally(() => {
      if (textPending.current.get(paper.id) === pending)
        textPending.current.delete(paper.id);
    });
    return pending;
  }
  async function requestFullText(paper: Paper): Promise<void> {
    const controller = new AbortController();
    textControllers.current.set(paper.id, controller);
    setTextBusy((ids) => new Set(ids).add(paper.id));
    setTextErrors((errors) => ({ ...errors, [paper.id]: '' }));
    try {
      const updated = await api<Paper>(
        `/api/papers/${encodeURIComponent(paper.id)}/fulltext`,
        {},
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!updated.fullText || !hasArticleBody(updated))
        throw new Error(
          'The provider did not return article-body text. This record was not admitted to the retrieved-text filter.',
        );
      if (selectedIds.current.has(updated.id)) clearAnalysis();
      setSelected((items) =>
        items.some((p) => p.id === updated.id)
          ? items.map((p) => (p.id === updated.id ? updated : p))
          : items,
      );
      setPapers((items) =>
        items.some((p) => p.id === updated.id)
          ? items.map((p) => (p.id === updated.id ? updated : p))
          : items,
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setTextErrors((errors) => ({
          ...errors,
          [paper.id]:
            error instanceof Error ? error.message : 'Text retrieval failed.',
        }));
    } finally {
      if (textControllers.current.get(paper.id) === controller)
        textControllers.current.delete(paper.id);
      if (!controller.signal.aborted)
        setTextBusy((ids) => {
          const next = new Set(ids);
          next.delete(paper.id);
          return next;
        });
    }
  }
  async function verifyPapers(
    records: Paper[],
    signal?: AbortSignal,
    limit = 12,
    settings: PaperFilters = filters,
    retryFailures = false,
  ) {
    const scope = retryFailures
      ? records
      : filterPapers(records, {
          ...settings,
          access: 'supported',
          allowExcerpt: true,
        });
    const candidates = scope
      .filter((p) => canLoadFullText(p) && (retryFailures || !textErrors[p.id]))
      .slice(0, limit);
    const run = ++verificationRun.current;
    setVerification({
      running: !!candidates.length,
      checked: 0,
      total: candidates.length,
    });
    let cursor = 0,
      checked = 0;
    async function worker() {
      while (
        cursor < candidates.length &&
        !signal?.aborted &&
        run === verificationRun.current
      ) {
        const paper = candidates[cursor++];
        await loadFullText(paper);
        checked++;
        if (run === verificationRun.current && !signal?.aborted)
          setVerification({ running: true, checked, total: candidates.length });
      }
    }
    try {
      await Promise.all([worker(), worker()]);
    } finally {
      if (run === verificationRun.current)
        setVerification({ running: false, checked, total: candidates.length });
    }
  }
  function changeFilters(next: PaperFilters) {
    setFilters(next);
    verificationRun.current++;
    setVerification({ running: false, checked: 0, total: 0 });
    if (next.access === 'verified')
      void verifyPapers(papers, undefined, 12, next);
  }
  function inspectComparison(reference: Citation) {
    setActiveId(null);
    setInspection({
      reference,
      label: 'Comparison supporting passage',
      explanation:
        'This passage supports the displayed text comparison. Shared terms do not by themselves establish scientific agreement, and differences in wording are not proof that the studies disagree.',
    });
    document
      .getElementById('evidence-inspector')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function inspectGap(lead: GapLead) {
    setActiveId(null);
    setInspection({
      reference: { paperId: lead.paperId, passageId: lead.passageId },
      label: lead.label,
      explanation: lead.followUp,
    });
    document
      .getElementById('evidence-inspector')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function runAnalysis() {
    setInspection(null);
    priorController.current?.abort();
    setPriorBusy(false);
    const controller = new AbortController();
    analysisController.current = controller;
    const version = ++generation.current;
    setAnalysisBusy(true);
    setAnalysisError('');
    setAnalysis(null);
    setAssessment(null);
    setPrior(null);
    setPriorError('');
    setActiveId(null);
    setAnalysisId('');
    try {
      const result = await api<{
        analysisId: string;
        result: Analysis;
        sources: Paper[];
      }>(
        '/api/analyze',
        { brief, paperIds: selected.map((p) => p.id) },
        controller.signal,
      );
      if (!controller.signal.aborted && version === generation.current) {
        setSelected(result.sources);
        setAnalysis(result.result);
        setAnalysisId(result.analysisId);
        setActiveId(result.result.hypotheses[0]?.id ?? null);
        setPlanRevision(resourceRevision);
        setActiveNav('connections');
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setAnalysisError(e instanceof Error ? e.message : 'Analysis failed.');
    } finally {
      if (!controller.signal.aborted) setAnalysisBusy(false);
    }
  }
  const hypothesis =
    analysis?.hypotheses.find((h) => h.id === activeId) ?? null;
  const fitCurrent =
    assessment?.hypothesisId === activeId &&
    assessmentIsCurrent(assessment?.revision ?? null, resourceRevision);
  function choose(id: string) {
    setInspection(null);
    priorController.current?.abort();
    setPriorBusy(false);
    setActiveId(id);
    setAssessment(null);
    setPrior(null);
    setPriorError('');
  }
  function onAssess() {
    if (hypothesis)
      setAssessment({
        revision: resourceRevision,
        hypothesisId: hypothesis.id,
        value: assessResources(hypothesis, brief.resources, selected),
      });
  }
  async function onPrior() {
    if (!hypothesis) return;
    priorController.current?.abort();
    const controller = new AbortController();
    priorController.current = controller;
    setPriorBusy(true);
    setPriorError('');
    setPrior(null);
    try {
      const result = await api<PriorWork>(
        '/api/prior-work',
        { analysisId, hypothesisId: hypothesis.id },
        controller.signal,
      );
      if (!controller.signal.aborted) setPrior(result);
    } catch (e) {
      if (!controller.signal.aborted)
        setPriorError(
          e instanceof Error ? e.message : 'Prior-work search incomplete.',
        );
    } finally {
      if (!controller.signal.aborted) setPriorBusy(false);
    }
  }
  function onExport() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            brief,
            papers: selected,
            analysis,
            priorWork: prior,
            resourceAssessment: fitCurrent ? assessment?.value : null,
            limitations:
              'Coverage is labelled per source. Retrieved body text excludes figures, tables and supplements. Hypotheses and experiment plans are untested proposals.',
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'paperbridge-workspace.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  const stage = hypothesis ? 5 : selected.length >= 2 ? 3 : searched ? 1 : 0;
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#question">
          <BridgeMark />
          <div>
            <strong>PaperBridge</strong>
            <span>Research workspace</span>
          </div>
        </a>
        <nav className="steps" aria-label="Research workflow">
          {[
            'Set focus',
            'Select papers',
            'Compare text',
            'Find gap leads',
            'Optional AI',
            'Plan experiment',
          ].map((label, i) => (
            <a
              href={`#${nav[i].id}`}
              key={label}
              className={i <= stage ? 'current' : ''}
              onClick={() => setActiveNav(nav[i].id)}
            >
              <span>{String(i + 1).padStart(2, '0')}</span>
              <b>{label}</b>
            </a>
          ))}
        </nav>
        <span
          className="session-note"
          title="Your workspace stays in this tab. Reloading clears it; export a completed analysis to keep a copy."
        >
          Session only <Info size={15} />
        </span>
      </header>
      <nav className="sidebar" aria-label="Workspace sections">
        {nav.map((item) => (
          <a
            href={`#${item.id}`}
            onClick={() => setActiveNav(item.id)}
            className={activeNav === item.id ? 'active' : ''}
            key={item.id}
          >
            <item.icon size={19} />
            <span>{item.label}</span>
          </a>
        ))}
        <div className="sidebar-bottom">
          <BridgeMark small />
          <p>
            Follow the evidence.
            <br />
            Explore the possibility.
          </p>
        </div>
      </nav>
      <main className="workspace">
        <div className="page-heading">
          <div>
            <h1>Find the next question in your field</h1>
            <p>
              Read source text, investigate limitations, and develop a possible
              research gap.
            </p>
          </div>
          {!exampleMode ? (
            <a
              className="example-link"
              href="/?example=network-ecology"
              target="_blank"
              rel="noreferrer"
            >
              Explore saved example <ArrowUpRight size={13} />
            </a>
          ) : (
            <a
              className="example-link"
              href="/"
              target="_blank"
              rel="noreferrer"
            >
              Open live workspace <ArrowUpRight size={13} />
            </a>
          )}
        </div>
        {exampleMode ? (
          <div className="example-banner">
            <strong>
              {analysis?.origin === 'live'
                ? 'Live model analysis of an example workspace · untested hypotheses.'
                : analysis?.origin === 'saved-example'
                  ? 'Saved example · manually prepared, not a live AI result.'
                  : 'Saved-example workspace · analysis cleared after edits.'}
            </strong>
            <p>
              Four real OpenAlex records, retrieved October 24, 2026. This
              example opened in its own tab. Edit resources, inspect the
              passages, or check prior work. Paper search and prior-work checks
              still use live free-paper search services.
            </p>
          </div>
        ) : null}
        {exampleError ? <Notice error>{exampleError}</Notice> : null}
        <div className="workspace-grid">
          <BriefForm
            brief={brief}
            onCore={onCore}
            onResources={onResources}
            onFindPapers={searchFocus}
            searching={searchBusy}
          />
          <PaperPanel
            papers={papers}
            selected={selected}
            loading={searchBusy}
            error={searchError}
            searched={searched}
            lastQuery={lastQuery}
            onSearch={search}
            onToggle={toggle}
            sourceStatuses={sourceStatuses}
            onLoad={loadFullText}
            textBusy={textBusy}
            textErrors={textErrors}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            filters={filters}
            onFiltersChange={changeFilters}
            verification={verification}
            onCheckText={() => void verifyPapers(papers)}
          />
          <ComparisonPanel
            papers={selected}
            onLoad={loadFullText}
            busy={textBusy}
            errors={textErrors}
            onExport={onExport}
            onInspect={inspectComparison}
          />
          <GapPanel
            papers={selected}
            question={brief.question}
            field={brief.field}
            busy={textBusy}
            onSearch={search}
            onRetrieve={() =>
              verifyPapers(selected, undefined, 6, filters, true)
            }
            onInspect={inspectGap}
          />
          <EvidencePanel
            inspection={inspection}
            hypothesis={hypothesis}
            papers={selected}
            brief={brief}
            fit={fitCurrent ? assessment!.value : null}
            staleFit={!!assessment && !fitCurrent}
            onAssess={onAssess}
            prior={prior}
            priorBusy={priorBusy}
            priorError={priorError}
            onPrior={onPrior}
          />
          <ConnectionPanel
            brief={brief}
            analysis={analysis}
            activeId={activeId}
            health={health}
            count={selected.length}
            busy={analysisBusy}
            error={analysisError}
            onAnalyze={runAnalysis}
            onSelect={choose}
          />
          <ExperimentPanel
            hypothesis={hypothesis}
            resourcesChanged={resourceRevision !== planRevision}
            onExport={onExport}
          />
        </div>
      </main>
      <footer className="app-footer">
        <span>
          Evidence coverage is labelled per source. Gap leads need follow-up;
          they are not confirmed field-wide gaps.
        </span>
        <span>PaperBridge · No workspace is saved on reload</span>
      </footer>
    </div>
  );
}

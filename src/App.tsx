import { useEffect, useMemo, useRef, useState } from 'react';
import { Info, ArrowUpRight, X } from 'lucide-react';
import type {
  Analysis,
  Brief,
  Fit,
  Health,
  Paper,
  PriorWork,
  Resources,
  SearchResult,
  SearchConcept,
  SearchSourceStatus,
  Citation,
} from '../shared/types';
import {
  assessResources,
  assessmentIsCurrent,
  emptyResources,
} from '../shared/resources';
import { CostPanel } from './components/CostPanel';
import type { UsageEntry } from './components/CostPanel';
import { api, ApiError } from './lib/api';
import { Notice } from './components/Primitives';
import { ResourcesPanel } from './components/ResourcesPanel';
import { BriefForm } from './components/BriefForm';
import { PaperPanel } from './components/PaperPanel';
import { ConnectionPanel } from './components/ConnectionPanel';
import type { EvidenceInspection } from './components/EvidencePanel';
import { scanGapLeads } from '../shared/gaps';
import type { GapLead } from '../shared/gaps';
import {
  defaultFilter,
  filterPapers,
  hasArticleBody,
} from '../shared/paper-filters';
import type { PaperFilters } from '../shared/paper-filters';
import { EvidencePanel } from './components/EvidencePanel';
import { ComparisonPanel } from './components/ComparisonPanel';
import { GapVisualMap } from './components/GapVisualMap';
import { GapFindings } from './components/GapFindings';
import { PaperSynthesis } from './components/PaperSynthesis';
import { GapResearchCheck } from './components/GapResearchCheck';
import { gapCheckScopeKey } from '../shared/gap-check';
import type {
  GapCheckGap,
  GapCheckResult,
  GapCheckDecision,
} from '../shared/gap-check';
import { buildGapFindings } from '../shared/gap-findings';
import type { GapFinding } from '../shared/gap-findings';
import type { DiscoveryLead } from './components/DiscoveryPanel';
import { PriorWorkCheck } from './components/PriorWorkCheck';
import { gapScanSources } from './components/GapPanel';
import type { GapEvidenceScope } from './components/GapPanel';
import { buildQueryPlan, buildResearchQuery } from '../shared/research-query';
import { canLoadFullText } from '../shared/comparison';
import { ExperimentPanel } from './components/ExperimentPanel';
import {
  createHypothesisPlan,
  createManualPlan,
  planContextKey,
} from '../shared/experiment-plan';
import type { ExperimentDraft } from '../shared/experiment-plan';
type Stage = 'focus' | 'papers' | 'gaps' | 'experiment';
const pipeline: { id: Stage; label: string; description: string }[] = [
  { id: 'focus', label: 'Focus', description: 'Set your research focus' },
  { id: 'papers', label: 'Papers', description: 'Choose and compare evidence' },
  { id: 'gaps', label: 'Find gaps', description: 'Explain a candidate gap' },
  { id: 'experiment', label: 'Experiment', description: 'Plan a test' },
];
const nav = [
  { id: 'question', label: 'Focus', stage: 'focus' },
  { id: 'papers', label: 'Search & select', stage: 'papers' },
  { id: 'comparison', label: 'Read & compare', stage: 'papers' },
  { id: 'gaps', label: 'Gap findings', stage: 'gaps' },
  { id: 'visual-map', label: 'Visual map', stage: 'gaps' },
  { id: 'experiment', label: 'Experiment', stage: 'experiment' },
] as const;
const workflowHeadings: Record<string, { title: string; description: string }> =
  {
    question: {
      title: 'Find the next question in your field',
      description: 'Start with one field and a question.',
    },
    papers: {
      title: 'Choose your sources',
      description:
        'Find relevant papers and select the evidence you want to explore.',
    },
    comparison: {
      title: 'Compare your selected papers',
      description:
        'Read similarities, differences and the passages behind them.',
    },
    gaps: {
      title: 'Find gaps',
      description:
        'Compare your papers, choose a gap, and develop a testable hypothesis.',
    },
    'visual-map': {
      title: 'Find gaps',
      description: 'Explore the evidence behind the same selected finding.',
    },
    experiment: {
      title: 'Plan a small first test',
      description:
        'Refine the proposal, check related work and decide what result would count against it.',
    },
  };
export default function App() {
  const [exampleMode] = useState(
    () =>
      new URLSearchParams(window.location.search).get('example') ===
      'network-ecology',
  );
  const [researchLead, setResearchLead] = useState<{
    lead: DiscoveryLead;
    contextKey: string;
  } | null>(null);
  const [usageEntries, setUsageEntries] = useState<UsageEntry[]>([]);
  const [plan, setPlan] = useState<ExperimentDraft | null>(null);
  const drafts = useRef(new Map<string, ExperimentDraft>());
  const draftGapBindings = useRef(
    new Map<string, { findingId: string; gapId: string }>(),
  );
  const [planSources, setPlanSources] = useState<Paper[]>([]);
  function editPlan(next: ExperimentDraft) {
    drafts.current.set(next.id, next);
    setPlan(next);
  }
  function retainPlanSources() {
    setPlanSources((previous) => [
      ...previous.filter((p) => !selected.some((x) => x.id === p.id)),
      ...selected,
    ]);
  }
  const [readinessBusy, setReadinessBusy] = useState(false);
  async function recheckHealth() {
    setReadinessBusy(true);
    try {
      setHealth(
        await api<Health>('/api/health', undefined, AbortSignal.timeout(10000)),
      );
    } catch {
      setHealth({
        analysisAvailable: false,
        analysisState: 'unreachable',
        reason:
          'Backend unreachable. Check that npm run dev is running, then recheck.',
        openalexKeyConfigured: false,
      });
    } finally {
      setReadinessBusy(false);
    }
  }
  const [exampleError, setExampleError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [queryPlan, setQueryPlan] = useState<SearchResult['queryPlan']>();
  const [performedQueries, setPerformedQueries] = useState<
    SearchResult['performedQueries']
  >([]);
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
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [researchInspectionPapers, setResearchInspectionPapers] = useState<
    Paper[]
  >([]);
  const evidenceDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = evidenceDialog.current;
    if (!dialog) return;
    if (evidenceOpen && !dialog.open) dialog.showModal();
    if (!evidenceOpen && dialog.open) dialog.close();
  }, [evidenceOpen]);
  function openEvidence(
    reference: Citation,
    label = 'Supporting source passage',
    explanation?: string,
  ) {
    setResearchInspectionPapers([]);
    setInspection({ reference, label, explanation });
    setEvidenceOpen(true);
  }
  const selectedIds = useRef(new Set<string>());
  const textPending = useRef(new Map<string, Promise<void>>());
  const [brief, setBrief] = useState<Brief>({
    question: '',
    field: '',
    resources: { ...emptyResources },
  });
  const [readingPaper, setReadingPaper] = useState<Paper | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]),
    [selected, setSelected] = useState<Paper[]>([]);
  const [gapScope, setGapScope] = useState<GapEvidenceScope>('body');
  const gapScan = useMemo(
    () =>
      scanGapLeads(
        gapScanSources(selected, gapScope),
        brief.question,
        brief.field,
      ),
    [selected, gapScope, brief.question, brief.field],
  );
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
  const [resourceRevision, setResourceRevision] = useState(0);
  const [analysisResourceRevision, setAnalysisResourceRevision] = useState(0);
  const [assessment, setAssessment] = useState<{
    revision: number;
    hypothesisId: string;
    value: Fit;
  } | null>(null);
  const [activeNav, setActiveNav] = useState('question');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    null,
  );
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [gapQuestions, setGapQuestions] = useState<Record<string, string>>({});
  const [gapBindings, setGapBindings] = useState<Record<string, GapCheckGap>>(
    {},
  );
  const [gapChecks, setGapChecks] = useState<
    Record<string, { result: GapCheckResult; textKey: string }>
  >({});
  const [gapCheckBusy, setGapCheckBusy] = useState<Record<string, boolean>>({});
  const [gapReviewBusy, setGapReviewBusy] = useState<Record<string, boolean>>(
    {},
  );
  const [gapCheckErrors, setGapCheckErrors] = useState<Record<string, string>>(
    {},
  );
  const gapCheckRuns = useRef(new Map<string, number>());
  const findings = useMemo(
    () =>
      buildGapFindings(gapScan.candidates, analysis, analysisId, selected).map(
        (finding) => ({
          ...finding,
          question:
            gapQuestions[finding.id] ??
            gapBindings[finding.id]?.question ??
            finding.question,
        }),
      ),
    [gapScan, analysis, analysisId, selected, gapQuestions, gapBindings],
  );
  const sourceTextKey = JSON.stringify(
    selected
      .map((paper) => ({ id: paper.id, passages: paper.passages }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
  function gapFor(finding: GapFinding): GapCheckGap {
    return (
      gapBindings[finding.id] ?? {
        id: finding.id,
        question: finding.question,
        reason: `${finding.rationale} ${finding.unresolved}`.trim(),
        evidence: finding.evidence,
      }
    );
  }
  const latestCheckContext = useRef({
    brief,
    selected,
    findings,
    sourceTextKey,
  });
  latestCheckContext.current = { brief, selected, findings, sourceTextKey };
  function checkIsCurrent(finding: GapFinding, entry = gapChecks[finding.id]) {
    return (
      !!entry &&
      entry.textKey === sourceTextKey &&
      entry.result.scopeKey ===
        gapCheckScopeKey(
          brief,
          selected.map((p) => p.id),
          gapFor(finding),
        )
    );
  }
  function checkIsReviewed(finding: GapFinding) {
    const entry = gapChecks[finding.id];
    return (
      checkIsCurrent(finding, entry) &&
      entry.result.reviewed &&
      (entry.result.aiCompleted || entry.result.assessmentNotNeeded === true) &&
      entry.result.status !== 'Check incomplete or inconclusive'
    );
  }
  function editGapQuestion(finding: GapFinding, question: string) {
    setGapQuestions((items) => ({ ...items, [finding.id]: question }));
    setGapBindings((items) => {
      const next = { ...items };
      delete next[finding.id];
      return next;
    });
    gapCheckRuns.current.set(
      finding.id,
      (gapCheckRuns.current.get(finding.id) ?? 0) + 1,
    );
    setGapCheckBusy((items) => ({ ...items, [finding.id]: false }));
    setGapReviewBusy((items) => ({ ...items, [finding.id]: false }));
    if (analysisBusy) {
      generation.current++;
      analysisController.current?.abort();
      setAnalysisBusy(false);
      setAnalysisError(
        'Gap wording changed during analysis. Check and review the updated question before developing it.',
      );
    }
    invalidateGapDrafts(finding);
  }
  function invalidateGapDrafts(finding: GapFinding) {
    const editedGapId = gapFor(finding).id;
    for (const [id, draft] of drafts.current) {
      const binding = draftGapBindings.current.get(id);
      if (
        binding &&
        (binding.findingId === finding.id || binding.gapId === editedGapId)
      ) {
        const staleDraft = {
          ...draft,
          contextKey: `review:changed-gap:${finding.id}`,
        };
        drafts.current.set(id, staleDraft);
        if (plan?.id === id) setPlan(staleDraft);
      }
    }
  }
  async function checkGap(finding: GapFinding) {
    invalidateGapDrafts(finding);
    const gap = gapFor(finding);
    const body = { brief, paperIds: selected.map((p) => p.id), gap };
    const scopeKey = gapCheckScopeKey(brief, body.paperIds, gap);
    const textKey = sourceTextKey;
    const run = (gapCheckRuns.current.get(finding.id) ?? 0) + 1;
    gapCheckRuns.current.set(finding.id, run);
    setGapCheckBusy((items) => ({ ...items, [finding.id]: true }));
    setGapCheckErrors((items) => ({ ...items, [finding.id]: '' }));
    setGapChecks((items) => {
      const next = { ...items };
      delete next[finding.id];
      return next;
    });
    const runId = crypto.randomUUID();
    setUsageEntries((items) => [
      ...items,
      {
        id: runId,
        time: new Date().toISOString(),
        status: 'running',
        cost: null,
      },
    ]);
    try {
      const result = await api<GapCheckResult>('/api/gap-check', body);
      setUsageEntries((items) =>
        items.map((entry) =>
          entry.id === runId
            ? { ...entry, status: 'complete', cost: result.cost ?? null }
            : entry,
        ),
      );
      const latest = latestCheckContext.current;
      const latestFinding = latest.findings.find(
        (item) => item.id === finding.id,
      );
      const latestGap =
        latestFinding &&
        (gapBindings[finding.id] ?? {
          id: latestFinding.id,
          question: latestFinding.question,
          reason:
            `${latestFinding.rationale} ${latestFinding.unresolved}`.trim(),
          evidence: latestFinding.evidence,
        });
      if (
        gapCheckRuns.current.get(finding.id) !== run ||
        !latestGap ||
        latest.sourceTextKey !== textKey ||
        gapCheckScopeKey(
          latest.brief,
          latest.selected.map((p) => p.id),
          latestGap,
        ) !== scopeKey
      )
        return;
      setGapChecks((items) => ({
        ...items,
        [finding.id]: { result, textKey },
      }));
    } catch (error) {
      setUsageEntries((items) =>
        items.map((entry) =>
          entry.id === runId
            ? {
                ...entry,
                status: 'error',
                cost: error instanceof ApiError ? (error.cost ?? null) : null,
              }
            : entry,
        ),
      );
      if (gapCheckRuns.current.get(finding.id) === run)
        setGapCheckErrors((items) => ({
          ...items,
          [finding.id]:
            error instanceof Error
              ? error.message
              : 'Existing research check failed.',
        }));
    } finally {
      if (gapCheckRuns.current.get(finding.id) === run)
        setGapCheckBusy((items) => ({ ...items, [finding.id]: false }));
    }
  }
  async function reviewGap(finding: GapFinding, decision: GapCheckDecision) {
    const entry = gapChecks[finding.id];
    if (!checkIsCurrent(finding, entry)) return;
    const run = gapCheckRuns.current.get(finding.id) ?? 0;
    setGapReviewBusy((items) => ({ ...items, [finding.id]: true }));
    setGapCheckErrors((items) => ({ ...items, [finding.id]: '' }));
    try {
      const result = await api<GapCheckResult>(
        `/api/gap-check/${entry.result.checkId}/review`,
        {
          brief,
          paperIds: selected.map((p) => p.id),
          gap: gapFor(finding),
          decision,
        },
      );
      const latest = latestCheckContext.current;
      if (
        gapCheckRuns.current.get(finding.id) === run &&
        latest.sourceTextKey === entry.textKey &&
        gapCheckScopeKey(
          latest.brief,
          latest.selected.map((p) => p.id),
          result.gap,
        ) === result.scopeKey &&
        latest.findings.some(
          (item) =>
            item.id === finding.id && item.question === finding.question,
        )
      ) {
        setGapChecks((items) => ({
          ...items,
          [finding.id]: { result, textKey: entry.textKey },
        }));
        requestAnimationFrame(() => {
          const panel = document.getElementById('gap-development');
          panel?.focus({ preventScroll: true });
          panel?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
      }
    } catch (error) {
      if (gapCheckRuns.current.get(finding.id) === run)
        setGapCheckErrors((items) => ({
          ...items,
          [finding.id]:
            error instanceof Error
              ? error.message
              : 'Review could not be saved.',
        }));
    } finally {
      if (gapCheckRuns.current.get(finding.id) === run)
        setGapReviewBusy((items) => ({ ...items, [finding.id]: false }));
    }
  }
  const selectedFinding =
    findings.find((item) => item.id === selectedFindingId) ??
    findings[0] ??
    null;
  const chosenCheck = selectedFinding
    ? gapChecks[selectedFinding.id]
    : undefined;
  const chosenCheckCurrent =
    !!selectedFinding && checkIsCurrent(selectedFinding);
  const chosenCheckComplete =
    chosenCheckCurrent &&
    !!chosenCheck &&
    (chosenCheck.result.aiCompleted ||
      chosenCheck.result.assessmentNotNeeded === true) &&
    chosenCheck.result.status !== 'Check incomplete or inconclusive';
  const researchCheckMessage = !selectedFinding
    ? 'Choose a gap before generating a hypothesis.'
    : gapCheckBusy[selectedFinding.id]
      ? 'The research check is still running. Wait for its results.'
      : !chosenCheck
        ? 'Run the research check for this gap first.'
        : !chosenCheckCurrent
          ? 'The gap or evidence changed. Update the research check first.'
          : !chosenCheckComplete
            ? !chosenCheck.result.aiCompleted && !health?.analysisAvailable
              ? 'Related papers were found, but AI assessment is unavailable. See the check results and server requirements below.'
              : 'The research check is incomplete or inconclusive. Open its results to see what failed or what evidence is missing.'
            : !chosenCheck.result.reviewed
              ? 'The research check is complete. Click “Confirm review & continue” in its results to unlock this button.'
              : '';
  function goToResearchCheck() {
    const check = document.getElementById('selected-gap-check');
    check?.focus({ preventScroll: true });
    check?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function selectFinding(id: string) {
    if (selectedFinding && selectedFinding.id !== id) {
      const previous = selectedFinding.id;
      gapCheckRuns.current.set(
        previous,
        (gapCheckRuns.current.get(previous) ?? 0) + 1,
      );
      setGapCheckBusy((items) => ({ ...items, [previous]: false }));
      setGapReviewBusy((items) => ({ ...items, [previous]: false }));
      if (analysisBusy) {
        generation.current++;
        analysisController.current?.abort();
        setAnalysisBusy(false);
      }
    }
    setSelectedFindingId(id);
    const finding = findings.find((item) => item.id === id);
    if (finding?.hypothesisId) choose(finding.hypothesisId, false);
  }
  function developFinding(finding: GapFinding) {
    if (!checkIsReviewed(finding)) return;
    setSelectedFindingId(finding.id);
    startDiscoveryHypothesis({
      id: finding.id,
      title: finding.title,
      question: finding.question,
      reason: `${finding.rationale} ${finding.unresolved}`,
      sources: finding.evidence,
      searchQuery: finding.sourceLead?.searchQuery ?? finding.title,
    });
    requestAnimationFrame(() => {
      const panel = document.getElementById('gap-development');
      panel?.focus({ preventScroll: true });
      panel?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }
  function planFinding(finding: GapFinding) {
    if (!checkIsReviewed(finding)) return;
    setSelectedFindingId(finding.id);
    const draftId = finding.hypothesisId
      ? `${analysisId}:hypothesis:${finding.hypothesisId}`
      : `discovery:${finding.id}`;
    draftGapBindings.current.set(draftId, {
      findingId: finding.id,
      gapId: gapFor(finding).id,
    });
    if (finding.hypothesisId) startHypothesisPlan(finding.hypothesisId);
    else
      startDiscoveryPlan({
        id: finding.id,
        title: finding.title,
        question: finding.question,
        reason: finding.rationale,
        sources: finding.evidence,
        searchQuery: finding.sourceLead?.searchQuery ?? finding.title,
      });
  }

  const stage = nav.find((item) => item.id === activeNav)?.stage ?? 'focus';
  const stageIndex = pipeline.findIndex((item) => item.id === stage);
  const lastViews = useRef<Record<Stage, string>>({
    focus: 'question',
    papers: 'papers',
    gaps: 'gaps',
    experiment: 'experiment',
  });
  useEffect(() => {
    lastViews.current[stage] = activeNav;
  }, [activeNav, stage]);
  useEffect(() => {
    const revealTab = () =>
      document
        .getElementById(`tab-${activeNav}`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    revealTab();
    window.addEventListener('resize', revealTab);
    return () => window.removeEventListener('resize', revealTab);
  }, [activeNav]);
  const searchController = useRef<AbortController | null>(null),
    analysisController = useRef<AbortController | null>(null),
    priorController = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    selectedIds.current = new Set(selected.map((p) => p.id));
  }, [selected]);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const readinessTimeout = window.setTimeout(
      () =>
        controller.abort(
          new Error('Backend readiness timed out. Recheck server readiness.'),
        ),
      10000,
    );
    api<Health>('/api/health', undefined, controller.signal)
      .then(setHealth)
      .catch((e) => {
        if (!disposed)
          setHealth({
            analysisAvailable: false,
            analysisState: 'unreachable',
            reason: e instanceof Error ? e.message : 'Backend unavailable.',
            openalexKeyConfigured: false,
          });
      })
      .finally(() => window.clearTimeout(readinessTimeout));
    return () => {
      disposed = true;
      window.clearTimeout(readinessTimeout);
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
        setActiveNav('gaps');
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
    for (const [id, run] of gapCheckRuns.current)
      gapCheckRuns.current.set(id, run + 1);
    setGapCheckBusy({});
    setGapReviewBusy({});
    generation.current++;
    analysisController.current?.abort();
    priorController.current?.abort();
    setAnalysis(null);
    setEvidenceOpen(false);
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
    setResearchLead(null);
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
      setActiveNav('papers');
    }
  }
  async function search(query: string, concepts?: SearchConcept[]) {
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
    setPerformedQueries([]);
    setQueryPlan(
      buildQueryPlan({
        question: brief.question || query,
        field: brief.field,
        concepts,
      }),
    );
    setPapers([]);
    setSearched(true);
    setActiveNav('papers');
    try {
      const params = new URLSearchParams({
        q: query,
        question: brief.question || query,
        field: brief.field,
      });
      if (concepts?.length) params.set('concepts', JSON.stringify(concepts));
      const result = await api<SearchResult>(
        `/api/search?${params.toString()}`,
        undefined,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setPapers(result.papers);
        setSourceStatuses(result.sourceStatuses ?? []);
        setQueryPlan(
          result.queryPlan ??
            buildQueryPlan({
              question: brief.question || query,
              field: brief.field,
              concepts,
            }),
        );
        setPerformedQueries(result.performedQueries ?? []);
        if (filters.access === 'verified')
          void verifyPapers(result.papers, controller.signal);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setSearchError(e instanceof Error ? e.message : 'Search failed.');
        if (e instanceof ApiError && e.searchDetails) {
          setQueryPlan(e.searchDetails.queryPlan);
          setSourceStatuses(e.searchDetails.sourceStatuses ?? []);
          setPerformedQueries(e.searchDetails.performedQueries ?? []);
        }
      }
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
      setReadingPaper((paper) => (paper?.id === updated.id ? updated : paper));
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
    openEvidence(
      reference,
      'Comparison supporting passage',
      'Compare the source wording and study context before drawing a conclusion.',
    );
  }
  async function runAnalysis() {
    const finding = selectedFinding;
    if (
      !finding ||
      !checkIsReviewed(finding) ||
      gapCheckBusy[finding.id] ||
      gapReviewBusy[finding.id]
    ) {
      setAnalysisError(
        'Select a gap, check existing research and review the current matches before developing a hypothesis.',
      );
      return;
    }
    const checked = gapChecks[finding.id];
    const gap = gapFor(finding);
    const runId = crypto.randomUUID();
    setUsageEntries((items) => [
      ...items,
      {
        id: runId,
        time: new Date().toISOString(),
        status: 'running',
        cost: null,
      },
    ]);
    function record(status: UsageEntry['status'], cost: UsageEntry['cost']) {
      setUsageEntries((items) =>
        items.map((entry) =>
          entry.id === runId ? { ...entry, status, cost } : entry,
        ),
      );
    }
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
        {
          brief,
          paperIds: selected.map((p) => p.id),
          checkId: checked.result.checkId,
          gap,
        },
        controller.signal,
      );
      record('complete', result.result.cost ?? null);
      if (!controller.signal.aborted && version === generation.current) {
        setSelected(result.sources);
        setAnalysis(result.result);
        setAnalysisResourceRevision(resourceRevision);
        setAnalysisId(result.analysisId);
        setActiveId(result.result.hypotheses[0]?.id ?? null);
        for (const hypothesis of result.result.hypotheses) {
          const findingId = `${result.analysisId}:hypothesis:${hypothesis.id}`;
          setGapBindings((items) => ({ ...items, [findingId]: gap }));
          setGapChecks((items) => ({ ...items, [findingId]: checked }));
        }
        setSelectedFindingId(
          result.result.hypotheses[0]
            ? `${result.analysisId}:hypothesis:${result.result.hypotheses[0].id}`
            : null,
        );
      }
    } catch (e) {
      record(
        controller.signal.aborted ? 'interrupted' : 'error',
        e instanceof ApiError ? (e.cost ?? null) : null,
      );
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
  function choose(id: string, inspect = true) {
    if (inspect) setEvidenceOpen(true);
    setResearchInspectionPapers([]);
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
            experimentPlan: plan,
            selectedResearchLead: researchLead,
            aiUsage: usageEntries,
            priorWork: prior,
            gapResearchChecks: gapChecks,
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
  function startHypothesisPlan(id: string) {
    const h = analysis?.hypotheses.find((item) => item.id === id);
    if (!h || !analysis) return;
    choose(id, false);
    const draft = createHypothesisPlan(h, brief, selected, analysis.origin);
    draft.id = `${analysisId}:${draft.id}`;
    if (analysisResourceRevision !== resourceRevision)
      draft.contextKey = `review:older-analysis-resources:${analysisId}:${analysisResourceRevision}`;
    editPlan(drafts.current.get(draft.id) ?? draft);
    retainPlanSources();
    setActiveNav('experiment');
  }
  function startManualPlan(lead?: GapLead) {
    setInspection(null);
    const draft = createManualPlan(brief, selected, lead);
    editPlan(drafts.current.get(draft.id) ?? draft);
    retainPlanSources();
    setActiveNav('experiment');
  }
  function startDiscoveryPlan(lead: DiscoveryLead) {
    const draft = createManualPlan(brief, selected);
    draft.id = `discovery:${lead.id}`;
    draft.fields.question = lead.question;
    draft.fields.constraints = [lead.reason, draft.fields.constraints]
      .filter(Boolean)
      .join('\n\n');
    draft.sources = lead.sources.map((reference) => ({ ...reference }));
    setInspection(null);
    editPlan(drafts.current.get(draft.id) ?? draft);
    retainPlanSources();
    setActiveNav('experiment');
  }
  function startDiscoveryHypothesis(lead: DiscoveryLead) {
    setResearchLead({ lead, contextKey: planContextKey(brief, selected) });
    setActiveNav('gaps');
  }
  function tabKeys(event: React.KeyboardEvent, index: number) {
    const visible = nav.filter((item) => item.stage === stage);
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % visible.length
        : event.key === 'ArrowLeft'
          ? (index + visible.length - 1) % visible.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? visible.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    setActiveNav(visible[next].id);
    requestAnimationFrame(() =>
      document.getElementById(`tab-${visible[next].id}`)?.focus(),
    );
  }
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          aria-label="PaperBridge research workspace"
          href="#question"
          onClick={(e) => {
            e.preventDefault();
            setActiveNav('question');
          }}
        >
          <img
            className="brand-logo"
            src="/paperbridge-logo.png"
            width={150}
            height={70}
            alt="PaperBridge logo"
          />
          <span className="brand-tagline">Research workspace</span>
        </a>
        <nav className="pipeline-nav" aria-label="Research pipeline">
          {pipeline.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              id={
                item.id === 'focus'
                  ? 'tab-question'
                  : item.id === 'experiment'
                    ? 'tab-experiment'
                    : `stage-${item.id}`
              }
              aria-controls={`step-${item.id === 'focus' ? 'question' : item.id}`}
              aria-current={stage === item.id ? 'step' : undefined}
              className={
                stage === item.id ? 'pipeline-step current' : 'pipeline-step'
              }
              onClick={() =>
                setActiveNav(
                  item.id === 'gaps' ? 'gaps' : lastViews.current[item.id],
                )
              }
            >
              <span className="pipeline-number">{index + 1}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <span
          className="session-note"
          title="Your workspace stays in this tab. Reloading clears it; export a completed analysis to keep a copy."
        >
          Session only <Info size={15} />
        </span>
      </header>
      <main className="workspace">
        {pipeline
          .filter((item) => item.id === 'papers' || item.id === 'gaps')
          .map((item) => (
            <nav
              className="workflow-subnav"
              role="tablist"
              aria-label={`${item.label} tools`}
              key={item.id}
              hidden={stage !== item.id}
            >
              {nav
                .filter((view) => view.stage === item.id)
                .map((view, index) => (
                  <button
                    type="button"
                    role="tab"
                    id={`tab-${view.id}`}
                    aria-controls={`step-${view.id}`}
                    aria-selected={activeNav === view.id}
                    tabIndex={activeNav === view.id ? 0 : -1}
                    key={view.id}
                    onClick={() => setActiveNav(view.id)}
                    onKeyDown={(event) => tabKeys(event, index)}
                  >
                    {view.label}
                  </button>
                ))}
            </nav>
          ))}
        <div className="page-heading">
          <div>
            <h1>{workflowHeadings[activeNav].title}</h1>
            <p>{workflowHeadings[activeNav].description}</p>
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
          <details className="example-banner">
            <summary>Example workspace · manually prepared</summary>
            <p>
              Four real OpenAlex records, retrieved October 24, 2026. Saved
              analysis is manually prepared, not a live AI result. New searches
              use real literature services. New AI generation remains a separate
              paid action.
            </p>
          </details>
        ) : null}
        {exampleError ? <Notice error>{exampleError}</Notice> : null}
        <div className="workspace-grid tab-workspace">
          <div
            className="workflow-panel"
            role="tabpanel"
            id="step-question"
            aria-labelledby="tab-question"
            hidden={activeNav !== 'question'}
            tabIndex={0}
          >
            <BriefForm
              brief={brief}
              onCore={onCore}
              onFindPapers={searchFocus}
              searching={searchBusy}
            />
          </div>
          <div
            className="workflow-panel"
            role="tabpanel"
            id="step-papers"
            aria-labelledby="tab-papers"
            hidden={activeNav !== 'papers'}
            tabIndex={0}
          >
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
              queryPlan={queryPlan}
              performedQueries={performedQueries}
              onLoad={loadFullText}
              textBusy={textBusy}
              textErrors={textErrors}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              filters={filters}
              onFiltersChange={changeFilters}
              verification={verification}
              resources={brief.resources}
              onCheckText={() => void verifyPapers(papers)}
              onRead={(paper) => {
                setReadingPaper(paper);
                setActiveNav('comparison');
              }}
            />
          </div>
          <div
            className="workflow-panel"
            role="tabpanel"
            id="step-comparison"
            aria-labelledby="tab-comparison"
            hidden={activeNav !== 'comparison'}
            tabIndex={0}
          >
            {readingPaper ? (
              <div className="reader-context">
                <p>Reading: {readingPaper.title}</p>
                <button
                  className="text-button"
                  onClick={() => setReadingPaper(null)}
                >
                  Compare selected papers
                </button>
              </div>
            ) : null}
            <ComparisonPanel
              papers={readingPaper ? [readingPaper] : selected}
              onLoad={loadFullText}
              busy={textBusy}
              errors={textErrors}
              onExport={onExport}
              onInspect={inspectComparison}
              onGoPapers={() => setActiveNav('papers')}
            />
          </div>
          <div
            className="workflow-panel"
            role="tabpanel"
            id="step-gaps"
            aria-labelledby="tab-gaps"
            hidden={activeNav !== 'gaps'}
            tabIndex={0}
          >
            <PaperSynthesis papers={selected} onInspect={inspectComparison} />
            <nav
              className="gap-step-links"
              aria-label="Gap and hypothesis steps"
            >
              <a href="#gap-findings">1. Choose a gap</a>
              <a href="#gap-development">2. Develop hypothesis ↓</a>
            </nav>
            <GapFindings
              onGoPapers={() => setActiveNav('papers')}
              onIncludeAbstracts={
                gapScope === 'body'
                  ? () => setGapScope('include-abstracts')
                  : undefined
              }
              findings={findings}
              researchCheck={
                selectedFinding ? (
                  <GapResearchCheck
                    finding={selectedFinding}
                    question={selectedFinding.question}
                    onQuestionChange={(question) =>
                      editGapQuestion(selectedFinding, question)
                    }
                    result={gapChecks[selectedFinding.id]?.result ?? null}
                    stale={
                      !!gapChecks[selectedFinding.id] &&
                      !checkIsCurrent(selectedFinding)
                    }
                    busy={!!gapCheckBusy[selectedFinding.id]}
                    reviewBusy={!!gapReviewBusy[selectedFinding.id]}
                    error={gapCheckErrors[selectedFinding.id]}
                    onCheck={() => void checkGap(selectedFinding)}
                    onReview={(decision) =>
                      void reviewGap(selectedFinding, decision)
                    }
                    onDevelop={() => developFinding(selectedFinding)}
                    onPlan={() => planFinding(selectedFinding)}
                    aiAvailable={health?.analysisAvailable === true}
                    onInspect={(reference) => {
                      openEvidence(
                        reference,
                        'Existing research supporting passage',
                      );
                      setResearchInspectionPapers(
                        gapChecks[selectedFinding.id]?.result.candidates ?? [],
                      );
                    }}
                  />
                ) : null
              }
              papers={selected}
              selectedId={selectedFinding?.id ?? null}
              onSelect={selectFinding}
              onInspect={(reference, label) => openEvidence(reference, label)}
              onDevelop={developFinding}
              onPlan={planFinding}
              onInspectHypothesis={(id) => choose(id, true)}
              field={brief.field}
            />
            <section
              className="gap-development"
              id="gap-development"
              tabIndex={-1}
              aria-labelledby="hypothesis-step-title"
            >
              <h2 id="hypothesis-step-title">Develop hypothesis</h2>
              <p className="muted">
                Check and review your chosen gap above, then generate a testable
                hypothesis.
              </p>
              {selectedFinding ? (
                <p className="hypothesis-selected-question">
                  <strong>Selected question</strong> {selectedFinding.question}
                </p>
              ) : (
                <p>Select papers and choose a gap to begin.</p>
              )}
              {hypothesis && selectedFinding?.hypothesisId === hypothesis.id ? (
                <article
                  className="visible-hypothesis"
                  aria-label="Generated hypothesis"
                >
                  <p className="muted">
                    {analysis?.origin === 'saved-example'
                      ? 'Saved example · manually prepared'
                      : 'AI-generated · untested hypothesis'}
                  </p>
                  <h3>{hypothesis.title}</h3>
                  <p>{hypothesis.hypothesis}</p>
                  {hypothesis.experiment.method ? (
                    <div className="hypothesis-experiment-preview">
                      <h3>Proposed experiment</h3>
                      <p>{hypothesis.experiment.method}</p>
                      {hypothesis.experiment.measure ? (
                        <p>
                          <strong>Measure:</strong>{' '}
                          {hypothesis.experiment.measure}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="primary"
                    onClick={() => planFinding(selectedFinding)}
                    disabled={!checkIsReviewed(selectedFinding)}
                  >
                    Plan experiment
                  </button>
                </article>
              ) : null}
              <details
                className="gap-resources"
                open={resourcesOpen}
                onToggle={(event) => setResourcesOpen(event.currentTarget.open)}
              >
                <summary>Planning resources · optional</summary>
                <ResourcesPanel
                  embedded
                  resources={brief.resources}
                  onChange={onResources}
                  onContinue={() => setResourcesOpen(false)}
                />
              </details>
              <ConnectionPanel
                generationOnly
                researchCheckMessage={researchCheckMessage}
                onReviewCheck={selectedFinding ? goToResearchCheck : undefined}
                reviewCheckAction={
                  chosenCheckComplete && !chosenCheck?.result.reviewed
                    ? 'Review results & continue'
                    : chosenCheck && !chosenCheckCurrent
                      ? 'Update research check'
                      : chosenCheck && !chosenCheckComplete
                        ? 'See why the check is incomplete'
                        : 'Go to research check'
                }
                researchCheckReady={
                  !!selectedFinding && checkIsReviewed(selectedFinding)
                }
                brief={brief}
                analysis={analysis}
                activeId={activeId}
                health={health}
                count={selected.length}
                busy={analysisBusy}
                error={analysisError}
                onAnalyze={runAnalysis}
                onSelect={choose}
                papers={selected}
                onRecheck={recheckHealth}
                readinessBusy={readinessBusy}
                resourcesChanged={
                  !!analysis && analysisResourceRevision !== resourceRevision
                }
              />
              {selectedFinding && checkIsReviewed(selectedFinding) ? (
                <details className="hypothesis-manual-alternative">
                  <summary>Plan without AI</summary>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => planFinding(selectedFinding)}
                  >
                    Draft an experiment without AI
                  </button>
                </details>
              ) : null}
            </section>
            <details className="gap-source-settings">
              <summary>Evidence scope & retrieval</summary>
              <label htmlFor="gap-evidence-scope">Evidence to scan</label>
              <select
                id="gap-evidence-scope"
                value={gapScope}
                onChange={(event) =>
                  setGapScope(event.target.value as GapEvidenceScope)
                }
              >
                <option value="body">Retrieved article body only</option>
                <option value="include-abstracts">
                  Include abstracts too — limited evidence
                </option>
              </select>
              <p className="muted">
                Only retrieved passages are used. A source link is not proof
                that its body text has been read.
              </p>
              <button
                className="secondary"
                onClick={() =>
                  void verifyPapers(selected, undefined, 6, filters, true)
                }
                disabled={
                  !selected.length ||
                  selected.some((paper) => textBusy.has(paper.id))
                }
              >
                Retrieve selected article text
              </button>
              {selected.some((paper) => textErrors[paper.id]) ? (
                <Notice>
                  Some selected article text could not be imported. Review
                  source statuses in Papers.
                </Notice>
              ) : null}
            </details>
            {usageEntries.length ? (
              <details className="gap-cost-details">
                <summary>API usage & cost</summary>
                <CostPanel entries={usageEntries} />
              </details>
            ) : null}
          </div>
          <div
            className="workflow-panel"
            role="tabpanel"
            id="step-visual-map"
            aria-labelledby="tab-visual-map"
            hidden={activeNav !== 'visual-map'}
            tabIndex={0}
          >
            <GapVisualMap
              finding={selectedFinding}
              findings={findings}
              papers={selected}
              onSelect={selectFinding}
              onInspect={(reference, label) =>
                openEvidence(reference, label ?? 'Selected gap evidence')
              }
            />
          </div>
          <dialog
            className="evidence-dialog"
            ref={evidenceDialog}
            aria-labelledby="evidence-title"
            onCancel={() => setEvidenceOpen(false)}
            onClose={() => setEvidenceOpen(false)}
          >
            <button
              type="button"
              className="evidence-close"
              aria-label="Close evidence"
              onClick={() => setEvidenceOpen(false)}
            >
              <X size={20} />
            </button>
            <EvidencePanel
              inspection={inspection}
              hypothesis={
                activeNav !== 'experiment' ||
                plan?.id === `${analysisId}:hypothesis:${activeId}`
                  ? hypothesis
                  : null
              }
              papers={[
                ...researchInspectionPapers,
                ...Object.values(gapChecks)
                  .flatMap((entry) => entry.result.candidates)
                  .filter(
                    (paper, index, all) =>
                      all.findIndex((item) => item.id === paper.id) === index &&
                      !selected.some((item) => item.id === paper.id),
                  ),
                ...planSources.filter(
                  (p) =>
                    !selected.some((s) => s.id === p.id) &&
                    p.id !== readingPaper?.id,
                ),
                ...(readingPaper &&
                !selected.some((paper) => paper.id === readingPaper.id)
                  ? [readingPaper]
                  : []),
                ...selected,
              ]}
              brief={brief}
              fit={fitCurrent ? assessment!.value : null}
              staleFit={!!assessment && !fitCurrent}
              onAssess={onAssess}
              prior={prior}
              priorBusy={priorBusy}
              priorError={priorError}
              onPrior={onPrior}
            />
          </dialog>
          <div
            className="workflow-panel"
            role="tabpanel"
            id="step-experiment"
            aria-labelledby="tab-experiment"
            hidden={activeNav !== 'experiment'}
            tabIndex={0}
          >
            {drafts.current.size > 1 ? (
              <label className="draft-picker">
                Open a saved session draft
                <select
                  aria-label="Open a saved session draft"
                  value={plan?.id ?? ''}
                  onChange={(event) => {
                    setInspection(null);
                    const draft =
                      drafts.current.get(event.target.value) ?? null;
                    setPlan(draft);
                    const matched = analysis?.hypotheses.find(
                      (h) => draft?.id === `${analysisId}:hypothesis:${h.id}`,
                    );
                    if (matched) choose(matched.id, false);
                  }}
                >
                  {[...drafts.current.values()].map((draft) => (
                    <option key={draft.id} value={draft.id}>
                      {draft.fields.question.slice(0, 80) ||
                        'Untitled manual draft'}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <ExperimentPanel
              plan={plan}
              currentResources={brief.resources}
              onChange={editPlan}
              onStartManual={() => startManualPlan()}
              needsReview={
                !!plan && plan.contextKey !== planContextKey(brief, selected)
              }
              onReview={() => {
                if (plan)
                  editPlan({
                    ...plan,
                    contextKey: planContextKey(brief, selected),
                  });
              }}
              onInspect={(reference) =>
                openEvidence(reference, 'Experiment draft source')
              }
            />
            {plan ? (
              <PriorWorkCheck
                key={`plan:${plan.id}`}
                initialQuery={plan.fields.question.slice(0, 400)}
                field={brief.field}
              />
            ) : null}
          </div>
        </div>
        <div className="workflow-controls">
          <button
            className="secondary"
            disabled={stageIndex === 0}
            onClick={() =>
              setActiveNav(lastViews.current[pipeline[stageIndex - 1].id])
            }
          >
            Back
          </button>
          <span>
            Stage {stageIndex + 1} of {pipeline.length} ·{' '}
            {pipeline[stageIndex].label}
          </span>
          {stageIndex < pipeline.length - 1 ? (
            <button
              className="primary"
              onClick={() =>
                setActiveNav(
                  pipeline[stageIndex + 1].id === 'gaps'
                    ? 'gaps'
                    : lastViews.current[pipeline[stageIndex + 1].id],
                )
              }
            >
              {stage === 'papers'
                ? 'Compare & find gaps'
                : `Continue to ${pipeline[stageIndex + 1].label}`}
            </button>
          ) : (
            <span className="workflow-next-spacer" aria-hidden="true" />
          )}
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

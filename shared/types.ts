import type { AnalysisCost } from './analysis-cost';
export type Resources = {
  data: string;
  equipment: string;
  skills: string;
  deadline: string;
};
export type Brief = {
  question: string;
  field: string;
  resources: Resources;
};
export type Passage = {
  id: string;
  text: string;
  kind?: 'abstract' | 'full-text';
  section?: string;
};
export type SourceName = 'OpenAlex' | 'Europe PMC' | 'arXiv';
export type PaperSource = { provider: SourceName; id: string; url: string };
export type FreeCopy = {
  url: string;
  via: string;
  format: 'HTML' | 'PDF' | 'Repository';
  license?: string | null;
};
export type SearchSourceStatus = {
  source: SourceName;
  status: 'ok' | 'error';
  count: number;
  message: string | null;
};
export type SearchConcept = { label: string; terms: string[] };
export type QueryPlan = {
  question: string;
  concepts: SearchConcept[];
  variants: string[];
  note: string;
};
export type PerformedQuery = {
  source: SourceName;
  query: string;
  status: 'ok' | 'error';
  message: string | null;
};
export type PaperRelevance = {
  classification:
    | 'Directly addresses the question'
    | 'Related background or potentially transferable method'
    | 'Relevance unclear';
  explanation: string;
  matchedConcepts: string[];
  missingConcepts: string[];
  evidence: { field: 'title' | 'abstract'; text: string }[];
};
export type Paper = {
  relevance?: PaperRelevance;
  id: string;
  title: string;
  year: number | null;
  doi: string | null;
  url: string;
  authors: string[];
  abstract: string | null;
  passages: Passage[];
  retrievedAt: string;
  coverage:
    | 'Abstract only'
    | 'Metadata only'
    | 'Full text retrieved'
    | 'Full text excerpt';
  sources?: PaperSource[];
  identifiers?: { pmcid?: string; arxiv?: string };
  freeCopies?: FreeCopy[];
  publicationType?:
    | 'Preprint'
    | 'Includes preprint version'
    | 'Repository record'
    | 'Journal / other work';
  fullText?: {
    provider: 'Europe PMC' | 'arXiv';
    url: string;
    license: string | null;
    retrievedAt: string;
    note: string;
    truncated: boolean;
  };
};
export type Citation = { paperId: string; passageId: string };
export type ResearchLeadContext = {
  question: string;
  reason: string;
  evidence: Citation[];
};
export type Requirement = {
  category: keyof Resources;
  term: string;
  evidence: Citation;
};
export type Hypothesis = {
  id: string;
  title: string;
  hypothesis: string;
  evidenceSummary: string;
  gapRationale: string;
  proposedApproach: string;
  evidence: Citation[];
  assumptions: string[];
  incompatibilities: string[];
  unknowns: string[];
  requirements: Requirement[];
  experiment: {
    question: string;
    data: string;
    method: string;
    baseline: string;
    measure: string;
    against: string;
    independent?: string;
    dependent?: string;
    confounders?: string;
    supports?: string;
  };
};
export type Analysis = {
  cost?: AnalysisCost;
  origin: 'live' | 'saved-example';
  status: 'connections' | 'insufficient';
  summary: string;
  hypotheses: Hypothesis[];
};
export type SearchResult = {
  queryPlan?: QueryPlan;
  performedQueries?: PerformedQuery[];
  papers: Paper[];
  query: string;
  retrievedAt: string;
  sourceStatuses?: SearchSourceStatus[];
};
export type PriorWork = {
  status:
    | 'Related prior work found.'
    | 'No close match found in these searches; novelty is not established.'
    | 'Search incomplete.';
  searches: { query: string; error: string | null }[];
  matches: { paper: Paper; overlap: string }[];
};
export type Fit = {
  status: 'Appears compatible' | 'Potential mismatch' | 'Unknown';
  rows: {
    requirement: Requirement;
    status: Fit['status'];
    explanation: string;
  }[];
  note: string;
};
export type Health = {
  analysisState?:
    'ready' | 'spending-disabled' | 'not-configured' | 'unreachable';
  analysisAvailable: boolean;
  reason: string;
  openalexKeyConfigured: boolean;
};

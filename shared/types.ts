export type Resources = {
  data: string;
  equipment: string;
  skills: string;
  deadline: string;
};
export type Brief = {
  question: string;
  fieldA: string;
  fieldB: string;
  resources: Resources;
};
export type Passage = { id: string; text: string };
export type Paper = {
  id: string;
  title: string;
  year: number | null;
  doi: string | null;
  url: string;
  authors: string[];
  abstract: string | null;
  passages: Passage[];
  retrievedAt: string;
  coverage: 'Abstract only' | 'Metadata only';
};
export type Citation = { paperId: string; passageId: string };
export type Requirement = {
  category: keyof Resources;
  term: string;
  evidence: Citation;
};
export type Hypothesis = {
  id: string;
  title: string;
  hypothesis: string;
  contributionA: string;
  contributionB: string;
  transfer: string;
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
  };
};
export type Analysis = {
  origin: 'live' | 'saved-example';
  status: 'connections' | 'insufficient';
  summary: string;
  hypotheses: Hypothesis[];
};
export type SearchResult = {
  papers: Paper[];
  query: string;
  retrievedAt: string;
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
  analysisAvailable: boolean;
  reason: string;
  openalexKeyConfigured: boolean;
};

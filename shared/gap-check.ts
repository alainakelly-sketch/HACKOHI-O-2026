import type { AnalysisCost } from './analysis-cost';
import type { Brief, Citation, Paper, SearchSourceStatus } from './types';
export type GapCheckGap = {
  id: string;
  question: string;
  reason: string;
  evidence: Citation[];
};
export type GapCheckDecision = 'continue' | 'replication' | 'extension';
export type GapCheckMatch = {
  paperId: string;
  question: string;
  establishes: string;
  addresses: 'all' | 'part' | 'unclear' | 'different';
  uncertainty: string;
  evidence: Citation[];
};
export type GapCheckStatus =
  | 'Existing research may address this gap'
  | 'Related work addresses part of this gap'
  | 'No close match found in the searches completed'
  | 'Check incomplete or inconclusive';
export type GapCheckResult = {
  checkId: string;
  gap: GapCheckGap;
  scopeKey: string;
  status: GapCheckStatus;
  summary: string;
  candidates: Paper[];
  matches: GapCheckMatch[];
  searches: { query: string; error: string | null }[];
  sourceStatuses: SearchSourceStatus[];
  checkedAt: string;
  aiCompleted: boolean;
  assessmentWarnings?: string[];
  limitedCoverageEligible?: boolean;
  limitedCoverageAccepted?: boolean;
  assessmentNotNeeded?: boolean;
  reviewed: boolean;
  decision: GapCheckDecision | null;
  cost?: AnalysisCost;
};
export type GapCheckContext = Pick<
  GapCheckResult,
  | 'checkId'
  | 'gap'
  | 'status'
  | 'summary'
  | 'matches'
  | 'searches'
  | 'checkedAt'
  | 'decision'
  | 'assessmentWarnings'
  | 'limitedCoverageAccepted'
  | 'limitedCoverageEligible'
> & { candidates: Paper[] };
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
/** Shared request identity, not an authorization token. The server independently
 * checks this identity, expiry, source text and explicit review state. */
export function gapCheckScopeKey(
  brief: Brief,
  paperIds: string[],
  gap: GapCheckGap,
): string {
  return JSON.stringify({
    question: normalize(brief.question),
    field: normalize(brief.field),
    paperIds: [...paperIds].sort(),
    gap: {
      id: gap.id,
      question: normalize(gap.question),
      reason: normalize(gap.reason),
      evidence: gap.evidence.map((c) => `${c.paperId}:${c.passageId}`).sort(),
    },
  });
}

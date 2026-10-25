import type { SearchResult } from '../shared/types';
import type { AnalysisCost } from '../shared/analysis-cost';
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public cost?: AnalysisCost,
    public searchDetails?: Pick<
      SearchResult,
      'queryPlan' | 'performedQueries' | 'sourceStatuses'
    >,
  ) {
    super(message);
  }
}

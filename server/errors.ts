import type { AnalysisCost } from '../shared/analysis-cost';
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public cost?: AnalysisCost,
  ) {
    super(message);
  }
}

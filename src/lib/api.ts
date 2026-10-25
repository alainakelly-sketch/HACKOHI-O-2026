import type { SearchResult } from '../../shared/types';
import type { AnalysisCost } from '../../shared/analysis-cost';
export class ApiError extends Error {
  constructor(
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
export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers:
      body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  let data: T & {
    error?: string;
    cost?: AnalysisCost;
    searchDetails?: ApiError['searchDetails'];
  };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    throw new Error(
      'The PaperBridge server is not responding correctly. Start both the website and backend with npm run dev.',
    );
  }
  if (!response.ok)
    throw new ApiError(
      data.error || 'Request failed. Please retry.',
      data.cost,
      data.searchDetails,
    );
  return data;
}

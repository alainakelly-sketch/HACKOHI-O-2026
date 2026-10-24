import { createHash } from 'node:crypto';
import type { Paper, SearchResult } from '../shared/types';
import { AppError } from './errors';
import { networkFetch } from './http';
type RawWork = {
  id?: string;
  display_name?: string;
  publication_year?: number;
  doi?: string | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: { author?: { display_name?: string } }[];
};
export function reconstructAbstract(
  index: RawWork['abstract_inverted_index'],
): string | null {
  if (!index || typeof index !== 'object') return null;
  const words = new Map<number, string>();
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions)
      if (Number.isInteger(pos) && pos >= 0 && pos < 20000)
        words.set(pos, word);
  }
  const text = [...words]
    .sort((a, b) => a[0] - b[0])
    .map(([, word]) => word)
    .join(' ')
    .trim();
  return text || null;
}
export function normalizeWork(
  raw: RawWork,
  at = new Date().toISOString(),
): Paper | null {
  if (
    !raw.id ||
    !/^https:\/\/openalex.org\/W\d+$/.test(raw.id) ||
    !raw.display_name?.trim()
  )
    return null;
  const id = raw.id.split('/').pop()!;
  const abstract = reconstructAbstract(raw.abstract_inverted_index);
  const hash = abstract
    ? createHash('sha256').update(abstract).digest('hex').slice(0, 12)
    : '';
  const passages = abstract
    ? Array.from(
        new Intl.Segmenter('en', { granularity: 'sentence' }).segment(abstract),
        (part, i) => ({
          id: `${id}:abstract:${hash}:${i + 1}`,
          text: part.segment.trim(),
        }),
      ).filter((p) => p.text)
    : [];
  const doi =
    raw.doi && /^https:\/\/doi.org\/10\./i.test(raw.doi) ? raw.doi : null;
  return {
    id,
    title: raw.display_name,
    year: Number.isInteger(raw.publication_year) ? raw.publication_year! : null,
    doi,
    url: raw.id,
    authors: (raw.authorships ?? [])
      .slice(0, 3)
      .map((a) => a.author?.display_name)
      .filter((s): s is string => !!s),
    abstract,
    passages,
    retrievedAt: at,
    coverage: abstract ? 'Abstract only' : 'Metadata only',
  };
}
export function deduplicate(papers: Paper[]) {
  const ids = new Set<string>(),
    dois = new Set<string>();
  return papers.filter((p) => {
    const doi = p.doi?.toLowerCase().replace(/\/$/, '');
    if (ids.has(p.id) || (doi && dois.has(doi))) return false;
    ids.add(p.id);
    if (doi) dois.add(doi);
    return true;
  });
}
export function createPaperStore() {
  const cache = new Map<string, { paper: Paper; expires: number }>();
  return {
    put(papers: Paper[]) {
      for (const paper of papers) {
        if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
        cache.set(paper.id, { paper, expires: Date.now() + 3600000 });
      }
    },
    get(ids: string[]) {
      return ids.map((id) => {
        const entry = cache.get(id);
        if (!entry || entry.expires < Date.now())
          throw new AppError(
            409,
            'Selected source text has expired or is unknown. Search again and reselect your papers.',
          );
        return entry.paper;
      });
    },
  };
}
export function createOpenAlex(fetcher: typeof fetch = networkFetch) {
  return async (query: string): Promise<SearchResult> => {
    const url = new URL('https://api.openalex.org/works');
    url.searchParams.set('search', query);
    url.searchParams.set('per-page', '16');
    url.searchParams.set(
      'select',
      'id,display_name,publication_year,doi,abstract_inverted_index,authorships',
    );
    if (process.env.OPENALEX_API_KEY)
      url.searchParams.set('api_key', process.env.OPENALEX_API_KEY);
    if (process.env.OPENALEX_EMAIL)
      url.searchParams.set('mailto', process.env.OPENALEX_EMAIL);
    let response: Response;
    try {
      response = await fetcher(url, {
        signal: AbortSignal.timeout(20000),
        headers: { Accept: 'application/json' },
      });
    } catch {
      throw new AppError(
        502,
        'OpenAlex could not be reached. Check network access to api.openalex.org, then retry.',
      );
    }
    if (response.status === 429)
      throw new AppError(
        429,
        'OpenAlex rate limit reached. Wait before retrying; no automatic retries were sent.',
      );
    if ([401, 403].includes(response.status))
      throw new AppError(
        502,
        'OpenAlex access was denied. Check the network allowlist and, if OpenAlex requires it, a server-side OPENALEX_API_KEY.',
      );
    if (!response.ok)
      throw new AppError(
        502,
        'OpenAlex returned an error. Please try again later.',
      );
    let body: { results?: RawWork[] };
    try {
      body = (await response.json()) as typeof body;
    } catch {
      throw new AppError(502, 'OpenAlex returned an unreadable response.');
    }
    if (!Array.isArray(body.results))
      throw new AppError(502, 'OpenAlex returned an unexpected response.');
    const retrievedAt = new Date().toISOString();
    const papers = deduplicate(
      body.results
        .map((raw) => normalizeWork(raw, retrievedAt))
        .filter((p): p is Paper => p !== null),
    );
    return { query, papers, retrievedAt };
  };
}

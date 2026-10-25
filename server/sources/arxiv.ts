import { compileProviderQuery } from '../../shared/research-query';
import { load } from 'cheerio';
import { XMLValidator } from 'fast-xml-parser';
import type { Paper, SearchResult } from '../../shared/types';
import { AppError } from '../errors';
import { networkFetch } from '../http';
import { readSource, sourcePassages } from './common';
export function arxivIdentifier(value: string): string | null {
  const id = value
    .replace(/^https?:\/\/(?:export\.)?arxiv.org\/(?:abs|html|pdf)\//i, '')
    .replace(/\.pdf$/i, '');
  return /^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/.test(id)
    ? id
    : null;
}
export function parseArxiv(
  xml: string,
  at = new Date().toISOString(),
): Paper[] {
  if (XMLValidator.validate(xml) !== true)
    throw new AppError(
      502,
      'arXiv returned incomplete or malformed XML. This search is incomplete.',
    );
  const $ = load(xml, { xml: true });
  if ($('feed').length !== 1)
    throw new AppError(502, 'arXiv returned an unexpected response.');
  if (
    $('entry > id')
      .toArray()
      .some((el) => $(el).text().includes('/api/errors'))
  )
    throw new AppError(
      502,
      'arXiv rejected this search. Try simpler keywords.',
    );
  return $('entry')
    .toArray()
    .flatMap((entry) => {
      const el = $(entry),
        external = arxivIdentifier(el.find('id').first().text().trim()),
        title = el.find('title').first().text().replace(/\s+/g, ' ').trim();
      if (!external || !title) return [];
      const id = `ARXIV_${external.replace('/', '_')}`,
        url = `https://arxiv.org/abs/${external}`;
      const abstract =
        el.find('summary').first().text().replace(/\s+/g, ' ').trim() || null;
      const doiText = el.find('arxiv\\:doi, doi').first().text().trim();
      const doi = /^10\.\d{4,9}\/\S+$/i.test(doiText)
        ? `https://doi.org/${doiText}`
        : null;
      const year = Number(el.find('published').first().text().slice(0, 4));
      return [
        {
          id,
          title,
          doi,
          url,
          year: Number.isInteger(year) && year > 1000 ? year : null,
          authors: el
            .find('author > name')
            .toArray()
            .slice(0, 3)
            .map((a) => $(a).text().trim()),
          abstract,
          passages: abstract ? sourcePassages(id, abstract) : [],
          retrievedAt: at,
          coverage: abstract ? 'Abstract only' : 'Metadata only',
          sources: [{ provider: 'arXiv', id: external, url }],
          identifiers: { arxiv: external },
          freeCopies: [
            {
              url: `https://arxiv.org/pdf/${external}`,
              via: 'arXiv',
              format: 'PDF',
            },
          ],
          publicationType: 'Preprint',
        } satisfies Paper,
      ];
    });
}
// The legacy API requires one connection at a time and >=3 seconds between
// requests. Cache repeated queries rather than making users spend that budget twice.
let queue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;
let pendingCount = 0;
export function createArxiv(
  fetcher: typeof fetch = networkFetch,
  spacingMs = 3100,
) {
  const cache = new Map<string, { result: SearchResult; expires: number }>();
  const inFlight = new Map<string, Promise<SearchResult>>();
  async function retrieve(query: string): Promise<SearchResult> {
    if (pendingCount >= 4)
      throw new AppError(
        429,
        'arXiv is busy. Wait a moment before searching again.',
      );
    pendingCount++;
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const wait = nextRequestAt - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      if (!query.trim())
        return { query, papers: [], retrievedAt: new Date().toISOString() };
      const url = new URL('https://export.arxiv.org/api/query');
      url.searchParams.set(
        'search_query',
        compileProviderQuery(query, 'arXiv'),
      );
      url.searchParams.set('start', '0');
      url.searchParams.set('max_results', '12');
      url.searchParams.set('sortBy', 'relevance');
      let response: Response;
      try {
        response = await fetcher(url, {
          signal: AbortSignal.timeout(20000),
          headers: { Accept: 'application/atom+xml' },
        });
      } catch {
        throw new AppError(
          502,
          'arXiv could not be reached. Check network access or try again later.',
        );
      }
      const xml = await readSource(response, 'arXiv');
      const retrievedAt = new Date().toISOString();
      return { query, papers: parseArxiv(xml, retrievedAt), retrievedAt };
    } finally {
      nextRequestAt = Date.now() + spacingMs;
      pendingCount--;
      release();
    }
  }
  return async (query: string): Promise<SearchResult> => {
    const key = query.trim().toLowerCase();
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now())
      return { ...cached.result, query };
    const existing = inFlight.get(key);
    if (existing) return existing;
    const pending = retrieve(query);
    inFlight.set(key, pending);
    try {
      const result = await pending;
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, { result, expires: Date.now() + 600000 });
      return result;
    } finally {
      if (inFlight.get(key) === pending) inFlight.delete(key);
    }
  };
}

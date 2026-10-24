import { load } from 'cheerio';
import type { Paper, SearchResult } from '../../shared/types';
import { AppError } from '../errors';
import { networkFetch } from '../http';
import { readSource, safeSourceUrl, sourcePassages } from './common';
const asText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
// Europe PMC's core search response exposes abstracts and the OA status/PMCID.
export function normalizeEuropePMC(
  value: unknown,
  at = new Date().toISOString(),
): Paper | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>,
    title = asText(raw.title),
    externalId = asText(raw.id),
    source = asText(raw.source);
  if (
    !title ||
    !externalId ||
    !/^[A-Z]+$/.test(source) ||
    !/^[A-Za-z0-9.]+$/.test(externalId)
  )
    return null;
  const pmcid = asText(raw.pmcid).toUpperCase();
  const validPMC = /^PMC\d+$/.test(pmcid) ? pmcid : null;
  const id = validPMC ?? `EPMC_${source}_${externalId}`;
  const url = `https://europepmc.org/article/${encodeURIComponent(source)}/${encodeURIComponent(externalId)}`;
  const doiText = asText(raw.doi).replace(
    /^https?:\/\/(?:dx\.)?doi.org\//i,
    '',
  );
  const doi = /^10\.\d{4,9}\/\S+$/i.test(doiText)
    ? `https://doi.org/${doiText}`
    : null;
  const abstractHtml = asText(raw.abstractText);
  const abstract = abstractHtml
    ? load(
        abstractHtml.replace(/<\/(?:p|div|h[1-6]|section|sec|title)>/gi, '$& '),
      )('body')
        .text()
        .replace(/\s+/g, ' ')
        .trim() || null
    : null;
  const journalInfo =
    raw.journalInfo && typeof raw.journalInfo === 'object'
      ? (raw.journalInfo as Record<string, unknown>)
      : {};
  const yearCandidates = [
    Number(raw.pubYear),
    Number(asText(raw.firstPublicationDate).match(/^(\d{4})-/)?.[1]),
    Number(journalInfo.yearOfPublication),
  ];
  const year =
    yearCandidates.find((n) => Number.isInteger(n) && n > 1000 && n < 3000) ??
    null;
  const isOA = raw.isOpenAccess === 'Y';
  return {
    id,
    title,
    doi,
    url,
    year,
    authors: asText(raw.authorString).split(/,\s*/).filter(Boolean).slice(0, 3),
    abstract,
    passages: abstract ? sourcePassages(id, abstract) : [],
    retrievedAt: at,
    coverage: abstract ? 'Abstract only' : 'Metadata only',
    sources: [{ provider: 'Europe PMC', id: externalId, url }],
    identifiers: validPMC ? { pmcid: validPMC } : {},
    freeCopies:
      isOA && validPMC
        ? [
            {
              url: `https://europepmc.org/articles/${validPMC}`,
              via: 'Europe PMC / PubMed Central',
              format: 'HTML',
            },
          ]
        : [],
    publicationType: source === 'PPR' ? 'Preprint' : 'Journal / other work',
  };
}
export function createEuropePMC(fetcher: typeof fetch = networkFetch) {
  return async (query: string): Promise<SearchResult> => {
    const url = new URL(
      'https://www.ebi.ac.uk/europepmc/webservices/rest/search',
    );
    // Quoted keyword clauses prevent user-entered search operators overriding the OA filter.
    const terms = query.match(/[\p{L}\p{N}_-]+/gu) ?? [];
    if (!terms.length)
      return { papers: [], query, retrievedAt: new Date().toISOString() };
    url.searchParams.set(
      'query',
      `(${terms
        .slice(0, 40)
        .map((t) => `"${t}"`)
        .join(' AND ')}) AND OPEN_ACCESS:Y`,
    );
    url.searchParams.set('format', 'json');
    url.searchParams.set('resultType', 'core');
    url.searchParams.set('pageSize', '12');
    let response: Response;
    try {
      response = await fetcher(url, {
        signal: AbortSignal.timeout(20000),
        headers: { Accept: 'application/json' },
      });
    } catch {
      throw new AppError(
        502,
        'Europe PMC could not be reached. Check network access or try again later.',
      );
    }
    const text = await readSource(response, 'Europe PMC');
    let data: { resultList?: { result?: unknown[] } };
    try {
      data = JSON.parse(text);
    } catch {
      throw new AppError(502, 'Europe PMC returned an unreadable response.');
    }
    if (!Array.isArray(data?.resultList?.result))
      throw new AppError(502, 'Europe PMC returned an unexpected response.');
    const retrievedAt = new Date().toISOString();
    const papers = data.resultList.result
      .map((r) => normalizeEuropePMC(r, retrievedAt))
      .filter((p): p is Paper => !!p);
    return { query, papers, retrievedAt };
  };
}
export { safeSourceUrl };

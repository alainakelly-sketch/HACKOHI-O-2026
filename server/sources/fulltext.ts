import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { XMLValidator } from 'fast-xml-parser';
import type { Paper, Passage } from '../../shared/types';
import { AppError } from '../errors';
import { networkFetch } from '../http';
import { arxivIdentifier } from './arxiv';
import { readSource, sourcePassages } from './common';

const TEXT_LIMIT = 350_000;
const REDIRECT_LIMIT = 3;
function validArxivID(value: string | undefined): string | null {
  if (!value) return null;
  const identifier = arxivIdentifier(value);
  return identifier === value ? identifier : null;
}
function sameArxivVersion(actual: string, expected: string): boolean {
  return /v\d+$/.test(expected)
    ? actual === expected
    : actual.replace(/v\d+$/, '') === expected;
}
export function canRetrieveFullText(paper: Paper) {
  return !!(
    (paper.identifiers?.pmcid && /^PMC\d+$/.test(paper.identifiers.pmcid)) ||
    validArxivID(paper.identifiers?.arxiv)
  );
}
function paragraphsToPassages(
  paper: Paper,
  items: { section: string; text: string }[],
) {
  const contentHash = createHash('sha256')
    .update(JSON.stringify(items))
    .digest('hex')
    .slice(0, 12);
  let length = 0;
  let truncated = false;
  const passages: Passage[] = [];
  for (const item of items) {
    const remaining = TEXT_LIMIT - length;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    // The prefix is still verbatim source text. Its coverage is explicitly an
    // excerpt, including when a single source paragraph exceeds the limit.
    const text = item.text.slice(0, remaining);
    if (text.length < item.text.length) truncated = true;
    length += text.length;
    passages.push({
      id: `${paper.id}:full-text:${contentHash}:${passages.length + 1}`,
      text,
      kind: 'full-text',
      section: item.section,
    });
    if (truncated) break;
  }
  if (!passages.length)
    throw new AppError(
      422,
      'No readable article-body text was available. The paper stays abstract-only; use its free-copy link to read it at the source.',
    );
  return { passages, truncated };
}
export function parsePMCText(xml: string, paper: Paper): Paper {
  if (XMLValidator.validate(xml) !== true)
    throw new AppError(
      422,
      'The PMC response contained malformed or incomplete XML. No text was accepted.',
    );
  const $ = load(xml, { xml: true });
  const article = $('article').first();
  // Match the main article's front matter, not an ID embedded in a related
  // article, figure, supplementary item or body paragraph.
  const pmcID = article
    .children('front')
    .find('article-id[pub-id-type="pmc"],article-id[pub-id-type="pmcid"]')
    .first()
    .text()
    .trim()
    .replace(/^PMC/i, '');
  if (
    !article.length ||
    !paper.identifiers?.pmcid ||
    !/^PMC\d+$/.test(paper.identifiers.pmcid) ||
    `PMC${pmcID}` !== paper.identifiers.pmcid
  )
    throw new AppError(
      422,
      'The full-text response did not match the selected PMC article. No text was accepted.',
    );
  article
    .find('script,style,table-wrap,fig,supplementary-material,ref-list')
    .remove();
  const body = article.children('body');
  const items = body
    .find('p')
    .toArray()
    .filter((el) => !$(el).parents('p').length)
    .map((el) => ({
      section:
        $(el).closest('sec').children('title').first().text().trim() ||
        'Article body',
      text: $(el).text().replace(/\s+/g, ' ').trim(),
    }))
    .filter((p) => p.text);
  const { passages, truncated } = paragraphsToPassages(paper, items);
  const license =
    article
      .children('front')
      .find('permissions license')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500) || null;
  const abstractNode = article.children('front').find('abstract').first();
  const abstractParagraphs = abstractNode
    .find('p')
    .toArray()
    .filter((el) => !$(el).parents('p').length)
    .map((el) => $(el).text().replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const importedAbstract =
    paper.abstract ??
    (abstractParagraphs.join(' ') ||
      abstractNode.text().replace(/\s+/g, ' ').trim() ||
      null);
  const abstractPassages = paper.abstract
    ? paper.passages.filter((p) => p.kind !== 'full-text')
    : importedAbstract
      ? sourcePassages(paper.id, importedAbstract)
      : [];
  const xmlYear = Number(
    article.children('front').find('pub-date year').first().text(),
  );
  return {
    ...paper,
    year:
      paper.year ??
      (Number.isInteger(xmlYear) && xmlYear > 1000 && xmlYear < 3000
        ? xmlYear
        : null),
    abstract: importedAbstract,
    passages: [...abstractPassages, ...passages],
    coverage: truncated ? 'Full text excerpt' : 'Full text retrieved',
    fullText: {
      provider: 'Europe PMC',
      url: `https://europepmc.org/articles/${paper.identifiers.pmcid}`,
      license,
      retrievedAt: new Date().toISOString(),
      truncated,
      note: 'Article-body paragraphs retrieved from Europe PMC / PubMed Central XML. Figures, tables, references and supplements are not included; formulas and formatting may be flattened. Read the original for those details.',
    },
  };
}
export function parseArxivText(
  html: string,
  paper: Paper,
  retrievedUrl?: string,
): Paper {
  const expectedID = validArxivID(paper.identifiers?.arxiv);
  if (!expectedID)
    throw new AppError(
      422,
      'The selected paper has no valid arXiv identifier.',
    );
  const $ = load(html);
  const article = $('article.ltx_document').first();
  if (!article.length)
    throw new AppError(
      422,
      'arXiv has no readable HTML version for this paper. Use its free PDF link; PDF extraction is not implemented.',
    );
  const declaredIDs = [
    ...$('link[rel="canonical"]')
      .toArray()
      .map((el) => $(el).attr('href') ?? ''),
    ...$('meta[name="citation_arxiv_id"]')
      .toArray()
      .map((el) => $(el).attr('content') ?? ''),
  ]
    .filter(Boolean)
    .map((value) => arxivIdentifier(value.replace(/^arXiv:/i, '')));
  const declaredVersions = new Set(
    declaredIDs.filter((id): id is string => !!id && /v\d+$/.test(id)),
  );
  if (
    declaredVersions.size > 1 ||
    declaredIDs.some(
      (id) =>
        !id ||
        id.replace(/v\d+$/, '') !== expectedID.replace(/v\d+$/, '') ||
        (/v\d+$/.test(id) && /v\d+$/.test(expectedID) && id !== expectedID),
    )
  )
    throw new AppError(
      422,
      'The HTML version did not match the selected arXiv paper or version.',
    );
  const finalID = retrievedUrl ? arxivIdentifier(retrievedUrl) : null;
  if (retrievedUrl && (!finalID || !sameArxivVersion(finalID, expectedID)))
    throw new AppError(
      422,
      'The retrieved arXiv URL did not match the selected paper or version.',
    );
  if (
    finalID &&
    /v\d+$/.test(finalID) &&
    declaredVersions.size &&
    !declaredVersions.has(finalID)
  )
    throw new AppError(
      422,
      'The arXiv metadata disagreed with the retrieved article version.',
    );
  // Pin the source URL to the resolved version when it is supplied by arXiv.
  const sourceID =
    declaredIDs.find((id) => id && /v\d+$/.test(id)) || finalID || expectedID;
  article
    .find('script,style,nav,figure,table,.ltx_bibliography,.ltx_abstract')
    .remove();
  const items = article
    .find('p.ltx_p')
    .toArray()
    .filter((el) => !$(el).parents('p.ltx_p').length)
    .map((el) => ({
      section:
        $(el)
          .closest('section')
          .children('h2,h3,h4,h5,h6')
          .first()
          .text()
          .replace(/\s+/g, ' ')
          .trim() || 'Article body',
      text: $(el).text().replace(/\s+/g, ' ').trim(),
    }))
    .filter((p) => p.text);
  const { passages, truncated } = paragraphsToPassages(paper, items);
  return {
    ...paper,
    passages: [
      ...paper.passages.filter((p) => p.kind !== 'full-text'),
      ...passages,
    ],
    coverage: truncated ? 'Full text excerpt' : 'Full text retrieved',
    fullText: {
      provider: 'arXiv',
      url: `https://arxiv.org/html/${sourceID}`,
      license: paper.freeCopies?.find((c) => c.license)?.license ?? null,
      retrievedAt: new Date().toISOString(),
      truncated,
      note: 'Article-body paragraphs retrieved from arXiv HTML. Figures, tables, references and supplements are not included; formulas and formatting may be flattened. This is an arXiv manuscript; check publication and review status separately.',
    },
  };
}
type Candidate = {
  url: string;
  parse: (text: string, paper: Paper, retrievedUrl?: string) => Paper;
  label: string;
  acceptsRedirect: (url: URL) => boolean;
};
async function fetchCandidate(candidate: Candidate, fetcher: typeof fetch) {
  let url = new URL(candidate.url);
  const signal = AbortSignal.timeout(25000);
  for (let redirects = 0; ; redirects++) {
    const response = await fetcher(url.href, {
      signal,
      redirect: 'manual',
      headers: { Accept: 'application/xml,text/html' },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      const text = await readSource(response, candidate.label);
      return { text, url: url.href };
    }
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (redirects >= REDIRECT_LIMIT || !location)
      throw new AppError(
        502,
        `${candidate.label} redirected too many times or omitted its location. No text was accepted.`,
      );
    let next: URL;
    try {
      next = new URL(location, url);
    } catch {
      throw new AppError(
        502,
        `${candidate.label} returned an invalid redirect. No text was accepted.`,
      );
    }
    if (
      next.protocol !== 'https:' ||
      next.username ||
      next.password ||
      next.search ||
      next.hash ||
      next.origin !== new URL(candidate.url).origin ||
      !candidate.acceptsRedirect(next)
    )
      throw new AppError(
        502,
        `${candidate.label} redirected outside the selected trusted article. No text was accepted.`,
      );
    url = next;
  }
}
export function createFullTextRetriever(fetcher: typeof fetch = networkFetch) {
  return async (paper: Paper): Promise<Paper> => {
    if (paper.fullText) return paper;
    const candidates: Candidate[] = [];
    const pmcid = paper.identifiers?.pmcid;
    if (pmcid && /^PMC\d+$/.test(pmcid)) {
      const path = `/europepmc/webservices/rest/${pmcid}/fullTextXML`;
      candidates.push({
        url: `https://www.ebi.ac.uk${path}`,
        parse: parsePMCText,
        label: 'Europe PMC full text',
        acceptsRedirect: (url) =>
          url.pathname === path || url.pathname === `${path}/`,
      });
    }
    const arxiv = validArxivID(paper.identifiers?.arxiv);
    if (arxiv)
      candidates.push({
        url: `https://arxiv.org/html/${arxiv}`,
        parse: parseArxivText,
        label: 'arXiv full text',
        acceptsRedirect: (url) => {
          const actual = arxivIdentifier(url.href);
          return (
            url.pathname.startsWith('/html/') &&
            !!actual &&
            sameArxivVersion(actual, arxiv)
          );
        },
      });
    if (!candidates.length)
      throw new AppError(
        422,
        'A free copy is linked, but in-app text retrieval is not supported for this repository yet. Open the free-copy link to read it; no paywall is bypassed.',
      );
    let lastError: unknown;
    for (const candidate of candidates)
      try {
        const { text, url } = await fetchCandidate(candidate, fetcher);
        return candidate.parse(text, paper, url);
      } catch (error) {
        lastError = error;
      }
    if (lastError instanceof AppError) throw lastError;
    throw new AppError(
      502,
      'Free full text could not be retrieved. The source may be unavailable or lack a readable HTML/XML copy. Your abstract remains available.',
    );
  };
}

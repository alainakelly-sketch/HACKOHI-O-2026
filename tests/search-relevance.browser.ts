/** SYNTHETIC API fixtures only. This tests search UI behavior, not live providers. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import type { Paper } from '../shared/types';

const direct = 'Directly addresses the question';
const background = 'Related background or potentially transferable method';
const unclear = 'Relevance unclear';
const question = 'How does music affect time perception?';
const source = (
  id: string,
  title: string,
  abstract: string | null,
  classification: string,
  body = false,
) =>
  ({
    id,
    title,
    abstract,
    year: 2026,
    doi: null,
    url: `https://example.invalid/${id}`,
    authors: ['SYNTHETIC test author'],
    retrievedAt: 'synthetic',
    coverage: body
      ? 'Full text retrieved'
      : abstract
        ? 'Abstract only'
        : 'Metadata only',
    sources: [
      { provider: 'OpenAlex', id, url: `https://example.invalid/${id}` },
    ],
    passages: body
      ? [
          {
            id: `${id}:body`,
            kind: 'full-text',
            section: 'Results',
            text: 'SYNTHETIC: Music reduced pain intensity. Duration perception was not assessed.',
          },
        ]
      : abstract
        ? [
            {
              id: `${id}:abstract`,
              kind: 'abstract',
              section: 'Abstract',
              text: abstract,
            },
          ]
        : [],
    ...(body
      ? {
          fullText: {
            provider: 'Europe PMC',
            url: `https://example.invalid/${id}`,
            license: null,
            retrievedAt: 'synthetic',
            note: 'SYNTHETIC body fixture only.',
            truncated: false,
          },
        }
      : {}),
    relevance: {
      classification,
      explanation:
        classification === direct
          ? 'Both music and duration-perception outcomes are stated in the available title or abstract.'
          : classification === background
            ? 'Music is studied, but no duration-perception outcome is established by the abstract.'
            : 'No abstract is available; relevance beyond the title is uncertain.',
      matchedConcepts:
        classification === direct ? ['music', 'time perception'] : ['music'],
      missingConcepts: classification === direct ? [] : ['time perception'],
      evidence: [
        { field: abstract ? 'abstract' : 'title', text: abstract ?? title },
      ],
    },
  }) as Paper;
const papers: Paper[] = [
  source(
    'synthetic:duration',
    'SYNTHETIC Musical tempo and perceived duration',
    'SYNTHETIC: We tested musical tempo and duration estimates. Music altered perceived duration.',
    direct,
  ),
  source(
    'synthetic:pain-duration',
    'SYNTHETIC Music, pain and time perception',
    'SYNTHETIC: Participants listened to music during pain while reporting duration estimates.',
    direct,
  ),
  source(
    'synthetic:pain',
    'SYNTHETIC Music for pain relief',
    'SYNTHETIC: We measured music and pain intensity. Outcomes concerned pain ratings only.',
    background,
    true,
  ),
  source(
    'synthetic:metadata',
    'SYNTHETIC Music questionnaire record',
    null,
    unclear,
  ),
];
const concepts = [
  { label: 'music', terms: ['music', 'musical tempo'] },
  {
    label: 'time perception',
    terms: ['time perception', 'perceived duration', 'duration estimates'],
  },
];
const queryPlan = {
  question,
  concepts,
  variants: ['music "time perception"', 'music "duration estimates"'],
  note: 'SYNTHETIC query plan; no actual provider requests.',
};
const performedQueries = [
  {
    source: 'OpenAlex',
    query: 'music "time perception"',
    status: 'ok',
    message: null,
  },
  {
    source: 'Europe PMC',
    query: '(music) AND ("time perception" OR "duration estimates")',
    status: 'error',
    message: 'SYNTHETIC rate limit: retry later.',
  },
  {
    source: 'arXiv',
    query: 'all:music AND all:"time perception"',
    status: 'ok',
    message: null,
  },
];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const output = '/tmp/paperbridge-search';
await mkdir(output, { recursive: true });
async function expand(page: Page, text: string | RegExp) {
  const summary = page.locator('summary').filter({ hasText: text }).first();
  await summary.waitFor();
  if (
    !(await summary.evaluate(
      (node) => (node.parentElement as HTMLDetailsElement).open,
    ))
  )
    await summary.click();
}
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors: string[] = [],
    consoleErrors: string[] = [];
  const searches: URL[] = [];
  let analysisRequests = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/health')
      await route.fulfill({
        json: {
          analysisAvailable: false,
          analysisState: 'not-configured',
          reason: 'SYNTHETIC: model disabled.',
          openalexKeyConfigured: false,
        },
      });
    else if (url.pathname === '/api/search') {
      searches.push(url);
      await route.fulfill({
        json: {
          papers: searches.length === 1 ? papers : [papers[1], papers[3]],
          query: url.searchParams.get('q'),
          retrievedAt: 'synthetic',
          queryPlan,
          performedQueries,
          sourceStatuses: [
            {
              source: 'OpenAlex',
              status: 'ok',
              count: papers.length,
              message: null,
            },
            {
              source: 'Europe PMC',
              status: 'error',
              count: 0,
              message: 'SYNTHETIC rate limit: retry later.',
            },
            { source: 'arXiv', status: 'ok', count: 0, message: null },
          ],
        },
      });
    } else if (url.pathname === '/api/analyze') {
      analysisRequests++;
      await route.fulfill({
        status: 500,
        json: { error: 'No model calls permitted in this test.' },
      });
    } else
      throw new Error(`Unexpected synthetic-test request: ${url.pathname}`);
  });
  await page.goto(process.env.PAPERBRIDGE_TEST_URL || 'http://localhost:5173');
  assert.match(await page.title(), /PaperBridge/);
  await page.getByLabel('Research question', { exact: true }).fill(question);
  await page
    .getByLabel('Your field of interest', { exact: true })
    .fill('Psychology');
  await page
    .getByRole('button', { name: 'Find papers for this focus', exact: true })
    .click();
  const panel = page.locator('.paper-panel');
  await panel.getByRole('heading', { name: direct, exact: true }).waitFor();
  assert.equal(await panel.locator('#article-access').inputValue(), 'all');
  const firstRows = await panel
    .locator('.paper-list .paper-row:visible h3')
    .allTextContents();
  assert.deepEqual(
    firstRows.slice(0, 2),
    papers.slice(0, 2).map((paper) => paper.title),
  );
  const firstPaper = panel.locator('.paper-row').filter({
    has: page.getByRole('heading', { name: papers[0].title, exact: true }),
  });
  await firstPaper
    .getByText('Abstract only', { exact: true })
    .first()
    .waitFor();
  assert.equal(
    await firstPaper
      .getByText('Article body retrieved', { exact: true })
      .count(),
    0,
  );
  await firstPaper
    .getByText(papers[0].relevance!.explanation, { exact: true })
    .waitFor();
  await firstPaper
    .getByLabel(`Select ${papers[0].title}`, { exact: true })
    .check();
  await expand(page, 'Why this match?');
  await firstPaper
    .getByText(papers[0].abstract!, { exact: true })
    .first()
    .waitFor();
  const interpreted = page.getByLabel('Interpreted search concepts', {
    exact: true,
  });
  await interpreted.waitFor();
  assert.match(await interpreted.innerText(), /music/i);
  assert.match(await interpreted.innerText(), /time perception/i);
  await expand(page, 'Searches actually performed');
  await panel.getByText(performedQueries[1].query, { exact: true }).waitFor();
  await panel
    .getByText('SYNTHETIC rate limit: retry later.', { exact: true })
    .first()
    .waitFor();
  await expand(page, new RegExp(background));
  await panel
    .getByRole('heading', { name: papers[2].title, exact: true })
    .waitFor();
  await expand(page, new RegExp(unclear));
  await panel
    .getByRole('heading', { name: papers[3].title, exact: true })
    .waitFor();
  await panel
    .getByText(papers[3].relevance!.explanation, { exact: true })
    .waitFor();
  await page.evaluate(() => {
    document.querySelector('.paper-list')?.scrollTo(0, 0);
    scrollTo(0, 0);
  });
  await page.screenshot({
    path: `${output}/discovery-desktop.png`,
    fullPage: true,
  });

  await expand(page, /^Filters/);
  await panel.locator('#article-access').selectOption('verified');
  assert.equal(await panel.locator('.paper-row:visible').count(), 1);
  await panel
    .getByRole('heading', { name: papers[2].title, exact: true })
    .waitFor();
  const tray = panel.getByLabel('Selected papers', { exact: true });
  await tray
    .getByRole('button', { name: new RegExp(papers[0].title) })
    .waitFor();
  await panel
    .getByText(/records are hidden by your text-access requirement/)
    .waitFor();
  await page.screenshot({
    path: `${output}/full-text-filter.png`,
    fullPage: true,
  });
  await page
    .getByLabel('Search papers', { exact: true })
    .fill('music duration estimates');
  await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/search',
    ),
    panel.getByRole('button', { name: 'Search', exact: true }).click(),
  ]);
  assert.equal(
    await panel.locator('#article-access').inputValue(),
    'verified',
    'An explicit full-text filter must survive a new search.',
  );
  await panel
    .getByText(/No imported article body matches this access requirement/)
    .waitFor();
  await tray
    .getByRole('button', { name: new RegExp(papers[0].title) })
    .waitFor();
  await panel.locator('#article-access').selectOption('all');
  await expand(page, 'Edit interpreted concepts');
  await page
    .getByLabel('Concepts and related terms', { exact: true })
    .fill('music | musical tempo\ntime perception | duration estimates');
  await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/search',
    ),
    page
      .getByRole('button', { name: 'Apply concepts & search', exact: true })
      .click(),
  ]);
  assert.equal(searches.length, 3);
  assert.ok(
    searches[2].searchParams.get('concepts')?.includes('duration estimates'),
    'Explicit concept corrections must reach the search request.',
  );
  await tray
    .getByRole('button', { name: new RegExp(papers[0].title) })
    .waitFor();
  assert.equal(await panel.locator('#article-access').inputValue(), 'all');
  await page
    .getByRole('navigation', { name: 'Research pipeline' })
    .getByRole('button', { name: 'Search', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Focus', exact: true }).click();
  assert.equal(
    await page.getByLabel('Research question', { exact: true }).inputValue(),
    question,
    'Editing query concepts must not silently rewrite the research question.',
  );
  await page.getByRole('tab', { name: 'Papers', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `${output}/discovery-mobile.png`,
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.equal(analysisRequests, 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  console.log(
    'PASS (synthetic UI fixtures): relevance groups and explanations, abstract discovery, strict access filter, editable concepts, performed-query failure reporting, selected-paper preservation, unchanged focus, mobile/no paid calls.',
  );
} finally {
  await browser.close();
}

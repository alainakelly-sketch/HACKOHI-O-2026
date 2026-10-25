/** SYNTHETIC FIXTURES ONLY. All API calls are mocked; no paid model requests. */
import { chromium, type Page } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import type { Paper } from '../shared/types';

const question =
  'How does sleep duration affect memory recall in university students?';
const related: Paper[] = Array.from({ length: 4 }, (_, index) => ({
  id: `synthetic:sleep:${index}`,
  title: `SYNTHETIC Sleep duration and memory recall in university students ${index + 1}`,
  year: 2026,
  doi: null,
  url: `https://example.invalid/synthetic-sleep-${index}`,
  authors: ['Synthetic test author'],
  abstract: null,
  passages: [
    {
      id: `synthetic:sleep:${index}:methods`,
      kind: 'full-text',
      section: 'Methods',
      text: `We measured sleep duration and memory recall in university students using a daily sleep diary and a word recall task. The study population included university students.`,
    },
    {
      id: `synthetic:sleep:${index}:results`,
      kind: 'full-text',
      section: 'Results',
      text: `Our results show that longer sleep duration improved memory recall in university students. Diary completion was recorded for synthetic study ${index + 1}.`,
    },
    {
      id: `synthetic:sleep:${index}:limitations`,
      kind: 'full-text',
      section: 'Limitations',
      text: 'A limitation of this study is its small sample of university students. Future work should test sleep duration and memory recall during examinations.',
    },
  ],
  retrievedAt: '2026-10-24T00:00:00Z',
  coverage: 'Full text retrieved',
  fullText: {
    provider: 'Europe PMC',
    url: `https://example.invalid/synthetic-sleep-${index}`,
    license: null,
    retrievedAt: '2026-10-24T00:00:00Z',
    note: 'SYNTHETIC TEST FIXTURE, not a real paper.',
    truncated: false,
  },
}));
const unrelatedTexts = [
  [
    'Coral reef ecology',
    'Coral reef biodiversity depends on ocean temperature and marine conservation.',
  ],
  [
    'Quantum optical devices',
    'Quantum optical devices measure photon polarization in superconducting circuits.',
  ],
  [
    'Cretaceous fossils',
    'Cretaceous fossils reveal sedimentary patterns and ancient reptile morphology.',
  ],
  [
    'Urban rail networks',
    'Urban rail networks were assessed using commuter transport and station density.',
  ],
];
const weak = related.map((paper, index) => ({
  ...paper,
  id: `synthetic:unrelated:${index}`,
  title: `SYNTHETIC ${unrelatedTexts[index][0]}`,
  passages: [
    {
      id: `synthetic:unrelated:${index}:results`,
      kind: 'full-text' as const,
      section: 'Results',
      text: unrelatedTexts[index][1],
    },
  ],
}));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const base = process.env.PAPERBRIDGE_TEST_URL || 'http://localhost:5173';
const output = '/tmp/paperbridge-overlap';
await mkdir(output, { recursive: true });

async function prepare(page: Page, papers: Paper[]) {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const counts = { analysis: 0, unexpected: [] as string[] };
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/health') {
      await route.fulfill({
        json: {
          analysisAvailable: true,
          analysisState: 'ready',
          reason: 'SYNTHETIC readiness only.',
          openalexKeyConfigured: false,
        },
      });
    } else if (path === '/api/search') {
      await route.fulfill({
        json: {
          papers,
          query: 'SYNTHETIC search',
          retrievedAt: '2026-10-24T00:00:00Z',
          sourceStatuses: [],
        },
      });
    } else if (path === '/api/analyze') {
      counts.analysis++;
      await route.fulfill({
        status: 500,
        json: { error: 'Unexpected model call in local map test.' },
      });
    } else {
      counts.unexpected.push(path);
      await route.fulfill({
        status: 500,
        json: { error: 'Unexpected request in synthetic test.' },
      });
    }
  });
  await page.goto(base);
  assert.match(await page.title(), /PaperBridge/);
  await page.getByLabel('Research question', { exact: true }).fill(question);
  await page
    .getByLabel('Your field of interest', { exact: true })
    .fill('Neuroscience');
  await page
    .getByRole('button', { name: 'Find papers for this focus', exact: true })
    .click();
  for (const paper of papers)
    await page.getByLabel(`Select ${paper.title}`, { exact: true }).check();
  await page
    .getByRole('navigation', { name: 'Research pipeline' })
    .getByRole('button', { name: 'Mind map', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'Theme overlap map', exact: true })
    .waitFor();
  return { errors, consoleErrors, counts };
}
function verifyQuotes(quotes: string[], papers: Paper[]) {
  assert.ok(
    quotes.length > 0,
    'Details must include at least one source excerpt',
  );
  for (const quote of quotes)
    assert.ok(
      papers.some((paper) =>
        paper.passages.some((passage) => passage.text.includes(quote.trim())),
      ),
      `Quote not found in selected source text: ${quote}`,
    );
}
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const { errors, consoleErrors, counts } = await prepare(page, related);
  const themes = page.getByRole('button', { name: /^Explore theme: / });
  const overlaps = page.getByRole('button', { name: /^Explore overlap: / });
  const themeCount = await themes.count();
  assert.ok(
    themeCount >= 3 && themeCount <= 5,
    `Expected 3–5 supported themes, got ${themeCount}`,
  );
  for (let index = 0; index < themeCount; index++)
    assert.match(await themes.nth(index).innerText(), /4 papers/);
  assert.ok(
    (await overlaps.count()) > 0,
    'Related papers should produce an overlap',
  );
  assert.equal(await page.locator('.concept-conflicts').count(), 0);
  assert.equal(
    await page.getByRole('heading', { name: 'Conflicts', exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .getByText('These papers may not strongly match your question.', {
        exact: true,
      })
      .count(),
    0,
  );
  assert.ok((await page.getByText('Strong fit', { exact: true }).count()) > 0);
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.ok(
    (await page.locator('.concept-connectors .overlap-edge').count()) > 0,
    'Map must render relationships between overlap and theme nodes',
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({
    path: `${output}/related-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `${output}/related-mobile-top.png` });
  await page.screenshot({
    path: `${output}/related-mobile.png`,
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  const themeLabel = (await themes.first().getAttribute('aria-label'))!.replace(
    'Explore theme: ',
    '',
  );
  await themes.first().click();
  const detail = page.getByRole('region', {
    name: 'Concept details',
    exact: true,
  });
  await detail.waitFor();
  await detail
    .getByRole('heading', { name: themeLabel, exact: true })
    .waitFor();
  await detail
    .getByRole('heading', { name: 'What is known', exact: true })
    .waitFor();
  await detail
    .getByRole('heading', { name: 'What is missing', exact: true })
    .waitFor();
  await detail.getByText('Why investigate this', { exact: true }).waitFor();
  // Source excerpts may be progressively disclosed, but every rendered quote must
  // be an exact substring of a selected source and be inspectable in the dialog.
  const evidenceSummary = detail
    .locator('summary')
    .filter({ hasText: /source passages|supporting.*passages|evidence/i })
    .first();
  if (await evidenceSummary.count()) {
    const details = evidenceSummary.locator('..');
    if (
      !(await details.evaluate(
        (element) => (element as HTMLDetailsElement).open,
      ))
    )
      await evidenceSummary.click();
  }
  const themeQuotes = await detail.locator('blockquote').allTextContents();
  verifyQuotes(themeQuotes, related);
  assert.ok(
    themeQuotes.some((quote) =>
      quote.toLowerCase().includes(themeLabel.toLowerCase()),
    ),
    'Theme selection must show evidence mentioning that theme',
  );
  await detail
    .getByRole('button', {
      name: 'Inspect complete source passage',
      exact: true,
    })
    .first()
    .click();
  await page.getByRole('dialog').waitFor();
  assert.ok(
    (await page.getByRole('dialog').textContent())?.includes(
      'SYNTHETIC Sleep duration',
    ),
  );
  await page
    .getByRole('button', { name: 'Close evidence', exact: true })
    .click();
  const overlapLabel = (await overlaps
    .first()
    .getAttribute('aria-label'))!.replace('Explore overlap: ', '');
  await overlaps.first().click();
  await detail.waitFor();
  await detail
    .getByRole('heading', { name: overlapLabel, exact: true })
    .waitFor();
  const overlapSummary = detail
    .locator('summary')
    .filter({ hasText: /source passages|supporting.*passages|evidence/i })
    .first();
  assert.match(await overlapSummary.innerText(), /4 papers/);
  if (await overlapSummary.count()) {
    const details = overlapSummary.locator('..');
    if (
      !(await details.evaluate(
        (element) => (element as HTMLDetailsElement).open,
      ))
    )
      await overlapSummary.click();
  }
  verifyQuotes(await detail.locator('blockquote').allTextContents(), related);
  await page.screenshot({
    path: `${output}/overlap-detail.png`,
    fullPage: true,
  });
  await detail
    .getByRole('button', { name: 'Develop into a hypothesis', exact: true })
    .click();
  assert.equal(
    await page
      .getByRole('navigation', { name: 'Research pipeline' })
      .getByRole('button', { name: 'Hypothesis', exact: true })
      .getAttribute('aria-current'),
    'step',
  );
  assert.equal(counts.analysis, 0);
  await page
    .getByRole('navigation', { name: 'Research pipeline' })
    .getByRole('button', { name: 'Mind map', exact: true })
    .click();
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(counts.unexpected, []);
  await context.close();

  const weakContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const weakPage = await weakContext.newPage();
  const weakState = await prepare(weakPage, weak);
  await weakPage
    .getByText('These papers may not strongly match your question.', {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await weakPage.getByText('Weak fit', { exact: true }).count(),
    weak.length,
  );
  assert.equal(await weakPage.locator('.concept-conflicts').count(), 0);
  assert.equal(
    await weakPage
      .getByRole('heading', { name: 'Conflicts', exact: true })
      .count(),
    0,
  );
  await weakPage.evaluate(() =>
    window.scrollTo({ top: 0, behavior: 'instant' }),
  );
  assert.equal(await weakPage.locator('vite-error-overlay').count(), 0);
  await weakPage.screenshot({
    path: `${output}/weak-desktop.png`,
    fullPage: true,
  });
  assert.equal(weakState.counts.analysis, 0);
  assert.deepEqual(weakState.errors, []);
  assert.deepEqual(weakState.consoleErrors, []);
  assert.deepEqual(weakState.counts.unexpected, []);
  await weakContext.close();
  console.log(
    'PASS: related themes and overlaps; exact source evidence and dialog; hypothesis handoff without model calls; weak-fit warning; no empty conflicts; desktop/mobile without overflow or page errors.',
  );
} finally {
  await browser.close();
}

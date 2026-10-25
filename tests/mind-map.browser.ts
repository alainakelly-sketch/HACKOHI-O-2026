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
    .getByRole('button', { name: 'Find gaps', exact: true })
    .click();
  await page.getByRole('heading', { name: 'Find gaps', exact: true }).waitFor();
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
  const state = await prepare(page, related);
  const detail = page.getByRole('region', { name: 'Selected gap finding' });
  await detail.waitFor();
  const id = await detail.getAttribute('data-finding-id');
  assert.ok(id);
  await detail.locator('.finding-evidence > summary').click();
  const expectedRefs = await detail
    .locator('.finding-source')
    .evaluateAll((nodes) =>
      nodes
        .map((n) =>
          [
            n.getAttribute('data-paper-id'),
            n.getAttribute('data-passage-id'),
          ].join(':'),
        )
        .sort(),
    );
  verifyQuotes(await detail.locator('blockquote').allTextContents(), related);
  await page.getByRole('tab', { name: 'Visual map', exact: true }).click();
  const map = page.locator('.gap-visual-map');
  assert.equal(await map.getAttribute('data-finding-id'), id);
  assert.equal(await map.locator('.concept-conflicts').count(), 0);
  const sourceBranch = map.locator('.gap-map-source > button');
  assert.equal(
    await sourceBranch.count(),
    1,
    'Map should contain only sources supporting selected author issue',
  );
  const relationship = map.locator('.relationship-node');
  await relationship.click();
  await sourceBranch.first().click();
  const actualRefs = await map
    .locator('.gap-map-evidence-node')
    .evaluateAll((nodes) =>
      nodes
        .map((n) =>
          [
            n.getAttribute('data-paper-id'),
            n.getAttribute('data-passage-id'),
          ].join(':'),
        )
        .sort(),
    );
  assert.deepEqual(actualRefs, expectedRefs);
  await map.locator('.gap-map-evidence-node').first().click();
  const drawer = map.getByRole('region', { name: 'Map evidence details' });
  await drawer.waitFor();
  verifyQuotes(await drawer.locator('blockquote').allTextContents(), related);
  await drawer
    .getByRole('button', { name: 'Open evidence inspector', exact: true })
    .click();
  await page.getByRole('dialog').waitFor();
  await page
    .getByRole('button', { name: 'Close evidence', exact: true })
    .click();
  await drawer
    .getByRole('button', { name: 'Close evidence details', exact: true })
    .click();
  assert.equal(
    await sourceBranch.first().getAttribute('aria-expanded'),
    'true',
  );
  assert.equal(await relationship.getAttribute('aria-expanded'), 'true');
  await page.getByRole('tab', { name: 'Gap findings', exact: true }).click();
  assert.equal(await detail.getAttribute('data-finding-id'), id);
  await page.getByRole('tab', { name: 'Visual map', exact: true }).click();
  assert.equal(
    await sourceBranch.first().getAttribute('aria-expanded'),
    'true',
  );
  await page.screenshot({
    path: `${output}/related-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
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
  assert.equal(state.counts.analysis, 0);
  assert.deepEqual(state.errors, []);
  assert.deepEqual(state.consoleErrors, []);
  assert.deepEqual(state.counts.unexpected, []);
  await context.close();
  const weakContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const weakPage = await weakContext.newPage();
  const weakState = await prepare(weakPage, weak);
  await weakPage.getByText(/No supported candidate is available yet/).waitFor();
  assert.equal(await weakPage.getByRole('radio').count(), 0);
  await weakPage.getByRole('tab', { name: 'Visual map', exact: true }).click();
  await weakPage.getByText(/No supported candidate is selected/).waitFor();
  assert.equal(
    await weakPage.locator('.gap-map-question').count(),
    0,
    'No invented question when sources lack a defensible lead',
  );
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
    'PASS: canonical selected-gap map and list share exact evidence; focused source branches and persistent state; no forced weak-source gap or empty conflict section; desktop/mobile. Synthetic mocks only.',
  );
} finally {
  await browser.close();
}

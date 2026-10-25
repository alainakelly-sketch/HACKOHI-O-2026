/** SYNTHETIC mocked paper retrieval only. No provider or paid model requests. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import type { Paper } from '../shared/types';
const methods = [
  'We implemented the analysis using Python on a laptop.',
  'We trained the model using a GPU.',
  'We implemented the analysis using MATLAB.',
  'The simulation took three days.',
];
const papers: Paper[] = methods.map((method, i) => ({
  id: `test:${i}`,
  title: `SYNTHETIC RESOURCE TEST ${i}`,
  year: 2026,
  doi: null,
  url: 'https://example.invalid/test',
  authors: [],
  abstract: null,
  passages: [
    { id: `method:${i}`, kind: 'full-text', section: 'Methods', text: method },
    {
      id: `limitation:${i}`,
      kind: 'full-text',
      section: 'Limitations',
      text: 'Future work should investigate larger network samples.',
    },
  ],
  retrievedAt: 'test',
  coverage: 'Full text retrieved',
  sources: [
    {
      provider: 'Europe PMC',
      id: `test:${i}`,
      url: 'https://example.invalid/test',
    },
  ],
  fullText: {
    provider: 'Europe PMC',
    url: 'https://example.invalid/test',
    license: null,
    retrievedAt: 'test',
    note: 'SYNTHETIC TEST',
    truncated: false,
  },
}));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
let searches = 0;
page.on('pageerror', (e) => errors.push(e.message));
await page.route('**/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/health')
    await route.fulfill({
      json: {
        analysisAvailable: false,
        analysisState: 'spending-disabled',
        reason: 'SYNTHETIC TEST: paid AI off.',
        openalexKeyConfigured: false,
      },
    });
  else if (path === '/api/search') {
    searches++;
    assert.match(
      new URL(route.request().url()).searchParams.get('q')!,
      /network/i,
    );
    await route.fulfill({
      json: {
        papers,
        query: 'network',
        retrievedAt: 'test',
        sourceStatuses: [],
      },
    });
  } else
    throw new Error(`Unexpected request ${path}; no model calls permitted.`);
});
const tab = (name: string) => page.getByRole('tab', { name, exact: true });
const stageFor = (name: string) =>
  ['Focus', 'Papers', 'Compare'].includes(name)
    ? 'Search'
    : name === 'Mind map'
      ? 'Mind map'
      : name === 'Experiment'
        ? 'Experiment'
        : 'Hypothesis';
async function closeEvidence() {
  const close = page.getByRole('button', {
    name: 'Close evidence',
    exact: true,
  });
  if (await close.isVisible()) await close.click();
}
async function open(name: string) {
  await closeEvidence();
  const stage = page
    .getByRole('navigation', { name: 'Research pipeline' })
    .getByRole('button', { name: new RegExp(stageFor(name)) });
  if ((await stage.getAttribute('aria-current')) !== 'step')
    await stage.click();
  await tab(name).click();
  assert.equal(await page.locator('[role=tabpanel]:visible').count(), 1);
  assert.ok((await page.getByRole('tab').count()) <= 3);
}
async function expand(text: string | RegExp) {
  const summary = page.locator('summary').filter({ hasText: text }).first();
  const details = summary.locator('xpath=ancestor::details');
  for (let i = 0; i < (await details.count()); i++) {
    const detail = details.nth(i);
    if (!(await detail.evaluate((element: HTMLDetailsElement) => element.open)))
      await detail.locator(':scope > summary').click();
  }
}
async function generate(name: string) {
  const button = page.getByRole('button', {
    name,
    exact: true,
    includeHidden: true,
  });
  const details = button.locator('xpath=ancestor::details');
  for (let i = 0; i < (await details.count()); i++) {
    const detail = details.nth(i);
    if (!(await detail.evaluate((element: HTMLDetailsElement) => element.open)))
      await detail.locator(':scope > summary').click();
  }
  await button.click();
}

try {
  await page.goto(process.env.PAPERBRIDGE_TEST_URL || 'http://localhost:5173');
  await page
    .getByLabel('Research question', { exact: true })
    .fill('How can network analysis be improved?');
  await page.getByLabel('Your field of interest').fill('Network science');
  assert.equal(
    await page
      .locator('#step-question')
      .getByLabel('Available equipment', { exact: true })
      .count(),
    0,
  );
  assert.equal(await page.locator('.sidebar').count(), 0);
  await open('Resources');
  await page.getByLabel('Available equipment', { exact: true }).fill('laptop');
  await page.getByLabel('Available skills', { exact: true }).fill('Python');
  await open('Focus');
  await open('Resources');
  assert.equal(
    await page.getByLabel('Available skills', { exact: true }).inputValue(),
    'Python',
  );
  assert.equal(searches, 0);
  await open('Focus');
  await page
    .getByRole('button', { name: 'Find papers for this focus' })
    .click();
  await page.locator('.paper-row').first().waitFor();
  assert.equal(await page.locator('.paper-row').count(), 4);
  assert.equal(
    await page.getByLabel('Resource filter', { exact: true }).count(),
    0,
  );
  const originalTitles = await page.locator('.paper-row h3').allTextContents();
  await open('Resources');
  await page.getByLabel('Available equipment', { exact: true }).fill('');
  await page.getByLabel('Available skills', { exact: true }).fill('');
  await open('Papers');
  assert.equal(await page.locator('.paper-row').count(), 4);
  assert.deepEqual(
    await page.locator('.paper-row h3').allTextContents(),
    originalTitles,
  );
  await open('Resources');
  await page.getByLabel('Available equipment', { exact: true }).fill('no GPU');
  await page.getByLabel('Project deadline', { exact: true }).fill('one day');
  await open('Papers');
  assert.equal(await page.locator('.paper-row').count(), 4);
  assert.deepEqual(
    await page.locator('.paper-row h3').allTextContents(),
    originalTitles,
  );
  assert.equal(searches, 1);
  assert.equal(
    await page
      .locator('.paper-row')
      .filter({ hasText: 'SYNTHETIC RESOURCE TEST 1' })
      .count(),
    1,
  );
  for (let i = 0; i < 3; i++)
    await page
      .getByLabel(`Select SYNTHETIC RESOURCE TEST ${i}`, { exact: true })
      .check();
  await open('Compare');
  await page.getByText('What they have in common', { exact: true }).waitFor();
  await page.getByText('How they differ', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Comparison paper A').inputValue(),
    'test:0',
  );
  await page.getByLabel('Comparison paper B').selectOption('test:2');
  await page.getByRole('button', { name: 'Method', exact: true }).click();
  await expand('Read source excerpt');
  const excerptSummaries = page
    .locator('.comparison-overview summary')
    .filter({ hasText: 'Read source excerpt' });
  for (let i = 0; i < (await excerptSummaries.count()); i++)
    if (
      !(await excerptSummaries
        .nth(i)
        .locator('xpath=..')
        .evaluate((d: HTMLDetailsElement) => d.open))
    )
      await excerptSummaries.nth(i).click();
  await page
    .locator('.comparison-overview')
    .getByText(methods[2], { exact: false })
    .waitFor();
  await page.getByRole('button', { name: 'Findings', exact: true }).click();
  await page.getByRole('button', { name: 'Limitations', exact: true }).click();
  await page
    .getByRole('button', { name: 'Inspect full passage' })
    .first()
    .click();
  await page.locator('#evidence-inspector blockquote').waitFor();
  await closeEvidence();
  assert.equal(await page.locator('.comparison-passages:visible').count(), 0);
  await page
    .getByText('Read full retrieved passages · optional deeper reading', {
      exact: true,
    })
    .click();
  assert.equal(await page.locator('.comparison-passages:visible').count(), 3);
  assert.equal(searches, 1);
  assert.deepEqual(errors, []);
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  await page
    .getByText('Read full retrieved passages · optional deeper reading', {
      exact: true,
    })
    .click();
  await mkdir('/tmp/paperbridge-resources', { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: '/tmp/paperbridge-resources/compare-desktop.png',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: '/tmp/paperbridge-resources/compare-mobile.png',
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  console.log(
    'PASS: resource notes never hide/reorder papers or rerun search, selected source evidence, two-paper comparison/aspects, optional reader, mobile. No paid requests.',
  );
} finally {
  await browser.close();
}

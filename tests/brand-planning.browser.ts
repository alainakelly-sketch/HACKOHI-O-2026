/** SYNTHETIC mocked retrieval/model responses only. No paid calls. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import type { Paper, Analysis } from '../shared/types';
const papers: Paper[] = Array.from({ length: 4 }, (_, i) => ({
  id: `test:${i}`,
  title: `SYNTHETIC PLANNING PAPER ${i}`,
  year: 2026,
  doi: null,
  url: 'https://example.invalid',
  authors: [],
  abstract: null,
  passages: [
    {
      id: `body:${i}`,
      kind: 'full-text',
      section: 'Methods',
      text: 'We used Python to examine network samples. Future work should investigate larger samples.',
    },
  ],
  retrievedAt: 'test',
  coverage: 'Full text retrieved',
  sources: [
    { provider: 'Europe PMC', id: `test:${i}`, url: 'https://example.invalid' },
  ],
  fullText: {
    provider: 'Europe PMC',
    url: 'https://example.invalid',
    license: null,
    retrievedAt: 'test',
    note: 'SYNTHETIC TEST',
    truncated: false,
  },
}));
const result: Analysis = {
  origin: 'live',
  status: 'connections',
  summary: 'SYNTHETIC MOCK: user-constrained proposal.',
  hypotheses: [
    {
      id: 'test-h',
      title: 'SYNTHETIC portable network test',
      hypothesis:
        'A small network comparison may distinguish the alternatives.',
      evidenceSummary: 'SYNTHETIC evidence.',
      gapRationale: 'SYNTHETIC limitation.',
      proposedApproach:
        'A proposed CPU-based first step, not an established protocol.',
      evidence: [
        { paperId: 'test:0', passageId: 'body:0' },
        { paperId: 'test:1', passageId: 'body:1' },
      ],
      assumptions: ['Synthetic assumption'],
      incompatibilities: ['Synthetic unknown'],
      unknowns: ['Synthetic unknown'],
      requirements: [],
      experiment: {
        question: 'Synthetic constrained plan',
        data: 'Synthetic public data',
        method: 'Synthetic CPU comparison',
        baseline: 'Synthetic baseline',
        measure: 'Synthetic measure',
        against: 'Synthetic counter-result',
      },
    },
  ],
};
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
let calls = 0,
  searches = 0;
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('**/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/health')
    await route.fulfill({
      json: {
        analysisAvailable: true,
        analysisState: 'ready',
        reason: 'SYNTHETIC readiness only.',
        openalexKeyConfigured: false,
      },
    });
  else if (path === '/api/search') {
    searches++;
    await route.fulfill({
      json: {
        papers,
        query: 'networks',
        retrievedAt: 'test',
        sourceStatuses: [],
      },
    });
  } else if (path === '/api/analyze') {
    calls++;
    assert.equal(
      route.request().postDataJSON().brief.resources.equipment,
      'Laptop, no GPU',
    );
    assert.equal(
      route.request().postDataJSON().brief.resources.deadline,
      'one week',
    );
    await route.fulfill({
      json: { analysisId: 'synthetic', sources: papers, result },
    });
  } else throw new Error(`Unexpected ${path}`);
});
const tab = (name: string) => page.getByRole('tab', { name, exact: true });
try {
  await page.goto(process.env.PAPERBRIDGE_TEST_URL || 'http://localhost:5173');
  await page.getByRole('img', { name: 'PaperBridge', exact: true }).waitFor();
  assert.ok(
    await page
      .getByRole('img', { name: 'PaperBridge', exact: true })
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  );
  assert.equal(
    await page.locator('link[rel=icon]').getAttribute('href'),
    '/paperbridge-icon.png',
  );
  await page
    .getByLabel('Research question', { exact: true })
    .fill('What improves network evaluation?');
  await page.getByLabel('Your field of interest').fill('Network science');
  await page
    .getByLabel('Available data', { exact: true })
    .fill('Public network data');
  await page
    .getByLabel('Available equipment', { exact: true })
    .fill('Laptop, no GPU');
  await page.getByLabel('Available skills', { exact: true }).fill('Python');
  await page.getByLabel('Project deadline', { exact: true }).fill('one week');
  await mkdir('/tmp/paperbridge-brand', { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/paperbridge-brand/focus-desktop.png' });
  await page
    .getByRole('button', { name: 'Find papers for this focus' })
    .click();
  await page.locator('.paper-row').first().waitFor();
  assert.equal(await page.locator('.paper-row').count(), 4);
  assert.equal(
    await page.getByLabel('Resource filter', { exact: true }).count(),
    0,
  );
  for (let i = 0; i < 4; i++)
    await page
      .getByLabel(`Select SYNTHETIC PLANNING PAPER ${i}`, { exact: true })
      .check();
  await tab('AI hypotheses').click();
  await page
    .getByText('Resources guiding the next hypothesis and experiment', {
      exact: true,
    })
    .waitFor();
  await page
    .locator('.hypothesis-resource-context')
    .getByText('Laptop, no GPU', { exact: true })
    .waitFor();
  assert.equal(calls, 0);
  await page
    .getByRole('button', { name: 'Develop AI gap hypotheses', exact: true })
    .click();
  await page
    .getByText('SYNTHETIC portable network test', { exact: true })
    .waitFor();
  await page
    .getByRole('button', { name: 'Plan an experiment', exact: true })
    .click();
  assert.match(
    await page
      .getByLabel('Resource constraints and unresolved questions', {
        exact: true,
      })
      .inputValue(),
    /Laptop, no GPU/,
  );
  await page
    .getByLabel('Proposed method', { exact: true })
    .fill('Keep my edited method');
  await tab('Focus').click();
  await page.getByLabel('Project deadline', { exact: true }).fill('one day');
  await tab('Papers').click();
  assert.equal(await page.locator('.paper-row').count(), 4);
  await tab('AI hypotheses').click();
  await page
    .getByText('Resource notes changed after this analysis.', { exact: false })
    .waitFor();
  assert.equal(calls, 1);
  await tab('Experiment').click();
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'Keep my edited method',
  );
  await page
    .locator('.planning-resource-context')
    .getByText('one day', { exact: true })
    .waitFor();
  await page
    .getByRole('button', {
      name: 'Add current resource notes to this plan · free',
      exact: true,
    })
    .click();
  assert.match(
    await page
      .getByLabel('Resource constraints and unresolved questions', {
        exact: true,
      })
      .inputValue(),
    /Project deadline: one day/,
  );
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'Keep my edited method',
  );
  assert.equal(calls, 1);
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export current plan', exact: true })
    .click();
  const saved = await download;
  const exported = JSON.parse(await readFile((await saved.path())!, 'utf8'));
  assert.match(exported.fields.constraints, /Project deadline: one day/);
  assert.equal(exported.fields.method, 'Keep my edited method');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: '/tmp/paperbridge-brand/experiment-desktop.png',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: '/tmp/paperbridge-brand/experiment-mobile.png',
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  assert.equal(searches, 1);
  console.log(
    'PASS: logo/favicon load, resource notes preserve source list, model request receives constraints, current/old plan resources differentiated, stale warning, free explicit notes append preserves edits/export, desktop/mobile. Synthetic mocks only.',
  );
} finally {
  await browser.close();
}

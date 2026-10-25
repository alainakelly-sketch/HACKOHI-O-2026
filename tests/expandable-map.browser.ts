/** SYNTHETIC FIXTURES ONLY. All API responses mocked; no paid API calls. */
import { chromium, type Locator, type Page } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import type { Analysis, Paper } from '../shared/types';

const question =
  'How does sleep duration affect memory recall in university students?';
const papers: Paper[] = Array.from({ length: 4 }, (_, index) => ({
  id: `synthetic:expand:${index}`,
  title: `SYNTHETIC Sleep duration and memory recall ${index + 1}`,
  year: 2026,
  doi: null,
  url: `https://example.invalid/expand-${index}`,
  authors: ['Synthetic test author'],
  abstract:
    'Synthetic abstract: sleep duration and memory recall in university students.',
  passages: [
    {
      id: `synthetic:expand:${index}:methods`,
      kind: 'full-text',
      section: 'Methods',
      text: 'We measured sleep duration and memory recall in university students using sleep diaries and a word recall task.',
    },
    {
      id: `synthetic:expand:${index}:results`,
      kind: 'full-text',
      section: 'Results',
      text: 'Our results show that sleep duration improved memory recall in university students.',
    },
    {
      id: `synthetic:expand:${index}:gap`,
      kind: 'full-text',
      section: 'Limitations',
      text:
        index === 0
          ? 'Future work should test sleep duration and memory recall in shift workers.'
          : `A limitation of this study is that sleep duration was evaluated only in university students from site ${index}.`,
    },
  ],
  retrievedAt: '2026-10-24T00:00:00Z',
  coverage: 'Full text retrieved',
  sources: [
    {
      provider: 'Europe PMC',
      id: `synthetic:expand:${index}`,
      url: `https://example.invalid/expand-${index}`,
    },
  ],
  fullText: {
    provider: 'Europe PMC',
    url: `https://example.invalid/expand-${index}`,
    license: null,
    retrievedAt: '2026-10-24T00:00:00Z',
    note: 'SYNTHETIC fixture, not a real paper.',
    truncated: false,
  },
}));
const analysis: Analysis = {
  origin: 'live',
  status: 'connections',
  summary: 'SYNTHETIC mocked analysis; not a live AI response.',
  hypotheses: [
    {
      id: 'synthetic-expand-h1',
      title: 'SYNTHETIC selected hypothesis',
      hypothesis:
        'Sleep duration changes memory recall in this synthetic test.',
      evidenceSummary: 'SYNTHETIC evidence only.',
      gapRationale: 'SYNTHETIC limitation.',
      proposedApproach: 'SYNTHETIC approach.',
      evidence: [
        { paperId: papers[0].id, passageId: papers[0].passages[0].id },
        { paperId: papers[1].id, passageId: papers[1].passages[0].id },
      ],
      assumptions: [],
      incompatibilities: [],
      unknowns: ['SYNTHETIC unknown'],
      requirements: [],
      experiment: {
        question: 'SYNTHETIC plan question',
        data: 'SYNTHETIC data',
        method: 'SYNTHETIC draft method',
        baseline: 'SYNTHETIC baseline',
        measure: 'SYNTHETIC recall measure',
        against: 'SYNTHETIC contrary result',
      },
    },
  ],
};
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors: string[] = [];
const unexpected: string[] = [];
const calls = { search: 0, analysis: 0 };
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
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
    calls.search++;
    await route.fulfill({
      json: {
        papers,
        query: question,
        retrievedAt: 'test',
        sourceStatuses: [],
      },
    });
  } else if (path === '/api/analyze') {
    calls.analysis++;
    await route.fulfill({
      json: {
        analysisId: 'synthetic-expand-analysis',
        result: analysis,
        sources: papers,
      },
    });
  } else {
    unexpected.push(path);
    await route.fulfill({
      status: 500,
      json: { error: 'Unexpected test request' },
    });
  }
});
async function open(name: string) {
  const stage = ['Focus', 'Papers', 'Compare'].includes(name)
    ? 'Search'
    : name === 'Gap leads'
      ? 'Mind map'
      : name === 'Experiment'
        ? 'Experiment'
        : 'Hypothesis';
  await page
    .getByRole('navigation', { name: 'Research pipeline' })
    .getByRole('button', { name: stage, exact: true })
    .click();
  await page.getByRole('tab', { name, exact: true }).click();
}
async function expandDetails(summary: Locator) {
  const parent = summary.locator('..');
  if (!(await parent.evaluate((e) => (e as HTMLDetailsElement).open)))
    await summary.click();
}
async function noJump(button: Locator) {
  await button.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => window.scrollY);
  await button.click();
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.scrollY);
  assert.ok(
    Math.abs(after - before) <= 3,
    `Ordinary node click jumped page: ${before} → ${after}`,
  );
}
async function generate() {
  const button = page.getByRole('button', {
    name: 'Develop AI gap hypotheses',
    exact: true,
  });
  const ancestors = button.locator('xpath=ancestor::details');
  for (let i = 0; i < (await ancestors.count()); i++) {
    const detail = ancestors.nth(i);
    if (!(await detail.evaluate((e) => (e as HTMLDetailsElement).open)))
      await detail.locator(':scope > summary').click();
  }
  await button.click();
}
try {
  await page.goto(process.env.PAPERBRIDGE_TEST_URL || 'http://localhost:5173');
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
  await open('Gap leads');
  const list = page.locator('.gap-panel');
  await list
    .getByRole('heading', { name: 'Research gap leads', exact: true })
    .waitFor();
  const gapRows = list.locator('[data-gap-id]');
  assert.ok(
    (await gapRows.count()) > 0,
    'Independent gap list should have normal results',
  );
  const map = page.locator('.explore-connections');
  const mapSummary = map.locator(':scope > summary');
  if (await map.evaluate((e) => (e as HTMLDetailsElement).open))
    await mapSummary.click();
  assert.equal(
    await map.evaluate((e) => (e as HTMLDetailsElement).open),
    false,
  );
  assert.equal(
    await gapRows.first().isVisible(),
    true,
    'Gap results must remain available while map is collapsed',
  );
  const expectedGapId =
    (await gapRows
      .filter({
        has: page.getByText(
          'Future work should test sleep duration and memory recall in shift workers.',
          { exact: false },
        ),
      })
      .first()
      .getAttribute('data-gap-id')) ||
    (await gapRows.first().getAttribute('data-gap-id'));
  await mapSummary.click();
  const themes = map.locator('button[aria-expanded][aria-controls]');
  assert.ok(
    (await themes.count()) >= 2,
    'Need independently expandable theme branches',
  );
  const first = themes.nth(0),
    second = themes.nth(1);
  await noJump(first);
  assert.equal(await first.getAttribute('aria-expanded'), 'true');
  const firstControl = await first.getAttribute('aria-controls');
  await page.locator(`[id="${firstControl}"]`).waitFor();
  await noJump(second);
  assert.equal(await second.getAttribute('aria-expanded'), 'true');
  await noJump(first);
  assert.equal(await first.getAttribute('aria-expanded'), 'false');
  assert.equal(
    await second.getAttribute('aria-expanded'),
    'true',
    'Collapsing one branch must preserve another',
  );
  await noJump(first);
  await open('Compare');
  await open('Gap leads');
  assert.equal(
    await first.getAttribute('aria-expanded'),
    'true',
    'Workflow changes must preserve expansion',
  );
  assert.equal(await second.getAttribute('aria-expanded'), 'true');
  // Exact gap IDs shared by map children and independent readable list.
  const mapGap = map.locator(`button[data-gap-id="${expectedGapId}"]`).first();
  if (!(await mapGap.isVisible())) {
    for (let i = 0; i < (await themes.count()); i++)
      if ((await themes.nth(i).getAttribute('aria-expanded')) === 'false')
        await themes.nth(i).click();
  }
  await mapGap.waitFor();
  await noJump(mapGap);
  const drawer = map.getByRole('region', {
    name: 'Concept details',
    exact: true,
  });
  await drawer.waitFor();
  assert.equal(await drawer.getAttribute('data-gap-id'), expectedGapId);
  await drawer
    .getByRole('heading', { name: 'What is known', exact: true })
    .waitFor();
  await drawer
    .getByRole('heading', { name: 'What is missing', exact: true })
    .waitFor();
  const evidenceSummary = drawer
    .locator('summary')
    .filter({ hasText: /supporting.*passages|evidence/i })
    .first();
  if (await evidenceSummary.count()) await expandDetails(evidenceSummary);
  const expectedRow = list.locator(`[data-gap-id="${expectedGapId}"]`);
  const expectedPaperId = await expectedRow.getAttribute('data-paper-id');
  const expectedPaper = papers.find((p) => p.id === expectedPaperId)!;
  assert.ok(expectedPaper, 'Gap row must preserve selected source identity');
  for (const quote of await drawer.locator('blockquote').allTextContents())
    assert.ok(
      expectedPaper.passages.some((p) => p.text.includes(quote.trim())),
      'Map and list must use the same actual source text',
    );
  await drawer
    .getByRole('button', {
      name: 'Inspect complete source passage',
      exact: true,
    })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const metadata = dialog.locator('.source-metadata > summary').first();
  if (await metadata.count()) await expandDetails(metadata);
  assert.ok((await dialog.innerText()).includes(expectedPaper.passages[2].id));
  await page
    .getByRole('button', { name: 'Close evidence', exact: true })
    .click();
  await drawer
    .getByRole('button', { name: 'Close details', exact: true })
    .click();
  assert.equal(
    await first.getAttribute('aria-expanded'),
    'true',
    'Closing details preserves expanded branches',
  );
  assert.equal(calls.analysis, 0);
  assert.equal(calls.search, 1, 'Map display actions do not rerun retrieval');
  await map.getByRole('button', { name: 'Collapse all', exact: true }).click();
  for (let i = 0; i < (await themes.count()); i++)
    assert.equal(await themes.nth(i).getAttribute('aria-expanded'), 'false');
  await map.getByRole('button', { name: 'Fit map', exact: true }).click();
  await map
    .getByRole('button', { name: 'Restore spacing', exact: true })
    .waitFor();
  await first.focus();
  await first.press('Enter');
  assert.equal(await first.getAttribute('aria-expanded'), 'true');
  await first.press('Space');
  assert.equal(await first.getAttribute('aria-expanded'), 'false');
  await noJump(first);
  await noJump(second);
  // Keep a selected hypothesis and an edited plan while inspecting gap evidence.
  await open('AI hypotheses');
  await generate();
  await page
    .getByText('SYNTHETIC selected hypothesis', { exact: true })
    .first()
    .waitFor();
  await page
    .getByRole('button', { name: 'Plan an experiment', exact: true })
    .first()
    .click();
  await page
    .getByLabel('Proposed method', { exact: true })
    .fill('User-edited method survives source inspection.');
  await open('Gap leads');
  await list
    .locator(`[data-gap-id="${expectedGapId}"]`)
    .getByRole('button', { name: 'Inspect evidence', exact: true })
    .click();
  await page.getByRole('dialog').waitFor();
  await page
    .getByRole('button', { name: 'Close evidence', exact: true })
    .click();
  await mapGap.click();
  const currentDrawer = map.getByRole('region', {
    name: 'Concept details',
    exact: true,
  });
  const currentEvidence = currentDrawer
    .locator('summary')
    .filter({ hasText: /supporting.*passages|evidence/i })
    .first();
  if (await currentEvidence.count()) await expandDetails(currentEvidence);
  await currentDrawer
    .getByRole('button', {
      name: 'Inspect complete source passage',
      exact: true,
    })
    .first()
    .click();
  await page.getByRole('dialog').waitFor();
  await page
    .getByRole('button', { name: 'Close evidence', exact: true })
    .click();
  await open('AI hypotheses');
  await page
    .locator('.hypothesis-result-card.selected')
    .getByText('SYNTHETIC selected hypothesis', { exact: true })
    .waitFor();
  await open('Experiment');
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'User-edited method survives source inspection.',
  );
  // Source removal invalidates current gap details while retaining user plan edits.
  await open('Papers');
  await page
    .getByLabel(`Select ${expectedPaper.title}`, { exact: true })
    .uncheck();
  await open('Gap leads');
  assert.equal(
    await list.locator(`[data-gap-id="${expectedGapId}"]`).count(),
    0,
  );
  assert.equal(
    await map.locator(`button[data-gap-id="${expectedGapId}"]`).count(),
    0,
  );
  assert.equal(
    await map.locator(`[data-gap-id="${expectedGapId}"][role=region]`).count(),
    0,
    'Removed source evidence must not remain current',
  );
  await open('Experiment');
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'User-edited method survives source inspection.',
  );
  await open('Gap leads');
  const output = '/tmp/paperbridge-expand';
  await mkdir(output, { recursive: true });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await map.locator('.concept-map-viewport').evaluate((element) => {
    element.scrollTop = 0;
    element.scrollLeft = 0;
  });
  await page.screenshot({ path: `${output}/laptop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (let i = 0; i < (await themes.count()); i++)
    if ((await themes.nth(i).getAttribute('aria-expanded')) === 'false')
      await themes.nth(i).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await map.locator('.concept-map-viewport').evaluate((element) => {
    element.scrollTop = 0;
    element.scrollLeft = 0;
  });
  await page.screenshot({ path: `${output}/narrow.png`, fullPage: true });
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  assert.equal(calls.search, 1);
  assert.equal(
    calls.analysis,
    1,
    'Only the explicit synthetic generation request is allowed',
  );
  console.log(
    'PASS: independent gap list; expandable independent branches; inline no-jump details; shared gap IDs/evidence; retained hypothesis/edited plan; tab/source updates; laptop/narrow layout; no automatic retrieval or model calls.',
  );
} finally {
  await browser.close();
}

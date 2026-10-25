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
  const close = page.getByRole('button', {
    name: 'Close evidence',
    exact: true,
  });
  if (await close.isVisible()) await close.click();
  const stage =
    name === 'Focus'
      ? 'Focus'
      : ['Papers', 'Compare'].includes(name)
        ? 'Papers'
        : name === 'Experiment'
          ? 'Experiment'
          : 'Find gaps';
  await page
    .getByRole('navigation', { name: 'Research pipeline' })
    .getByRole('button', { name: stage, exact: true })
    .click();
  const child =
    name === 'Papers'
      ? 'Search & select'
      : name === 'Compare'
        ? 'Read & compare'
        : name === 'Visual map'
          ? 'Visual map'
          : ['Gap leads', 'AI hypotheses', 'Resources'].includes(name)
            ? 'Gap findings'
            : null;
  if (child) await page.getByRole('tab', { name: child, exact: true }).click();
  if (['Resources', 'AI hypotheses'].includes(name)) {
    const development = page.locator('.gap-development');
    if (!(await development.evaluate((e: HTMLDetailsElement) => e.open)))
      await development.locator(':scope > summary').click();
    if (name === 'Resources') {
      const resources = page.locator('.gap-resources');
      if (!(await resources.evaluate((e: HTMLDetailsElement) => e.open)))
        await resources.locator(':scope > summary').click();
    }
  }
  assert.equal(await page.locator('[role=tabpanel]:visible').count(), 1);
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
    includeHidden: true,
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
  const finding = page.getByRole('region', { name: 'Selected gap finding' });
  await finding.waitFor();
  const expectedGapId = await finding.getAttribute('data-finding-id');
  assert.ok(expectedGapId);
  assert.equal(
    await page
      .getByRole('tab', { name: 'Gap findings', exact: true })
      .getAttribute('aria-selected'),
    'true',
  );
  await expandDetails(finding.locator('.finding-evidence > summary'));
  const reference = await finding
    .locator('.finding-source')
    .first()
    .evaluate((e) => ({
      paperId: e.getAttribute('data-paper-id'),
      passageId: e.getAttribute('data-passage-id'),
    }));
  const expectedPaper = papers.find((p) => p.id === reference.paperId)!;
  assert.ok(expectedPaper);
  await open('Visual map');
  const map = page.locator('.gap-visual-map');
  assert.equal(await map.getAttribute('data-finding-id'), expectedGapId);
  const sources = map.locator('.gap-map-source > button');
  const relationship = map.locator('.relationship-node');
  const unresolved = map.locator('.unresolved-node');
  await noJump(sources.first());
  await noJump(relationship);
  assert.equal(await sources.first().getAttribute('aria-expanded'), 'true');
  assert.equal(await relationship.getAttribute('aria-expanded'), 'true');
  await noJump(sources.first());
  assert.equal(await sources.first().getAttribute('aria-expanded'), 'false');
  assert.equal(await relationship.getAttribute('aria-expanded'), 'true');
  await noJump(sources.first());
  await open('Compare');
  await open('Visual map');
  assert.equal(await sources.first().getAttribute('aria-expanded'), 'true');
  assert.equal(await relationship.getAttribute('aria-expanded'), 'true');
  const leaf = map.locator(
    `.gap-map-evidence-node[data-paper-id="${reference.paperId}"][data-passage-id="${reference.passageId}"]`,
  );
  await noJump(leaf);
  const drawer = map.getByRole('region', { name: 'Map evidence details' });
  await drawer.waitFor();
  assert.equal(await drawer.getAttribute('data-paper-id'), reference.paperId);
  assert.equal(
    await drawer.getAttribute('data-passage-id'),
    reference.passageId,
  );
  for (const quote of await drawer.locator('blockquote').allTextContents())
    assert.ok(
      expectedPaper.passages.some((p) => p.text.includes(quote.trim())),
    );
  await drawer
    .getByRole('button', { name: 'Open evidence inspector', exact: true })
    .click();
  await page.getByRole('dialog').waitFor();
  const metadata = page
    .getByRole('dialog')
    .locator('.source-metadata > summary');
  await expandDetails(metadata);
  assert.ok(
    (await page.getByRole('dialog').innerText()).includes(reference.passageId!),
  );
  await page
    .getByRole('button', { name: 'Close evidence', exact: true })
    .click();
  await drawer
    .getByRole('button', { name: 'Close evidence details', exact: true })
    .click();
  assert.equal(await sources.first().getAttribute('aria-expanded'), 'true');
  await map.getByRole('button', { name: 'Collapse all', exact: true }).click();
  assert.equal(await sources.first().getAttribute('aria-expanded'), 'false');
  assert.equal(await relationship.getAttribute('aria-expanded'), 'false');
  await sources.first().focus();
  await sources.first().press('Enter');
  assert.equal(await sources.first().getAttribute('aria-expanded'), 'true');
  await sources.first().press('Space');
  assert.equal(await sources.first().getAttribute('aria-expanded'), 'false');
  await noJump(sources.first());
  await noJump(unresolved);
  assert.equal(calls.analysis, 0);
  assert.equal(calls.search, 1);
  await open('AI hypotheses');
  await generate();
  await page
    .getByRole('region', { name: 'Selected gap finding' })
    .getByRole('heading', {
      name: 'SYNTHETIC selected hypothesis',
      exact: true,
    })
    .waitFor();
  await page
    .getByRole('button', { name: 'Plan experiment', exact: true })
    .click();
  await page
    .getByLabel('Proposed method', { exact: true })
    .fill('User-edited method survives source inspection.');
  await open('Gap leads');
  await page
    .locator(`.finding-choice[data-finding-id="${expectedGapId}"]`)
    .getByRole('radio')
    .check();
  assert.equal(await finding.getAttribute('data-finding-id'), expectedGapId);
  await expandDetails(finding.locator('.finding-evidence > summary'));
  await finding
    .getByRole('button', { name: 'Inspect evidence', exact: true })
    .first()
    .click();
  await page.getByRole('dialog').waitFor();
  await page
    .getByRole('button', { name: 'Close evidence', exact: true })
    .click();
  await open('Visual map');
  assert.equal(await map.getAttribute('data-finding-id'), expectedGapId);
  await leaf.click();
  await drawer
    .getByRole('button', { name: 'Open evidence inspector', exact: true })
    .click();
  await page.getByRole('dialog').waitFor();
  await page
    .getByRole('button', { name: 'Close evidence', exact: true })
    .click();
  await open('Experiment');
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'User-edited method survives source inspection.',
  );
  await open('Papers');
  await page
    .getByLabel(`Select ${expectedPaper.title}`, { exact: true })
    .uncheck();
  await open('Gap leads');
  assert.equal(
    await page
      .locator(`.finding-choices [data-finding-id="${expectedGapId}"]`)
      .count(),
    0,
  );
  await open('Visual map');
  assert.notEqual(await map.getAttribute('data-finding-id'), expectedGapId);
  assert.equal(
    await map.getByRole('region', { name: 'Map evidence details' }).count(),
    0,
  );
  await open('Experiment');
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'User-edited method survives source inspection.',
  );
  await open('Visual map');
  const output = '/tmp/paperbridge-expand';
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/laptop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/narrow.png`, fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  assert.equal(calls.search, 1);
  assert.equal(calls.analysis, 1);
  console.log(
    'PASS: selected canonical gap, independent inline branches/evidence, shared source IDs, selected hypothesis/edited plan retention, tab/source updates and keyboard/mobile behavior. Synthetic mocked generation only.',
  );
} finally {
  await browser.close();
}

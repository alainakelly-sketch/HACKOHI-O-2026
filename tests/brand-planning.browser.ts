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
result.hypotheses.push({
  ...structuredClone(result.hypotheses[0]),
  id: 'test-h2',
  title: 'SYNTHETIC second original proposal',
});
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
const aliases: Record<string, string> = {
  Papers: 'Search & select',
  Compare: 'Read & compare',
  'Gap leads': 'Gap findings',
  'AI hypotheses': 'Gap findings',
  Resources: 'Gap findings',
};
const tab = (name: string) =>
  page.getByRole('tab', { name: aliases[name] ?? name, exact: true });
async function closeEvidence() {
  const close = page.getByRole('button', {
    name: 'Close evidence',
    exact: true,
  });
  if (await close.isVisible()) await close.click();
}
async function open(name: string) {
  await closeEvidence();
  const stageName =
    name === 'Focus'
      ? 'Focus'
      : name === 'Experiment'
        ? 'Experiment'
        : ['Papers', 'Compare'].includes(name)
          ? 'Papers'
          : 'Find gaps';
  const stage = page
    .getByRole('navigation', { name: 'Research pipeline' })
    .getByRole('button', { name: stageName, exact: true });
  if ((await stage.getAttribute('aria-current')) !== 'step')
    await stage.click();
  if (!['Focus', 'Experiment'].includes(name)) await tab(name).click();
  if (['AI hypotheses', 'Resources'].includes(name))
    await expand('Develop a candidate with AI');
  if (name === 'Resources') await expand('Planning resources · optional');
  assert.equal(await page.locator('[role=tabpanel]:visible').count(), 1);
  assert.ok((await page.getByRole('tab').count()) <= 2);
}
async function expand(text: string | RegExp) {
  const summary = page
    .locator('[role=tabpanel]:visible')
    .locator('summary')
    .filter({ hasText: text })
    .first();
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
    .getByRole('link', { name: 'PaperBridge research workspace', exact: true })
    .waitFor();
  const logo = page.getByRole('img', { name: 'PaperBridge logo', exact: true });
  await logo.waitFor();
  assert.equal(
    await logo.evaluate(
      (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
    ),
    true,
  );
  await page.evaluate(() => document.fonts.ready);
  const favicon = await page.request.get(
    new URL('/paperbridge-icon.png', page.url()).toString(),
  );
  assert.equal(favicon.status(), 200);
  assert.match(favicon.headers()['content-type'], /image\/png/);
  const fonts = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const title = getComputedStyle(document.querySelector('h1')!);
    const box = document.querySelector('.brand')!.getBoundingClientRect();
    return {
      bodyFamily: body.fontFamily,
      titleFamily: title.fontFamily,
      bodyWeight: body.fontWeight,
      titleWeight: title.fontWeight,
      left: box.left,
      top: box.top,
    };
  });
  assert.match(fonts.bodyFamily, /Manrope/);
  assert.match(fonts.titleFamily, /Manrope/);
  assert.equal(await page.locator('.brand-name').count(), 0);
  assert.equal(await logo.getAttribute('src'), '/paperbridge-logo.png');
  assert.equal(fonts.bodyWeight, '400');
  assert.equal(fonts.titleWeight, '500');
  assert.ok(fonts.left < 40 && fonts.top < 40);
  assert.equal(
    await page.locator('link[rel=icon]').getAttribute('href'),
    '/paperbridge-icon.png',
  );
  await page
    .getByLabel('Research question', { exact: true })
    .fill('What improves network evaluation?');
  await page.getByLabel('Your field of interest').fill('Network science');
  assert.equal(
    await page
      .getByRole('navigation', { name: 'Research pipeline' })
      .getByRole('button')
      .count(),
    4,
  );
  assert.ok((await page.getByRole('tab').count()) <= 3);
  assert.equal(await page.locator('.sidebar').count(), 0);
  assert.equal(
    await page
      .locator('#step-question')
      .getByLabel('Available data', { exact: true })
      .count(),
    0,
  );
  await open('Resources');
  await page
    .getByRole('heading', {
      name: 'Resources for your hypothesis',
      exact: true,
    })
    .waitFor();
  await page
    .getByLabel('Available data', { exact: true })
    .fill('Public network data');
  await page
    .getByLabel('Available equipment', { exact: true })
    .fill('Laptop, no GPU');
  await page.getByLabel('Available skills', { exact: true }).fill('Python');
  await page.getByLabel('Project deadline', { exact: true }).fill('one week');
  await mkdir('/tmp/paperbridge-minimal', { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: '/tmp/paperbridge-minimal/resources-desktop.png',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: '/tmp/paperbridge-minimal/resources-mobile.png',
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole('button', { name: 'Use these resource notes', exact: true })
    .click();
  assert.equal(
    await tab('AI hypotheses').getAttribute('aria-selected'),
    'true',
  );
  assert.equal(calls, 0);
  assert.equal(searches, 0);
  await open('Focus');
  await open('Resources');
  assert.equal(
    await page.getByLabel('Project deadline', { exact: true }).inputValue(),
    'one week',
  );
  await open('Focus');
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
  await open('AI hypotheses');
  await open('Resources');
  assert.equal(
    await page.getByLabel('Available equipment', { exact: true }).inputValue(),
    'Laptop, no GPU',
  );
  await page
    .getByRole('button', { name: 'Use these resource notes', exact: true })
    .click();
  assert.equal(calls, 0);
  await generate('Develop AI gap hypotheses');
  await page
    .getByRole('region', { name: 'Selected gap finding' })
    .getByRole('heading', {
      name: 'SYNTHETIC portable network test',
      exact: true,
    })
    .waitFor();
  await page
    .getByRole('button', { name: 'Plan experiment', exact: true })
    .first()
    .click();
  await expand('Constraints & open questions');
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
  await open('Resources');
  await page.getByLabel('Project deadline', { exact: true }).fill('one day');
  await open('Papers');
  assert.equal(await page.locator('.paper-row').count(), 4);
  await open('AI hypotheses');
  await page
    .getByText('Resource notes changed after this analysis.', { exact: false })
    .waitFor();
  assert.equal(calls, 1);
  await open('Experiment');
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'Keep my edited method',
  );
  await expand('Planning resources');
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
  await expand('Constraints & open questions');
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
  await open('AI hypotheses');
  await page
    .getByRole('radiogroup', { name: 'Candidate gaps' })
    .getByRole('radio')
    .last()
    .check();
  await page
    .getByRole('button', { name: 'Plan experiment', exact: true })
    .click();
  await page
    .getByText(
      'Your research focus, selected source text, or resources changed.',
      { exact: false },
    )
    .waitFor();
  assert.equal(calls, 1);
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
    'PASS: restored logo/wordmark/favicon load, resource notes preserve source list, model request receives constraints, current/old plan resources differentiated, stale warning, free explicit notes append preserves edits/export, desktop/mobile. Synthetic mocks only.',
  );
} finally {
  await browser.close();
}

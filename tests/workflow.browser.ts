/** Automated browser test. All paper/AI responses below are SYNTHETIC MOCKS.
 * No external literature or model provider is contacted. Start npm run dev first.
 * Run: npx tsx tests/workflow.browser.ts
 */
import { estimateAnalysisCost } from '../server/analysis-cost';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import type { Paper, Analysis } from '../shared/types';
const papers: Paper[] = Array.from({ length: 4 }, (_, i) => ({
  id: `test:${i}`,
  title: `SYNTHETIC TEST PAPER ${i}`,
  year: 2026,
  doi: null,
  url: 'https://example.invalid/test',
  authors: ['Synthetic author'],
  abstract: null,
  passages: [
    {
      id: `body:${i}`,
      kind: 'full-text',
      section: 'Limitations',
      text: `Future work should investigate larger network samples. Our network evaluation uses synthetic data in test ${i}.`,
    },
  ],
  retrievedAt: '2026-01-01',
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
    retrievedAt: '2026-01-01',
    note: 'SYNTHETIC TEST',
    truncated: false,
  },
}));
const analysis: Analysis = {
  cost: estimateAnalysisCost('gpt-4.1-mini', {
    input_tokens: 10000,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens: 2000,
  }),
  origin: 'live',
  status: 'connections',
  summary: 'SYNTHETIC MOCK RESPONSE — not live AI.',
  hypotheses: [
    {
      id: 'h-test',
      title: 'Synthetic test hypothesis',
      hypothesis: 'Test whether larger network samples alter outcomes.',
      evidenceSummary: 'Synthetic evidence only.',
      gapRationale: 'Synthetic test limitation.',
      proposedApproach: 'Synthetic test approach.',
      evidence: [
        { paperId: 'test:0', passageId: 'body:0' },
        { paperId: 'test:1', passageId: 'body:1' },
      ],
      assumptions: [],
      incompatibilities: [],
      unknowns: ['Synthetic unknown'],
      requirements: [],
      experiment: {
        independent: 'Synthetic proposed variable',
        question: 'Synthetic plan question',
        data: 'Synthetic plan data',
        method: 'Synthetic method',
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
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
let ready = false,
  healthFailure = false,
  mode = 'success',
  analysisCalls = 0,
  searchCalls = 0;
await page.route('**/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/health' && healthFailure) {
    await route.abort();
    return;
  }
  let data: unknown;
  let status = 200;
  if (path === '/api/health')
    data = {
      analysisAvailable: ready,
      analysisState: ready ? 'ready' : 'spending-disabled',
      reason: ready
        ? 'MOCK ready, no model requests.'
        : 'Live analysis is off. A project owner must approve API spending before enabling it on the server.',
      openalexKeyConfigured: false,
    };
  else if (path === '/api/search') {
    searchCalls++;
    data = {
      papers,
      query: 'synthetic',
      retrievedAt: 'test',
      sourceStatuses: [],
    };
  } else if (path === '/api/analyze') {
    analysisCalls++;
    const payload = route.request().postDataJSON();
    assert.equal(payload.paperIds.length, 4);
    assert.equal(payload.brief.field, 'Network science');
    if (mode === 'error') {
      status = 502;
      data = { error: 'The model provider timed out. Please retry.' };
    } else
      data = {
        analysisId: `mock-analysis-${analysisCalls}`,
        sources: papers,
        result:
          mode === 'insufficient'
            ? { ...analysis, status: 'insufficient', hypotheses: [] }
            : analysis,
      };
  } else throw new Error(`Unexpected mock endpoint ${path}`);
  await route.fulfill({ status, json: data });
});
const tab = (name: string) => page.getByRole('tab', { name, exact: true });
const stageFor = (name: string) =>
  ['Focus', 'Papers', 'Compare'].includes(name)
    ? 'Search'
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
  assert.match(await page.title(), /PaperBridge/);
  assert.equal(
    await page
      .getByRole('navigation', { name: 'Research pipeline' })
      .getByRole('button')
      .count(),
    3,
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
  await page
    .getByLabel('Research question', { exact: true })
    .fill('How do network samples affect evaluation?');
  await page.getByLabel('Your field of interest').fill('Network science');
  for (const name of [
    'Papers',
    'Compare',
    'Gap leads',
    'Resources',
    'AI hypotheses',
    'Experiment',
    'Focus',
  ])
    await open(name);
  assert.equal(
    await page.getByLabel('Research question', { exact: true }).inputValue(),
    'How do network samples affect evaluation?',
  );
  assert.equal(analysisCalls, 0);
  assert.equal(searchCalls, 0);
  await tab('Focus').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await tab('Papers').getAttribute('aria-selected'), 'true');
  await open('Focus');
  await page
    .getByRole('button', { name: 'Find papers for this focus' })
    .click();
  for (let i = 0; i < 3; i++)
    await page
      .getByLabel(`Select SYNTHETIC TEST PAPER ${i}`, { exact: true })
      .check();
  await open('AI hypotheses');
  await page
    .getByText('Select 1 more paper (4–6 required).', { exact: false })
    .waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: 'Develop AI gap hypotheses' })
      .isDisabled(),
    true,
  );
  await open('Papers');
  await page
    .getByLabel('Select SYNTHETIC TEST PAPER 3', { exact: true })
    .check();
  await open('AI hypotheses');
  await page
    .getByText('Live analysis is off.', { exact: false })
    .first()
    .waitFor();
  healthFailure = true;
  await page.getByRole('button', { name: 'Recheck server readiness' }).click();
  await page
    .getByText('Backend unreachable.', { exact: false })
    .first()
    .waitFor();
  healthFailure = false;
  ready = true;
  await page.getByRole('button', { name: 'Recheck server readiness' }).click();
  mode = 'error';
  await generate('Develop AI gap hypotheses');
  await page
    .getByText('The model provider timed out. Please retry.', { exact: true })
    .waitFor();
  mode = 'insufficient';
  await generate('Develop AI gap hypotheses');
  await page.getByText('Insufficient evidence.', { exact: false }).waitFor();
  mode = 'success';
  await generate('Analyze again');
  await page.getByText('Synthetic test hypothesis', { exact: true }).waitFor();
  await page.getByText('Cost of each AI run (3)', { exact: true }).click();
  await page
    .getByText('Estimated $0.0072 USD', { exact: true })
    .first()
    .waitFor();
  await page
    .getByText(
      'Cost unknown — this does not mean the request was free. Check OpenAI Usage.',
      { exact: true },
    )
    .waitFor();
  assert.match(
    await page.locator('.cost-total').innerText(),
    /0.0144.*unknown cost/,
  );
  await page.locator('.cost-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/paperbridge-cost-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.cost-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/paperbridge-cost-mobile.png' });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole('button', { name: 'Plan an experiment', exact: true })
    .click();
  assert.equal(await tab('Experiment').getAttribute('aria-selected'), 'true');
  assert.equal(
    await page.locator('.experiment-panel textarea:visible').count(),
    3,
  );
  await expand('Design details');
  assert.equal(
    await page
      .getByLabel('Independent variables', { exact: true })
      .inputValue(),
    'Synthetic proposed variable',
  );
  await page
    .getByLabel('Proposed method', { exact: true })
    .fill('Edited synthetic method');
  await open('Compare');
  await page.getByRole('button', { name: 'Limitations', exact: true }).click();
  await page
    .getByRole('button', { name: /Inspect/ })
    .first()
    .click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').isVisible(), false);
  await open('Experiment');
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'Edited synthetic method',
  );
  await open('AI hypotheses');
  await page
    .getByRole('button', { name: 'Plan an experiment', exact: true })
    .click();
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'Edited synthetic method',
  );
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export current plan' }).click();
  const download = await downloadEvent;
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  assert.equal(exported.fields.method, 'Edited synthetic method');
  // A second analysis may reuse a model hypothesis ID; it must get a new draft.
  await open('AI hypotheses');
  await generate('Analyze again');
  await page
    .getByRole('button', { name: 'Plan an experiment', exact: true })
    .click();
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'Synthetic method',
  );
  await open('Gap leads');
  await expand('Scan author-stated limitations and future work');
  await page
    .getByRole('button', { name: 'Find gap leads', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Draft an experiment from this lead' })
    .first()
    .click();
  await page
    .getByText('User-created draft · not AI-generated', { exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    '',
  );
  await page
    .getByLabel('Proposed method', { exact: true })
    .fill('Manual method remains mine');
  await open('Resources');
  await page
    .getByLabel('Available data', { exact: true })
    .fill('Changed resources');
  await open('Experiment');
  await page
    .getByText('Your edits have been kept.', { exact: false })
    .waitFor();
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'Manual method remains mine',
  );
  await open('Papers');
  await page
    .getByTitle('Remove SYNTHETIC TEST PAPER 0', { exact: true })
    .click();
  await open('Experiment');
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'Manual method remains mine',
  );
  await expand('Sources & draft context');
  await page
    .getByRole('button', { name: 'Inspect source passage body:0', exact: true })
    .click();
  await page
    .locator('#evidence-inspector')
    .getByText(papers[0].passages[0].text, { exact: true })
    .waitFor();
  assert.equal(analysisCalls, 4);
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.equal(searchCalls, 1);
  assert.deepEqual(errors, []);
  await mkdir('/tmp/paperbridge-tabs', { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/paperbridge-tabs/desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/paperbridge-tabs/mobile.png' });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  console.log(
    'PASS: mocked tab navigation, state retention, AI readiness/errors/success, evidence, manual/AI plans, edited export, stale plans, desktop/mobile. No paid calls.',
  );
} finally {
  await browser.close();
}

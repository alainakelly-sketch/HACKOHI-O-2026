/** SYNTHETIC MOCKS ONLY. No external literature or paid model requests. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import type { Paper } from '../shared/types';
const papers: Paper[] = Array.from({ length: 4 }, (_, i) => ({
  id: `test:${i}`,
  title: `SYNTHETIC DISCOVERY PAPER ${i}`,
  year: 2026,
  doi: null,
  url: 'https://example.invalid/paper',
  authors: ['Synthetic author'],
  abstract: null,
  passages: [
    {
      id: `test:${i}:result`,
      kind: 'full-text',
      section: 'Results',
      text:
        i < 2
          ? `Our results show that transformer screening ${i === 0 ? 'improved' : 'reduced'} diagnostic accuracy in adult patients.`
          : 'Our results describe transformer screening in adult patients.',
    },
    {
      id: `test:${i}:method`,
      kind: 'full-text',
      section: 'Methods',
      text: `We used transformer screening with the SYNTHETIC ${i === 0 ? 'Atlas' : 'Boreal'} dataset. We evaluated diagnostic accuracy.`,
    },
    {
      id: `test:${i}:sample`,
      kind: 'full-text',
      section: 'Methods',
      text: 'We enrolled 120 participants. The study population included adult patients.',
    },
    {
      id: `test:${i}:gap`,
      kind: 'full-text',
      section: 'Limitations',
      text: 'A limitation of this study is its small sample. Future work should test transformer screening in pediatric patients.',
    },
  ],
  retrievedAt: 'test',
  coverage: 'Full text retrieved',
  sources: [
    {
      provider: 'Europe PMC',
      id: `test:${i}`,
      url: 'https://example.invalid/paper',
    },
  ],
  fullText: {
    provider: 'Europe PMC',
    url: 'https://example.invalid/paper',
    license: null,
    retrievedAt: 'test',
    note: 'SYNTHETIC TEST TEXT',
    truncated: false,
  },
}));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const errors: string[] = [];
let searches = 0,
  priorCalls = 0,
  modelCalls = 0;
page.on('pageerror', (e) => errors.push(e.message));
await page.route('**/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/health')
    await route.fulfill({
      json: {
        analysisAvailable: true,
        analysisState: 'ready',
        reason: 'SYNTHETIC MOCK ONLY: no real model request.',
        openalexKeyConfigured: false,
      },
    });
  else if (path === '/api/search') {
    searches++;
    await route.fulfill({
      json: {
        papers,
        query: 'screening',
        retrievedAt: 'test',
        sourceStatuses: [],
      },
    });
  } else if (path === '/api/prior-work/search') {
    priorCalls++;
    const body = route.request().postDataJSON();
    assert.ok(body.question.length >= 2);
    await route.fulfill({
      json: {
        status:
          priorCalls === 1
            ? 'No close match found in these searches; novelty is not established.'
            : priorCalls === 2
              ? 'Search incomplete.'
              : 'Related prior work found.',
        searches: [
          {
            query: body.question,
            error: priorCalls === 2 ? 'SYNTHETIC provider unavailable' : null,
          },
        ],
        matches:
          priorCalls === 3
            ? [{ paper: papers[0], overlap: 'SYNTHETIC topical overlap only.' }]
            : [],
      },
    });
  } else if (path === '/api/analyze') {
    modelCalls++;
    const body = route.request().postDataJSON();
    assert.equal(body.lead.evidence.length, 2);
    assert.equal(body.lead.evidence[0].passageId, 'test:0:result');
    assert.match(body.brief.question, /different reported findings/);
    await route.fulfill({
      json: {
        analysisId: 'synthetic-analysis',
        sources: papers,
        result: {
          origin: 'live',
          status: 'insufficient',
          summary: 'SYNTHETIC MOCK: insufficient evidence',
          hypotheses: [],
        },
      },
    });
  } else throw new Error(`Unexpected endpoint ${path}`);
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
  await page
    .getByLabel('Research question', { exact: true })
    .fill('Original question preserved until Apply');
  await page.getByLabel('Your field of interest').fill('Medical AI');
  assert.equal(await page.locator('.sidebar').count(), 0);
  await open('Resources');
  await page
    .getByRole('heading', {
      name: 'Resources for your hypothesis',
      exact: true,
    })
    .waitFor();
  assert.equal(modelCalls, 0);
  assert.equal(searches, 0);
  await open('Focus');
  await page.getByText('Help me shape a question', { exact: true }).click();
  await page
    .getByLabel('Topic, approach, or factor', { exact: true })
    .fill('transformer screening');
  await page
    .getByLabel('Outcome to investigate', { exact: true })
    .fill('diagnostic accuracy');
  assert.equal(
    await page.getByLabel('Research question', { exact: true }).inputValue(),
    'Original question preserved until Apply',
  );
  assert.equal(searches, 0);
  assert.equal(modelCalls, 0);
  await page
    .getByRole('button', { name: 'Use this question', exact: true })
    .click();
  assert.match(
    await page.getByLabel('Research question', { exact: true }).inputValue(),
    /transformer screening/,
  );
  await page
    .getByRole('button', { name: 'Find papers for this focus' })
    .click();
  for (let i = 0; i < 4; i++)
    await page
      .getByLabel(`Select SYNTHETIC DISCOVERY PAPER ${i}`, { exact: true })
      .check();
  await open('Gap leads');
  await page
    .getByRole('heading', { name: 'Follow the evidence', exact: true })
    .waitFor();
  const discovery = page.locator('.discovery-panel');
  await discovery
    .getByRole('button', {
      name: /Possible disagreement to review: diagnostic accuracy/,
    })
    .click();
  await page
    .getByText('PAPERBRIDGE CANDIDATE · NOT A CONFIRMED CONTRADICTION', {
      exact: true,
    })
    .waitFor();
  await expand(/^Supporting evidence/);
  for (let i = 0; i < 2; i++)
    await discovery
      .getByText(papers[i].passages[0].text, { exact: true })
      .first()
      .waitFor();
  await page
    .getByText(
      'Could population, dataset, or method differences explain this?',
      { exact: true },
    )
    .click();
  await discovery
    .locator('.discovery-context')
    .getByText(papers[0].passages[1].text.split('. ')[0] + '.', { exact: true })
    .first()
    .waitFor();
  await discovery
    .getByRole('button', {
      name: 'Inspect complete source passage',
      exact: true,
    })
    .first()
    .click();
  await page
    .locator('#evidence-inspector')
    .getByText(papers[0].passages[0].text, { exact: true })
    .waitFor();
  await closeEvidence();
  assert.equal(priorCalls, 0);
  assert.equal(modelCalls, 0);
  await discovery
    .getByRole('button', { name: 'Draft an experiment · free', exact: true })
    .click();
  assert.equal(await tab('Experiment').getAttribute('aria-selected'), 'true');
  await page
    .getByText('User-created draft · not AI-generated', { exact: true })
    .waitFor();
  await expand('Design details');
  assert.equal(
    await page
      .getByLabel('Independent variables', { exact: true })
      .inputValue(),
    '',
  );
  await page
    .getByLabel('Independent variables', { exact: true })
    .fill('Study population group');
  await page
    .getByLabel('Possible confounding factors', { exact: true })
    .fill('Age and device differences');
  const dl = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export current plan', exact: true })
    .click();
  const file = await dl;
  const exported = JSON.parse(await readFile((await file.path())!, 'utf8'));
  assert.equal(exported.fields.independent, 'Study population group');
  assert.equal(exported.sources.length, 2);
  const planPrior = page.locator('#step-experiment .prior-work-check');
  await planPrior
    .getByRole('button', { name: 'Check related prior work', exact: true })
    .click();
  await planPrior
    .getByText(
      'No close match found in these searches; novelty is not established.',
      { exact: true },
    )
    .waitFor();
  await planPrior
    .getByLabel('Prior-work search terms', { exact: true })
    .fill('transformer screening pediatric replication');
  assert.equal(
    await planPrior
      .getByText(
        'No close match found in these searches; novelty is not established.',
        { exact: true },
      )
      .count(),
    0,
  );
  await planPrior
    .getByRole('button', { name: 'Check related prior work', exact: true })
    .click();
  await planPrior.getByText('Search incomplete.', { exact: true }).waitFor();
  await planPrior
    .getByRole('button', {
      name: 'Check related prior work again',
      exact: true,
    })
    .click();
  await planPrior
    .getByText('Related prior work found.', { exact: true })
    .waitFor();
  await open('Gap leads');
  await discovery
    .getByRole('button', {
      name: 'Use this question in AI hypotheses',
      exact: true,
    })
    .click();
  assert.equal(
    await tab('AI hypotheses').getAttribute('aria-selected'),
    'true',
  );
  assert.equal(modelCalls, 0);
  await page
    .getByRole('heading', { name: 'Selected discovery lead', exact: true })
    .waitFor();
  await generate('Develop AI gap hypotheses');
  await page
    .getByText('SYNTHETIC MOCK: insufficient evidence', { exact: true })
    .waitFor();
  assert.equal(modelCalls, 1);
  await open('Experiment');
  assert.equal(
    await page
      .getByLabel('Independent variables', { exact: true })
      .inputValue(),
    'Study population group',
  );
  await open('Gap leads');
  await discovery
    .getByRole('button', {
      name: /Possible disagreement to review: diagnostic accuracy/,
    })
    .click();
  await mkdir('/tmp/paperbridge-discovery', { recursive: true });
  await page.locator('.discovery-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/paperbridge-discovery/desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.discovery-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/paperbridge-discovery/mobile.png' });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  assert.equal(searches, 1);
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  console.log(
    'PASS: guided focus, selected-source map/tension/context/evidence, free draft+variables/export, three prior outcomes, selected-lead AI handoff only on explicit generation, retained plan, mobile. SYNTHETIC mocks; no paid calls.',
  );
} finally {
  await browser.close();
}

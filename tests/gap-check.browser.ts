/** SYNTHETIC FIXTURES ONLY. Every API mocked; no model or literature requests. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import type { Analysis, Paper } from '../shared/types';
import { gapCheckScopeKey, type GapCheckResult } from '../shared/gap-check';
import { buildComparisonOverview } from '../shared/comparison-overview';
const question =
  'How does sleep duration affect memory recall in university students?';
const papers: Paper[] = Array.from({ length: 4 }, (_, index) => ({
  id: `synthetic:purpose:${index}`,
  title: `SYNTHETIC Sleep duration and memory recall ${index + 1}`,
  year: 2026,
  doi: null,
  url: `https://example.invalid/expand-${index}`,
  authors: ['Synthetic test author'],
  abstract:
    'Synthetic abstract: sleep duration and memory recall in university students.',
  passages: [
    {
      id: `synthetic:purpose:${index}:methods`,
      kind: 'full-text',
      section: 'Methods',
      text: 'We measured sleep duration and memory recall in university students using sleep diaries and a word recall task.',
    },
    {
      id: `synthetic:purpose:${index}:results`,
      kind: 'full-text',
      section: 'Results',
      text: 'Our results show that sleep duration improved memory recall in university students.',
    },
    {
      id: `synthetic:purpose:${index}:gap`,
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
      id: `synthetic:purpose:${index}`,
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
      id: 'synthetic-purpose-h1',
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

// This relevant abstract remains discoverable even though it has no imported body.
const abstractPaper: Paper = {
  ...papers[0],
  id: 'synthetic:abstract',
  title: 'SYNTHETIC Relevant abstract-only sleep study',
  coverage: 'Abstract only',
  fullText: undefined,
  passages: [
    {
      id: 'synthetic:abstract:p',
      kind: 'abstract',
      section: 'Abstract',
      text: 'Sleep duration predicts memory recall in university students.',
    },
  ],
};
const candidate: Paper = {
  ...abstractPaper,
  id: 'synthetic:external',
  title: 'SYNTHETIC External related research',
  passages: [
    {
      id: 'synthetic:external:p',
      kind: 'abstract',
      section: 'Abstract',
      text: 'We evaluated sleep duration and memory recall in shift workers; longer sleep was associated with better recall.',
    },
  ],
};
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
const calls = { search: 0, check: 0, review: 0, analysis: 0 };
let mode: 'part' | 'all' | 'empty' | 'manual' | 'failure' = 'part';
let last: GapCheckResult | null = null;
let analyzed: any = null;
let delayNext = false;
let release: (() => void) | null = null;
await page.route('**/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/health')
    return route.fulfill({
      json: {
        analysisAvailable: mode !== 'manual',
        analysisState: mode === 'manual' ? 'missing-key' : 'ready',
        reason: 'SYNTHETIC readiness',
        openalexKeyConfigured: false,
      },
    });
  if (path === '/api/search') {
    calls.search++;
    return route.fulfill({
      json: {
        papers: [...papers, abstractPaper],
        query: question,
        retrievedAt: 'synthetic',
        sourceStatuses: [],
      },
    });
  }
  if (path === '/api/gap-check') {
    calls.check++;
    const body = route.request().postDataJSON();
    const result: GapCheckResult = {
      checkId: `synthetic-check-${calls.check}`,
      gap: body.gap,
      scopeKey: gapCheckScopeKey(body.brief, body.paperIds, body.gap),
      status:
        mode === 'all'
          ? 'Existing research may address this gap'
          : mode === 'empty'
            ? 'No close match found in the searches completed'
            : mode === 'manual' || mode === 'failure'
              ? 'Check incomplete or inconclusive'
              : 'Related work addresses part of this gap',
      summary:
        mode === 'manual' || mode === 'failure'
          ? 'SYNTHETIC AI assessment has not been completed; candidates require manual review.'
          : 'SYNTHETIC mocked assessment, not a live AI response.',
      candidates: mode === 'empty' ? [] : [candidate],
      matches:
        mode === 'manual' || mode === 'failure' || mode === 'empty'
          ? []
          : [
              {
                paperId: candidate.id,
                question: 'Sleep duration and recall in shift workers',
                establishes: 'An association was observed, not causation.',
                addresses: mode === 'all' ? 'all' : 'part',
                uncertainty:
                  'Experimental manipulation and population coverage remain uncertain.',
                evidence: [
                  {
                    paperId: candidate.id,
                    passageId: candidate.passages[0].id,
                  },
                ],
              },
            ],
      searches: [
        {
          query: 'SYNTHETIC shift work sleep memory',
          error: mode === 'failure' ? 'SYNTHETIC provider unavailable' : null,
        },
      ],
      sourceStatuses: [],
      checkedAt: '2026-10-25T12:00:00Z',
      aiCompleted: mode === 'part' || mode === 'all',
      assessmentNotNeeded: mode === 'empty',
      reviewed: false,
      decision: null,
    };
    last = result;
    if (delayNext) {
      delayNext = false;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    return route.fulfill({ json: result }).catch(() => {});
  }
  if (/^\/api\/gap-check\/[^/]+\/review$/.test(path)) {
    calls.review++;
    assert.ok(last);
    const body = route.request().postDataJSON();
    if (last.matches.some((m) => m.addresses === 'all'))
      assert.notEqual(body.decision, 'continue');
    last = { ...last, reviewed: true, decision: body.decision };
    return route.fulfill({ json: last });
  }
  if (path === '/api/analyze') {
    calls.analysis++;
    analyzed = route.request().postDataJSON();
    assert.ok(analyzed.checkId);
    assert.ok(analyzed.gap);
    return route.fulfill({
      json: {
        analysisId: 'synthetic-checked-analysis',
        result: analysis,
        sources: papers,
      },
    });
  }
  errors.push(`Unexpected API ${path}`);
  return route.fulfill({
    status: 500,
    json: { error: 'SYNTHETIC unexpected endpoint' },
  });
});
const output = '/tmp/paperbridge-gap-check';
await mkdir(output, { recursive: true });
const check = () => page.locator('.gap-research-check:visible');
async function stage(name: string) {
  await page
    .getByRole('navigation', { name: 'Research pipeline' })
    .getByRole('button', { name, exact: true })
    .click();
}
async function clickCheck() {
  await check()
    .getByRole('button', { name: 'Check existing research', exact: true })
    .click();
  await check().locator('.gap-check-status').waitFor();
}
async function reset() {
  await page.reload();
  await page.getByLabel('Research question', { exact: true }).fill(question);
  await page
    .getByLabel('Your field of interest', { exact: true })
    .fill('Neuroscience');
  await page
    .getByRole('button', { name: 'Find papers for this focus', exact: true })
    .click();
  await page.getByLabel(`Select ${papers[0].title}`, { exact: true }).waitFor();
}
async function selectSources() {
  for (const paper of papers)
    await page.getByLabel(`Select ${paper.title}`, { exact: true }).check();
  await stage('Find gaps');
  await check().waitFor();
}
let questionEdits = 0;
async function editGap() {
  const details = check().locator('details.gap-check-question');
  if (!(await details.evaluate((e) => (e as HTMLDetailsElement).open)))
    await details.locator('summary').click();
  await check()
    .getByLabel('Gap question to check')
    .fill(
      `Does sleep duration affect recall in night shift workers under controlled conditions? Revision ${++questionEdits}`,
    );
}
try {
  await page.goto(process.env.PAPERBRIDGE_TEST_URL || 'http://localhost:5173');
  await reset();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page.evaluate(
      () =>
        document.fonts.check('400 16px \"Playfair Display\"') &&
        document.fonts.check('700 24px \"Playfair Display\"'),
    ),
    true,
  );
  assert.match(
    await page.locator('h1').evaluate((e) => getComputedStyle(e).fontFamily),
    /Playfair Display/,
  );
  await page.getByText(abstractPaper.title, { exact: true }).waitFor();
  const box = page.getByLabel(`Select ${papers[0].title}`, { exact: true });
  await box.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await box.check();
  assert.ok(
    Math.abs((await page.evaluate(() => scrollY)) - y) < 4,
    'Selecting a paper must not jump',
  );
  assert.equal(
    await page
      .getByRole('tab', { name: 'Search & select', exact: true })
      .getAttribute('aria-selected'),
    'true',
  );
  for (const paper of papers.slice(1))
    await page.getByLabel(`Select ${paper.title}`, { exact: true }).check();
  await page.screenshot({
    path: `${output}/sources-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${output}/sources-mobile.png`,
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1366, height: 900 });
  await stage('Focus');
  await stage('Papers');
  for (const paper of papers)
    assert.equal(
      await page
        .getByLabel(`Select ${paper.title}`, { exact: true })
        .isChecked(),
      true,
    );
  await stage('Find gaps');
  await check().waitFor();
  const synthesis = page.locator('.paper-synthesis:visible');
  await synthesis
    .getByRole('heading', { name: 'Your papers, compared', exact: true })
    .waitFor();
  const automaticCalls = { ...calls };
  const comparison = buildComparisonOverview(papers);
  assert.ok(
    comparison.shared.length > 0,
    'Synthetic body text has inspectable shared topics',
  );
  const topic = comparison.shared[0];
  await synthesis
    .getByRole('button', { name: topic.term, exact: true })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const reference = topic.evidence[0].reference;
  const passage = papers
    .find((p) => p.id === reference.paperId)!
    .passages.find((p) => p.id === reference.passageId)!;
  assert.equal(
    await dialog.locator('.source-quote blockquote').innerText(),
    passage.text,
  );
  await page
    .getByRole('button', { name: 'Close evidence', exact: true })
    .click();
  assert.deepEqual(
    calls,
    automaticCalls,
    'Automatic comparison and source inspection incur no API requests',
  );
  assert.equal(calls.analysis, 0);
  assert.equal(calls.check, 0);
  assert.equal(
    await page
      .getByRole('radio', { name: /Select gap finding:/ })
      .first()
      .isVisible(),
    false,
    'Alternate gaps stay collapsed by default',
  );
  assert.equal(
    await page
      .getByRole('button', { name: 'Generate hypothesis', exact: true })
      .isVisible(),
    true,
    'Hypothesis generation remains discoverable before checking',
  );
  assert.equal(
    await page
      .getByRole('button', { name: 'Generate hypothesis', exact: true })
      .isDisabled(),
    true,
  );
  await page.screenshot({
    path: `${output}/gap-default-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${output}/gap-default-mobile.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1366, height: 900 });
  await clickCheck();
  await check()
    .getByText('Related work addresses part of this gap', { exact: true })
    .waitFor();
  assert.equal(
    await check()
      .getByRole('button', { name: 'Go to hypothesis', exact: true })
      .count(),
    0,
  );
  const match = check().locator('details.gap-check-match').first();
  assert.equal(
    await match.evaluate((e) => (e as HTMLDetailsElement).open),
    false,
    'Match deep detail is collapsed',
  );
  await page.screenshot({
    path: `${output}/research-check-compact-desktop.png`,
    fullPage: true,
  });
  await match.locator(':scope > summary').click();
  await check().getByText('Supporting passages · 1', { exact: true }).click();
  await check()
    .getByText(candidate.passages[0].text, { exact: true })
    .waitFor();
  await page.screenshot({
    path: `${output}/research-check-desktop.png`,
    fullPage: true,
  });
  const before = { ...calls };
  await page.getByRole('tab', { name: 'Visual map', exact: true }).click();
  await page.getByRole('tab', { name: 'Gap findings', exact: true }).click();
  assert.deepEqual(
    calls,
    before,
    'Display tab switches must not trigger API calls',
  );
  assert.equal(
    await check().getByLabel('How will you use this check?').isVisible(),
    false,
    'Alternate intentions are optional disclosure',
  );
  await check()
    .getByRole('button', { name: 'I have reviewed this check', exact: true })
    .click();
  await check()
    .getByRole('button', { name: 'Go to hypothesis', exact: true })
    .waitFor();
  await editGap();
  await check()
    .getByText(/check is stale/)
    .waitFor();
  assert.equal(
    await check()
      .getByRole('button', { name: 'Go to hypothesis', exact: true })
      .count(),
    0,
  );
  mode = 'all';
  await clickCheck();
  await check()
    .getByText('Existing research may address this gap', { exact: true })
    .waitFor();
  assert.equal(await check().locator('option[value="continue"]').count(), 0);
  await check()
    .getByLabel('How will you use this check?')
    .selectOption('replication');
  await check()
    .getByRole('button', { name: 'I have reviewed this check', exact: true })
    .click();
  const generate = page.getByRole('button', {
    name: 'Generate hypothesis',
    exact: true,
  });
  await generate.waitFor();
  assert.equal(
    await generate.isEnabled(),
    true,
    'Reviewed selected gap permits direct generation without navigation CTA',
  );
  await generate.click();
  await page.waitForFunction(() =>
    document.body.textContent?.includes('SYNTHETIC selected hypothesis'),
  );
  assert.equal(calls.analysis, 1);
  assert.equal(analyzed.checkId, last?.checkId);
  assert.deepEqual(analyzed.gap, last?.gap);
  // The generated finding inherits its reviewed source-gap check; no second charge.
  assert.equal(calls.check, 2);
  const generated = page.getByRole('article', {
    name: 'Generated hypothesis',
    exact: true,
  });
  await generated.waitFor();
  assert.equal(
    await generated
      .getByText(analysis.hypotheses[0].experiment.method, { exact: true })
      .isVisible(),
    true,
  );
  assert.equal(
    await generated
      .getByText(`Measure: ${analysis.hypotheses[0].experiment.measure}`, {
        exact: true,
      })
      .isVisible(),
    true,
  );
  assert.equal(
    await generated
      .getByText(analysis.hypotheses[0].hypothesis, { exact: true })
      .isVisible(),
    true,
  );
  await page.screenshot({
    path: `${output}/generated-hypothesis-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${output}/generated-hypothesis-mobile.png`,
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1366, height: 900 });
  await generated
    .getByRole('button', { name: 'Plan experiment', exact: true })
    .click();
  await page
    .getByLabel('Proposed method', { exact: true })
    .fill('SYNTHETIC user edited method retained after context changes.');
  await stage('Find gaps');
  await editGap();
  await stage('Experiment');
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'SYNTHETIC user edited method retained after context changes.',
  );
  await page
    .locator('.experiment-panel:visible')
    .getByText(/Review this plan before using it/i)
    .first()
    .waitFor();
  // A check finishing for a previous finding must not overwrite the new selection.
  mode = 'part';
  await reset();
  await selectSources();
  delayNext = true;
  await check()
    .getByRole('button', { name: 'Check existing research', exact: true })
    .click();
  await page.waitForTimeout(100);
  const radios = page.getByRole('radio', { name: /Select gap finding:/ });
  await page.locator('.finding-picker > summary').click();
  assert.ok((await radios.count()) > 1);
  await radios.nth(1).check();
  const currentGap = await check().getAttribute('data-gap-id');
  release?.();
  await page.waitForTimeout(200);
  assert.equal(await check().getAttribute('data-gap-id'), currentGap);
  assert.equal(
    await check().locator('.gap-check-status').count(),
    0,
    'Late result must not populate a different gap',
  );
  // Separate fresh sessions cover honest empty/manual/failed-search states.
  for (const next of ['empty', 'manual', 'failure'] as const) {
    mode = next;
    await reset();
    await selectSources();
    await clickCheck();
    const expected =
      next === 'empty'
        ? 'No close match found in the searches completed'
        : 'Check incomplete or inconclusive';
    await check().getByText(expected, { exact: true }).waitFor();
    if (next === 'empty') {
      await check()
        .getByText(/no AI request was made/)
        .waitFor();
    } else {
      await check()
        .getByText(/AI assessment has not been completed/)
        .first()
        .waitFor();
      await check().locator('.gap-check-manual > summary').click();
      await check().getByText(candidate.title, { exact: true }).waitFor();
      assert.equal(
        await check().getByLabel('How will you use this check?').count(),
        0,
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${output}/research-check-mobile.png`,
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    'Mobile must not overflow',
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        passed: true,
        calls,
        screenshots: output,
        scope:
          'All APIs synthetic mocked; no paid or live literature requests.',
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  console.error((await page.locator('body').innerText()).slice(-4000));
  throw error;
} finally {
  await browser.close();
}

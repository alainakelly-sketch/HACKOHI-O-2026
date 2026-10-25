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
const uncertainCandidate: Paper = {
  ...candidate,
  id: 'synthetic:unclear',
  title: 'SYNTHETIC Unclear related study',
  passages: [
    {
      ...candidate.passages[0],
      id: 'synthetic:unclear:p',
      text: 'SYNTHETIC abstract reports sleep measurements but does not describe a memory outcome.',
    },
  ],
};
const differentCandidate: Paper = {
  ...candidate,
  id: 'synthetic:different',
  title: 'SYNTHETIC Different outcome study',
  passages: [
    {
      ...candidate.passages[0],
      id: 'synthetic:different:p',
      text: 'SYNTHETIC abstract examines sleep and physical coordination, not memory recall.',
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
const calls = { search: 0, check: 0, review: 0, analysis: 0, reassess: 0 };
let mode:
  'part' | 'all' | 'empty' | 'manual' | 'failure' | 'recovery' | 'unclear' =
  'part';
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
            : mode === 'manual' || mode === 'failure' || mode === 'recovery'
              ? 'Check incomplete or inconclusive'
              : 'Related work addresses part of this gap',
      summary:
        mode === 'manual' || mode === 'failure' || mode === 'recovery'
          ? 'SYNTHETIC AI assessment has not been completed; candidates require manual review.'
          : 'SYNTHETIC mocked assessment, not a live AI response.',
      candidates:
        mode === 'empty'
          ? []
          : mode === 'part'
            ? [candidate, uncertainCandidate, differentCandidate]
            : [candidate],
      matches:
        mode === 'manual' ||
        mode === 'failure' ||
        mode === 'recovery' ||
        mode === 'empty'
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
    if (mode === 'part')
      result.matches.push(
        {
          paperId: uncertainCandidate.id,
          question: 'SYNTHETIC sleep measurements',
          establishes: 'The abstract describes measurements only.',
          addresses: 'unclear',
          uncertainty:
            'Memory outcomes are unavailable; relevance cannot be resolved.',
          evidence: [
            {
              paperId: uncertainCandidate.id,
              passageId: uncertainCandidate.passages[0].id,
            },
          ],
        },
        {
          paperId: differentCandidate.id,
          question: 'SYNTHETIC sleep and coordination',
          establishes: 'The reported outcome is coordination.',
          addresses: 'different',
          uncertainty: 'This outcome does not answer memory recall.',
          evidence: [
            {
              paperId: differentCandidate.id,
              passageId: differentCandidate.passages[0].id,
            },
          ],
        },
      );
    if (mode === 'unclear') {
      result.status = 'Check incomplete or inconclusive';
      result.aiCompleted = true;
      result.matches.forEach((m) => (m.addresses = 'unclear'));
    }
    last = result;
    if (delayNext) {
      delayNext = false;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    return route.fulfill({ json: result }).catch(() => {});
  }
  if (/^\/api\/gap-check\/[^/]+\/reassess$/.test(path)) {
    calls.reassess++;
    assert.ok(last);
    const body = route.request().postDataJSON();
    assert.deepEqual(body.gap, last.gap);
    last = {
      ...last,
      aiCompleted: true,
      summary:
        'SYNTHETIC Available candidate partially addresses the question; provider coverage remains incomplete.',
      limitedCoverageEligible: true,
      limitedCoverageAccepted: false,
      assessmentWarnings: [
        'SYNTHETIC One provider failed; coverage remains incomplete.',
      ],
      matches: [
        {
          paperId: candidate.id,
          question: 'SYNTHETIC sleep recall',
          establishes: 'Available text partially addresses sleep and recall.',
          addresses: 'part',
          uncertainty:
            'Missing provider results and abstract-only evidence remain uncertain.',
          evidence: [
            { paperId: candidate.id, passageId: candidate.passages[0].id },
          ],
        },
      ],
      sourceStatuses: [
        { source: 'OpenAlex', status: 'ok', count: 1, message: null },
        {
          source: 'Europe PMC',
          status: 'error',
          count: 0,
          message: 'SYNTHETIC provider failure',
        },
      ],
    };
    return route.fulfill({ json: last });
  }
  if (/^\/api\/gap-check\/[^/]+\/review$/.test(path)) {
    calls.review++;
    assert.ok(last);
    const body = route.request().postDataJSON();
    if (last.matches.some((m) => m.addresses === 'all'))
      assert.notEqual(body.decision, 'continue');
    if (last.limitedCoverageEligible)
      assert.equal(
        body.acceptLimitedCoverage,
        true,
        'Limited review requires explicit checked opt-in',
      );
    last = {
      ...last,
      reviewed: true,
      decision: body.decision,
      limitedCoverageAccepted: body.acceptLimitedCoverage === true,
    };
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
  const development = page.locator('#gap-development');
  await development
    .getByText(
      'The research check is complete. Click “Confirm review & continue” in its results to unlock this button.',
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await development
      .getByRole('button', { name: 'Generate hypothesis', exact: true })
      .isDisabled(),
    true,
  );
  await development
    .getByRole('button', { name: 'Review results & continue', exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    'selected-gap-check',
  );
  const uncertainMatch = check().locator(
    `details.gap-check-match[data-paper-id="${uncertainCandidate.id}"]`,
  );
  await uncertainMatch.locator(':scope > summary').click();
  await uncertainMatch
    .getByText(
      'Memory outcomes are unavailable; relevance cannot be resolved.',
      { exact: true },
    )
    .waitFor();
  await uncertainMatch.locator(':scope > summary').click();
  assert.equal(
    await check()
      .getByRole('button', { name: 'Confirm review & continue', exact: true })
      .isEnabled(),
    true,
    'Partial evidence stays reviewable despite other uncertain/different matches',
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
  await match.getByText('Supporting passages · 1', { exact: true }).click();
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
    .getByRole('button', { name: 'Confirm review & continue', exact: true })
    .click();
  await check()
    .getByRole('button', { name: 'Go to hypothesis', exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    'gap-development',
  );
  assert.equal(
    await page
      .getByRole('button', { name: 'Generate hypothesis', exact: true })
      .isEnabled(),
    true,
  );
  await editGap();
  await check()
    .getByText(/check is stale/)
    .waitFor();
  await page
    .locator('#gap-development')
    .getByText(
      'The gap or evidence changed. Update the research check first.',
      { exact: true },
    )
    .waitFor();
  await page
    .locator('#gap-development')
    .getByRole('button', { name: 'Update research check', exact: true })
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
    .getByRole('button', { name: 'Confirm review & continue', exact: true })
    .click();
  mode = 'part';
  const rerun = check().getByText('Run another check', { exact: true });
  await rerun.click();
  await check()
    .getByRole('button', { name: 'Check existing research again', exact: true })
    .click();
  await check()
    .getByText('Related work addresses part of this gap', { exact: true })
    .waitFor();
  await check()
    .getByRole('button', { name: 'Confirm review & continue', exact: true })
    .click();
  const reviewedUncertainty = check().locator(
    `details.gap-check-match[data-paper-id="${uncertainCandidate.id}"]`,
  );
  await reviewedUncertainty.locator(':scope > summary').click();
  await reviewedUncertainty
    .getByText(
      'Memory outcomes are unavailable; relevance cannot be resolved.',
      { exact: true },
    )
    .waitFor();
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
  assert.equal(
    await reviewedUncertainty
      .getByText(
        'Memory outcomes are unavailable; relevance cannot be resolved.',
        { exact: true },
      )
      .isVisible(),
    true,
    'Uncertain matches remain inspectable after successful generation',
  );
  assert.equal(analyzed.checkId, last?.checkId);
  assert.deepEqual(analyzed.gap, last?.gap);
  // The generated finding inherits its reviewed source-gap check; no second charge.
  assert.equal(calls.check, 3);
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
  assert.equal(await radios.count(), 3, 'Only three candidate gaps initially');
  await page.getByRole('button', { name: /Show \d+ more gaps/ }).click();
  assert.equal(await radios.count(), 4, 'Remaining candidates are opt-in');
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
      await page
        .locator('#gap-development')
        .getByText(
          next === 'manual'
            ? 'Related papers were found, but AI assessment is unavailable. See the check results and server requirements below.'
            : 'The research check is incomplete or inconclusive. Open its results to see what failed or what evidence is missing.',
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await page
          .getByRole('button', { name: 'Generate hypothesis', exact: true })
          .isDisabled(),
        true,
      );
      await page
        .locator('#gap-development')
        .getByRole('button', {
          name: 'See why the check is incomplete',
          exact: true,
        })
        .waitFor();
      await check().locator('.gap-check-manual > summary').click();
      await check().getByText(candidate.title, { exact: true }).waitFor();
      assert.equal(
        await check().getByLabel('How will you use this check?').count(),
        0,
      );
    }
  }
  mode = 'unclear';
  await reset();
  await selectSources();
  await clickCheck();
  await check()
    .getByText('Check incomplete or inconclusive', { exact: true })
    .waitFor();
  assert.equal(
    await check()
      .getByRole('button', { name: 'Confirm review & continue', exact: true })
      .count(),
    0,
    'All-unclear AI results cannot be approved',
  );
  assert.equal(
    await page
      .getByRole('button', { name: 'Generate hypothesis', exact: true })
      .isDisabled(),
    true,
  );
  // Explicit assessment recovery reuses candidates and never restarts literature searches.
  mode = 'recovery';
  await reset();
  await selectSources();
  await clickCheck();
  await check()
    .getByText('Check incomplete or inconclusive', { exact: true })
    .waitFor();
  const beforeRecovery = { ...calls };
  await page.waitForTimeout(150);
  assert.deepEqual(
    calls,
    beforeRecovery,
    'Failed checks must not automatically retry',
  );
  await check()
    .getByRole('button', { name: 'Reassess these papers', exact: true })
    .click();
  await check()
    .getByText('Available text partially addresses sleep and recall.', {
      exact: false,
    })
    .first()
    .waitFor();
  assert.equal(calls.reassess, beforeRecovery.reassess + 1);
  assert.equal(
    calls.search,
    beforeRecovery.search,
    'Reassessment must not search again',
  );
  assert.equal(
    calls.check,
    beforeRecovery.check,
    'Reassessment uses existing check',
  );
  await check()
    .getByText('Check incomplete or inconclusive', { exact: true })
    .waitFor();
  const limitedAck = check().getByRole('checkbox', {
    name: /I understand searches were incomplete for .*; continue with available collections/,
  });
  assert.equal(await limitedAck.isChecked(), false);
  const limitedReview = check().getByRole('button', {
    name: 'Confirm review & continue',
    exact: true,
  });
  assert.equal(await limitedReview.isDisabled(), true);
  await limitedAck.check();
  await limitedReview.click();
  assert.equal(last?.limitedCoverageAccepted, true);
  await check()
    .getByText('Check incomplete or inconclusive', { exact: true })
    .waitFor();
  await page
    .getByText('Limited search coverage', { exact: false })
    .first()
    .waitFor();
  await page
    .getByRole('button', { name: 'Generate hypothesis', exact: true })
    .click();
  assert.equal(
    calls.analysis,
    2,
    'Accepted limited positive evidence permits explicit generation',
  );
  assert.equal(analyzed.checkId, last?.checkId);
  assert.equal(
    last?.status,
    'Check incomplete or inconclusive',
    'Approval must not rewrite coverage into a complete status',
  );
  await page.screenshot({
    path: `${output}/recovery-desktop.png`,
    fullPage: true,
  });
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

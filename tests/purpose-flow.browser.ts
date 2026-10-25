import { gapCheckScopeKey, type GapCheckResult } from '../shared/gap-check';
/** SYNTHETIC FIXTURES ONLY. All API responses mocked; no paid API calls. */
import { chromium, type Locator, type Page } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Analysis, Paper } from '../shared/types';

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
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors: string[] = [];
const unexpected: string[] = [];
const calls = { search: 0, analysis: 0, prior: 0 };
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
const checks = new Map<string, GapCheckResult>();
await page.route('**/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/gap-check') {
    const body = route.request().postDataJSON();
    const result: GapCheckResult = {
      checkId: `synthetic-check-${checks.size + 1}`,
      gap: body.gap,
      scopeKey: gapCheckScopeKey(body.brief, body.paperIds, body.gap),
      status: 'No close match found in the searches completed',
      summary:
        'SYNTHETIC check found no close answer; novelty remains unproven.',
      candidates: [],
      matches: [],
      searches: [
        { query: 'SYNTHETIC focused gap question search', error: null },
      ],
      sourceStatuses: [],
      checkedAt: '2026-10-25T00:00:00Z',
      aiCompleted: true,
      reviewed: false,
      decision: null,
    };
    checks.set(result.checkId, result);
    await route.fulfill({ json: result });
    return;
  }
  if (/^\/api\/gap-check\/[^/]+\/review$/.test(path)) {
    const id = path.split('/')[3];
    const previous = checks.get(id);
    assert.ok(previous, 'Only an existing check can be reviewed');
    const body = route.request().postDataJSON();
    const result = { ...previous, reviewed: true, decision: body.decision };
    checks.set(id, result);
    await route.fulfill({ json: result });
    return;
  }

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
        retrievedAt: 'synthetic',
        sourceStatuses: [],
      },
    });
  } else if (path === '/api/analyze') {
    const checked = checks.get(route.request().postDataJSON().checkId);
    assert.ok(
      checked?.reviewed,
      'AI development requires an explicitly reviewed real-search result',
    );
    calls.analysis++;
    await route.fulfill({
      json: {
        analysisId: 'synthetic-purpose-analysis',
        result: analysis,
        sources: papers,
      },
    });
  } else if (path === '/api/prior-work') {
    calls.prior++;
    const body = route.request().postDataJSON();
    assert.equal(body.analysisId, 'synthetic-purpose-analysis');
    assert.equal(body.hypothesisId, analysis.hypotheses[0].id);
    await route.fulfill({
      json: {
        status:
          'No close match found in these searches; novelty is not established.',
        searches: [{ query: 'SYNTHETIC related work query', error: null }],
        matches: [],
      },
    });
  } else {
    unexpected.push(path);
    await route.fulfill({
      status: 500,
      json: { error: 'Unexpected synthetic test request' },
    });
  }
});
const pipeline = page.getByRole('navigation', { name: 'Research pipeline' });
async function stage(name: string) {
  const close = page.getByRole('button', {
    name: 'Close evidence',
    exact: true,
  });
  if (await close.isVisible()) await close.click();
  await pipeline.getByRole('button', { name, exact: true }).click();
}
async function openDetailsFor(button: Locator) {
  const parents = button.locator('xpath=ancestor::details');
  for (let i = 0; i < (await parents.count()); i++) {
    const details = parents.nth(i);
    if (!(await details.evaluate((e) => (e as HTMLDetailsElement).open)))
      await details.locator(':scope > summary').click();
  }
}
async function noJump(button: Locator) {
  await button.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => scrollY);
  await button.click();
  await page.waitForTimeout(100);
  assert.ok(
    Math.abs((await page.evaluate(() => scrollY)) - before) <= 3,
    'Map branch click must not jump the page',
  );
}
async function noOverflow() {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
}
const output = '/tmp/paperbridge-purpose';
await mkdir(output, { recursive: true });
async function checkAndReviewSelectedGap() {
  await page
    .getByRole('button', { name: 'Check existing research', exact: true })
    .click();
  await page
    .getByText('No close match found in the searches completed', {
      exact: true,
    })
    .waitFor();
  await page.getByText('Other research intentions', { exact: true }).click();
  await page
    .getByLabel('How will you use this check?', { exact: true })
    .selectOption('continue');
  await page
    .getByRole('button', { name: 'I have reviewed this check', exact: true })
    .click();
  await page
    .getByText('Reviewed · candidate follow-up, novelty not established.', {
      exact: true,
    })
    .waitFor();
}

try {
  await page.goto(process.env.PAPERBRIDGE_TEST_URL || 'http://localhost:5173');
  assert.match(await page.title(), /PaperBridge/);
  assert.deepEqual(await pipeline.getByRole('button').allTextContents(), [
    '1Focus',
    '2Papers',
    '3Find gaps',
    '4Experiment',
  ]);
  const logo = page.getByRole('img', { name: /PaperBridge logo/i });
  await logo.waitFor();
  assert.ok(
    await logo.evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
    ),
  );
  const logoContained = await logo.evaluate((img) => {
    const rect = img.getBoundingClientRect(),
      frame = img.parentElement!.getBoundingClientRect();
    return (
      rect.left >= frame.left - 1 &&
      rect.top >= frame.top - 1 &&
      rect.right <= frame.right + 1 &&
      rect.bottom <= frame.bottom + 1
    );
  });
  assert.equal(
    logoContained,
    true,
    'The original logo must not be clipped by its frame',
  );

  const font = await page
    .locator('h1')
    .evaluate((e) => getComputedStyle(e).fontFamily);
  assert.match(font, /Playfair Display/);
  assert.doesNotMatch(font, /Newsreader/);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page.evaluate(() =>
      document.fonts.check('400 16px "Playfair Display"'),
    ),
    true,
  );
  const brandProof = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement),
      button = getComputedStyle(document.querySelector('button.primary')!);
    return {
      family: getComputedStyle(document.querySelector('h1')!).fontFamily,
      accent: root.getPropertyValue('--accent').trim(),
      ink: root.getPropertyValue('--ink').trim(),
      page: root.getPropertyValue('--page').trim(),
      foreground: button.color,
      background: button.backgroundColor,
    };
  });
  assert.notEqual(
    brandProof.accent.toLowerCase(),
    '#a63e2b',
    'Editorial rust rebranding must not return',
  );
  const luminance = (color: string) => {
    const channels = (color.match(/[\d.]+/g) || [])
      .slice(0, 3)
      .map((value) => Number(value) / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const l1 = luminance(brandProof.foreground),
    l2 = luminance(brandProof.background);
  const contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  assert.ok(
    contrast >= 4.5,
    'Primary action text must retain readable contrast',
  );
  await writeFile(
    `${output}/brand-proof.json`,
    JSON.stringify({ ...brandProof, contrast, logoContained }, null, 2),
  );

  await page.screenshot({ path: `${output}/after-focus.png`, fullPage: true });
  await page.getByLabel('Research question', { exact: true }).fill(question);
  await page
    .getByLabel('Your field of interest', { exact: true })
    .fill('Neuroscience');
  await page
    .getByRole('button', { name: 'Find papers for this focus', exact: true })
    .click();
  for (const paper of papers)
    await page.getByLabel(`Select ${paper.title}`, { exact: true }).check();
  await page.getByRole('tab', { name: 'Read & compare', exact: true }).click();
  await page.locator('.comparison-panel').waitFor();
  await page.screenshot({
    path: `${output}/after-papers-comparison.png`,
    fullPage: true,
  });
  await stage('Find gaps');
  await page.getByRole('heading', { name: 'Find gaps', exact: true }).waitFor();
  assert.deepEqual(await page.getByRole('tab').allTextContents(), [
    'Gap findings',
    'Visual map',
  ]);
  assert.equal(
    await page
      .getByRole('tab', { name: 'Gap findings', exact: true })
      .getAttribute('aria-selected'),
    'true',
  );
  const findings = page.locator('.gap-findings');
  await findings.waitFor();
  const choices = findings.locator('[data-finding-id]');
  assert.ok(
    (await choices.count()) > 0,
    'Source-backed candidates must be readable without the map',
  );
  // Stable selectors are deliberately shared by the findings and map components.
  const selected = findings.locator('.finding-detail');
  await selected.waitFor();
  await selected.getByText('Why this may be a gap', { exact: true }).click();
  for (const label of [
    'What the sources establish',
    'What remains unresolved',
    'Why investigate this',
  ])
    await selected.getByText(label, { exact: true }).waitFor();
  const selectedId = await selected.getAttribute('data-finding-id');
  assert.ok(selectedId);
  assert.match(
    await selected.locator('.finding-origin').innerText(),
    /Author-stated/,
  );
  assert.equal(await selected.locator('.finding-next').count(), 0);
  await selected
    .getByRole('button', { name: 'Check existing research', exact: true })
    .waitFor();
  const selectedQuestion = (
    await selected.locator(':scope > h3').innerText()
  ).replace(/[.!?]+$/, '');
  await page.screenshot({
    path: `${output}/after-gap-findings.png`,
    fullPage: true,
  });
  const displayCalls = { ...calls };
  await page.getByRole('tab', { name: 'Visual map', exact: true }).click();
  await page.getByRole('heading', { name: 'Find gaps', exact: true }).waitFor();
  const map = page.locator('.gap-visual-map');
  await map.waitFor();
  assert.equal(await map.getAttribute('data-finding-id'), selectedId);
  assert.ok(
    (await map.innerText())
      .toLowerCase()
      .includes(selectedQuestion.toLowerCase()),
    'The map must explain the selected readable finding',
  );
  const sourceRefs = await selected
    .locator('.finding-source')
    .evaluateAll((nodes) =>
      nodes
        .map(
          (node) =>
            `${(node as HTMLElement).dataset.paperId}:${(node as HTMLElement).dataset.passageId}`,
        )
        .sort(),
    );
  const mapRefs = await map
    .locator('.gap-map-evidence-node')
    .evaluateAll((nodes) =>
      nodes
        .map(
          (node) =>
            `${(node as HTMLElement).dataset.paperId}:${(node as HTMLElement).dataset.passageId}`,
        )
        .sort(),
    );
  assert.ok(sourceRefs.length > 0);
  assert.deepEqual(
    [...new Set(mapRefs)],
    [...new Set(sourceRefs)],
    'Map and readable finding must use exactly the same citations',
  );
  assert.equal(await map.getByRole('textbox').count(), 0);
  assert.equal(
    await map
      .getByRole('button', { name: /Develop this gap|Plan experiment/ })
      .count(),
    0,
  );

  assert.equal(
    await map
      .locator(
        '.comparison-panel,.paper-panel,.connection-panel,.experiment-panel',
      )
      .count(),
    0,
    'Map must not duplicate complete tools',
  );
  const branches = map.locator('button[aria-expanded][aria-controls]');
  assert.ok((await branches.count()) >= 2);
  await noJump(branches.nth(0));
  await noJump(branches.nth(1));
  assert.equal(await branches.nth(0).getAttribute('aria-expanded'), 'true');
  await noJump(branches.nth(0));
  assert.equal(await branches.nth(0).getAttribute('aria-expanded'), 'false');
  assert.equal(await branches.nth(1).getAttribute('aria-expanded'), 'true');
  await noJump(branches.nth(0));
  const leaf = map.locator('.gap-map-evidence-node').first();
  await noJump(leaf);
  await map
    .getByRole('region', { name: 'Map evidence details', exact: true })
    .waitFor();
  await map
    .getByRole('button', { name: 'Close evidence details', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Gap findings', exact: true }).click();
  await page.getByRole('tab', { name: 'Visual map', exact: true }).click();
  assert.equal(await branches.nth(0).getAttribute('aria-expanded'), 'true');
  assert.equal(await branches.nth(1).getAttribute('aria-expanded'), 'true');
  assert.deepEqual(
    calls,
    displayCalls,
    'Existing map display must not request analysis/search',
  );
  await page.screenshot({
    path: `${output}/after-visual-map.png`,
    fullPage: true,
  });
  await page.getByRole('tab', { name: 'Gap findings', exact: true }).click();
  assert.equal(await selected.getAttribute('data-finding-id'), selectedId);
  // AI development remains an explicit, separately billed action, mocked here.
  await checkAndReviewSelectedGap();
  const develop = selected.getByRole('button', {
    name: 'Go to hypothesis',
    exact: true,
  });
  await develop.click();
  assert.equal(
    calls.analysis,
    0,
    'Selecting development context must not auto-generate',
  );
  const generate = page.getByRole('button', {
    name: 'Generate hypothesis',
    exact: true,
    includeHidden: true,
  });
  await openDetailsFor(generate);
  await generate.click();
  await selected
    .getByRole('heading', {
      name: 'SYNTHETIC selected hypothesis',
      exact: true,
    })
    .waitFor();
  await findings.getByText(/^Choose a different gap/).click();
  const aiChoice = findings.getByRole('radio', {
    name: /SYNTHETIC selected hypothesis/,
  });
  assert.equal(await aiChoice.count(), 1);
  await aiChoice.first().check();
  assert.match(
    await selected.locator('.finding-origin').innerText(),
    /inference|AI-developed/,
  );
  const inspectHypothesis = selected.getByRole('button', {
    name: 'Inspect evidence & limitations',
    exact: true,
    includeHidden: true,
  });
  await openDetailsFor(inspectHypothesis);
  await inspectHypothesis.click();
  const fullInspector = page.getByRole('dialog');
  await fullInspector.locator('.hypothesis-evidence').waitFor();
  assert.equal(
    await fullInspector.locator('.explicit-evidence').count(),
    0,
    'Full hypothesis inspector must not be replaced by a single-passage view',
  );
  const fitSection = fullInspector.locator('.resource-assessment');
  await fitSection.locator(':scope > summary').click();
  await fitSection
    .getByRole('button', { name: 'Assess resources', exact: true })
    .click();
  await fitSection.locator('.fit-status').waitFor();
  assert.equal(await fitSection.locator('.fit-status').innerText(), 'Unknown');
  assert.equal(
    calls.analysis,
    1,
    'Inspecting and assessing resources must not regenerate',
  );
  const priorSection = fullInspector.locator('.prior-work');
  await priorSection.locator(':scope > summary').click();
  await priorSection
    .getByRole('button', { name: 'Check related prior work', exact: true })
    .click();
  await priorSection
    .getByText(
      'No close match found in these searches; novelty is not established.',
      { exact: true },
    )
    .waitFor();
  await page.screenshot({
    path: `${output}/after-hypothesis-inspector.png`,
    fullPage: false,
  });
  await page
    .getByRole('button', { name: 'Close evidence', exact: true })
    .click();
  assert.equal(
    await aiChoice.first().isChecked(),
    true,
    'Full inspector must preserve the selected AI candidate',
  );
  const generated = page.getByRole('article', {
    name: 'Generated hypothesis',
    exact: true,
  });
  await generated
    .getByText(analysis.hypotheses[0].hypothesis, { exact: true })
    .waitFor();
  await generated
    .getByRole('button', { name: 'Plan experiment', exact: true })
    .click();
  await page
    .getByLabel('Proposed method', { exact: true })
    .fill('User edited method survives the simplified workflow.');
  await stage('Find gaps');
  const aiId = await selected.getAttribute('data-finding-id');
  const evidence = selected
    .getByRole('button', {
      name: /Inspect.*passage|Inspect evidence/i,
      includeHidden: true,
    })
    .first();
  assert.equal(await evidence.count(), 1);
  {
    await openDetailsFor(evidence);
    await evidence.click();
    await page.getByRole('dialog').waitFor();
    await page
      .getByRole('button', { name: 'Close evidence', exact: true })
      .click();
  }
  assert.equal(await selected.getAttribute('data-finding-id'), aiId);
  await page.getByRole('tab', { name: 'Visual map', exact: true }).click();
  assert.equal(await map.getAttribute('data-finding-id'), aiId);
  await stage('Experiment');
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'User edited method survives the simplified workflow.',
  );
  await page.screenshot({
    path: `${output}/after-experiment.png`,
    fullPage: true,
  });
  await stage('Papers');
  await page.getByRole('tab', { name: 'Read & compare', exact: true }).click();
  assert.equal(await page.locator('.comparison-panel:visible').count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await stage('Find gaps');
  await noOverflow();
  await page.getByRole('tab', { name: 'Visual map', exact: true }).click();
  await noOverflow();
  await page.screenshot({
    path: `${output}/after-map-mobile.png`,
    fullPage: true,
  });
  await stage('Experiment');
  await noOverflow();
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'User edited method survives the simplified workflow.',
  );
  const emptyPage = await browser.newPage({
    viewport: { width: 1366, height: 900 },
  });
  emptyPage.on('pageerror', (error) => errors.push(error.message));
  await emptyPage.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/health')
      await route.fulfill({
        json: {
          analysisAvailable: false,
          analysisState: 'not-configured',
          reason: 'SYNTHETIC unavailable model.',
          openalexKeyConfigured: false,
        },
      });
    else {
      unexpected.push(path);
      await route.fulfill({
        status: 500,
        json: { error: 'Unexpected empty-state request' },
      });
    }
  });
  await emptyPage.goto(
    process.env.PAPERBRIDGE_TEST_URL || 'http://localhost:5173',
  );
  await emptyPage
    .getByRole('navigation', { name: 'Research pipeline' })
    .getByRole('button', { name: 'Find gaps', exact: true })
    .click();
  await emptyPage
    .getByText(/No clear gap found in the available text/)
    .waitFor();
  assert.equal(
    await emptyPage
      .getByRole('tab', { name: 'Gap findings', exact: true })
      .getAttribute('aria-selected'),
    'true',
  );
  await emptyPage.getByRole('tab', { name: 'Visual map', exact: true }).click();
  await emptyPage.getByText(/No supported candidate is selected/).waitFor();
  assert.equal(
    await emptyPage.locator('.gap-visual-map button[aria-expanded]').count(),
    0,
    'Insufficient evidence must not produce filler branches',
  );
  await emptyPage.screenshot({
    path: `${output}/after-insufficient-evidence.png`,
    fullPage: true,
  });
  await emptyPage.close();
  assert.equal(calls.search, 1);
  assert.equal(calls.analysis, 1);
  assert.equal(calls.prior, 1);
  assert.deepEqual(unexpected, []);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: Focus/Papers/Find gaps/Experiment; default readable findings; canonical selected-gap map; independent no-jump branches; comparison only in Papers; explicit mocked AI development; full hypothesis inspector/resource fit/prior work; edited plan/evidence/tab state; logo and Playfair typography; laptop/narrow. No paid requests.',
  );
} finally {
  await browser.close();
}

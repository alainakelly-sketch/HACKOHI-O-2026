/** Visual restoration and selection regression. SYNTHETIC API fixtures only;
 * every API endpoint is intercepted, so no literature/model requests are made.
 * Start npm run dev, then npx tsx tests/visual-restoration.browser.ts. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import type { Paper } from '../shared/types';
const base = process.env.PAPERBRIDGE_TEST_URL || 'http://localhost:5173';
const output = '/tmp/paperbridge-restore';
await mkdir(output, { recursive: true });
const digest = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
const original = execFileSync(
  'git',
  ['show', 'acba703:public/paperbridge-logo.png'],
  { maxBuffer: 4 * 1024 * 1024 },
);
assert.equal(
  digest(await readFile('public/paperbridge-logo.png')),
  digest(original),
);
const papers: Paper[] = Array.from({ length: 7 }, (_, i) => ({
  id: `synthetic:restore:${i}`,
  title: `SYNTHETIC Restoration source ${i + 1}`,
  year: 2026,
  doi: null,
  url: 'https://example.invalid/synthetic',
  authors: ['Synthetic author'],
  abstract: 'SYNTHETIC network evidence for browser testing.',
  passages: [
    {
      id: `synthetic:passage:${i}`,
      kind: 'full-text',
      section: 'Results',
      text: 'SYNTHETIC network evaluation uses repeated samples. Future work should investigate larger network samples.',
    },
  ],
  retrievedAt: '2026-01-01',
  coverage: 'Full text retrieved',
  sources: [
    {
      provider: 'Europe PMC',
      id: `synthetic:restore:${i}`,
      url: 'https://example.invalid/synthetic',
    },
  ],
  fullText: {
    provider: 'Europe PMC',
    url: 'https://example.invalid/synthetic',
    license: null,
    retrievedAt: '2026-01-01',
    note: 'Synthetic test only',
    truncated: false,
  },
}));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors: string[] = [],
  unexpected: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
let searches = 0;
await page.route('**/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/health')
    await route.fulfill({
      json: {
        analysisAvailable: false,
        analysisState: 'spending-disabled',
        reason: 'SYNTHETIC disabled',
        openalexKeyConfigured: false,
      },
    });
  else if (path === '/api/search') {
    searches++;
    await route.fulfill({
      json: {
        papers,
        query: 'synthetic networks',
        retrievedAt: '2026-01-01',
        sourceStatuses: [],
      },
    });
  } else {
    unexpected.push(path);
    await route.fulfill({
      status: 500,
      json: { error: 'No real API calls allowed in this test.' },
    });
  }
});
try {
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  for (const weight of [400, 700])
    assert.equal(
      await page.evaluate(
        (w) => document.fonts.check(`${w} 16px "Playfair Display"`),
        weight,
      ),
      true,
    );
  const fontResponse = await page.request.get(
    new URL('/fonts/playfair-display-variable.ttf', base).toString(),
  );
  assert.equal(fontResponse.status(), 200);
  assert.equal(
    digest(await fontResponse.body()),
    'c40f2293766a503bc70cce9e512ef844a4ccb7cbcde792fe2ea31d191917d8d6',
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const documentNode = await cdp.send('DOM.getDocument');
  for (const selector of [
    'h1',
    '.page-heading p',
    'button.primary',
    'textarea',
  ]) {
    const { nodeId } = await cdp.send('DOM.querySelector', {
      nodeId: documentNode.root.nodeId,
      selector,
    });
    assert.ok(nodeId, selector);
    const fonts = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    // Empty form controls have no glyphs until filled, but must inherit the family.
    assert.match(
      await page
        .locator(selector)
        .first()
        .evaluate((e) => getComputedStyle(e).fontFamily),
      /Playfair Display/,
    );
    if (selector === 'h1' || selector === '.page-heading p')
      assert.ok(
        fonts.fonts.some(
          (f) =>
            f.familyName === 'Playfair Display' &&
            f.isCustomFont &&
            f.glyphCount > 0,
        ),
        `Actual ${selector} glyphs use requested font`,
      );
  }
  assert.equal(
    await page.locator('h1').evaluate((e) => getComputedStyle(e).fontWeight),
    '700',
  );
  assert.equal(
    await page
      .locator('.page-heading p')
      .evaluate((e) => getComputedStyle(e).fontWeight),
    '400',
  );
  assert.equal(
    await page
      .locator('body')
      .evaluate((e) => getComputedStyle(e).backgroundColor),
    'rgb(248, 250, 252)',
  );
  assert.equal(
    await page
      .locator('button.primary')
      .first()
      .evaluate((e) => getComputedStyle(e).backgroundColor),
    'rgb(85, 88, 239)',
  );
  assert.match(
    await page.evaluate(() => {
      const code = document.createElement('code');
      document.body.append(code);
      const family = getComputedStyle(code).fontFamily;
      code.remove();
      return family;
    }),
    /monospace/,
  );
  const logo = page.getByRole('img', { name: 'PaperBridge logo', exact: true });
  assert.equal(await logo.getAttribute('src'), '/paperbridge-logo.png');
  assert.equal(
    digest(
      await (
        await page.request.get(
          new URL('/paperbridge-logo.png', base).toString(),
        )
      ).body(),
    ),
    digest(original),
  );
  await page.screenshot({
    path: `${output}/focus-desktop.png`,
    fullPage: true,
  });
  await page
    .getByLabel('Research question', { exact: true })
    .fill('How can network sample size improve evaluation?');
  await page
    .getByLabel('Your field of interest', { exact: true })
    .fill('Network science');
  await page
    .getByRole('button', { name: 'Find papers for this focus', exact: true })
    .click();
  const panel = page.locator('.paper-panel');
  const checkbox = (i: number) =>
    panel.getByRole('checkbox', {
      name: `Select ${papers[i].title}`,
      exact: true,
    });
  await checkbox(0).waitFor();
  const panelStyle = await panel.evaluate((e) => {
    const s = getComputedStyle(e);
    return {
      border: s.borderTopWidth,
      radius: s.borderRadius,
      background: s.backgroundColor,
    };
  });
  assert.deepEqual(panelStyle, {
    border: '1px',
    radius: '10px',
    background: 'rgb(255, 255, 255)',
  });
  assert.equal(await panel.locator('.paper-entry-number').count(), 0);
  await checkbox(0).scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  await checkbox(0).check();
  assert.equal(
    await page
      .getByRole('tab', { name: 'Search & select', exact: true })
      .getAttribute('aria-selected'),
    'true',
  );
  assert.ok(
    Math.abs((await page.evaluate(() => scrollY)) - scroll) < 80,
    'Selection should not jump the page',
  );
  await panel.getByText('1 selected', { exact: false }).first().waitFor();
  assert.equal(await panel.locator('.paper-row.selected').count(), 1);
  assert.equal(await page.locator('.reader-context:visible').count(), 0);
  const second = panel.locator('.paper-row').filter({
    has: page.getByRole('heading', { name: papers[1].title, exact: true }),
  });
  await second
    .getByRole('button', { name: 'Read article body', exact: true })
    .click();
  await page
    .locator('.reader-context')
    .getByText(`Reading: ${papers[1].title}`, { exact: true })
    .waitFor();
  await page.getByRole('tab', { name: 'Search & select', exact: true }).click();
  assert.equal(await checkbox(1).isChecked(), false);
  assert.equal(await checkbox(0).isChecked(), true);
  assert.equal(
    await panel
      .getByRole('button', { name: `Remove ${papers[0].title}`, exact: true })
      .count(),
    1,
  );
  await panel.getByText(/^Filters ·/).click();
  await panel.locator('#article-access').selectOption('verified');
  assert.equal(await checkbox(0).isChecked(), true);
  await panel.locator('#article-access').selectOption('all');
  await panel.locator('#paper-search').fill('synthetic second search');
  await panel
    .locator('.search-form')
    .getByRole('button', { name: 'Search', exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll('.paper-row').length >= 7,
  );
  assert.equal(await checkbox(0).isChecked(), true);
  for (let i = 1; i < 6; i++) await checkbox(i).check();
  assert.equal(await checkbox(6).isDisabled(), true);
  assert.equal(await checkbox(0).isDisabled(), false);
  assert.equal(
    await panel.getByRole('button', { name: /^Remove SYNTHETIC/ }).count(),
    6,
  );
  await panel
    .getByRole('button', { name: `Remove ${papers[0].title}`, exact: true })
    .click();
  assert.equal(await checkbox(6).isDisabled(), false);
  await panel.getByText(/^Filters ·/).click();
  await panel.locator('.paper-list').evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `${output}/papers-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${output}/papers-mobile.png`,
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    '390px layout must not overflow',
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  assert.ok(searches >= 2);
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        font: 'Playfair Display',
        body: 400,
        headings: 700,
        originalLogoSha256: digest(original),
        searches,
        errors,
        unexpected,
      },
      null,
      2,
    ),
  );
  console.log(`PASS visual restoration and selection; screenshots: ${output}`);
} finally {
  await browser.close();
}

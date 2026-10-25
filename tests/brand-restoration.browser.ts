/** Branding-only regression. Research APIs are mocked; no paid requests. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const base = process.env.PAPERBRIDGE_TEST_URL || 'http://localhost:5173';
const output = '/tmp/paperbridge-brand-restore';
await mkdir(output, { recursive: true });
const digest = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
const originalLogo = execFileSync(
  'git',
  ['show', 'acba703:public/paperbridge-logo.png'],
  { maxBuffer: 4 * 1024 * 1024 },
);
const currentLogo = await readFile('public/paperbridge-logo.png');
assert.equal(
  digest(currentLogo),
  digest(originalLogo),
  'Logo asset must remain byte-identical to original Git asset',
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors: string[] = [];
let apiCalls = 0;
const apiPaths: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('**/api/**', async (route) => {
  apiCalls++;
  const path = new URL(route.request().url()).pathname;
  apiPaths.push(path);
  if (path === '/api/health')
    await route.fulfill({
      json: {
        analysisAvailable: false,
        analysisState: 'spending-disabled',
        reason: 'Synthetic disabled readiness',
        openalexKeyConfigured: false,
      },
    });
  else throw Error(`Unexpected request ${path}`);
});
try {
  await page.goto(base);
  assert.match(await page.title(), /PaperBridge/);
  await page.evaluate(() => document.fonts.ready);
  for (const font of [
    '400 16px Manrope',
    '500 32px Manrope',
    '600 14px Manrope',
  ])
    assert.equal(
      await page.evaluate((font) => document.fonts.check(font), font),
      true,
    );
  const logo = page.getByRole('img', { name: 'PaperBridge logo', exact: true });
  await logo.waitFor();
  assert.equal(await logo.getAttribute('src'), '/paperbridge-logo.png');
  assert.equal(
    await page.locator('.brand-name').count(),
    0,
    'Embedded logo lettering must not be replaced by a live wordmark',
  );
  assert.equal(
    digest(
      await (
        await page.request.get(
          new URL('/paperbridge-logo.png', base).toString(),
        )
      ).body(),
    ),
    digest(originalLogo),
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const doc = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: 'h1',
  });
  const fonts = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  assert.ok(
    fonts.fonts.some(
      (font) =>
        font.familyName.includes('Manrope') &&
        font.isCustomFont &&
        font.glyphCount > 0,
    ),
    'Actual heading glyphs must render in Manrope',
  );
  const tokens = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      [
        '--ink',
        '--accent',
        '--muted',
        '--line',
        '--soft',
        '--brand-blue',
        '--brand-violet',
      ].map((name) => [name, css.getPropertyValue(name).trim().toLowerCase()]),
    );
  });
  assert.equal(tokens['--ink'], '#0b1c3d');
  assert.equal(tokens['--accent'], '#5558ef');
  assert.equal(tokens['--muted'], '#62708b');
  assert.equal(tokens['--line'], '#dce4f0');
  assert.equal(tokens['--soft'], '#f2f5ff');
  assert.equal(tokens['--brand-blue'], '#0878c8');
  const pipeline = page.getByRole('navigation', { name: 'Research pipeline' });
  assert.deepEqual(await pipeline.getByRole('button').allTextContents(), [
    '1Focus',
    '2Papers',
    '3Find gaps',
    '4Experiment',
  ]);
  async function geometry() {
    const result = await logo.evaluate((element: HTMLImageElement) => {
      const r = element.getBoundingClientRect(),
        p = element.parentElement!.getBoundingClientRect();
      return {
        loaded: element.complete && element.naturalWidth > 0,
        full:
          r.left >= p.left - 1 &&
          r.top >= p.top - 1 &&
          r.right <= p.right + 1 &&
          r.bottom <= p.bottom + 1,
        fit: getComputedStyle(element).objectFit,
      };
    });
    assert.equal(result.loaded, true);
    assert.equal(result.full, true);
    assert.equal(result.fit, 'contain');
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    return result;
  }
  const desktop = await geometry();
  await page.screenshot({
    path: `${output}/after-desktop.png`,
    fullPage: true,
  });
  await pipeline.getByRole('button', { name: 'Papers', exact: true }).click();
  await page.getByRole('tab', { name: 'Read & compare', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Compare your selected papers', exact: true })
    .waitFor();
  await pipeline
    .getByRole('button', { name: 'Find gaps', exact: true })
    .click();
  assert.equal(
    await page
      .getByRole('tab', { name: 'Gap findings', exact: true })
      .getAttribute('aria-selected'),
    'true',
  );
  await page.getByRole('tab', { name: 'Visual map', exact: true }).click();
  assert.equal(await page.locator('h1').textContent(), 'Find gaps');
  await pipeline
    .getByRole('button', { name: 'Experiment', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Start my own experiment draft', exact: true })
    .click();
  await page
    .getByLabel('Proposed method', { exact: true })
    .fill('SYNTHETIC preserved experiment edit.');
  await pipeline.getByRole('button', { name: 'Focus', exact: true }).click();
  await pipeline
    .getByRole('button', { name: 'Experiment', exact: true })
    .click();
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'SYNTHETIC preserved experiment edit.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await pipeline.getByRole('button', { name: 'Focus', exact: true }).click();
  const narrow = await geometry();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${output}/after-mobile.png`, fullPage: true });
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.deepEqual(errors, []);
  assert.ok(
    apiPaths.every((path) => path === '/api/health'),
    'Branding/navigation must not trigger research or model requests',
  );
  await writeFile(
    `${output}/proof.json`,
    JSON.stringify(
      {
        originalLogoSha256: digest(originalLogo),
        tokens,
        fonts,
        desktop,
        narrow,
        errors,
        apiCalls,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS: original byte-identical full logo/embedded lettering, recovered purple-blue tokens, actual Manrope glyphs, unchanged workflow/plan edits, desktop/mobile no clipping or errors; no paid calls.',
  );
} finally {
  await browser.close();
}

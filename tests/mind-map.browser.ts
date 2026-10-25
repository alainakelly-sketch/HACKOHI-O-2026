/** Saved-example UI smoke test. No model calls or invented live results. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors: string[] = [];
  let analysisCalls = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/analyze') analysisCalls++;
  });
  await page.goto(
    `${process.env.PAPERBRIDGE_TEST_URL || 'http://localhost:5173'}/?example=network-ecology`,
  );
  const pipeline = page.getByRole('navigation', { name: 'Research pipeline' });
  assert.equal(await pipeline.getByRole('button').count(), 4);
  await pipeline.getByRole('button', { name: 'Mind map', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Evidence mind map', exact: true })
    .waitFor();
  const nodes = page.locator('.discovery-node.paper');
  await nodes.first().waitFor();
  assert.equal(await nodes.count(), 4);
  assert.equal(await page.locator('.discovery-candidate').count(), 0);
  await nodes.first().click();
  await page.getByRole('region', { name: 'Selected paper details' }).waitFor();
  await pipeline
    .getByRole('button', { name: 'Hypothesis', exact: true })
    .click();
  await page.getByRole('tab', { name: 'AI hypotheses', exact: true }).waitFor();
  await pipeline.getByRole('button', { name: 'Mind map', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.equal(analysisCalls, 0);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: map navigation, paper selection, no duplicate cards, mobile width, no paid calls or page errors',
  );
} finally {
  await browser.close();
}

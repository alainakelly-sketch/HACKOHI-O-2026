/** SYNTHETIC UI fixtures only. Fonts are local real assets; all API requests mocked. */
import { chromium, type Page } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Paper } from '../shared/types';
const question =
  'How does sleep duration affect memory recall in university students?';
const bodyPapers: Paper[] = Array.from({ length: 4 }, (_, index) => ({
  id: `synthetic:expand:${index}`,
  title:
    index === 0
      ? 'SYNTHETIC A longitudinal examination of sleep duration, memory recall, contextual variation and reproducibility among university students across multiple study sites'
      : `SYNTHETIC Sleep duration and memory recall ${index + 1}`,
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

const papers: Paper[] = [
  ...bodyPapers,
  {
    ...bodyPapers[0],
    id: 'synthetic:abstract',
    title: 'SYNTHETIC An abstract-only reading-list entry',
    coverage: 'Abstract only',
    fullText: undefined,
    passages: [
      {
        id: 'synthetic:abstract:p',
        kind: 'abstract',
        text: 'SYNTHETIC Abstract-only source.',
      },
    ],
  },
  {
    ...bodyPapers[0],
    id: 'synthetic:metadata',
    title: 'SYNTHETIC Metadata without an available abstract',
    coverage: 'Metadata only',
    fullText: undefined,
    abstract: null,
    passages: [],
  },
];
const output = '/tmp/paperbridge-journal';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors: string[] = [];
let modelCalls = 0;
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('500'))
    errors.push(message.text());
});
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/api/health')
    return route.fulfill({
      json: {
        analysisAvailable: false,
        analysisState: 'disabled',
        reason: 'Synthetic: live generation disabled.',
        openalexKeyConfigured: false,
      },
    });
  if (url.pathname === '/api/search') {
    if (url.searchParams.get('q') === 'trigger error')
      return route.fulfill({
        status: 500,
        json: { error: 'SYNTHETIC provider unavailable. Please retry.' },
      });
    return route.fulfill({
      json: {
        papers,
        query: question,
        retrievedAt: 'synthetic',
        sourceStatuses: [],
      },
    });
  }
  if (url.pathname === '/api/analyze') modelCalls++;
  throw Error('Unexpected API request ' + url.pathname);
});
async function open(name: string) {
  const stage = ['Focus', 'Papers', 'Compare'].includes(name)
    ? 'Search'
    : name === 'Gap leads'
      ? 'Mind map'
      : name === 'Experiment'
        ? 'Experiment'
        : 'Hypothesis';
  await page
    .getByRole('navigation', { name: 'Research pipeline' })
    .getByRole('button', { name: stage, exact: true })
    .click();
  await page.getByRole('tab', { name, exact: true }).click();
}
async function screenshot(name: string) {
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  await page.screenshot({
    path: `${output}/${name}-viewport.png`,
    fullPage: false,
  });
}
async function noOverflow() {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
}
function luminance(color: string) {
  const rgb = (color.match(/[\d.]+/g) || [])
    .slice(0, 3)
    .map(Number)
    .map((v) => {
      const n = v / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
try {
  await page.goto(process.env.PAPERBRIDGE_TEST_URL || 'http://localhost:5173');
  assert.match(await page.title(), /PaperBridge/);
  await page.locator('h1').waitFor();
  await page.evaluate(() => document.fonts.ready);
  for (const font of [
    '400 36px Newsreader',
    '500 21px Newsreader',
    '400 16px "IBM Plex Sans"',
    '600 14px "IBM Plex Sans"',
  ])
    assert.equal(
      await page.evaluate((font) => document.fonts.check(font), font),
      true,
      `Font unavailable: ${font}`,
    );
  const h1 = await page
    .locator('h1')
    .first()
    .evaluate((e) => ({
      family: getComputedStyle(e).fontFamily,
      size: parseFloat(getComputedStyle(e).fontSize),
      weight: parseFloat(getComputedStyle(e).fontWeight),
    }));
  assert.match(h1.family, /Newsreader/);
  assert.ok(h1.size >= 32 && h1.size <= 38);
  assert.ok(h1.weight >= 400 && h1.weight <= 500);
  const ui = await page
    .getByLabel('Research question', { exact: true })
    .evaluate((e) => ({
      family: getComputedStyle(e).fontFamily,
      size: parseFloat(getComputedStyle(e).fontSize),
    }));
  assert.match(ui.family, /IBM Plex Sans/);
  assert.ok(ui.size >= 14);
  const tokens = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      ink: s.getPropertyValue('--ink').trim(),
      muted: s.getPropertyValue('--muted').trim(),
      accent: s.getPropertyValue('--accent').trim(),
      page: s.getPropertyValue('--page').trim(),
    };
  });
  const computed = await page.evaluate(() => {
    const button = document.querySelector('button.primary')!;
    const s = getComputedStyle(button);
    return {
      color: s.color,
      background: s.backgroundColor,
      body: getComputedStyle(document.body).color,
      page: getComputedStyle(document.body).backgroundColor,
    };
  });
  assert.ok(
    contrast(computed.color, computed.background) >= 4.5,
    'Primary action contrast',
  );
  assert.ok(
    contrast(computed.body, computed.page) >= 4.5,
    'Body text contrast',
  );
  const inputBorder = await page
    .getByLabel('Research question', { exact: true })
    .evaluate((e) => ({
      border: getComputedStyle(e).borderColor,
      background: getComputedStyle(e).backgroundColor,
    }));
  assert.ok(
    contrast(inputBorder.border, inputBorder.background) >= 3,
    'Input border contrast',
  );
  await page.getByLabel('Research question', { exact: true }).focus();
  await page.keyboard.press('Tab');
  const outline = await page.locator(':focus').evaluate((e) => ({
    outline: getComputedStyle(e).outlineStyle,
    width: getComputedStyle(e).outlineWidth,
    shadow: getComputedStyle(e).boxShadow,
  }));
  assert.ok(
    outline.outline !== 'none' || outline.shadow !== 'none',
    'Keyboard focus visible',
  );
  await screenshot('after-focus');
  await noOverflow();
  await page.getByLabel('Research question', { exact: true }).fill(question);
  await page
    .getByLabel('Your field of interest', { exact: true })
    .fill('Neuroscience');
  await page
    .getByRole('button', { name: 'Find papers for this focus', exact: true })
    .click();
  await page.locator('.paper-row').first().waitFor();
  const publication = await page
    .locator('.paper-row h3')
    .first()
    .evaluate((e) => ({
      family: getComputedStyle(e).fontFamily,
      size: parseFloat(getComputedStyle(e).fontSize),
      weight: parseFloat(getComputedStyle(e).fontWeight),
    }));
  assert.match(publication.family, /Newsreader/);
  assert.ok(publication.size >= 19 && publication.size <= 22);
  assert.equal(publication.weight, 500);
  const metadata = await page
    .locator('.paper-meta')
    .first()
    .evaluate((e) => ({
      family: getComputedStyle(e).fontFamily,
      size: parseFloat(getComputedStyle(e).fontSize),
      color: getComputedStyle(e).color,
    }));
  assert.match(metadata.family, /IBM Plex Sans/);
  assert.ok(metadata.size >= 14, 'Metadata readable size');
  assert.ok(
    contrast(metadata.color, 'rgb(255, 255, 255)') >= 4.5,
    'Metadata contrast',
  );
  const titleColor = await page
    .locator('.paper-row h3')
    .first()
    .evaluate((e) => getComputedStyle(e).color);
  assert.ok(
    contrast(titleColor, 'rgb(255, 255, 255)') >= 4.5,
    'Publication title contrast',
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const domDocument = await cdp.send('DOM.getDocument');
  const nodes = await Promise.all(
    ['.brand-name', '.paper-row h3', '.paper-meta'].map(async (selector) => {
      const { nodeId } = await cdp.send('DOM.querySelector', {
        nodeId: domDocument.root.nodeId,
        selector,
      });
      return {
        selector,
        ...(await cdp.send('CSS.getPlatformFontsForNode', { nodeId })),
      };
    }),
  );
  assert.ok(
    nodes[0].fonts.some(
      (font: any) =>
        font.familyName.includes('Newsreader') && font.isCustomFont,
    ),
  );
  assert.ok(
    nodes[1].fonts.some(
      (font: any) =>
        font.familyName.includes('Newsreader') && font.isCustomFont,
    ),
  );
  assert.ok(
    nodes[2].fonts.some(
      (font: any) =>
        font.familyName.includes('IBM Plex Sans') && font.isCustomFont,
    ),
  );
  await screenshot('after-papers');
  await noOverflow();
  for (const paper of bodyPapers)
    await page.getByLabel(`Select ${paper.title}`, { exact: true }).check();
  await page.getByLabel('Search papers', { exact: true }).fill('trigger error');
  await page
    .locator('.paper-panel')
    .getByRole('button', { name: 'Search', exact: true })
    .click();
  await page
    .locator('.paper-panel .notice.error')
    .filter({ hasText: 'SYNTHETIC provider unavailable. Please retry.' })
    .waitFor();
  const errorColors = await page
    .locator('.paper-panel .notice.error')
    .evaluate((e) => ({
      color: getComputedStyle(e).color,
      background: getComputedStyle(e).backgroundColor,
    }));
  assert.ok(
    contrast(errorColors.color, errorColors.background) >= 4.5,
    'Error text contrast',
  );
  await screenshot('after-error');
  await page.getByLabel('Search papers', { exact: true }).fill(question);
  await page
    .locator('.paper-panel')
    .getByRole('button', { name: 'Search', exact: true })
    .click();
  await page.locator('.paper-row').first().waitFor();
  assert.equal((await page.locator('.selection-tray').count()) > 0, true);
  await open('Gap leads');
  const map = page.locator('.explore-connections');
  await map.locator(':scope > summary').click();
  const themes = map.getByRole('button', { name: /Explore theme:/ });
  await themes.first().click();
  await themes.nth(1).click();
  const mapNode = await themes.first().evaluate((e) => ({
    family: getComputedStyle(e).fontFamily,
    size: parseFloat(getComputedStyle(e).fontSize),
  }));
  assert.match(mapNode.family, /IBM Plex Sans/);
  assert.ok(mapNode.size >= 14, 'Map node control readable');
  await screenshot('after-map');
  await noOverflow();
  const gap = page.locator('.gap-panel [data-gap-id]').first();
  await gap
    .getByRole('button', { name: 'Inspect evidence', exact: true })
    .click();
  await page.getByRole('dialog').waitFor();
  await screenshot('after-evidence');
  await page
    .getByRole('button', { name: 'Close evidence', exact: true })
    .click();
  await gap
    .getByRole('button', {
      name: 'Draft an experiment from this lead',
      exact: true,
    })
    .click();
  await page
    .getByLabel('Proposed method', { exact: true })
    .fill('SYNTHETIC preserved editable plan method.');
  await screenshot('after-experiment');
  await noOverflow();
  await open('Gap leads');
  assert.equal(await themes.first().getAttribute('aria-expanded'), 'true');
  await open('Experiment');
  assert.equal(
    await page.getByLabel('Proposed method', { exact: true }).inputValue(),
    'SYNTHETIC preserved editable plan method.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('after-experiment-mobile');
  await noOverflow();
  await open('Gap leads');
  await screenshot('after-map-mobile');
  await noOverflow();
  await open('Papers');
  await screenshot('after-papers-mobile');
  await noOverflow();
  await open('Focus');
  const mobileHeading = await page
    .locator('h1')
    .first()
    .evaluate((e) => ({
      size: parseFloat(getComputedStyle(e).fontSize),
      weight: parseFloat(getComputedStyle(e).fontWeight),
      family: getComputedStyle(e).fontFamily,
    }));
  assert.match(mobileHeading.family, /Newsreader/);
  assert.ok(mobileHeading.size >= 30 && mobileHeading.size <= 38);
  assert.equal(mobileHeading.weight, 400);
  await screenshot('after-focus-mobile');
  await noOverflow();
  assert.equal(modelCalls, 0);
  assert.deepEqual(errors, []);
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  await writeFile(
    `${output}/font-and-contrast-proof.json`,
    JSON.stringify(
      {
        h1,
        ui,
        publication,
        metadata,
        tokens,
        computed,
        primaryContrast: contrast(computed.color, computed.background),
        inputBorder,
        inputBorderContrast: contrast(
          inputBorder.border,
          inputBorder.background,
        ),
        errorColors,
        errorContrast: contrast(errorColors.color, errorColors.background),
        bodyContrast: contrast(computed.body, computed.page),
        metadataContrast: contrast(metadata.color, 'rgb(255, 255, 255)'),
        mapNode,
        mobileHeading,
        outline,
        platformFonts: nodes,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS: actual rendered fonts, title weights/sizes, primary contrast, focus; Focus/Papers/error/map/evidence/editable Experiment, selection/tab state, desktop1366+narrow390, no page errors or model calls.',
  );
} finally {
  await browser.close();
}

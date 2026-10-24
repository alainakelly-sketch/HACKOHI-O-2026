// SYNTHETIC XML/HTML AND PAPER DATA FOR AUTOMATED TESTS ONLY.
import { describe, expect, it, vi } from 'vitest';
import type { Paper } from '../../shared/types';
import {
  canRetrieveFullText,
  createFullTextRetriever,
  parseArxivText,
  parsePMCText,
} from './fulltext';

function paper(identifiers: Paper['identifiers'] = { pmcid: 'PMC123' }): Paper {
  return {
    id: 'SYNTHETIC_TEST',
    title: 'SYNTHETIC TEST PAPER',
    year: 2026,
    doi: null,
    url: 'https://example.invalid/test-only',
    authors: [],
    abstract: 'Synthetic source abstract.',
    passages: [
      {
        id: 'SYNTHETIC_TEST:abstract:1',
        text: 'Synthetic source abstract.',
        kind: 'abstract',
        section: 'Abstract',
      },
    ],
    retrievedAt: '2026-01-01T00:00:00Z',
    coverage: 'Abstract only',
    identifiers,
  };
}
function pmc(
  body = '<sec><title>Methods</title><p>We used synthetic data &amp; a fixed comparison.</p></sec><sec><title>Results</title><p>No reliable effect was observed.</p></sec>',
  id = '123',
) {
  return `<article><front><article-meta><article-id pub-id-type="pmc">${id}</article-id><permissions><license><license-p>CC BY synthetic test license.</license-p></license></permissions></article-meta></front><body>${body}</body><back><ref-list><ref><p>Excluded reference text.</p></ref></ref-list></back></article>`;
}
function arxiv(
  body = '<section><h2>Methods</h2><div class="ltx_para"><p class="ltx_p">Synthetic method source text.</p></div></section>',
  id = '2401.12345v1',
) {
  return `<!doctype html><html><head><link rel="canonical" href="https://arxiv.org/html/${id}"/><meta name="citation_arxiv_id" content="${id}"/></head><body><article class="ltx_document">${body}</article></body></html>`;
}
function fetchMock() {
  return vi.fn<typeof fetch>();
}

describe('article-body extraction and evidence provenance', () => {
  it('preserves stored abstracts, actual paragraphs, section headings and license', () => {
    const input = paper();
    const result = parsePMCText(pmc(), input);
    expect(result.coverage).toBe('Full text retrieved');
    expect(result.passages[0]).toEqual(input.passages[0]);
    expect(result.passages[1]).toMatchObject({
      text: 'We used synthetic data & a fixed comparison.',
      kind: 'full-text',
      section: 'Methods',
    });
    expect(result.passages[2]).toMatchObject({
      text: 'No reliable effect was observed.',
      section: 'Results',
    });
    expect(result.fullText).toMatchObject({
      provider: 'Europe PMC',
      url: 'https://europepmc.org/articles/PMC123',
      license: 'CC BY synthetic test license.',
      truncated: false,
    });
    expect(input.coverage).toBe('Abstract only');
    expect(input.passages).toHaveLength(1);
  });
  it('gives identical paragraphs distinct, stable source IDs', () => {
    const xml = pmc(
      '<sec><title>Methods</title><p>Same text.</p><p>Same text.</p></sec>',
    );
    const a = parsePMCText(xml, paper()),
      b = parsePMCText(xml, paper());
    expect(a.passages.map((p) => p.id)).toEqual(b.passages.map((p) => p.id));
    expect(new Set(a.passages.map((p) => p.id)).size).toBe(a.passages.length);
    expect(a.passages[1].id).not.toBe(
      parsePMCText(xml.replace('Same text.', 'Changed text.'), paper())
        .passages[1].id,
    );
  });
  it('does not import figures, tables, references, scripts or supplements as prose', () => {
    const result = parsePMCText(
      pmc(
        '<sec><title>Methods</title><p>Keep this paragraph.</p><fig><p>Figure only.</p></fig><table-wrap><p>Table only.</p></table-wrap><supplementary-material><p>Supplement only.</p></supplementary-material><script>window.bad = true;</script></sec>',
      ),
      paper(),
    );
    expect(
      result.passages.filter((p) => p.kind === 'full-text').map((p) => p.text),
    ).toEqual(['Keep this paragraph.']);
    expect(result.fullText?.note).toContain('not included');
  });
  it('does not expand external XML entities or fetch referenced resources', () => {
    const xml = `<!DOCTYPE article [<!ENTITY external SYSTEM "https://example.invalid/secret">]>${pmc('<p>Literal &external; remains source data.</p>')}`;
    const result = parsePMCText(xml, paper());
    expect(result.passages[1].text).toContain('&external;');
  });
  it('rejects a wrong PMC ID and body-only ID spoofing', () => {
    expect(() => parsePMCText(pmc(undefined, '999'), paper())).toThrow(
      'did not match',
    );
    expect(() =>
      parsePMCText(
        '<article><body><article-id pub-id-type="pmc">123</article-id><p>Wrong identity location.</p></body></article>',
        paper(),
      ),
    ).toThrow('did not match');
  });
  it('rejects HTML/error bodies and empty article text without mutating the abstract', () => {
    const input = paper();
    expect(() =>
      parsePMCText('<html><body>Upstream error.</body></html>', input),
    ).toThrow('did not match');
    expect(() =>
      parsePMCText(pmc('<sec><title>Empty</title></sec>'), input),
    ).toThrow('No readable');
    expect(input.coverage).toBe('Abstract only');
  });
  it('labels truncated body text explicitly, including an oversized first paragraph', () => {
    const result = parsePMCText(pmc(`<p>${'a'.repeat(350001)}</p>`), paper());
    expect(result.coverage).toBe('Full text excerpt');
    expect(result.fullText?.truncated).toBe(true);
    expect(result.passages[1].text.length).toBe(350000);
    const several = parsePMCText(
      pmc(`<p>${'x'.repeat(349999)}</p><p>Tail.</p>`),
      paper(),
    );
    expect(several.fullText?.truncated).toBe(true);
    expect(several.passages.at(-1)?.text).toBe('T');
  });
  it('extracts arXiv sections without claiming the abstract or bibliography is body text', () => {
    const html = arxiv(
      '<div class="ltx_abstract"><p class="ltx_p">Do not duplicate this abstract.</p></div><section><h2>Results</h2><p class="ltx_p">Observed synthetic finding.</p><figure><p class="ltx_p">Figure caption.</p></figure><table><tr><td><p class="ltx_p">Table data.</p></td></tr></table></section><section class="ltx_bibliography"><p class="ltx_p">Reference.</p></section>',
    );
    const result = parseArxivText(html, paper({ arxiv: '2401.12345v1' }));
    expect(result.passages.filter((p) => p.kind === 'full-text')).toHaveLength(
      1,
    );
    expect(result.passages[1]).toMatchObject({
      section: 'Results',
      text: 'Observed synthetic finding.',
    });
    expect(result.fullText?.license).toBeNull();
    expect(result.fullText?.note).toContain(
      'check publication and review status',
    );
  });
  it('rejects a mismatched arXiv identity, explicit version or conflicting metadata', () => {
    const input = paper({ arxiv: '2401.12345v1' });
    expect(() =>
      parseArxivText(arxiv(undefined, '2401.99999v1'), input),
    ).toThrow('did not match');
    expect(() =>
      parseArxivText(arxiv(undefined, '2401.12345v2'), input),
    ).toThrow('version');
    expect(() =>
      parseArxivText(
        arxiv().replace('content="2401.12345v1"', 'content="2401.12345v2"'),
        input,
      ),
    ).toThrow('version');
  });
  it('accepts an unversioned canonical link without losing a pinned retrieval version', () => {
    const html = arxiv().replace(
      'href="https://arxiv.org/html/2401.12345v1"',
      'href="https://arxiv.org/html/2401.12345"',
    );
    expect(
      parseArxivText(
        html,
        paper({ arxiv: '2401.12345v1' }),
        'https://arxiv.org/html/2401.12345v1',
      ).fullText?.url,
    ).toBe('https://arxiv.org/html/2401.12345v1');
  });
  it('rejects conflicting source-declared and retrieved versions even for a versionless record', () => {
    expect(() =>
      parseArxivText(
        arxiv(undefined, '2401.12345v2'),
        paper({ arxiv: '2401.12345' }),
        'https://arxiv.org/html/2401.12345v1',
      ),
    ).toThrow('disagreed');
  });
  it('does not accept a truncated PMC XML article', () => {
    expect(() =>
      parsePMCText(pmc().replace('</article>', ''), paper()),
    ).toThrow('malformed or incomplete');
  });
  it('pins versionless arXiv retrieval to a version declared by the source', () => {
    const result = parseArxivText(
      arxiv(undefined, '2401.12345v3'),
      paper({ arxiv: '2401.12345' }),
    );
    expect(result.fullText?.url).toBe('https://arxiv.org/html/2401.12345v3');
  });
  it('reports missing arXiv HTML and never pretends a PDF was parsed', () => {
    expect(() =>
      parseArxivText('%PDF-1.5', paper({ arxiv: '2401.12345v1' })),
    ).toThrow('PDF extraction is not implemented');
    expect(() =>
      parseArxivText(
        '<article class="ltx_document"></article>',
        paper({ arxiv: '2401.12345v1' }),
      ),
    ).toThrow('No readable');
  });
});

describe('trusted full-text retrieval boundaries (mocked network only)', () => {
  it('requests only the fixed endpoint for a validated cached identifier', async () => {
    const fetcher = fetchMock().mockResolvedValue(new Response(pmc()));
    const input = paper();
    input.freeCopies = [
      {
        url: 'https://example.invalid/arbitrary-url',
        format: 'Repository',
        via: 'SYNTHETIC TEST',
      },
    ];
    const result = await createFullTextRetriever(fetcher)(input);
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://www.ebi.ac.uk/europepmc/webservices/rest/PMC123/fullTextXML',
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
    expect(result.coverage).toBe('Full text retrieved');
  });
  it('does not fetch an arbitrary free-copy link or malformed identifier', async () => {
    const fetcher = fetchMock();
    const retrieve = createFullTextRetriever(fetcher);
    for (const identifiers of [
      {},
      { pmcid: 'PMC123/../../secret' },
      { arxiv: 'https://arxiv.org/html/2401.12345' },
      { arxiv: '2401.12345?url=https://example.invalid' },
    ]) {
      const input = paper(identifiers);
      expect(canRetrieveFullText(input)).toBe(false);
      await expect(retrieve(input)).rejects.toThrow('not supported');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses retained retrieved text instead of repeating the network request', async () => {
    const input = parsePMCText(pmc(), paper());
    const fetcher = fetchMock();
    expect(await createFullTextRetriever(fetcher)(input)).toBe(input);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('follows a bounded same-article arXiv redirect and pins its resolved version', async () => {
    const fetcher = fetchMock()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: '/html/2401.12345v2' },
        }),
      )
      .mockResolvedValueOnce(new Response(arxiv(undefined, '2401.12345v2')));
    const result = await createFullTextRetriever(fetcher)(
      paper({ arxiv: '2401.12345' }),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe(
      'https://arxiv.org/html/2401.12345v2',
    );
    expect(result.fullText?.url).toBe('https://arxiv.org/html/2401.12345v2');
  });
  it.each([
    'https://example.invalid/html/2401.12345v1',
    'http://arxiv.org/html/2401.12345v1',
    'https://arxiv.org:444/html/2401.12345v1',
    'https://user:password@arxiv.org/html/2401.12345v1',
    '/html/2401.99999v1',
    '/pdf/2401.12345v1',
    '/html/2401.12345v2',
    '/html/2401.12345v1?url=https://example.invalid',
  ])('refuses an untrusted or mismatched redirect: %s', async (location) => {
    const fetcher = fetchMock().mockResolvedValue(
      new Response(null, { status: 302, headers: { location } }),
    );
    await expect(
      createFullTextRetriever(fetcher)(paper({ arxiv: '2401.12345v1' })),
    ).rejects.toThrow('outside the selected trusted article');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects a PMC redirect to a different article or service path', async () => {
    const fetcher = fetchMock().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: '/europepmc/webservices/rest/PMC999/fullTextXML' },
      }),
    );
    await expect(createFullTextRetriever(fetcher)(paper())).rejects.toThrow(
      'trusted article',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('stops redirect loops after three redirects', async () => {
    const fetcher = fetchMock().mockImplementation(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: '/html/2401.12345v1' },
        }),
    );
    await expect(
      createFullTextRetriever(fetcher)(paper({ arxiv: '2401.12345v1' })),
    ).rejects.toThrow('too many times');
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it.each([404, 429, 500])(
    'reports upstream HTTP %i without replacing the abstract',
    async (status) => {
      const input = paper(),
        fetcher = fetchMock().mockResolvedValue(
          new Response('Upstream error', { status }),
        );
      await expect(createFullTextRetriever(fetcher)(input)).rejects.toThrow(
        status === 429 ? 'rate limit' : 'returned an error',
      );
      expect(input.coverage).toBe('Abstract only');
      expect(input.passages).toHaveLength(1);
    },
  );
  it('reports connection failure without exposing the upstream error', async () => {
    const fetcher = fetchMock().mockRejectedValue(
      new Error('SYNTHETIC SECRET UPSTREAM DETAIL'),
    );
    await expect(createFullTextRetriever(fetcher)(paper())).rejects.toThrow(
      'Your abstract remains available',
    );
  });
  it('can try a known arXiv copy when PMC retrieval fails', async () => {
    const fetcher = fetchMock()
      .mockResolvedValueOnce(new Response('Not found', { status: 404 }))
      .mockResolvedValueOnce(new Response(arxiv()));
    const result = await createFullTextRetriever(fetcher)(
      paper({ pmcid: 'PMC123', arxiv: '2401.12345v1' }),
    );
    expect(result.fullText?.provider).toBe('arXiv');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects oversized source responses before parsing them', async () => {
    const fetcher = fetchMock().mockResolvedValue(
      new Response(pmc(), { headers: { 'content-length': '8000001' } }),
    );
    await expect(createFullTextRetriever(fetcher)(paper())).rejects.toThrow(
      'too large',
    );
  });
});

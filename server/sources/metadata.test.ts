// SYNTHETIC TEST DATA ONLY — regression cases for metadata missing in core responses.
import { describe, it, expect } from 'vitest';
import { normalizeEuropePMC } from './europepmc';
import { parsePMCText } from './fulltext';
const record = {
  id: '123',
  source: 'MED',
  pmcid: 'PMC123',
  title: 'SYNTHETIC TEST PAPER',
  isOpenAccess: 'Y',
};
describe('metadata preserved from retrieved sources', () => {
  it('uses a supplied first-publication date when pubYear is absent', () => {
    expect(
      normalizeEuropePMC({ ...record, firstPublicationDate: '2025-03-14' })
        ?.year,
    ).toBe(2025);
  });
  it('uses a journal year only when earlier year fields are unavailable', () => {
    expect(
      normalizeEuropePMC({
        ...record,
        journalInfo: { yearOfPublication: 2024 },
      })?.year,
    ).toBe(2024);
    expect(
      normalizeEuropePMC({
        ...record,
        pubYear: '2023',
        firstPublicationDate: '2025-03-14',
      })?.year,
    ).toBe(2023);
  });
  it('keeps unknown year unknown, never fills it from the current clock', () => {
    expect(normalizeEuropePMC(record)?.year).toBeNull();
  });
  it('imports a missing abstract/year from matching PMC front matter', () => {
    const original = normalizeEuropePMC(record)!;
    const xml =
      '<article><front><article-meta><article-id pub-id-type="pmc">123</article-id><pub-date><year>2025</year></pub-date><abstract><p>Synthetic retrieved abstract.</p></abstract></article-meta></front><body><sec><title>Methods</title><p>Synthetic body paragraph.</p></sec></body></article>';
    const loaded = parsePMCText(xml, original);
    expect(loaded.year).toBe(2025);
    expect(loaded.abstract).toBe('Synthetic retrieved abstract.');
    expect(loaded.passages.find((p) => p.kind === 'abstract')?.text).toBe(
      loaded.abstract,
    );
    expect(loaded.passages.some((p) => p.kind === 'full-text')).toBe(true);
  });
  it('keeps structured abstract paragraphs readable without joining headings to words', () => {
    const original = normalizeEuropePMC(record)!;
    const xml =
      '<article><front><article-meta><article-id pub-id-type="pmc">123</article-id><abstract><title>Abstract</title><sec><title>Introduction</title><p>Synthetic first paragraph.</p></sec><sec><title>Methods</title><p>Synthetic second paragraph.</p></sec></abstract></article-meta></front><body><p>Synthetic body.</p></body></article>';
    expect(parsePMCText(xml, original).abstract).toBe(
      'Synthetic first paragraph. Synthetic second paragraph.',
    );
    expect(
      normalizeEuropePMC({
        ...record,
        abstractText:
          '<h4>Methods</h4><p>Synthetic words.</p><p>More words.</p>',
      })?.abstract,
    ).toBe('Methods Synthetic words. More words.');
  });
});

// UI uses synthetic cost records only, never real provider calls.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CostPanel } from '../src/components/CostPanel';
import { estimateAnalysisCost, noRequestCost } from '../server/analysis-cost';
describe('transparent per-run cost display', () => {
  it('labels no recorded requests and free local operations', () => {
    const html = renderToStaticMarkup(
      createElement(CostPanel, { entries: [] }),
    );
    expect(html).toContain('No AI runs recorded');
    expect(html).toContain('$0 in OpenAI API charges');
    expect(html).toContain('not your bill');
  });
  it('shows small charges and flags unknown charges rather than implying a zero total', () => {
    const cost = estimateAnalysisCost('gpt-4.1-mini', {
      input_tokens: 1000,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 100,
    });
    const html = renderToStaticMarkup(
      createElement(CostPanel, {
        entries: [
          { id: 'test1', time: '2026-01-01', status: 'complete', cost },
          {
            id: 'test2',
            time: '2026-01-01',
            status: 'interrupted',
            cost: null,
          },
        ],
      }),
    );
    expect(html).toContain('$0.00056');
    expect(html).toContain('1 run(s) with unknown cost');
    expect(html).toContain('does not mean the request was free');
    expect(html).toContain('Interrupted');
  });
  it('distinguishes zero because no provider was called', () => {
    const html = renderToStaticMarkup(
      createElement(CostPanel, {
        entries: [
          {
            id: 'test',
            time: '2026-01-01',
            status: 'error',
            cost: noRequestCost(),
          },
        ],
      }),
    );
    expect(html).toContain('No model called');
    expect(html).toContain('No model provider request was made');
    expect(html).not.toContain('1 run(s) with unknown cost');
  });
});

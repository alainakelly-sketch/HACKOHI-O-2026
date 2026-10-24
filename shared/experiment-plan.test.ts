// Synthetic fixtures only; these are not real scientific claims or live AI calls.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Brief, Hypothesis, Paper } from './types';
import type { GapLead } from './gaps';
import {
  createHypothesisPlan,
  createManualPlan,
  exportPlan,
  planContextKey,
} from './experiment-plan';
import { ExperimentPanel } from '../src/components/ExperimentPanel';
const brief: Brief = {
  question: 'Synthetic question',
  field: 'Synthetic field',
  resources: {
    data: 'test data',
    equipment: '',
    skills: '',
    deadline: 'tomorrow',
  },
};
const paper: Paper = {
  id: 'test:1',
  title: 'SYNTHETIC TEST PAPER',
  year: 2026,
  doi: null,
  url: 'https://example.invalid',
  authors: [],
  abstract: null,
  passages: [
    {
      id: 'test:p1',
      text: 'Future work should study a new sample.',
      kind: 'full-text',
    },
  ],
  retrievedAt: 'test',
  coverage: 'Full text retrieved',
};
const lead: GapLead = {
  id: 'test-lead',
  paperId: paper.id,
  passageId: 'test:p1',
  quote: paper.passages[0].text,
  signalText: paper.passages[0].text,
  kind: 'full-text',
  section: 'Discussion',
  category: 'future-work',
  label: 'test',
  followUp: 'Check later work',
  searchQuery: 'test',
};
const hypothesis: Hypothesis = {
  id: 'h1',
  title: 'Synthetic hypothesis',
  hypothesis: 'test',
  evidenceSummary: 'test',
  gapRationale: 'test',
  proposedApproach: 'test',
  evidence: [{ paperId: paper.id, passageId: 'test:p1' }],
  assumptions: ['Test assumption'],
  incompatibilities: [],
  unknowns: ['Test unknown'],
  requirements: [],
  experiment: {
    question: 'Test question',
    data: 'Test data',
    method: 'Test method',
    baseline: 'Test baseline',
    measure: 'Test measure',
    against: 'Test against',
  },
};
describe('editable experiment drafts', () => {
  it('copies an existing hypothesis plan without a provider request', () => {
    const plan = createHypothesisPlan(hypothesis, brief, [paper]);
    expect(plan.fields.method).toBe('Test method');
    expect(plan.sources).toEqual(hypothesis.evidence);
    expect(plan.fields.constraints).toContain('Test unknown');
  });
  it('carries exact gap reference and focus while leaving unknown protocol blank', () => {
    const plan = createManualPlan(brief, [paper], lead);
    expect(plan.origin).toBe('user-created');
    expect(plan.fields.question).toBe(lead.signalText);
    expect(plan.fields.method).toBe('');
    expect(plan.sources).toEqual([{ paperId: paper.id, passageId: 'test:p1' }]);
    expect(plan.focus).toEqual({
      question: brief.question,
      field: brief.field,
    });
  });
  it('starts a manual hypothesis draft without AI or invented details', () => {
    const plan = createManualPlan(brief, [paper]);
    expect(plan.fields.question).toBe(brief.question);
    expect(plan.sources).toEqual([]);
    expect(plan.fields.baseline).toBe('');
  });
  it('preserves explicitly generated proposed variables while keeping older outputs compatible', () => {
    const generated = structuredClone(hypothesis);
    generated.experiment.independent =
      'SYNTHETIC proposed population comparison';
    generated.experiment.dependent = 'SYNTHETIC proposed accuracy measure';
    generated.experiment.supports = 'SYNTHETIC supporting result';
    const plan = createHypothesisPlan(generated, brief, [paper]);
    expect(plan.fields.independent).toBe(generated.experiment.independent);
    expect(plan.fields.dependent).toBe(generated.experiment.dependent);
    expect(plan.fields.supports).toBe(generated.experiment.supports);
  });
  it('leaves unknown variable definitions and result criteria blank in all draft origins', () => {
    for (const plan of [
      createManualPlan(brief, [paper], lead),
      createHypothesisPlan(hypothesis, brief, [paper]),
      createHypothesisPlan(hypothesis, brief, [paper], 'saved-example'),
    ]) {
      expect(plan.fields.independent).toBe('');
      expect(plan.fields.dependent).toBe('');
      expect(plan.fields.confounders).toBe('');
      expect(plan.fields.supports).toBe('');
    }
  });
  it('exports current variable, confounder and support edits alongside the existing plan', () => {
    const plan = createManualPlan(brief, [paper], lead);
    plan.fields.independent = 'Synthetic comparison groups';
    plan.fields.dependent = 'Synthetic outcome';
    plan.fields.confounders = 'Synthetic possible confounder';
    plan.fields.supports = 'Synthetic expected direction';
    const exported = JSON.parse(exportPlan(plan));
    expect(exported.fields).toMatchObject({
      independent: 'Synthetic comparison groups',
      dependent: 'Synthetic outcome',
      confounders: 'Synthetic possible confounder',
      supports: 'Synthetic expected direction',
      method: '',
    });
    expect(exported.sources).toEqual(plan.sources);
  });
  it('flags resources, paper selection, and source text changes without mutating edits', () => {
    const plan = createManualPlan(brief, [paper]);
    plan.fields.method = 'My edited method';
    expect(plan.contextKey).not.toBe(
      planContextKey(
        { ...brief, resources: { ...brief.resources, data: 'new data' } },
        [paper],
      ),
    );
    expect(plan.contextKey).not.toBe(planContextKey(brief, []));
    expect(plan.contextKey).not.toBe(
      planContextKey(brief, [
        {
          ...paper,
          passages: [...paper.passages, { id: 'new', text: 'new text' }],
        },
      ]),
    );
    expect(plan.fields.method).toBe('My edited method');
  });
  it('exports current edits and distinguishes saved examples from live AI', () => {
    const plan = createHypothesisPlan(
      hypothesis,
      brief,
      [paper],
      'saved-example',
    );
    plan.fields.method = 'Edited current plan';
    const exported = JSON.parse(exportPlan(plan));
    expect(exported.fields.method).toBe('Edited current plan');
    expect(exported.origin).toBe('saved-example');
    expect(exported.sources).toEqual(hypothesis.evidence);
  });
  it('renders editable manual fields, draft label, and review warning', () => {
    const html = renderToStaticMarkup(
      createElement(ExperimentPanel, {
        plan: createManualPlan(brief, [paper], lead),
        needsReview: true,
        onChange: () => {},
        onStartManual: () => {},
      }),
    );
    expect(html).toContain('User-created draft · not AI-generated');
    expect(html.match(/<textarea/g)).toHaveLength(11);
    expect(html).toContain('Your edits have been kept');
    expect(html).toContain('Export current plan');
    expect(html).toContain('Independent variables');
    expect(html).toContain('Dependent variables');
    expect(html).toContain('Possible confounding factors');
    expect(html).toContain('What result would support the hypothesis');
  });
});

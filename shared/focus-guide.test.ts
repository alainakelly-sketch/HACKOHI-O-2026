import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildFocusQuestion,
  emptyFocusGuide,
  focusExamples,
} from './focus-guide';
import { BriefForm } from '../src/components/BriefForm';

describe('guided user-composed research questions', () => {
  it('requires the user to supply the topic and outcome', () => {
    expect(buildFocusQuestion(emptyFocusGuide)).toBeNull();
    expect(
      buildFocusQuestion({ ...emptyFocusGuide, topic: 'sleep' }),
    ).toBeNull();
  });
  it('does not invent missing population or data', () => {
    expect(
      buildFocusQuestion({
        ...emptyFocusGuide,
        topic: 'sleep duration',
        outcome: 'memory recall',
      }),
    ).toBe('How does sleep duration affect memory recall?');
  });
  it('keeps user-supplied conditions and datasets', () => {
    expect(
      buildFocusQuestion({
        ...emptyFocusGuide,
        topic: 'an intervention',
        outcome: 'recall',
        context: 'adults',
        dataset: 'my measurements',
      }),
    ).toBe(
      'How does an intervention affect recall in adults using my measurements?',
    );
  });
  it('requires a second approach for comparison and trims punctuation', () => {
    expect(
      buildFocusQuestion({
        ...emptyFocusGuide,
        template: 'comparison',
        topic: 'method A',
        outcome: 'accuracy',
      }),
    ).toBeNull();
    expect(
      buildFocusQuestion({
        ...emptyFocusGuide,
        template: 'comparison',
        topic: '  method A. ',
        outcome: ' accuracy? ',
        comparison: 'method B!',
      }),
    ).toBe('How does method A compare with method B for accuracy?');
  });
  it('frames limitations as a question, never an established gap', () => {
    expect(
      buildFocusQuestion({
        ...emptyFocusGuide,
        template: 'limitation',
        topic: 'a classifier',
        outcome: 'detection',
      }),
    ).toBe('Under what conditions does a classifier fall short for detection?');
  });
  it('produces editable example questions without novelty claims', () => {
    for (const example of focusExamples) {
      const question = buildFocusQuestion(example.guide);
      expect(question).toMatch(/\?$/);
      expect(question).not.toMatch(
        /unexplored|novel|never studied|confirmed gap/i,
      );
    }
  });
  it('keeps focus separate from optional resources without applying the guide', () => {
    let updates = 0;
    const html = renderToStaticMarkup(
      createElement(BriefForm, {
        brief: {
          question: 'Keep my existing question',
          field: 'Ecology',
          resources: {
            data: 'My data',
            equipment: 'Laptop',
            skills: 'Python',
            deadline: 'One week',
          },
        },
        onCore: () => updates++,
        onFindPapers: () => updates++,
        searching: false,
      }),
    );
    expect(updates).toBe(0);
    expect(html).toContain('Keep my existing question');
    expect(html).not.toContain('My data');
    expect(html).not.toContain('Available equipment');
    expect(html).toContain('Help me shape a question');
    expect(html).toContain('user-composed template');
    expect(html).toContain('Use this question');
  });
});

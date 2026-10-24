import { describe, expect, it } from 'vitest';
import { createInitialSnapshot, replayEvents, type SimulationEvent } from '../simulation';
import {
  createInitialSession,
  getActiveEvents,
  getOriginalCursor,
  getReplayLength,
  sessionReducer,
  type SessionState,
} from './session';

const loadDemo = () => sessionReducer(createInitialSession(), { type: 'load-demo' });
const applyGap = (state: SessionState, gap: number) => sessionReducer(
  sessionReducer(state, { type: 'select-gap', gap }),
  { type: 'apply-hypothetical' },
);
const seek = (state: SessionState, cursor: number) => sessionReducer(state, { type: 'seek', cursor });
const snapshotAtCursor = (state: SessionState) => replayEvents(getActiveEvents(state))[state.cursor].snapshot;

describe('AfterTouch session workflow', () => {
  it('starts at the initial state with no recorded events or hypothetical', () => {
    const initial = createInitialSession();
    expect(initial).toEqual({ events: [], cursor: 0, selectedGap: 0, appliedGap: null });
    expect(snapshotAtCursor(initial)).toEqual(createInitialSnapshot());
  });

  it('loads the requested demo at its final step and suggests gap 4', () => {
    const demo = loadDemo();
    expect(demo.events.map(event => event.type === 'contact' && event.objectId))
      .toEqual(['phone', 'pen', 'tray', 'pen', 'patient']);
    expect(demo).toMatchObject({ cursor: 5, selectedGap: 4, appliedGap: null });
    expect(snapshotAtCursor(demo).marks.patient).toBe(true);
  });

  it('holds the original checkpoint steady during inserted hygiene, then re-marks the hand at the second pen', () => {
    const whatIf = applyGap(loadDemo(), 3);
    const beforeHygiene = seek(whatIf, 3);
    const afterHygiene = seek(whatIf, 4);
    const secondPen = seek(whatIf, 5);

    expect(getReplayLength(whatIf)).toBe(6);
    expect(getOriginalCursor(beforeHygiene)).toBe(3);
    expect(getOriginalCursor(afterHygiene)).toBe(3);
    expect(snapshotAtCursor(beforeHygiene).marks.hand).toBe(true);
    expect(snapshotAtCursor(afterHygiene).marks.hand).toBe(false);
    expect(snapshotAtCursor(afterHygiene).marks.pen).toBe(true);
    expect(getOriginalCursor(secondPen)).toBe(4);
    expect(snapshotAtCursor(secondPen).marks.hand).toBe(true);
    expect(snapshotAtCursor(whatIf).marks.patient).toBe(true);
  });

  it('changes the patient outcome at gap 4 while preserving the original log', () => {
    const original = loadDemo();
    const originalJSON = JSON.stringify(original.events);
    const whatIf = applyGap(original, 4);

    expect(whatIf.events).toBe(original.events);
    expect(JSON.stringify(original.events)).toBe(originalJSON);
    expect(getOriginalCursor(whatIf)).toBe(5);
    expect(snapshotAtCursor(original).marks.patient).toBe(true);
    expect(snapshotAtCursor(whatIf).marks.patient).toBe(false);
  });

  it('keeps a newly selected gap staged until apply is requested', () => {
    const applied = applyGap(loadDemo(), 3);
    const staged = sessionReducer(applied, { type: 'select-gap', gap: 4 });
    expect(staged).toMatchObject({ selectedGap: 4, appliedGap: 3 });
    expect(snapshotAtCursor(staged).marks.patient).toBe(true);
    const updated = sessionReducer(staged, { type: 'apply-hypothetical' });
    expect(updated).toMatchObject({ selectedGap: 4, appliedGap: 4 });
    expect(snapshotAtCursor(updated).marks.patient).toBe(false);
  });

  it('appends to the full original log while rewound and preserves the applied gap', () => {
    const original = seek(applyGap(loadDemo(), 4), 1);
    const newEvent: SimulationEvent = {
      id: 'manual-next', type: 'contact', objectId: 'phone', elapsedMs: 6000, source: 'manual',
    };
    const next = sessionReducer(original, { type: 'append', event: newEvent });

    expect(next.events.slice(0, 5)).toEqual(original.events);
    expect(next.events[5]).toEqual(newEvent);
    expect(original.events).toHaveLength(5);
    expect(next).toMatchObject({ cursor: 7, selectedGap: 4, appliedGap: 4 });
    expect(getOriginalCursor(next)).toBe(6);
    expect(snapshotAtCursor(next).marks.hand).toBe(true);
  });

  it('maps a removed hypothetical back to the matching original checkpoint', () => {
    const afterHygiene = seek(applyGap(loadDemo(), 3), 4);
    const removed = sessionReducer(afterHygiene, { type: 'remove-hypothetical' });
    expect(removed.events).toBe(afterHygiene.events);
    expect(removed).toMatchObject({ cursor: 3, selectedGap: 3, appliedGap: null });
    expect(snapshotAtCursor(removed).marks.hand).toBe(true);
    expect(getReplayLength(removed)).toBe(5);
  });

  it('supports insertion before the first event, including an empty log', () => {
    const empty = applyGap(createInitialSession(), 0);
    expect(getReplayLength(empty)).toBe(1);
    expect(getOriginalCursor(empty)).toBe(0);
    expect(snapshotAtCursor(empty).marks).toEqual(createInitialSnapshot().marks);

    const demo = seek(applyGap(loadDemo(), 0), 1);
    expect(getOriginalCursor(demo)).toBe(0);
    expect(getActiveEvents(demo)[0].type).toBe('hygiene');
    expect(snapshotAtCursor(demo).marks.phone).toBe(true);
  });

  it('retains prior patient exposure when inserting after the last event', () => {
    const state = applyGap(loadDemo(), 5);
    expect(getOriginalCursor(seek(state, 5))).toBe(5);
    expect(getOriginalCursor(state)).toBe(5);
    expect(snapshotAtCursor(state)).toMatchObject({
      marks: { hand: false, patient: true },
      patientExposureEventIds: ['demo-5'],
    });
  });

  it('reset restores the phone-only initial state and clears the entire replay workspace', () => {
    const previous = seek(applyGap(loadDemo(), 3), 4);
    const reset = sessionReducer(previous, { type: 'reset' });
    expect(reset).toEqual(createInitialSession());
    expect(snapshotAtCursor(reset)).toEqual(createInitialSnapshot());
    expect(previous.events).toHaveLength(5);
  });

  it('clamps finite seek requests and rejects invalid gaps or nonfinite positions', () => {
    const state = applyGap(loadDemo(), 4);
    expect(seek(state, -10).cursor).toBe(0);
    expect(seek(state, 100).cursor).toBe(6);
    expect(seek(state, 2.9).cursor).toBe(2);
    for (const cursor of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => seek(state, cursor)).toThrow('finite');
    }
    for (const gap of [-1, 6, 1.5, Number.NaN]) {
      expect(() => sessionReducer(state, { type: 'select-gap', gap })).toThrow(RangeError);
    }
  });

  it('rejects duplicate or invalid appended events without modifying the original state', () => {
    const state = loadDemo();
    const before = JSON.stringify(state);
    expect(() => sessionReducer(state, { type: 'append', event: state.events[0] }))
      .toThrow('Duplicate event ID');
    expect(() => sessionReducer(state, {
      type: 'append',
      event: { id: 'invalid', type: 'contact', objectId: 'phone', elapsedMs: -1, source: 'camera' },
    })).toThrow('nonnegative');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('handles deeply frozen original inputs without writes and is deterministic', () => {
    const demo = loadDemo();
    const frozen = Object.freeze({
      ...demo,
      events: Object.freeze(demo.events.map(event => Object.freeze({ ...event }))),
    });
    const one = applyGap(frozen, 4);
    const two = applyGap(frozen, 4);
    expect(one).toEqual(two);
    expect(getActiveEvents(one)).toEqual(getActiveEvents(two));
    expect(snapshotAtCursor(one)).toEqual(snapshotAtCursor(two));
    expect(frozen.appliedGap).toBeNull();
    expect(frozen.events).toHaveLength(5);
  });
});

import {
  createDemoEvents,
  insertHypotheticalHygiene,
  validateEvents,
  type SimulationEvent,
} from '../simulation';

/** The cursor counts processed events in the active replay, including an insertion. */
export interface SessionState {
  readonly events: readonly SimulationEvent[];
  readonly cursor: number;
  readonly selectedGap: number;
  readonly appliedGap: number | null;
}

export type SessionAction =
  | { readonly type: 'append'; readonly event: SimulationEvent }
  | { readonly type: 'reset' }
  | { readonly type: 'load-demo' }
  | { readonly type: 'seek'; readonly cursor: number }
  | { readonly type: 'select-gap'; readonly gap: number }
  | { readonly type: 'apply-hypothetical' }
  | { readonly type: 'remove-hypothetical' };

export function createInitialSession(): SessionState {
  return { events: [], cursor: 0, selectedGap: 0, appliedGap: null };
}

export function getActiveEvents(state: SessionState): readonly SimulationEvent[] {
  return state.appliedGap === null
    ? state.events
    : insertHypotheticalHygiene(state.events, state.appliedGap);
}

export function getReplayLength(state: SessionState): number {
  return state.events.length + (state.appliedGap === null ? 0 : 1);
}

/** The inserted event advances the hypothetical without advancing the original. */
export function getOriginalCursor(state: SessionState): number {
  return state.cursor - (
    state.appliedGap !== null && state.cursor > state.appliedGap ? 1 : 0
  );
}

function validateGap(gap: number, eventCount: number): void {
  if (!Number.isInteger(gap) || gap < 0 || gap > eventCount) {
    throw new RangeError(`Gap index must be an integer between 0 and ${eventCount}.`);
  }
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'append': {
      // Keep the original log append-only even while the user is viewing an old step.
      const events = [...state.events, { ...action.event }];
      validateEvents(events);
      return {
        ...state,
        events,
        cursor: events.length + (state.appliedGap === null ? 0 : 1),
      };
    }
    case 'reset':
      return createInitialSession();
    case 'load-demo': {
      const events = createDemoEvents();
      return { events, cursor: events.length, selectedGap: 4, appliedGap: null };
    }
    case 'seek': {
      if (!Number.isFinite(action.cursor)) {
        throw new RangeError('Replay cursor must be finite.');
      }
      return {
        ...state,
        cursor: Math.min(getReplayLength(state), Math.max(0, Math.trunc(action.cursor))),
      };
    }
    case 'select-gap':
      validateGap(action.gap, state.events.length);
      return { ...state, selectedGap: action.gap };
    case 'apply-hypothetical':
      validateGap(state.selectedGap, state.events.length);
      return { ...state, appliedGap: state.selectedGap, cursor: state.events.length + 1 };
    case 'remove-hypothetical':
      return { ...state, cursor: getOriginalCursor(state), appliedGap: null };
  }
}

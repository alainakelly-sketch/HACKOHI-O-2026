import { useMemo, useReducer, useRef } from 'react';
import { Info, RotateCcw, Play, ArrowRight } from 'lucide-react';
import { EntityStates } from './components/EntityStates';
import { Recorder } from './components/Recorder';
import { ReplayControls } from './components/ReplayControls';
import { Timeline } from './components/Timeline';
import { CounterfactualPanel } from './components/CounterfactualPanel';
import { replayEvents, type ObjectId, type SimulationEvent } from './simulation';
import { createInitialSession, sessionReducer, getActiveEvents, getOriginalCursor, getReplayLength } from './state/session';

export default function App() {
  const [session, dispatch] = useReducer(sessionReducer, undefined, createInitialSession);
  const sessionStart = useRef(performance.now());
  // Session-local IDs stay unique across reset and work on local HTTP previews.
  // Recording has no dependency on secure-context-only crypto.randomUUID().
  const manualEventNumber = useRef(0);
  const originalFrames = useMemo(() => replayEvents(session.events), [session.events]);
  const activeEvents = useMemo(() => getActiveEvents(session), [session.events, session.appliedGap]);
  const hypotheticalFrames = useMemo(() => session.appliedGap !== null ? replayEvents(activeEvents) : null, [activeEvents, session.appliedGap]);
  const originalCursor = getOriginalCursor(session);
  const originalFrame = originalFrames[originalCursor];
  const hypotheticalFrame = hypotheticalFrames?.[session.cursor] ?? null;
  const replayLength = getReplayLength(session);
  const insertedEvent = session.appliedGap !== null ? activeEvents[session.appliedGap] : null;

  function recordEvent(type: 'contact' | 'hygiene', objectId?: ObjectId) {
    const elapsedMs = Math.max(Math.round(performance.now() - sessionStart.current), session.events.at(-1)?.elapsedMs ?? 0);
    const common = { id: `manual-${++manualEventNumber.current}`, elapsedMs, source: 'manual' as const };
    const event: SimulationEvent = type === 'contact' && objectId
      ? { ...common, type: 'contact', objectId }
      : { ...common, type: 'hygiene' };
    dispatch({ type: 'append', event });
  }

  function loadDemo() {
    sessionStart.current = performance.now() - 5000;
    dispatch({ type: 'load-demo' });
  }

  function reset() {
    sessionStart.current = performance.now();
    dispatch({ type: 'reset' });
  }

  function jumpToEvent(eventId: string) {
    const index = activeEvents.findIndex((event) => event.id === eventId);
    if (index !== -1) dispatch({ type: 'seek', cursor: index + 1 });
  }

  return (
    <>
      <div className="training-notice"><div className="page-width"><Info size={18} aria-hidden="true" /><span>Training simulation. No actual contamination is measured.</span></div></div>
      <header className="app-header"><div className="page-width header-content">
        <a className="wordmark" href="#main">After<span>Touch</span></a>
        <span className="input-mode">Manual input</span>
        <div className="header-actions"><button className="button" onClick={loadDemo}><Play size={15} aria-hidden="true" />Load demo</button><button className="button" onClick={reset}><RotateCcw size={15} aria-hidden="true" />Reset</button></div>
      </div></header>
      <main id="main" className="page-width main-content">
        <div className="intro"><h1>See what one touch changes.</h1><p>Record a sequence. Replay it. Try one different moment.</p></div>
        <div className="workbench">
          <section className="panel original-panel" aria-labelledby="original-heading">
            <div className="panel-heading"><h2 id="original-heading">Original sequence</h2><p>{session.events.length === 0 ? 'Start with a phone carrying the initial mark.' : `${session.events.length} original ${session.events.length === 1 ? 'event' : 'events'} recorded`}</p></div>
            <EntityStates snapshot={originalFrame.snapshot} />
            <Recorder onTouch={(objectId) => recordEvent('contact', objectId)} onHygiene={() => recordEvent('hygiene')} isRewound={session.cursor < replayLength} />
            <ReplayControls cursor={session.cursor} length={replayLength} originalCursor={originalCursor} originalLength={session.events.length} hasHypothetical={session.appliedGap !== null} onSeek={(cursor) => dispatch({ type: 'seek', cursor })} />
            <div className="current-explanation" aria-live="polite"><ArrowRight size={16} aria-hidden="true" /><p>{originalFrame.explanation}</p></div>
            <Timeline events={activeEvents} originalEvents={session.events} cursor={session.cursor} insertedId={insertedEvent?.id ?? null} onSeek={(cursor) => dispatch({ type: 'seek', cursor })} />
          </section>
          <CounterfactualPanel events={session.events} selectedGap={session.selectedGap} appliedGap={session.appliedGap} onSelectGap={(gap) => dispatch({ type: 'select-gap', gap })} onApply={() => dispatch({ type: 'apply-hypothetical' })} onRemove={() => dispatch({ type: 'remove-hypothetical' })} original={originalFrame.snapshot} hypothetical={hypotheticalFrame?.snapshot ?? null} hypotheticalFrames={hypotheticalFrames} insertedEvent={insertedEvent} cursor={session.cursor} replayLength={replayLength} originalCursor={originalCursor} onEventJump={jumpToEvent} />
        </div>
        <footer className="model-footer"><Info size={16} aria-hidden="true" /><p>A simplified teaching model: a touch shares a mark in either direction; simulated hygiene clears only the hand. <strong>Unmarked does not prove cleanliness.</strong> These marks are not infection probabilities.</p></footer>
      </main>
    </>
  );
}

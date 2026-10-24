import { Check, CircleDot, Droplets, X } from 'lucide-react';
import { ENTITY_IDS, ENTITY_LABELS, type ReplayFrame, type SimulationEvent, type SimulationSnapshot } from '../simulation';
import { StatusBadge } from './EntityStates';
import { eventLabel } from './Timeline';

function gapDescription(events: readonly SimulationEvent[], gap: number): string {
  if (gap === 0) return 'Before the first event';
  return `After ${gap} · ${eventLabel(events[gap - 1])}`;
}

function OutcomeExplanation({ frames, cursor, insertedEvent, onEventJump }: {
  frames: readonly ReplayFrame[];
  cursor: number;
  insertedEvent: SimulationEvent;
  onEventJump: (eventId: string) => void;
}) {
  const current = frames[cursor];
  const reached = frames.slice(1, cursor + 1);
  const patientFrame = reached.filter((frame) => frame.event?.type === 'contact' && frame.event.objectId === 'patient').at(-1);
  const hygieneFrame = reached.find((frame) => frame.event?.id === insertedEvent.id);
  const marked = current.snapshot.marks.patient;
  const title = marked ? 'Patient prop is marked' : patientFrame ? 'Patient prop stays unmarked' : 'Patient contact not reached';
  const evidenceFrame = patientFrame ?? current;
  const referencedIds = [...new Set([
    ...(hygieneFrame?.referencedEventIds ?? []),
    ...evidenceFrame.referencedEventIds,
    ...current.snapshot.patientExposureEventIds,
  ])];
  return (
    <div className={`outcome-explanation ${marked ? 'outcome-marked' : patientFrame ? 'outcome-unmarked' : 'outcome-pending'}`} aria-live="polite" data-testid="hypothetical-explanation">
      <div className="outcome-heading"><span className="outcome-icon" aria-hidden="true">{marked ? <CircleDot size={20} /> : patientFrame ? <Check size={20} /> : <Droplets size={20} />}</span><h3>{title}</h3></div>
      {hygieneFrame ? <p>{hygieneFrame.explanation}</p> : <p>The hypothetical hygiene event has not been reached at this replay step.</p>}
      {evidenceFrame !== hygieneFrame ? <p>{evidenceFrame.explanation}</p> : null}
      {referencedIds.length > 0 ? <div className="evidence"><span>Event references</span><div className="evidence-ids">{referencedIds.map((id) => <button key={id} onClick={() => onEventJump(id)} title={`Replay to ${id}`}>{id}</button>)}</div></div> : null}
    </div>
  );
}

export function CounterfactualPanel({ events, selectedGap, appliedGap, onSelectGap, onApply, onRemove, original, hypothetical, hypotheticalFrames, insertedEvent, cursor, replayLength, originalCursor, onEventJump }: {
  events: readonly SimulationEvent[];
  selectedGap: number;
  appliedGap: number | null;
  onSelectGap: (gap: number) => void;
  onApply: () => void;
  onRemove: () => void;
  original: SimulationSnapshot;
  hypothetical: SimulationSnapshot | null;
  hypotheticalFrames: readonly ReplayFrame[] | null;
  insertedEvent: SimulationEvent | null;
  cursor: number;
  replayLength: number;
  originalCursor: number;
  onEventJump: (eventId: string) => void;
}) {
  const pending = appliedGap !== null && selectedGap !== appliedGap;
  const following = events[selectedGap];
  return (
    <aside className="panel comparison-panel" aria-labelledby="counterfactual-heading">
      <div className="panel-heading"><h2 id="counterfactual-heading">What if you cleaned your hands?</h2><p>Insert one simulated hygiene event.</p></div>
      <div className="insertion-controls">
        <label htmlFor="gap-select">Choose a gap in the original sequence</label>
        <select id="gap-select" value={selectedGap} onChange={(event) => onSelectGap(Number(event.target.value))}>
          {Array.from({ length: events.length + 1 }, (_, gap) => <option key={gap} value={gap}>{gapDescription(events, gap)}</option>)}
        </select>
        <p className="gap-detail">{following ? <>Before {selectedGap + 1} · {eventLabel(following)} <code>{following.id}</code></> : events.length ? 'After the final event' : 'No original events recorded yet'}</p>
        <button className="button button-primary apply-button" onClick={onApply}><Droplets size={17} aria-hidden="true" />{appliedGap === null ? 'Apply hypothetical' : pending ? 'Update hypothetical' : 'Replay hypothetical'}</button>
        {appliedGap !== null ? <div className="applied-summary"><span>Applied: {gapDescription(events, appliedGap).toLowerCase()}.{pending ? ' Your new selection is not applied yet.' : ''}</span><button className="text-button" onClick={onRemove}><X size={14} aria-hidden="true" />Remove</button></div> : null}
      </div>
      <section className="comparison-section" aria-labelledby="comparison-heading">
        <div className="section-heading"><h3 id="comparison-heading">{cursor === replayLength && replayLength > 0 ? 'At the end of the sequence' : cursor === 0 ? 'At the initial state' : `At replay step ${cursor}`}</h3></div>
        {hypothetical ? <p className="comparison-caption">Same {originalCursor} original {originalCursor === 1 ? 'event' : 'events'}, with one possible intervention.</p> : <p className="comparison-caption">Apply a hypothetical to compare the same sequence.</p>}
        <div className="comparison-table-wrap"><table className="comparison-table">
          <caption className="sr-only">Original versus hypothetical marks at the current aligned replay position</caption>
          <thead><tr><th scope="col">Entity</th><th scope="col">Original</th><th scope="col">Hypothetical</th></tr></thead>
          <tbody>{ENTITY_IDS.map((entity) => <tr key={entity} className={hypothetical && original.marks[entity] !== hypothetical.marks[entity] ? 'changed-state' : ''}>
            <th scope="row">{ENTITY_LABELS[entity]}</th>
            <td data-testid={`comparison-original-${entity}`}><StatusBadge marked={original.marks[entity]} /></td>
            <td data-testid={`comparison-hypothetical-${entity}`}>{hypothetical ? <StatusBadge marked={hypothetical.marks[entity]} /> : <span className="not-compared" aria-label="No hypothetical applied">—</span>}</td>
          </tr>)}</tbody>
        </table></div>
      </section>
      {hypotheticalFrames && insertedEvent ? <OutcomeExplanation frames={hypotheticalFrames} cursor={cursor} insertedEvent={insertedEvent} onEventJump={onEventJump} /> : <div className="what-if-prompt"><Droplets size={23} strokeWidth={1.5} aria-hidden="true" /><p><strong>The moment matters.</strong> Try hygiene before and after the second pen contact in the demo. Watch what changes.</p></div>}
    </aside>
  );
}

import { Droplets, Hand, ArrowDown } from 'lucide-react';
import { type SimulationEvent } from '../simulation';

export function eventLabel(event: SimulationEvent): string {
  return event.type === 'hygiene' ? 'Simulated hand hygiene' : `Touch ${event.objectId === 'patient' ? 'patient prop' : event.objectId}`;
}

function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function Timeline({ events, originalEvents, cursor, insertedId, onSeek }: {
  events: readonly SimulationEvent[];
  originalEvents: readonly SimulationEvent[];
  cursor: number;
  insertedId: string | null;
  onSeek: (step: number) => void;
}) {
  const originalPositions = new Map(originalEvents.map((event, index) => [event.id, index + 1]));
  return (
    <section className="timeline-section" aria-labelledby="history-heading">
      <div className="section-heading">
        <h3 id="history-heading">Event history</h3>
        <span className="muted small">{originalEvents.length} original {originalEvents.length === 1 ? 'event' : 'events'}</span>
      </div>
      <p className="timeline-caption">Initial mark: phone. {insertedId ? 'The teal row belongs only to the hypothetical.' : 'Events play in recorded order.'}</p>
      {events.length === 0 ? (
        <div className="empty-history">
          <Hand size={25} strokeWidth={1.5} aria-hidden="true" />
          <div><strong>Your first touch starts the story.</strong><p>Touch an object above, or load the five-contact demo.</p></div>
        </div>
      ) : (
        <ol className="event-list" aria-label="Ordered replay events">
          {events.map((event, index) => {
            const hypothetical = event.id === insertedId;
            const current = cursor === index + 1;
            return (
              <li key={event.id} className={`${hypothetical ? 'hypothetical-event' : ''} ${index + 1 > cursor ? 'future-event' : ''}`}>
                <button className={`event-row ${current ? 'current-event' : ''}`} onClick={() => onSeek(index + 1)} aria-current={current ? 'step' : undefined} aria-label={`Replay to ${eventLabel(event)}, ${event.id}`}>
                  <span className="event-number" aria-hidden="true">{hypothetical ? <Droplets size={15} /> : originalPositions.get(event.id)}</span>
                  <span className="event-content"><span className="event-title">{eventLabel(event)}</span><span className="event-id">{event.id}</span></span>
                  <span className="event-meta"><span className="event-source">{event.source}</span><time>{formatElapsed(event.elapsedMs)}</time></span>
                  {hypothetical ? <span className="hypothetical-tag">What if</span> : null}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {cursor === 0 && events.length > 0 ? <p className="initial-caption"><ArrowDown size={14} aria-hidden="true" /> At the initial state. Select Next to begin.</p> : null}
    </section>
  );
}

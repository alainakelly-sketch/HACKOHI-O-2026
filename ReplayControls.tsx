import { ChevronLeft, ChevronRight, SkipBack, SkipForward } from 'lucide-react';

export function ReplayControls({ cursor, length, originalCursor, originalLength, hasHypothetical, onSeek }: {
  cursor: number;
  length: number;
  originalCursor: number;
  originalLength: number;
  hasHypothetical: boolean;
  onSeek: (step: number) => void;
}) {
  return (
    <section className="replay-section" aria-labelledby="replay-heading">
      <div className="section-heading">
        <h3 id="replay-heading">{hasHypothetical ? 'Replay both sequences' : 'Replay sequence'}</h3>
        <span className="step-count" aria-live="polite">Step {cursor} of {length}</span>
      </div>
      <div className="replay-controls">
        <button className="icon-button" aria-label="Go to initial state" title="Go to initial state" disabled={cursor === 0} onClick={() => onSeek(0)}>
          <SkipBack size={17} />
        </button>
        <button className="button button-small" aria-label="Previous event" disabled={cursor === 0} onClick={() => onSeek(cursor - 1)}>
          <ChevronLeft size={18} aria-hidden="true" /><span>Previous</span>
        </button>
        <input
          aria-label="Replay position"
          aria-valuetext={`${cursor} of ${length} replay events; ${originalCursor} of ${originalLength} original events`}
          type="range" min={0} max={Math.max(1, length)} value={cursor}
          disabled={length === 0} onChange={(event) => onSeek(Number(event.target.value))}
          style={{ '--range-progress': `${length ? (cursor / length) * 100 : 0}%` } as React.CSSProperties}
        />
        <button className="button button-small" aria-label="Next event" disabled={cursor === length} onClick={() => onSeek(cursor + 1)}>
          <span>Next</span><ChevronRight size={18} aria-hidden="true" />
        </button>
        <button className="icon-button" aria-label="Go to latest event" title="Go to latest event" disabled={cursor === length} onClick={() => onSeek(length)}>
          <SkipForward size={17} />
        </button>
      </div>
      {hasHypothetical ? <p className="replay-alignment">Aligned after {originalCursor} of {originalLength} original events. The inserted step changes only the hypothetical sequence.</p> : null}
    </section>
  );
}

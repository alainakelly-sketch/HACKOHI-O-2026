import { Droplets } from 'lucide-react';
import { OBJECT_IDS, type ObjectId } from '../simulation';

export function Recorder({ onTouch, onHygiene, isRewound }: {
  onTouch: (objectId: ObjectId) => void;
  onHygiene: () => void;
  isRewound: boolean;
}) {
  return (
    <section className="recorder" aria-label="Record manual events">
      <div className="touch-actions">
        {OBJECT_IDS.map((objectId) => (
          <button className="button button-outline" key={objectId} onClick={() => onTouch(objectId)}>
            Touch {objectId === 'patient' ? 'patient prop' : objectId}
          </button>
        ))}
        <button className="button button-primary hygiene-button" onClick={onHygiene}>
          <Droplets size={17} aria-hidden="true" />
          Simulate hand hygiene
        </button>
      </div>
      {isRewound ? (
        <p className="recorder-hint" role="status">New events append to the end of the original log, then replay returns to the latest step.</p>
      ) : null}
    </section>
  );
}

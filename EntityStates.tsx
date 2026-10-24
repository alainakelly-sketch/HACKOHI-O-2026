import { Hand, Smartphone, PenLine, RectangleEllipsis, UserRound } from 'lucide-react';
import { ENTITY_IDS, ENTITY_LABELS, type EntityId, type SimulationSnapshot } from '../simulation';

const icons = { hand: Hand, phone: Smartphone, pen: PenLine, tray: RectangleEllipsis, patient: UserRound };

export function EntityIcon({ entity, size = 44 }: { entity: EntityId; size?: number }) {
  const Icon = icons[entity];
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}

export function StatusBadge({ marked }: { marked: boolean }) {
  return (
    <span className={`status-badge ${marked ? 'is-marked' : 'is-unmarked'}`}>
      <span className="status-dot" aria-hidden="true" />
      {marked ? 'Marked' : 'Unmarked'}
    </span>
  );
}

export function EntityStates({ snapshot }: { snapshot: SimulationSnapshot }) {
  return (
    <ul className="entity-grid" aria-label="Original entity states">
      {ENTITY_IDS.map((entity) => (
        <li key={entity} className="entity" data-testid={`original-${entity}`}>
          <div className="entity-illustration"><EntityIcon entity={entity} /></div>
          <span className="entity-name">{ENTITY_LABELS[entity]}</span>
          <StatusBadge marked={snapshot.marks[entity]} />
        </li>
      ))}
    </ul>
  );
}

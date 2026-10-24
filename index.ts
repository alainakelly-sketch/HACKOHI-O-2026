/**
 * A deterministic, educational model of mark transfer by touch.
 * Marks are illustrative state, not probabilities or measured infection risk.
 * Array order is authoritative; timestamps never reorder the event log.
 */
export const OBJECT_IDS = ["phone", "pen", "tray", "patient"] as const;
export type ObjectId = (typeof OBJECT_IDS)[number];

export const ENTITY_IDS = ["hand", ...OBJECT_IDS] as const;
export type EntityId = (typeof ENTITY_IDS)[number];

export const ENTITY_LABELS: Readonly<Record<EntityId, string>> = {
  hand: "Hand",
  phone: "Phone",
  pen: "Pen",
  tray: "Tray",
  patient: "Patient prop",
};

export type InputSource = "manual" | "camera" | "demo" | "hypothetical";

type EventBase = {
  readonly id: string;
  readonly elapsedMs: number;
  readonly source: InputSource;
};

export type SimulationEvent =
  | (EventBase & {
      readonly type: "contact";
      readonly objectId: ObjectId;
    })
  | (EventBase & {
      readonly type: "hygiene";
      readonly objectId?: never;
    });

export interface SimulationSnapshot {
  readonly marks: Readonly<Record<EntityId, boolean>>;
  /** The exact event that first marked the patient; hygiene never erases it. */
  readonly patientExposureEventIds: readonly string[];
  readonly processedEventIds: readonly string[];
  readonly lastEventId: string | null;
  /** Event IDs in the first transfer chain that currently marks each entity. */
  readonly provenance: Readonly<Record<EntityId, readonly string[]>>;
}

export interface ReplayFrame {
  readonly event: SimulationEvent | null;
  readonly snapshot: SimulationSnapshot;
  readonly explanation: string;
  readonly referencedEventIds: readonly string[];
}

type MutableSnapshot = {
  marks: Record<EntityId, boolean>;
  patientExposureEventIds: string[];
  processedEventIds: string[];
  lastEventId: string | null;
  provenance: Record<EntityId, string[]>;
};

const INPUT_SOURCES: readonly InputSource[] = [
  "manual",
  "camera",
  "demo",
  "hypothetical",
];

/** Validate an event without changing it or relying on its timestamp ordering. */
export function validateEvent(event: unknown): asserts event is SimulationEvent {
  if (event === null || typeof event !== "object" || Array.isArray(event)) {
    throw new TypeError("A simulation event must be an object.");
  }

  const value = event as Record<string, unknown>;
  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    throw new TypeError("Every event must have a nonempty string ID.");
  }
  if (
    typeof value.elapsedMs !== "number" ||
    !Number.isFinite(value.elapsedMs) ||
    value.elapsedMs < 0
  ) {
    throw new TypeError(`Event "${value.id}" must have a finite, nonnegative elapsedMs.`);
  }
  if (!INPUT_SOURCES.includes(value.source as InputSource)) {
    throw new TypeError(`Event "${value.id}" has an unsupported input source.`);
  }

  if (value.type === "contact") {
    if (!OBJECT_IDS.includes(value.objectId as ObjectId)) {
      throw new TypeError(`Contact event "${value.id}" must name a supported object.`);
    }
  } else if (value.type === "hygiene") {
    if ("objectId" in value) {
      throw new TypeError(`Hygiene event "${value.id}" must not have an objectId.`);
    }
  } else {
    throw new TypeError(`Event "${value.id}" has an unsupported event type.`);
  }
}

/** Validate the whole log, including uniqueness of stable event IDs. */
export function validateEvents(events: readonly SimulationEvent[]): void {
  if (!Array.isArray(events)) {
    throw new TypeError("The event log must be an array.");
  }
  const ids = new Set<string>();
  for (const event of events) {
    validateEvent(event);
    if (ids.has(event.id)) {
      throw new Error(`Duplicate event ID: "${event.id}".`);
    }
    ids.add(event.id);
  }
}

export function createInitialSnapshot(): SimulationSnapshot {
  return {
    marks: { hand: false, phone: true, pen: false, tray: false, patient: false },
    patientExposureEventIds: [],
    processedEventIds: [],
    lastEventId: null,
    provenance: { hand: [], phone: [], pen: [], tray: [], patient: [] },
  };
}

function cloneSnapshot(snapshot: SimulationSnapshot): MutableSnapshot {
  return {
    marks: { ...snapshot.marks },
    patientExposureEventIds: [...snapshot.patientExposureEventIds],
    processedEventIds: [...snapshot.processedEventIds],
    lastEventId: snapshot.lastEventId,
    provenance: {
      hand: [...snapshot.provenance.hand],
      phone: [...snapshot.provenance.phone],
      pen: [...snapshot.provenance.pen],
      tray: [...snapshot.provenance.tray],
      patient: [...snapshot.provenance.patient],
    },
  };
}

/**
 * Apply one event to a fresh state. Contact transfers a mark in either direction;
 * hygiene clears only the hand. Existing marks retain their first transfer chain.
 */
export function applyEvent(
  snapshot: SimulationSnapshot,
  event: SimulationEvent,
): SimulationSnapshot {
  validateEvent(event);
  if (snapshot.processedEventIds.includes(event.id)) {
    throw new Error(`Duplicate event ID: "${event.id}".`);
  }

  const next = cloneSnapshot(snapshot);
  next.processedEventIds.push(event.id);
  next.lastEventId = event.id;

  if (event.type === "hygiene") {
    next.marks.hand = false;
    next.provenance.hand = [];
    return next;
  }

  const objectId = event.objectId;
  const handWasMarked = snapshot.marks.hand;
  const objectWasMarked = snapshot.marks[objectId];

  if (objectWasMarked && !handWasMarked) {
    next.marks.hand = true;
    next.provenance.hand = [...snapshot.provenance[objectId], event.id];
  } else if (handWasMarked && !objectWasMarked) {
    next.marks[objectId] = true;
    next.provenance[objectId] = [...snapshot.provenance.hand, event.id];
    if (objectId === "patient") {
      next.patientExposureEventIds.push(event.id);
    }
  }

  return next;
}

function uniqueIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids)];
}

function explainEvent(
  before: SimulationSnapshot,
  event: SimulationEvent,
  after: SimulationSnapshot,
): Pick<ReplayFrame, "explanation" | "referencedEventIds"> {
  const prefix = `${event.id}: `;
  if (event.type === "hygiene") {
    const handExplanation = before.marks.hand
      ? "Hygiene cleared the mark from the hand."
      : "Hygiene left the already unmarked hand unmarked.";
    const patientExplanation = before.patientExposureEventIds.length > 0
      ? ` The patient prop mark first recorded at ${before.patientExposureEventIds.join(", ")} remains.`
      : " Other objects retain their marks.";
    return {
      explanation: prefix + handExplanation + patientExplanation,
      referencedEventIds: uniqueIds([event.id, ...before.patientExposureEventIds]),
    };
  }

  const objectId = event.objectId;
  const objectLabel = ENTITY_LABELS[objectId];
  const handWasMarked = before.marks.hand;
  const objectWasMarked = before.marks[objectId];

  if (!handWasMarked && !objectWasMarked) {
    return {
      explanation: `${prefix}Hand touched ${objectLabel}. Both were unmarked, so no mark transferred.`,
      referencedEventIds: [event.id],
    };
  }

  if (handWasMarked && objectWasMarked) {
    return {
      explanation: `${prefix}Hand touched ${objectLabel}. Both were already marked; their existing transfer chains remain.`,
      referencedEventIds: uniqueIds([
        ...before.provenance.hand,
        ...before.provenance[objectId],
        event.id,
      ]),
    };
  }

  const recipient: EntityId = handWasMarked ? objectId : "hand";
  const donorLabel = handWasMarked ? "Hand" : objectLabel;
  const recipientLabel = ENTITY_LABELS[recipient];
  const chain = after.provenance[recipient];
  const seedExplanation = !handWasMarked && before.provenance[objectId].length === 0
    ? ` ${objectLabel} carries the initial mark.`
    : "";
  const patientExplanation = recipient === "patient"
    ? ` The patient prop is first marked at ${event.id}.`
    : "";
  return {
    explanation: `${prefix}${donorLabel} transferred a mark to ${recipientLabel}.${seedExplanation}${patientExplanation} Transfer chain: ${chain.join(" → ")}.`,
    referencedEventIds: uniqueIds(chain),
  };
}

/** Return the initial frame followed by one frame per event, in array order. */
export function replayEvents(events: readonly SimulationEvent[]): readonly ReplayFrame[] {
  validateEvents(events);
  let snapshot = createInitialSnapshot();
  const frames: ReplayFrame[] = [{
    event: null,
    snapshot,
    explanation: "Initial state: only Phone is marked. Hand, Pen, Tray, and Patient prop are unmarked.",
    referencedEventIds: [],
  }];

  for (const event of events) {
    const before = snapshot;
    snapshot = applyEvent(before, event);
    frames.push({
      event,
      snapshot,
      ...explainEvent(before, event, snapshot),
    });
  }
  return frames;
}

/**
 * Insert hygiene into gap 0..length without editing the original log or IDs.
 * Its timestamp matches the preceding event, or 0 before the first event.
 * This deliberately permits tied and out-of-order timestamps: order is explicit.
 */
export function insertHypotheticalHygiene(
  events: readonly SimulationEvent[],
  gapIndex: number,
  hypotheticalId?: string,
): readonly SimulationEvent[] {
  validateEvents(events);
  if (!Number.isInteger(gapIndex) || gapIndex < 0 || gapIndex > events.length) {
    throw new RangeError(`Gap index must be an integer between 0 and ${events.length}.`);
  }

  const ids = new Set(events.map((event) => event.id));
  let id: string;
  if (hypotheticalId !== undefined) {
    if (typeof hypotheticalId !== "string" || hypotheticalId.trim().length === 0) {
      throw new TypeError("The hypothetical event ID must be a nonempty string.");
    }
    if (ids.has(hypotheticalId)) {
      throw new Error(`Hypothetical event ID already exists: "${hypotheticalId}".`);
    }
    id = hypotheticalId;
  } else {
    const baseId = `hypothetical-hygiene-gap-${gapIndex}`;
    id = baseId;
    let suffix = 2;
    while (ids.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
  }

  const hygiene: SimulationEvent = {
    id,
    type: "hygiene",
    elapsedMs: gapIndex === 0 ? 0 : events[gapIndex - 1].elapsedMs,
    source: "hypothetical",
  };

  return [...events.slice(0, gapIndex), hygiene, ...events.slice(gapIndex)];
}

export function createDemoEvents(): readonly SimulationEvent[] {
  const objects: readonly ObjectId[] = ["phone", "pen", "tray", "pen", "patient"];
  return objects.map((objectId, index) => ({
    id: `demo-${index + 1}`,
    type: "contact",
    objectId,
    elapsedMs: (index + 1) * 1000,
    source: "demo",
  }));
}

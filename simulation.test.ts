import { describe, expect, it } from "vitest";
import {
  ENTITY_IDS,
  applyEvent,
  createDemoEvents,
  createInitialSnapshot,
  insertHypotheticalHygiene,
  replayEvents,
  validateEvent,
  validateEvents,
  type ObjectId,
  type SimulationEvent,
  type SimulationSnapshot,
} from "./index";

function lastSnapshot(events: readonly SimulationEvent[]): SimulationSnapshot {
  const frames = replayEvents(events);
  return frames[frames.length - 1].snapshot;
}

function contact(id: string, objectId: ObjectId, elapsedMs = 1000): SimulationEvent {
  return { id, type: "contact", objectId, elapsedMs, source: "manual" };
}

function hygiene(id: string, elapsedMs = 1000): SimulationEvent {
  return { id, type: "hygiene", elapsedMs, source: "manual" };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

describe("the seven AfterTouch acceptance criteria", () => {
  it("marks the patient in the original demo", () => {
    const events = createDemoEvents();
    expect(events.map((event) => event.id)).toEqual([
      "demo-1", "demo-2", "demo-3", "demo-4", "demo-5",
    ]);
    expect(events.map((event) => event.elapsedMs)).toEqual([1000, 2000, 3000, 4000, 5000]);
    const snapshot = lastSnapshot(events);
    expect(snapshot.marks.patient).toBe(true);
    expect(snapshot.patientExposureEventIds).toEqual(["demo-5"]);
    expect(snapshot.provenance.patient).toEqual(["demo-1", "demo-5"]);
  });

  it("still marks the patient when hygiene occurs after the tray, before the second pen", () => {
    const snapshot = lastSnapshot(insertHypotheticalHygiene(createDemoEvents(), 3, "wash-after-tray"));
    expect(snapshot.marks.patient).toBe(true);
    expect(snapshot.patientExposureEventIds).toEqual(["demo-5"]);
    expect(snapshot.provenance.patient).toEqual(["demo-1", "demo-2", "demo-4", "demo-5"]);
  });

  it("leaves the patient unmarked when hygiene occurs after the second pen, before the patient", () => {
    const snapshot = lastSnapshot(insertHypotheticalHygiene(createDemoEvents(), 4, "wash-before-patient"));
    expect(snapshot.marks.patient).toBe(false);
    expect(snapshot.patientExposureEventIds).toEqual([]);
    expect(snapshot.provenance.patient).toEqual([]);
    expect(snapshot.marks.pen).toBe(true);
  });

  it("retains prior patient exposure when hygiene occurs after the patient", () => {
    const snapshot = lastSnapshot(insertHypotheticalHygiene(createDemoEvents(), 5, "wash-after-patient"));
    expect(snapshot.marks.hand).toBe(false);
    expect(snapshot.provenance.hand).toEqual([]);
    expect(snapshot.marks.patient).toBe(true);
    expect(snapshot.patientExposureEventIds).toEqual(["demo-5"]);
    expect(snapshot.provenance.patient).toEqual(["demo-1", "demo-5"]);
  });

  it("inserts a hypothetical event without changing the original log, values, or IDs", () => {
    const original = deepFreeze(createDemoEvents());
    const preserved = JSON.stringify(original);
    const edited = insertHypotheticalHygiene(original, 3, "what-if-1");
    expect(JSON.stringify(original)).toBe(preserved);
    expect(edited).not.toBe(original);
    expect(edited).toHaveLength(original.length + 1);
    expect(edited[3]).toEqual({
      id: "what-if-1", type: "hygiene", elapsedMs: 3000, source: "hypothetical",
    });
    expect(edited.filter((event) => event.id !== "what-if-1")).toEqual(original);
    for (let index = 0; index < original.length; index += 1) {
      expect(edited[index < 3 ? index : index + 1]).toBe(original[index]);
    }
  });

  it("replays the same immutable log identically each time", () => {
    const events = deepFreeze(insertHypotheticalHygiene(createDemoEvents(), 3));
    const first = replayEvents(events);
    const second = replayEvents(events);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second[second.length - 1].snapshot).not.toBe(first[first.length - 1].snapshot);
  });

  it("reset creates a fresh initial state with only the phone marked", () => {
    lastSnapshot(createDemoEvents());
    const reset = createInitialSnapshot();
    expect(reset).toEqual({
      marks: { hand: false, phone: true, pen: false, tray: false, patient: false },
      patientExposureEventIds: [], processedEventIds: [], lastEventId: null,
      provenance: { hand: [], phone: [], pen: [], tray: [], patient: [] },
    });
    expect(reset).not.toBe(createInitialSnapshot());
    expect(replayEvents([])).toHaveLength(1);
    expect(replayEvents([])[0].snapshot).toEqual(reset);
  });
});

describe("transfer and state isolation", () => {
  it("transfers back from a previously marked object after hygiene", () => {
    const frames = replayEvents([
      contact("touch-phone", "phone"),
      contact("mark-tray", "tray"),
      hygiene("clear-hands"),
      contact("retouch-tray", "tray"),
      contact("touch-patient", "patient"),
    ]);
    expect(frames[3].snapshot.marks.hand).toBe(false);
    expect(frames[3].snapshot.marks.tray).toBe(true);
    expect(frames[4].snapshot.provenance.hand).toEqual(["touch-phone", "mark-tray", "retouch-tray"]);
    expect(frames[5].snapshot.provenance.patient).toEqual([
      "touch-phone", "mark-tray", "retouch-tray", "touch-patient",
    ]);
  });

  it("leaves the unmarked hand and object unmarked on contact", () => {
    const snapshot = applyEvent(createInitialSnapshot(), contact("clean-touch", "patient"));
    expect(snapshot.marks.hand).toBe(false);
    expect(snapshot.marks.patient).toBe(false);
    expect(snapshot.patientExposureEventIds).toEqual([]);
  });

  it("records only the first patient-marking event and preserves it through later contacts", () => {
    const snapshot = lastSnapshot([
      contact("seed", "phone"),
      contact("first-patient-contact", "patient"),
      hygiene("clear"),
      contact("second-patient-contact", "patient"),
      contact("third-patient-contact", "patient"),
    ]);
    expect(snapshot.patientExposureEventIds).toEqual(["first-patient-contact"]);
    expect(snapshot.provenance.patient).toEqual(["seed", "first-patient-contact"]);
    expect(snapshot.provenance.hand).toEqual(["seed", "first-patient-contact", "second-patient-contact"]);
  });

  it("does not mutate frozen snapshots or events, and clones every mutable collection", () => {
    const before = deepFreeze(lastSnapshot(createDemoEvents()));
    const event = deepFreeze(hygiene("frozen-hygiene"));
    const preserved = JSON.stringify(before);
    const after = applyEvent(before, event);
    expect(JSON.stringify(before)).toBe(preserved);
    expect(after).not.toBe(before);
    expect(after.marks).not.toBe(before.marks);
    expect(after.provenance).not.toBe(before.provenance);
    expect(after.processedEventIds).not.toBe(before.processedEventIds);
    expect(after.patientExposureEventIds).not.toBe(before.patientExposureEventIds);
    for (const entityId of ENTITY_IDS) {
      expect(after.provenance[entityId]).not.toBe(before.provenance[entityId]);
    }
    expect(before.lastEventId).toBe("demo-5");
    expect(after.lastEventId).toBe("frozen-hygiene");
  });

  it("keeps earlier replay frames isolated from later state changes", () => {
    const frames = replayEvents(createDemoEvents());
    expect(frames[0].snapshot.marks.hand).toBe(false);
    expect(frames[1].snapshot.marks.pen).toBe(false);
    expect(frames[2].snapshot.marks.pen).toBe(true);
    expect(frames[4].snapshot.marks.patient).toBe(false);
    expect(frames[5].snapshot.marks.patient).toBe(true);
    expect(frames[0].snapshot.processedEventIds).toEqual([]);
  });
});

describe("stable event identity and order", () => {
  it("references exact event IDs and provenance in explanations after insertion", () => {
    const frames = replayEvents(insertHypotheticalHygiene(createDemoEvents(), 3, "hypothesis-abc"));
    const retouch = frames.find((frame) => frame.event?.id === "demo-4");
    const patient = frames.find((frame) => frame.event?.id === "demo-5");
    expect(retouch?.referencedEventIds).toEqual(["demo-1", "demo-2", "demo-4"]);
    expect(patient?.referencedEventIds).toEqual(["demo-1", "demo-2", "demo-4", "demo-5"]);
    expect(patient?.explanation).toContain("first marked at demo-5");
    expect(patient?.explanation).toContain("demo-1 → demo-2 → demo-4 → demo-5");
    expect(patient?.referencedEventIds).not.toContain("hypothesis-abc");
    expect(frames[0].referencedEventIds).toEqual([]);
  });

  it("explains retained patient exposure using its original event ID", () => {
    const frames = replayEvents(insertHypotheticalHygiene(createDemoEvents(), 5, "late-wash"));
    const frame = frames[frames.length - 1];
    expect(frame.explanation).toContain("demo-5 remains");
    expect(frame.referencedEventIds).toEqual(["late-wash", "demo-5"]);
  });

  it.each([
    [1000, 1000, 1000],
    [3000, 1000, 2000],
  ])("uses array order for equal or out-of-order timestamps (%s, %s, %s)", (first, second, third) => {
    const events = [
      contact("a-phone", "phone", first),
      hygiene("b-hygiene", second),
      contact("c-patient", "patient", third),
    ];
    const frames = replayEvents(events);
    expect(frames.slice(1).map((frame) => frame.event?.id)).toEqual(["a-phone", "b-hygiene", "c-patient"]);
    expect(frames[3].snapshot.marks.patient).toBe(false);
    expect(frames[3].snapshot.processedEventIds).toEqual(["a-phone", "b-hygiene", "c-patient"]);
  });

  it("uses deterministic collision-safe default IDs and matching gap timestamps", () => {
    const original = createDemoEvents();
    expect(insertHypotheticalHygiene(original, 0)[0].elapsedMs).toBe(0);
    expect(insertHypotheticalHygiene(original, 5)[5].elapsedMs).toBe(5000);
    const once = insertHypotheticalHygiene(original, 3);
    expect(once[3].id).toBe("hypothetical-hygiene-gap-3");
    const twice = insertHypotheticalHygiene(once, 3);
    expect(twice[3].id).toBe("hypothetical-hygiene-gap-3-2");
    expect(insertHypotheticalHygiene(once, 3)).toEqual(twice);
    expect(twice[3].elapsedMs).toBe(3000);
    expect(() => replayEvents(twice)).not.toThrow();
    expect(insertHypotheticalHygiene([], 0)[0]).toEqual({
      id: "hypothetical-hygiene-gap-0", type: "hygiene", elapsedMs: 0, source: "hypothetical",
    });
  });
});

describe("input validation", () => {
  const valid = contact("valid-id", "phone");

  it.each([
    null,
    [],
    "event",
    { ...valid, id: "" },
    { ...valid, id: "   " },
    { ...valid, id: 1 },
    { ...valid, elapsedMs: -1 },
    { ...valid, elapsedMs: Number.NaN },
    { ...valid, elapsedMs: Number.POSITIVE_INFINITY },
    { ...valid, elapsedMs: "1000" },
    { ...valid, source: "unknown" },
    { ...valid, type: "unknown" },
    { ...valid, objectId: "hand" },
    { id: "missing-object", type: "contact", elapsedMs: 0, source: "manual" },
    { ...valid, type: "hygiene" },
    { ...hygiene("undefined-object"), objectId: undefined },
  ])("rejects an invalid event shape %#", (event) => {
    expect(() => validateEvent(event)).toThrow();
    expect(() => replayEvents([event as SimulationEvent])).toThrow();
  });

  it.each(["manual", "camera", "demo", "hypothetical"] as const)("accepts the %s source", (source) => {
    expect(() => validateEvent({ ...valid, elapsedMs: 0, source })).not.toThrow();
  });

  it("rejects duplicate event IDs in replay, direct application, and insertion", () => {
    const duplicate = [contact("same-id", "phone"), contact("same-id", "patient")];
    expect(() => replayEvents(duplicate)).toThrow(/Duplicate event ID/);
    expect(() => validateEvents(duplicate)).toThrow(/Duplicate event ID/);
    expect(() => insertHypotheticalHygiene(duplicate, 1)).toThrow(/Duplicate event ID/);
    const after = applyEvent(createInitialSnapshot(), duplicate[0]);
    expect(() => applyEvent(after, duplicate[1])).toThrow(/Duplicate event ID/);
  });

  it.each([-1, 6, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid gap index %s", (gapIndex) => {
    expect(() => insertHypotheticalHygiene(createDemoEvents(), gapIndex)).toThrow(RangeError);
  });

  it("rejects an empty or colliding explicit hypothetical ID", () => {
    expect(() => insertHypotheticalHygiene(createDemoEvents(), 3, "")).toThrow(/nonempty/);
    expect(() => insertHypotheticalHygiene(createDemoEvents(), 3, "   ")).toThrow(/nonempty/);
    expect(() => insertHypotheticalHygiene(createDemoEvents(), 3, "demo-4")).toThrow(/already exists/);
  });
});

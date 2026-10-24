# Future camera integration contract

AfterTouch currently supports manual input only. This document describes how a future camera adapter should send events into the existing application. It does **not** implement camera access, detection, tracking, or a vision model.

The simulation remains independent of input hardware. Manual input and camera input must use the same exported event type, session reducer, validation, and replay functions.

## Shared event schema

The source of truth is [`src/simulation/index.ts`](../src/simulation/index.ts). Import its types instead of maintaining a separate camera-specific schema. The shared definitions are:

```ts
export const OBJECT_IDS = ["phone", "pen", "tray", "patient"] as const;
export type ObjectId = (typeof OBJECT_IDS)[number];

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
```

| Field | Adapter requirement |
| --- | --- |
| `id` | A stable, nonempty string, unique within the original event log. Preserve it through replay. |
| `type` | Exactly `contact` or `hygiene`. |
| `objectId` | Required for contact: `phone`, `pen`, `tray`, or `patient`. Omit this property entirely for hygiene. The `patient` ID means the patient-training prop. |
| `elapsedMs` | Emit finite, nonnegative integer milliseconds from the current recording start. The engine validator accepts any finite, nonnegative number, including fractional milliseconds. |
| `source` | Use `camera` for camera-origin events. Other accepted sources are `manual`, `demo`, and `hypothetical`. |

`EntityId` additionally includes `hand`. A contact's `objectId` must never be `hand`: every contact already means the single hand interacting with the named object. UI labels are **Hand**, **Phone**, **Pen**, **Tray**, and **Patient prop**.

## Event identity and ordering

- **Array order is authoritative.** Replay processes events in the order received. It never sorts by timestamps.
- Equal timestamps are valid. Out-of-order timestamps are also valid and do not change processing order.
- Use the shared recording start when mixing manual and camera inputs. Round the elapsed time to integer milliseconds in the adapter; do not use a wall-clock date as `elapsedMs`.
- The current manual recorder uses `manual-1`, `manual-2`, and so on. Its counter continues across resets while the page remains open.
- Give the camera adapter its own prefix, such as `camera-1`, `camera-2`, and so on. Keep the counter increasing while the adapter is active. Different adapters need distinct prefixes or a coordinated ID allocator.
- Replaying an event must not allocate a new ID, read a clock, or change its source. Repeated delivery of the same ID is a duplicate, not a new interaction.

The engine rejects duplicate IDs. `validateEvent` checks a single event's shape; `validateEvents`, `replayEvents`, and the session reducer also check uniqueness across the log. `applyEvent` rejects an ID that already appears in the supplied snapshot's `processedEventIds`.

## What the camera adapter owns

The adapter owns camera permission, object recognition, tracking, uncertainty handling, and contact debouncing. It must decide when a **distinct interaction** has occurred before producing a simulation event.

**Do not emit one contact per video frame.** A continuing touch should produce one event. Emit another only after the adapter has established a new interaction, using its own release/recontact or equivalent debounce rule. Confidence scores and raw frames belong to the adapter, not to the shared simulation event.

An uncertain observation should remain pending or require confirmation. It must not silently become a confirmed contact. Hygiene must come from an **explicit, approved input**, such as the existing simulation button or a confirmed action. A camera must not infer cleanliness or automatically clear the hand because it sees a sink, sanitizer, washing movement, or an apparently clean surface.

Keep the app's persistent notice unchanged:

> Training simulation. No actual contamination is measured.

Camera input would supply interaction events only. It would not turn the illustrative mark into a contamination measurement or infection probability.

## Append to the existing reducer

The existing reducer is [`sessionReducer`](../src/state/session.ts). Its append action is:

```ts
{ readonly type: "append"; readonly event: SimulationEvent }
```

The following is an **integration-boundary example for `src/App.tsx`**, using the existing `session` and `dispatch`. It validates unknown adapter input before dispatch and guards repeated camera deliveries, including multiple deliveries before React renders again. It contains no camera implementation.

```tsx
import { useRef } from "react";
import { validateEvent, type SimulationEvent } from "./simulation";

// Inside App, alongside the existing session reducer:
const acceptedCameraIds = useRef(new Set<string>());

function appendApprovedCameraEvent(candidate: unknown): void {
  validateEvent(candidate); // Throws for an unsupported or malformed event.
  const event: SimulationEvent = candidate;

  if (event.source !== "camera") {
    throw new Error("This adapter accepts camera-origin events only.");
  }

  const duplicate =
    acceptedCameraIds.current.has(event.id) ||
    session.events.some((existing) => existing.id === event.id);

  if (duplicate) {
    throw new Error(`Duplicate event ID: "${event.id}".`);
  }

  // The adapter must have already confirmed one distinct contact, or obtained
  // explicit approval for a hygiene action, before reaching this boundary.
  acceptedCameraIds.current.add(event.id);
  dispatch({ type: "append", event });
}
```

At the adapter boundary, catch validation or duplicate-delivery errors and show an actionable input status. Do not coerce unknown object names into supported IDs, silently replace an invalid source, or repair a duplicate by assigning a new ID to the same delivered interaction. The reducer independently validates the entire appended log; it remains the final guard if an input bypasses the adapter.

For example, one approved pen contact could have this payload:

```ts
const event: SimulationEvent = {
  id: "camera-17",
  type: "contact",
  objectId: "pen",
  elapsedMs: 12450,
  source: "camera",
};
```

An explicitly approved hygiene event has the same common fields, `type: "hygiene"`, and **no `objectId` property**, including no `objectId: undefined`.

## Preserve session and replay behavior

Appending a camera event follows the same behavior as a manual event: it goes to the end of the original log, even if replay currently shows an earlier step. The session then moves to its latest replay position.

Reset is a session action, **not a simulation event**:

```ts
dispatch({ type: "reset" });
```

Use the app's reset handler so the recording clock resets too. Start a new original log, clear the hypothetical, and restore the initial phone-only mark. Stop or invalidate any queued observations from the previous log so delayed camera callbacks cannot append old interactions to the new one. The camera ID counter can continue across resets, like the manual counter. The example's accepted-ID set also intentionally persists for the page session.

The simulation's guarantees remain unchanged:

- `createInitialSnapshot` starts with only the phone marked.
- `applyEvent` is pure and returns fresh collections. Hygiene clears only the hand and its provenance.
- `replayEvents` includes the initial frame at index 0, then one frame per event.
- `provenance` stores the exact event IDs of the first transfer chain currently marking an entity.
- `patientExposureEventIds` records the event that first marked the patient prop. Later hygiene does not erase it.
- `insertHypotheticalHygiene` returns a new comparison sequence and preserves the original events, values, and IDs. The inserted event has source `hypothetical`.
- Gap indices range from 0 through the original log length. The inserted event uses the preceding event's timestamp, or 0 at the beginning. Ties are intentional.

Do not bypass these functions by setting UI mark colors directly from camera detections. Marks, explanations, and the original-versus-hypothetical comparison must all derive from replay of the shared event log.

## Checks before enabling a future adapter

Keep the existing simulation and session tests passing with `npm test`. Add adapter tests for one event per distinct contact, release/recontact behavior, uncertain detections, duplicate delivery, malformed payloads, equal timestamps, and delayed events after reset. Confirm that the same accepted event log produces identical replay frames regardless of whether its contacts were recorded manually or by the camera adapter, except for the intentionally different source and event IDs.

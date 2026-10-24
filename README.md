# AfterTouch

A small, manual-input teaching simulator for exploring how a mark can transfer through a sequence of touches. Record interactions, replay them, and compare the original sequence with one hypothetical hand-hygiene event.

The app keeps this notice visible:

> Training simulation. No actual contamination is measured.

## Run it on your computer

You need **Node.js 22.12 or newer**, which includes npm, and a copy of this project. No API key, account, database, or backend setup is required.

1. Download the project, or clone it with Git:

   ```bash
   git clone https://github.com/alainakelly-sketch/HACKOHI-O-2026.git
   cd HACKOHI-O-2026
   ```

2. Open a terminal in the project folder, the folder containing `package.json`, and install the dependencies:

   ```bash
   npm ci
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open the **Local** URL printed in the terminal. It is usually `http://localhost:5173`. Leave the terminal running while using the app. Press **Ctrl+C** in that terminal to stop it.

If you downloaded the files instead of cloning them, start at step 2.

## Try the demo

Click **Load demo**. The original sequence is:

1. Touch phone: `demo-1`.
2. Touch pen: `demo-2`.
3. Touch tray: `demo-3`.
4. Touch pen again: `demo-4`.
5. Touch patient prop: `demo-5`.

The phone starts marked; the hand and other objects start unmarked. At the end of the original sequence, the patient prop is marked.

Choose a gap in the comparison panel, then click **Apply hypothetical** or **Update hypothetical**. Gap numbers count how many original events occur before the inserted hygiene event.

| Scenario | Gap | Patient prop at the end | Explanation |
| --- | --- | --- | --- |
| Original demo | No insertion | Marked | The hand transfers its mark to the patient prop at `demo-5`. |
| Hygiene after the tray, before the second pen touch | 3 | Marked | The pen was already marked. Touching it again marks the hand after hygiene. |
| Hygiene after the second pen touch, before the patient prop | 4 | Unmarked | Hygiene clears the hand immediately before patient-prop contact. |
| Hygiene after patient-prop contact | 5 | Marked | Hygiene clears the hand but does not erase the earlier patient-prop mark. |

Use the replay controls to inspect individual steps. The comparison aligns both versions to the same number of original events. Event-reference buttons jump to the event supporting an explanation. Removing the hypothetical restores the original replay without editing the original log.

## Record your own sequence

- Use **Touch phone**, **Touch pen**, **Touch tray**, and **Touch patient prop** to record one contact each.
- Use **Simulate hand hygiene** to record hygiene in the original sequence.
- New events always append to the original log, including when replay is showing an earlier step.
- **Reset** clears the log and hypothetical comparison and restores the initial state.
- **Load demo** replaces the current log with the five demo events.

All state stays in the current browser page. **Reloading the page resets the session.** This version has manual input only, with no camera detection, backend, API calls, database, or persistent storage.

## Teaching assumptions

This is a deliberately simplified, deterministic model:

- There is one hand and four objects: phone, pen, tray, and patient prop.
- Only the phone carries the initial mark.
- Contact shares a mark in either direction between the hand and the touched object.
- Simulated hygiene clears only the hand. Objects retain their marks until reset.
- The first event that marks the patient prop remains recorded, including after later hygiene.
- An inserted hypothetical changes only the comparison sequence. The original events and their IDs stay unchanged.

**Unmarked does not prove cleanliness.** Marks are not infection probabilities, actual contamination measurements, or clinical predictions.

## Tests and production build

Run these commands from the project folder. Use a second terminal if the development server is still running.

```bash
npm test
npm run build
npm run preview
```

`npm test` runs the automated tests once. `npm run build` checks TypeScript and produces the static site in `dist/`. `npm run preview` serves that build locally; open the URL it prints. Preview requires a successful build first.

At handoff, **57 automated tests passed**: 44 simulation tests and 13 session-state tests. The production build also passed. Browser checks covered the initial state, manual five-contact sequence, manual hygiene, reset, and hypothetical gaps 3, 4, and 5.

Additional browser checks covered backward/forward alignment, staged gap changes, appending while rewound, and layouts in 390px and 320px browser frames. A narrow-screen label overlap was fixed and rechecked with no horizontal overflow. These were desktop Chromium browser checks; physical phones, Safari, Firefox, and assistive-technology testing still need a human check. No application console errors remained after the final interaction checks.

## Where the code lives

| File | Purpose |
| --- | --- |
| `src/simulation/index.ts` | Shared event types, validation, pure state transitions, provenance, deterministic replay, demo events, and hypothetical insertion. |
| `src/simulation/simulation.test.ts` | Simulation rules, acceptance cases, immutability, stable IDs, timestamp ordering, and invalid-input tests. |
| `src/state/session.ts` | The shared session reducer: append, reset, demo loading, replay position, and hypothetical selection. |
| `src/state/session.test.ts` | Session actions, replay alignment, and preservation of the original log. |
| `src/App.tsx` | Connects the recorder, event log, simulation, replay, and comparison UI. |
| `src/components/` | Entity states, recorder buttons, replay controls, timeline, and comparison panel. |
| `src/styles.css` | Responsive layout and visual styling. |
| `src/main.tsx` | React entry point. |
| `docs/CAMERA_INTEGRATION.md` | Event contract and integration boundary for a future camera adapter. |

Built with React, TypeScript, Vite, and Vitest. To add a future camera input without changing the simulation, start with the [camera integration contract](docs/CAMERA_INTEGRATION.md).

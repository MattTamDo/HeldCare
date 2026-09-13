# CareFall

Senior-living emergency-response system — hackathon project (3-person team).

## Modules

| Module | Owner | Route | Status |
|--------|-------|-------|--------|
| Fall Detection | Person 1 | `/monitor` (Cameras tab) | Integrated |
| Incident Response | Person 2 | `/monitor?tab=facility`, `/monitor?tab=responder` | Integrated |
| Post-Fall Assessment | Person 3 | `/responder/incident/:id/assessment` | Not merged yet |

A confirmed fall POSTs the shared `FallEvent` to `/api/incidents/fall`, which opens
an alert and pushes it to the Facility tab over SSE. `FallEvent` is declared once, in
[`lib/types/incident.ts`](./lib/types/incident.ts), and re-exported by `lib/fall/types.ts`.

## Plan

See **[PLAN.md](./PLAN.md)** for architecture, shared contracts, and integration checklist.

Module specs:

- [Module 1 — Fall Detection](./docs/module-1-fall-detection.md)
- [Module 2 — Incident Response](./docs/module-2-incident-response.md)
- [Module 3 — Post-Fall Assessment](./docs/module-3-post-fall-assessment.md)

## Demo facility

**Oakwood Senior Living** — Room **204**, Margaret Davis. Responder: Sarah Miller, CNA.

## Running locally

```bash
npm install     # also copies the MediaPipe WASM runtime into public/
npm run dev     # http://localhost:3000
```

Everything lives on one dashboard at `/monitor` (`/` redirects there), with three
tabs: **Live cameras**, **Facility**, and **Responder**. Click any camera window
to make it the main view; the panels underneath follow it.

End-to-end demo: open `/monitor?demo=true`, stage a fall (or press **`F`**), and
the alert rail, Facility tab, and Responder tab all update over SSE. `?demo=true`
also reveals the demo controls and the detector diagnostics panel.

Requires Chrome and a webcam. The pose model (`public/models/pose_landmarker_lite.task`)
and the WASM runtime are served locally, so the camera page works offline.

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run check:fall` | Runs the fall detector against the eight spec scenarios |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

### Fall detection module (Person 1)

- Press **`F`** on the Live cameras tab to emit a fall event manually — same `reportFall()` path as the detector
- Detection logic lives in `lib/fall/`; nothing fall-related sits inside a component
- Set `NEXT_PUBLIC_FALL_ENDPOINT=""` to run the cameras log-only, without raising incidents
- All four windows keep running while you switch tabs or change the main view, so
  no camera restarts mid-demo

### UI notes

- Light theme by default with a header toggle; the choice persists in `localStorage`
- **AI analysis** is derived entirely from the live detector — no simulated values
- **Vital signs** stays empty on purpose: the camera cannot measure heart rate or
  temperature, so only the movement row (which it can) is populated
- "Talk to resident" and "Contact family" are shown disabled because there is no
  backend for them

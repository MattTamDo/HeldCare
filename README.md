# CareFall

Senior-living emergency-response system — hackathon project (3-person team).

## Modules

| Module | Owner | Route | Status |
|--------|-------|-------|--------|
| Fall Detection | Person 1 | `/monitor`, `/camera/204` | Integrated |
| Incident Response | Person 2 | `/dashboard`, `/responder` | Integrated |
| Post-Fall Assessment | Person 3 | `/responder/incident/:id/assessment` | Not merged yet |

A confirmed fall POSTs the shared `FallEvent` to `/api/incidents/fall`, which opens
an alert and pushes it to `/dashboard` over SSE. `FallEvent` is declared once, in
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

End-to-end demo: open `/monitor` in one window and `/dashboard?demo=true` in another.
Stage a fall (or press **`F`**) and the matching room card turns red in real time.

Requires Chrome and a webcam. The pose model (`public/models/pose_landmarker_lite.task`)
and the WASM runtime are served locally, so the camera page works offline.

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run check:fall` | Runs the fall detector against the eight spec scenarios |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

### Fall detection module (Person 1)

- `/monitor` — four-window camera wall: three uploadable clips plus the live camera
- `/camera/204` — single room with the full detector HUD (add `?demo=true` for a judge run)
- Press **`F`** to emit a fall event manually — same `reportFall()` path as the detector
- Detection logic lives in `lib/fall/`; nothing fall-related sits inside a component
- Set `NEXT_PUBLIC_FALL_ENDPOINT=""` to run the cameras log-only, without raising incidents

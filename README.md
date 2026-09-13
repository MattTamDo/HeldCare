# CareFall

Senior-living emergency-response system — hackathon project (3-person team).

## Modules

| Module | Owner | Route |
|--------|-------|-------|
| Fall Detection | Person 1 | `/camera/204` |
| Incident Response | Person 2 | `/dashboard`, `/responder` |
| Post-Fall Assessment | Person 3 | `/responder/incident/:id/assessment` |

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
npm run dev     # http://localhost:3000/camera/204
```

Requires Chrome and a webcam. The pose model (`public/models/pose_landmarker_lite.task`)
and the WASM runtime are served locally, so the camera page works offline.

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run check:fall` | Runs the fall detector against the eight spec scenarios |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

### Fall detection module (Person 1)

- Page: `/camera/204` (add `?demo=true` to flag a judge run)
- Press **`F`** to emit a fall event manually — same `reportFall()` path as the detector
- Detection logic lives in `lib/fall/`; nothing fall-related sits inside a component
- To send events to Person 2's API, set `NEXT_PUBLIC_FALL_ENDPOINT=/api/incidents/fall`;
  until then `reportFall()` logs to the console

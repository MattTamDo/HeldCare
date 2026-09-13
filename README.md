# HeldCare

Senior-living emergency response for a three-person hackathon. A confirmed fall on the camera wall becomes a live incident, a dispatched responder, a phone-side Gemini copilot, contactless vitals, and an EMS handoff — without diagnosing.

`/` redirects to **`/monitor`**. Light theme by default; the header toggle persists in `localStorage`.

## Full workflow

```text
Room camera / demo clip          Facility + Responder tabs         Phone at the bedside
MediaPipe Pose + fall agent      Incident agent (SSE)              Copilot + Presage + form
        │                                 │                                  │
        │  POST /api/incidents/fall       │                                  │
        ├────────────────────────────────►│  incident_created                │
        │                                 ├── SSE ──► Facility (red room)    │
        │                                 ├── SSE ──► Responder (alert)      │
        │                                 │                                  │
        │                                 │◄── accept ── Responder tab ──────┤
        │                                 │                                  │
        │                                 │   /responder/incident/:id/copilot
        │                                 │                                  │
        │                                 │   Gemini Live (audio + video)    │
        │                                 │   + realtime Presage estimates   │
        │                                 │   + structured findings          │
        │                                 │                                  │
        │                                 │◄── AssessmentResult ─────────────┤
        │                                 └── resolve / reset demo           │
```

1. **Detect.** Rooms **201–203** play uploaded demo clips; room **204** is the live camera. Every window runs the same pose detector. A staged fall, a detected collapse, or **`F`** on the selected window all call `reportFall()`.
2. **Dispatch.** `POST /api/incidents/fall` opens one active incident per room. SSE (`/api/realtime/stream`) updates Live cameras, Facility, and Responder at once.
3. **Accept.** On the Responder tab, tap a name. The phone opens Live copilot for **that room**, not a hardcoded 204.
4. **Copilot.** Safari on the phone (HTTPS) starts Gemini Live: one short spoken sentence at a time, grounded in the camera scene. Findings are saved with `recordObservation` / `recordProblem`.
5. **Vitals.** The Presage adapter streams measurement stages in real time (pulse, breathing, signal). The copilot chips update as numbers arrive. This build uses the simulated provider so the demo never depends on hardware.
6. **Assess / handoff.** Post-fall form, protocol card, 3D guide, then Complete. Stop on the copilot writes an EMS situation script (Presage numbers kept verbatim).
7. **Reset.** `/monitor?demo=true` → Clear all alerts. Ready for the next judge run.

### Judge path (two minutes)

```text
Laptop:  /monitor?demo=true
         Upload clips on 201–203 or stage a fall on 204 / press F
Phone:   same Next process via Cloudflare HTTPS
         Responder tab → accept → Allow Camera + Microphone → Start
         Speak what you see → Stop → EMS report
Laptop:  Facility + Responder tabs already show the same incident
```

## Multi-agent design

Not a generic agent swarm. Four narrow roles, each with one job and a typed contract.

| Agent | Runs | Does | Does not |
|-------|------|------|----------|
| **Fall agent** | Browser, `lib/fall/` | Pose → temporal features → one `FallEvent` | Dashboard, Gemini, vitals |
| **Incident agent** | Server, `lib/incidents/` + SSE | Create, claim, resolve; fan out to every tab | Pose math, medical advice |
| **Scene copilot** | Gemini Live + `/api/assessment/live-token` | See the phone camera, hear the responder, save findings, coach the next action | Recite a generic protocol script, name a diagnosis |
| **Assessment interpreter** | `/api/assessment/interpret` + local parser | Speech → structured form fields + protocol step | Invent procedures |
| **Presage vitals** | `VitalsProvider.subscribe()` | Stream stages and estimates to the UI and copilot | Diagnose from a pulse number |
| **EMS writer** | `/api/assessment/ems-report` | Situation script for incoming medics; keeps Presage numbers | Add findings that were not recorded |

Shared contracts (do not change without the team):

- `FallEvent` — `lib/types/incident.ts`
- `Incident` — same file / in-memory store
- `AssessmentResult` — `lib/assessment/types.ts`
- `VitalsProvider` — `lib/vitals/types.ts` (`start` / `stop` / `getLatest` / `subscribe`)

## Realtime Presage

The assessment UI never imports the SmartSpectra SDK. It only talks to `VitalsProvider`.

```text
createVitalsProvider()
        │
        ├─ mock (this demo)     staged snapshots ~15s
        │                       initializing → searching → acquired
        │                       → measuring → available
        │                       pulse ~112, respiration ~16
        │
        └─ live (reference)     Electron / SmartSpectra camera-bridge
                                or phone WebRTC → /api/mobile-health
                                see docs/phone-camera-presage-bridge.md
```

- Copilot and the Health vitals step **subscribe** to the same stream — numbers appear while the responder is still talking.
- `NEXT_PUBLIC_PRESAGE_MODE=mock` is the supported demo path. `PresageVitalsProvider` is in the tree so a live SDK can be swapped in without rewriting the UI.
- Phone camera pairing (`components/phone-camera/`) is the bridge for a real face-scan when hardware is available.

## Run

```bash
npm install          # also copies MediaPipe WASM into public/
cp .env.example .env.local   # then add GEMINI_API_KEY for Live copilot
npm run dev          # http://localhost:3000 → /monitor
```

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run check:fall` | Fall detector vs the eight spec scenarios |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

Chrome + webcam for room **204**. Rooms **201–203**: **Upload** (or drop) an MP4 on the tile, then **Analyse clip**. Pose overlay and fall score run on the clip. Files in `public/demo/clip-1.mp4` … `clip-3.mp4` load automatically (gitignored).

### Environment

Copy `.env.example` to `.env.local`. Never commit a real key.

| Variable | Role |
|----------|------|
| `GEMINI_API_KEY` | Live copilot + interpret + EMS rewrite. Without it, the form still works via the offline parser; Live Start will fail. |
| `GEMINI_MODEL` | Assessment interpret (default `gemini-2.5-flash`) |
| `GEMINI_LIVE_MODEL` | Phone copilot (default `gemini-3.1-flash-live-preview`) |
| `NEXT_PUBLIC_PRESAGE_MODE` | `mock` for the demo |
| `NEXT_PUBLIC_FALL_ENDPOINT` | Set to empty to log falls without opening incidents |

### iPhone copilot (required for camera + mic)

Safari only allows `getUserMedia` on **HTTPS**. Use the same Node process the laptop is running:

```bash
# terminal 1
npm run dev

# terminal 2
cloudflared tunnel --url http://localhost:3000
```

Open the printed `https://….trycloudflare.com` URL on the phone, then the Responder tab (or `/responder/incident/<id>/copilot`). Close the old Safari tab when the tunnel URL changes. `allowedDevOrigins` includes `*.trycloudflare.com` so the Next.js dev server will load scripts on that host.

Do not open `http://<LAN-IP>:3000` on the phone — Start will stay dead or show a camera-blocked error.

## Routes

| Route | What you see |
|-------|----------------|
| `/monitor` | Live cameras, pose, fall scores |
| `/monitor?tab=facility` | Room board + SSE alerts |
| `/monitor?tab=responder` | Accept / open copilot / resolve |
| `/monitor?demo=true` | Simulate fall, reset, detector HUD |
| `/responder/incident/:id/copilot` | Phone Gemini Live + Presage chips + EMS report |
| `/responder/incident/:id/assessment` | Form, protocol, vitals, 3D guide, complete |

## Demo facility

**Oakwood Senior Living** — rooms 201–206.

| Room | Resident | Source |
|------|----------|--------|
| 201 | Harold Jenkins | Demo clip |
| 202 | Doris Whitfield | Demo clip |
| 203 | Ernest Caldwell | Demo clip |
| 204 | Margaret Davis | Live camera |
| 205–206 | Unassigned | Board only |

Responders: Sarah Miller (CNA), John Lee (CNA), Linda Chen (RN), Marcus Reid (CNA).

## Team modules

| Module | Owner | Code | Status |
|--------|-------|------|--------|
| Fall detection | Person 1 | `lib/fall/`, camera wall | Integrated |
| Incident response | Person 2 | `lib/incidents/`, SSE, `/monitor` tabs | Integrated |
| Post-fall assessment | Person 3 | `lib/assessment/`, Gemini Live, Presage adapter, 3D | Integrated (vitals simulated) |

Architecture, contracts, and the integration checklist: **[PLAN.md](./PLAN.md)**.

- [Module 1 — Fall detection](./docs/module-1-fall-detection.md)
- [Module 2 — Incident response](./docs/module-2-incident-response.md)
- [Module 3 — Post-fall assessment](./docs/module-3-post-fall-assessment.md)
- [Phone camera → Presage bridge](./docs/phone-camera-presage-bridge.md)

This is a demonstration, not medical care. Fall scores and Presage numbers are heuristics / estimates.

# HeldCare

Senior-living emergency response for a three-person hackathon. A confirmed fall on the camera wall becomes a live incident, a dispatched responder, a phone-side Gemini copilot, contactless vitals, and an EMS handoff — without diagnosing.

`/` redirects to **`/monitor`**. Light theme by default; the header toggle persists in `localStorage`.

## Full workflow (multi-agent)

HeldCare is a **multi-agent pipeline**. Each agent has one job, its own model or runtime, and a typed handoff. No agent diagnoses. Shared state (`Incident` + `AssessmentState`) is the bus.

```text
┌─ 1. Fall Detection Agent ──────────────────────────────────────────┐
│  MediaPipe Pose (201–203 clips, 204 live) → features → state machine│
│  Output: one FallEvent                                              │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ POST /api/incidents/fall
┌─ 2. Incident Orchestrator ───▼─────────────────────────────────────┐
│  Create / claim / resolve. Fan-out over SSE to every dashboard tab  │
│  Output: Incident { id, roomId, resident, responder }               │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ accept → /copilot?room=…
┌─ 3. Bedside multi-agent loop (parallel) ───────────────────────────┐
│                                                                    │
│   Scene Copilot Agent          Presage Vitals Agent                │
│   Gemini Live audio+video      VitalsProvider.subscribe()          │
│   sees the room, hears CNA     initializing → … → available        │
│            │                              │                        │
│            │   latest pulse / breath      │                        │
│            ◄──────────────────────────────┘                        │
│            │                                                       │
│            │ function calls (same tool surface as interpret)       │
│            ├─► Context Agent      getIncidentContext               │
│            ├─► Protocol Agent     getProtocol                      │
│            ├─► Chart Agent        recordObservation                │
│            ├─► Problem Agent      recordProblem                    │
│            ├─► Visual Agent       showVisualGuide → 3D mannequin   │
│            └─► Closer Agent       completeAssessment               │
│                                                                    │
│   Form Interpreter Agent (mic on /assessment, not Live)            │
│   /api/assessment/interpret — up to 3 tool-calling turns           │
│   fallback: on-device parser if Gemini is down                     │
│                                                                    │
│   Shared AssessmentState: findings + Presage estimates             │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ Stop / Complete
┌─ 4. EMS Writer Agent ────────▼─────────────────────────────────────┐
│  /api/assessment/ems-report                                        │
│  Input: problems + Presage numbers + transcripts                   │
│  Gemini rewrites a situation script; numbers stay verbatim         │
│  Output: AssessmentResult → POST /api/incidents/:id/assessment     │
└────────────────────────────────────────────────────────────────────┘
```

How the agents actually call each other:

1. **Fall Detection Agent** (`lib/fall/`) watches every camera. A real collapse, a staged clip, or **`F`** emits exactly one `FallEvent`.
2. **Incident Orchestrator** (`lib/incidents/` + `/api/realtime/stream`) opens that room’s incident and pushes `incident_created` / `incident_responding` to Live cameras, Facility, and Responder.
3. Accepting a responder starts the **bedside loop** for **that room** (`/responder/incident/:id/copilot?room=…`).
4. **Scene Copilot Agent** (Gemini Live, `LIVE_SYSTEM_INSTRUCTION`) and **Presage Vitals Agent** run at the same time. Presage snapshots are written into `state.vitals`; the next Live turn is briefed with those estimates (`lib/gemini/live-config.ts`).
5. The copilot does **not** do the paperwork itself. It dispatches **specialist tool-agents** (`lib/gemini/tools.ts`): context, protocol, chart, problems, 3D guide, complete. The same specialists are used by the **Form Interpreter Agent** (`/api/assessment/interpret`, max 3 turns).
6. **EMS Writer Agent** is a separate Gemini call. It only rewrites language. It is forbidden to invent findings or change Presage numbers.
7. Demo reset: `/monitor?demo=true` → Clear all alerts.

### Judge path (two minutes)

```text
Laptop:  /monitor?demo=true
         Upload clips on 201–203 or stage a fall on 204 / press F
         Fall Agent → Orchestrator → red room on every tab
Phone:   same Next process via Cloudflare HTTPS
         Responder tab → accept → Allow Camera + Microphone → Start
         Copilot Agent + Presage Agent run together
         Speak what you see → tools save problems → Stop
         EMS Writer Agent builds the handoff
Laptop:  Facility + Responder already show the same incident
```

### Agent map

| Agent | Runtime | Handoff in | Handoff out |
|-------|---------|------------|-------------|
| Fall Detection | Browser pose + `lib/fall/` | Camera / clip frames | `FallEvent` |
| Incident Orchestrator | Server + SSE | `FallEvent` | `Incident`, tab updates |
| Scene Copilot | Gemini Live + `/api/assessment/live-token` | Incident, camera, mic, latest vitals | Spoken coach + tool calls |
| Form Interpreter | Gemini `generateContent` loop | Transcript + state | `AssessmentAction[]` |
| Context / Protocol / Chart / Problem / Visual / Closer | Function declarations | Copilot or interpreter tool call | `AssessmentState` fields, 3D, complete |
| Presage Vitals | `VitalsProvider.subscribe()` | Start measurement | Staged pulse / breath / signal |
| EMS Writer | Gemini rewrite + template fallback | State + transcripts + Presage | EMS script + `AssessmentResult` |
| Offline parser | `lib/gemini/local-parser.ts` | Transcript when Gemini is down | Same actions, `source: "local"` |

Shared contracts (do not change without the team):

- `FallEvent` — `lib/types/incident.ts`
- `Incident` — same file / in-memory store
- `AssessmentResult` / `AssessmentState` — `lib/assessment/types.ts`
- `VitalsProvider` — `lib/vitals/types.ts` (`start` / `stop` / `getLatest` / `subscribe`)
- Tool surface — `lib/gemini/tools.ts` (Live and interpret share it)

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

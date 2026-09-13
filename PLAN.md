# CareFall — Hackathon Project Plan

**CareFall** is a senior-living emergency-response system for a 3-person hackathon team. Each person owns one module. This document is the master plan: architecture, shared contracts, integration flow, and pointers to module specs.

---

## Team & Modules

| Person | Branch | Route(s) | Responsibility |
|--------|--------|----------|----------------|
| **Person 1** | `feature/fall-detection` | `/camera/204` | Camera → MediaPipe Pose → temporal fall detection → `FALL_DETECTED` |
| **Person 2** | `feature/incident-response` | `/dashboard`, `/responder` | Fall event → incident → dashboard → responder workflow → response time |
| **Person 3** | `feature/post-fall-assessment` | `/responder/incident/:id/assessment` | Arrival → assessment → Presage → Gemini → 3D guide → `AssessmentResult` |

### Out of scope (by design)

- Person 1: dashboard, responder UI, Gemini, Persona, Presage, 3D, auth, reports, multi-agent
- Person 2: MediaPipe, fall algorithm, Gemini Live, Presage, 3D, multi-agent
- Person 3: fall detection, room camera, facility dashboard, incident creation, dispatch, multi-agent

---

## System Flow

```text
[camera/204]                    [dashboard]              [responder]
Person 1                        Person 2                 Person 2 + 3
     │                               │                        │
     │  reportFall(FallEvent)        │                        │
     ├──────────────────────────────►│ POST /api/incidents/fall
     │                               │                        │
     │                               ├── realtime ───────────►│ alert + RESPOND
     │                               │                        │
     │                               │◄── accept / arrive ────┤
     │                               │                        │
     │                               │                        ├──► /assessment
     │                               │                        │         Person 3
     │                               │◄── AssessmentResult ───┤
     │                               │                        │
     │                               └── resolve, reset demo  │
```

---

## Tech Stack (shared)

| Layer | Choices |
|-------|---------|
| Framework | Next.js, React, TypeScript |
| Styling | Tailwind CSS, shadcn/ui (if installed), Framer Motion |
| Fall detection | `@mediapipe/tasks-vision`, browser MediaDevices, Web Worker |
| Backend | Next.js API routes, Prisma, SQLite, Zod |
| Realtime | WebSocket **or** SSE (Person 2 chooses one) |
| Assessment AI | Gemini Live / Google GenAI SDK, function calling |
| Vitals | Presage adapter (`mock` \| `live`) |
| 3D | three, @react-three/fiber, @react-three/drei |

**Do not add:** Python, TensorFlow, PyTorch, YOLO, OpenCV, FastAPI (unless repo already requires), LangChain, ADK, vector DB, Unity, WebXR.

---

## Shared Contracts

### `FallEvent` (Person 1 → Person 2)

```ts
export type FallEvent = {
  type: "FALL_DETECTED";
  roomId: string;
  residentId: string;
  timestamp: number;
  confidence: number;

  evidence?: {
    torsoAngle?: number;
    hipVelocity?: number;
    aspectRatio?: number;
    persistenceMs?: number;
  };
};
```

- Person 1 calls `reportFall(event)` — initially `console.log`, later `POST /api/incidents/fall`
- Person 2 validates with Zod at `POST /api/incidents/fall`
- **Do not change this shape without team coordination**

### `Incident` (Person 2 owns lifecycle)

```ts
export type IncidentStatus =
  | "detected"
  | "responding"
  | "arrived"
  | "assessing"
  | "resolved";

export type Incident = {
  id: string;
  roomId: string;
  residentId: string;
  status: IncidentStatus;
  fallConfidence: number;
  detectedAt: number;
  responderId?: string;
  acceptedAt?: number;
  arrivedAt?: number;
  resolvedAt?: number;
  responseSeconds?: number;
};
```

### `AssessmentResult` (Person 3 → Person 2)

```ts
export type AssessmentResult = {
  incidentId: string;
  responsive?: boolean;
  reportedConcern?: string;
  visibleConcern?: string;
  vitals?: {
    pulse?: number;
    respiration?: number;
    signalQuality?: string;
  };
  completedAt: number;
};
```

- Person 3 submits to `POST /api/incidents/:id/assessment` (Person 2 implements endpoint)
- **Do not change this shape without team coordination**

---

## Demo Facility Data

| Field | Value |
|-------|-------|
| Facility | Oakwood Senior Living |
| Rooms | 201, 202, 203, **204**, 205, 206 |
| Room 204 resident | Margaret Davis (`residentId: "margaret"`) |
| Responder | Sarah Miller, CNA, Floor 2, verified, available (`responderId: "sarah"`) |

---

## API Surface (Person 2 owns)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/incidents/fall` | Ingest `FallEvent`, create incident (duplicate-safe) |
| POST | `/api/incidents/:id/accept` | Responder accepts |
| POST | `/api/incidents/:id/arrive` | Responder arrived, stop response timer |
| POST | `/api/incidents/:id/assessment` | Person 3 assessment result |
| POST | `/api/incidents/:id/resolve` | Close incident |

Realtime events (approximate): `incident_created`, `incident_updated`, `responder_notified`, `responder_accepted`, `responder_arrived`, `assessment_updated`, `incident_resolved`.

---

## Database (Person 2 — Prisma + SQLite)

Minimum models: `Room`, `Resident`, `Responder`, `Incident`, `IncidentEvent`, `Assessment`

`IncidentEvent` values: `FALL_DETECTED`, `INCIDENT_CREATED`, `RESPONDER_NOTIFIED`, `RESPONDER_ACCEPTED`, `RESPONDER_ARRIVED`, `ASSESSMENT_STARTED`, `ASSESSMENT_COMPLETED`, `INCIDENT_RESOLVED`

---

## Integration Checklist

### Person 1 → Person 2

- [ ] `reportFall()` switched from log to `POST /api/incidents/fall`
- [ ] Duplicate protection: one event per fall (Person 1 state machine + Person 2 active-incident check)
- [ ] Room 204 / resident `margaret` IDs match seed data

### Person 2 → Person 3

- [ ] Arrive flow redirects to `/responder/incident/:id/assessment`
- [ ] Assessment endpoint accepts `AssessmentResult`
- [ ] Timeline shows assessment events from `IncidentEvent`

### Demo mode (`?demo=true`)

- [ ] Person 1: manual `F` key triggers same `reportFall()`
- [ ] Person 2: `SIMULATE FALL` + `RESET DEMO` buttons
- [ ] Person 3: mock incident until real `incidentId` available

---

## End-to-End Demo Script (target)

```text
1. Dashboard: 6 rooms normal
2. Fall detected (camera or SIMULATE FALL / F key)
3. Room 204 → RED, timer starts, alert sound
4. Responder phone: FALL DETECTED → RESPOND
5. Dashboard: Sarah responding (yellow)
6. I'M WITH RESIDENT → timer stops, response time shown
7. Assessment page opens
8. Responsiveness, Presage mock, Gemini/form, 3D guide
9. COMPLETE ASSESSMENT → AssessmentResult
10. RESET DEMO → ready for next judge run
```

---

## Git Strategy

Each person works on their feature branch. Suggested commit cadence:

**Person 1:** `feat: add room camera` → mediapipe → fall features → state machine → event contract → manual demo trigger

**Person 2:** seed data → incident models → fall API → dashboard → realtime → responder flow → response time → timeline → demo reset

**Person 3:** assessment page → types → vitals abstraction → mock presage → gemini → protocol → 3D guide → assessment result

Merge order recommendation: Person 2 foundation (types, DB, APIs) first, then Person 1 + Person 3 in parallel.

---

## Module Specifications

Full detailed specs live in:

- [Module 1 — Fall Detection + Room Camera](./docs/module-1-fall-detection.md)
- [Module 2 — Incident Response Workflow](./docs/module-2-incident-response.md)
- [Module 3 — Post-Fall Assessment](./docs/module-3-post-fall-assessment.md)

---

## Definition of Done (project)

| Module | Key deliverable |
|--------|-----------------|
| Person 1 | `reportFall(FallEvent)` fires **once** on real/staged fall; sitting/bending do not spam events |
| Person 2 | A `FallEvent` causes immediate, visible, real-time workflow through responder arrival |
| Person 3 | Given an `incidentId`, responder completes assessment and returns one clean `AssessmentResult` |

---

## File Ownership (avoid conflicts)

```text
Person 1                          Person 2                         Person 3
─────────────────────────────────────────────────────────────────────────────
app/camera/204/                   app/dashboard/                   app/responder/incident/[id]/assessment/
lib/fall/                         app/responder/                   lib/assessment/
                                  app/api/incidents/               lib/vitals/
                                  lib/incidents/                   lib/gemini/
                                  prisma/                          lib/protocol/
                                  lib/realtime/                    components/assessment/
                                  shared: types/fall-event.ts*     components/3d/
```

`*` Shared types: coordinate in `lib/types/` or agree on single source before merge.

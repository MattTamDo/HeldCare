# Module 2 — Incident Response Workflow

**Owner:** Person 2  
**Branch:** `feature/incident-response`  
**Primary routes:** `/dashboard`, `/responder`

## Responsibility

> `FALL_DETECTED` → incident → facility dashboard → responder notification → RESPOND → I'M WITH RESIDENT → response-time measurement → assessment handoff.

## Do NOT build

MediaPipe internals, fall-detection algorithm, Gemini Live, Presage, 3D guidance, multi-agent system.

Mock buttons/events OK until teammates finish.

---

## Tech stack

Next.js, TypeScript, Tailwind, shadcn/ui (if installed), Framer Motion, Prisma, SQLite, Zod, WebSocket or SSE, date-fns, optional Zustand.

Keep infrastructure simple — no separate FastAPI unless repo already requires it.

---

## Role in integration

- **Consumes** `FallEvent` from Person 1 → creates `Incident`
- **Hands off** `incidentId` to Person 3 after responder arrives
- **Owns** shared incident lifecycle, DB schema, core API, realtime architecture

---

## Incident model

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

---

## Seed data

**Facility:** Oakwood Senior Living  
**Rooms:** 201–206  
**Room 204:** Margaret Davis  
**Responder:** Sarah Miller, CNA, Floor 2, verified, available

---

## Database (Prisma + SQLite)

Models: `Room`, `Resident`, `Responder`, `Incident`, `IncidentEvent`, `Assessment`  
Optional: `VitalMeasurement`

`IncidentEvent` types: `FALL_DETECTED`, `INCIDENT_CREATED`, `RESPONDER_NOTIFIED`, `RESPONDER_ACCEPTED`, `RESPONDER_ARRIVED`, `ASSESSMENT_STARTED`, `ASSESSMENT_COMPLETED`, `INCIDENT_RESOLVED`

---

## Dashboard — `/dashboard`

Six room cards (201–206). Room 204 shows "Margaret".

Header:

```text
CareFall — Facility Command Center
System Online ● | 6 Rooms | 0 Active Incidents
```

### Room state visuals

| State | Display |
|-------|---------|
| Normal | ● NORMAL |
| Fall | 🔴 FALL DETECTED + timer |
| Responding | 🟡 RESPONDER EN ROUTE + Sarah Miller ✓ Verified + timer |
| Arrived | 🟠 ASSESSMENT IN PROGRESS + response time |
| Resolved | ✓ INCIDENT RESOLVED + response time |

Emergency red **only** for active fall. Transitions must be visually obvious.

---

## Simulate fall (dev)

Button: **SIMULATE FALL** — constructs real `FallEvent`, sends through real API. Hide behind `?demo=true` later.

```ts
const simulatedFall: FallEvent = {
  type: "FALL_DETECTED",
  roomId: "204",
  residentId: "margaret",
  timestamp: Date.now(),
  confidence: 0.91
};
```

---

## POST `/api/incidents/fall`

1. Validate with Zod  
2. If active unresolved incident in room → return existing (duplicate protection)  
3. Else create Incident + IncidentEvent  
4. Mark room status fall  
5. Notify realtime subscribers + responder UI  

---

## Realtime

WebSocket **or** SSE — pick one, don't overengineer.

Subscribers: dashboard, responder page.

Events: `incident_created`, `incident_updated`, `responder_notified`, `responder_accepted`, `responder_arrived`, `assessment_updated`, `incident_resolved`

Clients update **without refresh**.

---

## Alert UX

- Brief alert tone on fall (respect autoplay)
- Room 204 card pulses
- Timer from `detectedAt`
- Timer runs while `detected` or `responding`
- Timer stops at `arrivedAt`
- `responseSeconds = (arrivedAt - detectedAt) / 1000`

---

## Responder — `/responder`

Mobile-first. Sarah Miller, CNA, ✓ Verified, ● AVAILABLE.

On fall:

```text
🚨 FALL DETECTED
Room 204 — Margaret Davis
Detected 00:07 ago
[ RESPOND ]
```

---

## POST `/api/incidents/:id/accept`

Payload: `{ "responderId": "sarah" }`

- `status = responding`, `acceptedAt = now`, `responderId = sarah`
- Event: `RESPONDER_ACCEPTED`
- Dashboard: 🟡 SARAH RESPONDING
- Responder: RESPONDING TO ROOM 204 + **[ I'M WITH RESIDENT ]**

---

## POST `/api/incidents/:id/arrive`

- `arrivedAt = now`, `status = arrived`
- Calculate response time
- Event: `RESPONDER_ARRIVED`
- Redirect to `/responder/incident/:id/assessment` (Person 3; placeholder OK until integrated)

---

## Timeline component

Source: `IncidentEvent` records.

Example:

```text
8:31:14 PM  Fall detected
8:31:15 PM  Sarah notified
8:31:21 PM  Sarah accepted
8:31:42 PM  Sarah arrived
```

Later: assessment started/completed, resolved.

---

## Incident detail

Click Room 204 → panel/page with incident ID, resident, confidence, status, response timer, responder, timeline.

---

## POST `/api/incidents/:id/assessment`

Person 3 sends `AssessmentResult`. Save assessment, add event, update dashboard, optionally resolve.

---

## POST `/api/incidents/:id/resolve`

`status = resolved`, `resolvedAt = now`. Responder → AVAILABLE. Room → normal or brief resolved state.

---

## RESET DEMO (`?demo=true`)

- Clear active demo incident
- Room 204 → normal
- Sarah → available
- Clear timer and timeline
- Repeatable for judges

---

## Demo flow (must work without Person 1 or 3)

```text
Dashboard normal
  → SIMULATE FALL
  → Room 204 RED + timer
  → Responder alert
  → RESPOND
  → Dashboard: Sarah responding
  → I'M WITH RESIDENT
  → Timer stops + response time
  → Assessment route opens
```

All updates realtime, no manual refresh.

---

## Definition of done

- [ ] Seed data + Prisma models
- [ ] Fall API with duplicate protection
- [ ] Dashboard with 6 rooms + state transitions
- [ ] Realtime updates
- [ ] Responder alert + accept + arrive
- [ ] Response timer metric
- [ ] Incident timeline
- [ ] Demo simulate + reset

**Most important:** A `FallEvent` causes immediate, visible, real-time response from dashboard alert through responder arrival.

---

## Suggested commits

```text
feat: add facility seed data
feat: add incident models
feat: create fall incident API
feat: build facility dashboard
feat: add realtime updates
feat: build responder alert flow
feat: calculate response time
feat: add incident timeline
feat: add demo reset
```

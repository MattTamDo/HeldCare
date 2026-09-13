# Module 3 — Post-Fall Assessment

**Owner:** Person 3  
**Branch:** `feature/post-fall-assessment`  
**Primary route:** `/responder/incident/:id/assessment`

## Responsibility

> Responder arrives → structured assessment → optional Presage contactless measurements → Gemini conversational interface → protocol-grounded guidance → 3D visual guide → `AssessmentResult`.

## Do NOT build

MediaPipe fall detection, room camera, facility dashboard, incident creation, responder dispatch, multi-agent architecture.

---

## Tech stack

Next.js, TypeScript, React, Tailwind, shadcn/ui (if installed), Gemini Live / Google GenAI SDK, function calling, three + R3F + drei, Presage adapter, Zod.

**No:** LangChain, ADK, vector DB, Unity, WebXR, complex medical AI.

---

## Independent development

Use mock incident until Person 2 integration:

```ts
const mockIncident = {
  id: "incident-demo-001",
  roomId: "204",
  resident: { id: "margaret", name: "Margaret Davis" },
  responder: { id: "sarah", name: "Sarah Miller", role: "CNA" },
  status: "arrived",
  detectedAt: Date.now() - 25000,
  arrivedAt: Date.now()
};
```

---

## Assessment screen

Mobile-first.

```text
POST-FALL ASSESSMENT
Margaret Davis — Room 204
Responder: Sarah Miller
```

### Fields

**Responsive?** — YES / NO / NOT RECORDED  

**Visible concern** — NONE OBSERVED / BLEEDING / OTHER  

**Reported concern** — text input + 🎤 Speak  

Do not ask for diagnoses. Good: "What concern does the resident report?"

---

## Assessment state

```ts
type AssessmentState = {
  responsive?: boolean;
  visibleConcern?: string;
  reportedConcern?: string;
  vitals?: {
    pulse?: number;
    respiration?: number;
    signalQuality?: string;
  };
  protocolStep?: string;
  visualKey?: string;
};
```

---

## AssessmentResult (integration contract)

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

Submit to `POST /api/incidents/:id/assessment` (Person 2). Initially `console.log(result)`.

**Do not change shape without coordinating with Person 2.**

---

## Presage architecture

Adapter pattern — must not block module:

```ts
export interface VitalsProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  getLatest(): Promise<{
    pulse?: number;
    respiration?: number;
    signalQuality?: string;
  }>;
}
```

Implementations: `MockVitalsProvider`, `PresageVitalsProvider`

Env: `PRESAGE_MODE=mock` | `PRESAGE_MODE=live`

### Mock flow

**START CONTACTLESS ASSESSMENT** → stages:

```text
Initializing camera… → Looking for signal… → Signal acquired → Measuring… → Measurement available
```

Display:

```text
CONTACTLESS MEASUREMENT
Pulse estimate: 78 bpm
Breathing estimate: 16/min
Signal quality: GOOD
```

Use "estimate / measurement / signal" — not "diagnosis / safe / healthy / normal".

---

## Gemini role

**One role:** hands-free conversational interface for structured assessment and protocol navigation.

- No multi-agent
- No diagnosis
- Transform speech → structured data via function calling

### Tools

- `recordObservation()`
- `getIncidentContext()`
- `getProtocol()`
- `showVisualGuide()`
- `completeAssessment()`

Example:

```ts
recordObservation({ responsive: true, reportedConcern: "left hip pain" });
```

### System instruction (summary)

CareFall Live — hands-free post-fall workflow assistant. Record observations, navigate demo protocol. Never diagnose, confirm fracture, prescribe, or invent procedures. Escalate per facility policy when protocol doesn't cover situation. Brief responses.

### UI

```text
CareFall Live ●
Listening…
```

Compact emergency UI — not giant chat bubbles.

---

## Protocol

Simple JSON: `data/demo-fall-protocol.json`

```json
{
  "name": "Demo Fall Response",
  "disclaimer": "Hackathon demonstration only. Not medical guidance.",
  "steps": [
    {
      "id": "responsiveness",
      "title": "Record responsiveness",
      "condition": "default",
      "instruction": "Record whether the resident is responsive.",
      "visualKey": "general"
    },
    {
      "id": "concern",
      "title": "Record reported concern",
      "condition": "reported_concern",
      "instruction": "Document the resident's reported concern and escalate according to facility protocol.",
      "visualKey": "body-region"
    },
    {
      "id": "escalation",
      "title": "Escalate",
      "condition": "requires_escalation",
      "instruction": "Notify the designated clinical staff according to facility policy.",
      "visualKey": "general"
    }
  ]
}
```

Deterministic JSON selection — no RAG/vector DB.

---

## 3D visual guidance

Procedural mannequin (simple shapes):

- head (sphere), torso (box/capsule), limbs (capsules), pelvis
- Regions: head, torso, left/right arm, pelvis, left/right leg
- Rotate, zoom, region highlight

If `reportedConcern = "left hip pain"` → `visualKey = "pelvis"`, highlight hip.

**Visual orientation only — not medical diagnosis.**

Optional later: phone camera background + transparent canvas ("Spatial Guidance" — not true AR).

---

## Screen flow

1. Responsive + concern form + START CONTACTLESS ASSESSMENT  
2. Vitals display  
3. Gemini live / manual form  
4. SHOW VISUAL GUIDE → 3D mannequin  
5. ASSESSMENT READY checklist → **COMPLETE ASSESSMENT**

---

## Fallback modes

| Failure | Fallback |
|---------|----------|
| Presage | Mock provider |
| Gemini | Manual form |
| Microphone | Text field |
| 3D | Assessment still completes |

No optional feature may block core assessment.

---

## Testing

1. Mock incident loads  
2. Manual assessment without Gemini  
3. Presage mock works  
4. Result object correct  
5. Gemini populates form if available  
6. Concern updates 3D region  
7. Complete produces `AssessmentResult`  
8. API failure doesn't crash  
9. Mobile layout works  

---

## Definition of done

```text
open mock incident
  → record responsiveness
  → start contactless assessment
  → see pulse / respiration
  → speak or type reported concern
  → structured observation appears
  → open 3D visual guide
  → complete assessment
  → produce AssessmentResult
```

**Most important:** Given an `incidentId`, responder completes entire post-fall assessment and returns one clean `AssessmentResult`.

---

## Suggested commits

```text
feat: add responder assessment page
feat: add assessment types
feat: add vitals provider abstraction
feat: add mock presage flow
feat: add gemini assessment interface
feat: add protocol navigation
feat: add 3d spatial guide
feat: emit assessment result
```

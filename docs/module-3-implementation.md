# Module 3 — Implementation notes

Implementation of [module-3-post-fall-assessment.md](./module-3-post-fall-assessment.md).
Branch `feature/post-fall-assessment`.

## Run it

```bash
npm install
npm run dev
# http://localhost:3000/responder/incident/incident-demo-001/assessment
```

No environment variables are required. `.env.example` lists the optional ones.

## What is here

| Path | Purpose |
|------|---------|
| `app/responder/incident/[id]/assessment/` | The assessment route |
| `app/api/assessment/interpret/` | Gemini function-calling endpoint |
| `lib/assessment/` | Types, state reducer, body-region mapping, incident load, submit |
| `lib/vitals/` | `VitalsProvider` interface, mock + Presage adapters |
| `lib/gemini/` | Tool declarations, system instruction, offline parser, client |
| `lib/protocol/` | Deterministic protocol step selection |
| `lib/speech/` | Web Speech API wrapper |
| `components/assessment/` | Form, vitals, live, protocol, completion panels |
| `components/3d/` | Procedural mannequin + visual guide overlay |
| `data/demo-fall-protocol.json` | The protocol, verbatim from the spec |

## Integration with Person 2

Two touch points, both optional — the screen works standalone without either.

**Incident load.** `loadIncident(id)` GETs `/api/incidents/:id`. On any failure it
falls back to the mock incident and the header shows `mock incident`. Once the
endpoint exists it should return a JSON object shaped like `AssessmentIncident`
(`lib/assessment/types.ts`); unknown fields are ignored and `id` is always taken
from the route.

**Result submit.** `COMPLETE ASSESSMENT` POSTs `AssessmentResult` to
`/api/incidents/:id/assessment`. The contract is unchanged from PLAN.md. If the
endpoint is missing the result is still logged, shown on screen, and the panel
says `held locally` — the assessment is never lost.

Person 2 does not need to change anything for the demo to run.

## Design decisions worth knowing

**Gemini is speech → structured data, not an agent.** One endpoint, one turn-based
tool loop (max 3 turns), temperature 0. `getIncidentContext` and `getProtocol` are
answered server-side; `recordObservation`, `showVisualGuide`, and
`completeAssessment` are returned to the client as actions it applies to the form.
The model never selects the protocol step — `selectStep()` is a pure function of
recorded state, so the model cannot invent or skip an instruction.

**Gemini Live was not used.** The spec calls for a hands-free conversational
interface; this uses the browser's Web Speech API for transcription plus
`generateContent` with function calling. That is far less fragile in a demo than a
bidirectional audio session, and it keeps the same tool surface. Swapping in the
Live API later means replacing the transport in `lib/gemini/client.ts` and the
speech hook — the tool declarations and action handling stay as they are.

**There is an offline parser.** With no `GEMINI_API_KEY`, or if the API call
fails, `parseTranscriptLocally()` extracts responsiveness, bleeding, and a body
part + pain phrase using rules. It handles the demo phrasings and is deliberately
narrow. The response says which path ran via `source: "gemini" | "local"`, and the
UI surfaces a note. This means the demo cannot be broken by a missing key, a rate
limit, or bad conference wifi.

**Presage is a stub, and says so.** `PresageVitalsProvider` holds the shape of the
live path — it does acquire the camera — but `beginMeasurement()` throws rather
than calling a guessed SDK surface. `NEXT_PUBLIC_PRESAGE_MODE` defaults to `mock`.
The mock runs the staged sequence from the spec and produces estimates around
78 bpm / 16 per min. **No real vitals are measured anywhere in this build.**

**Anatomical left, not screen left.** The mannequin faces the camera, so the
resident's left arm sits at world `+x` — the viewer's right. "Left hip pain"
highlights the resident's left. The guide says so on screen.

## Safety wording

The UI says *estimate*, *measurement*, *signal*, *reported concern*. It does not
say diagnosis, safe, healthy, normal, or fracture. The form asks what the resident
*reports*, never for a diagnosis. The system instruction forbids diagnosing,
prescribing, and inventing procedures, and directs escalation to facility policy.
The protocol disclaimer is shown on screen.

## Fallbacks

| Failure | Behaviour |
|---------|-----------|
| No Gemini key / API error | Offline parser, note shown |
| Interpret route unreachable | Parsed in the browser |
| Presage unavailable | Mock provider (the default) |
| No microphone / permission denied | Mic disables, text fields still work |
| WebGL unavailable | Error boundary message, assessment still completes |
| Incident API missing | Mock incident |
| Assessment endpoint missing | Result logged, shown, marked held locally |

Only responsiveness gates `COMPLETE ASSESSMENT`. Every other input is optional.

## Not built (out of scope per spec)

Fall detection, room camera, dashboard, incident creation, dispatch, multi-agent,
Persona, real Presage SDK, AR.

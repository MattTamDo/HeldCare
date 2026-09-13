# Module 1 — Fall Detection + Room Camera

**Owner:** Person 1  
**Branch:** `feature/fall-detection`  
**Primary route:** `/camera/204`

## Responsibility

> Camera → MediaPipe Pose → temporal fall detection → emit one standardized `FALL_DETECTED` event.

## Do NOT build

Dashboard, responder UI, Gemini, Persona, Presage, 3D guidance, authentication, reports, multi-agent logic.

---

## Target page

Monitor fictional resident **Margaret Davis**, **Room 204**.

- Browser webcam + MediaPipe Pose Landmarker
- Real-time body landmark tracking
- Temporal state machine (not `horizontal body = fall`)
- Emit **exactly one** fall event per fall episode

---

## Tech stack

- Next.js, React, TypeScript
- `@mediapipe/tasks-vision`
- Browser `MediaDevices` API, `<video>`, `<canvas>`
- Web Worker if feasible
- Custom TypeScript fall logic

**No:** Python, TensorFlow, PyTorch, YOLO, OpenCV.

---

## Camera

```ts
navigator.mediaDevices.getUserMedia({ video: true });
```

Requirements:

- Start Camera / Stop Camera
- Permission-error handling
- Display camera feed + pose skeleton overlay
- Chrome-compatible

---

## MediaPipe Pose

- Run inference ~10–15 FPS (not every render frame)
- Primary landmarks: nose, shoulders, hips, knees, ankles
- Center points: `shoulderCenter`, `hipCenter`, `kneeCenter`, `ankleCenter`
- Skip frames with low landmark visibility

---

## File structure

```text
lib/fall/
├── types.ts
├── config.ts
├── geometry.ts
├── fallFeatures.ts
├── fallStateMachine.ts
├── reportFall.ts
└── pose.worker.ts
```

Do not put all fall logic inside a React component.

---

## Features to calculate

### 1. Torso angle

`shoulderCenter → hipCenter` — ~0° vertical (standing), ~90° horizontal (fallen). Thresholds in `config.ts`.

### 2. Hip vertical velocity

Store `{ timestamp, hipY }`. MediaPipe Y increases downward.

```ts
velocityY = (currentHipY - previousHipY) / deltaTime;
```

Smooth across several frames. Large positive = rapid downward movement.

### 3. Body aspect ratio

```ts
width = maxX - minX;
height = maxY - minY;
aspectRatio = width / height;
```

Standing: height > width. Horizontal: width ≥ height. **Never use alone.**

### 4. Body vertical position

Track hip Y, shoulder Y, nose Y — fall moves body lower in frame.

### 5. Persistence

After possible fall, require fall-like posture **1200–1800 ms** before confirm.

---

## State machine

```ts
type FallState =
  | "UPRIGHT"
  | "DESCENDING"
  | "POSSIBLE_FALL"
  | "CONFIRMED_FALL";
```

### Transitions

```text
UPRIGHT → DESCENDING     (rapid downward movement or fast torso-angle change)
DESCENDING → POSSIBLE_FALL (multiple indicators: hip velocity, horizontal torso, aspect ratio, lower body)
DESCENDING → UPRIGHT     (recovery)
POSSIBLE_FALL → CONFIRMED_FALL (persistence timer satisfied)
POSSIBLE_FALL → UPRIGHT  (recovery)
```

### CONFIRMED_FALL

- Emit **ONE** `reportFall()` call
- No repeated events while person stays down
- Reset only after sustained upright recovery

---

## Fall confidence (0–1)

| Signal | Weight |
|--------|--------|
| Rapid downward movement | 0.30 |
| Horizontal torso | 0.25 |
| Body aspect ratio | 0.15 |
| Low body position | 0.15 |
| Persistence | 0.15 |

Suggested trigger: `confidence >= 0.70` (tune in testing). Hackathon score only — not medically validated.

---

## Event contract

```ts
reportFall({
  type: "FALL_DETECTED",
  roomId: "204",
  residentId: "margaret",
  timestamp: Date.now(),
  confidence: 0.91,
  evidence: {
    torsoAngle: 74,
    hipVelocity: 0.57,
    aspectRatio: 1.21,
    persistenceMs: 1480
  }
});
```

Initially log only; Person 2 replaces with `POST /api/incidents/fall`.

---

## Debug HUD

Show (toggleable): State, pose confidence, torso angle, hip velocity, aspect ratio, persistence, fall confidence, FPS.

Skeleton colors:

- Normal: **green**
- Descending / possible fall: **yellow**
- Confirmed fall: **red**

---

## Manual fallback

- Press **`F`** → same `reportFall(...)` (not a separate pathway)
- Optional: `?demo=true`

---

## Test cases

1. Walk normally → no fall  
2. Stand still → no fall  
3. Bend down → no fall  
4. Sit down normally → ideally no fall  
5. Rapid staged fall + remain down → fall  
6. Fall then quickly recover → possible fall then recovery  
7. Remain on floor → **only one event**  
8. Stand up afterward → detector resets  

---

## UI (judge-ready)

```text
ROOM 204
Margaret Davis

[ LIVE CAMERA ]

● MONITORING

Pose detected
Fall score: 12%

Developer diagnostics
...
```

On confirm:

```text
🔴 FALL DETECTED
Confidence: 91%
```

---

## Definition of done

- [ ] Camera works
- [ ] MediaPipe skeleton works
- [ ] Pose data smooth enough
- [ ] State machine works
- [ ] Staged fall emits one event
- [ ] Sitting/bending do not constantly trigger
- [ ] Event matches shared contract
- [ ] `F` fallback works
- [ ] Detector resets correctly
- [ ] Code clean for Person 2 to consume

**Most important:** `reportFall(FallEvent)` fires once when a real/staged fall is detected.

---

## Suggested commits

```text
feat: add room camera
feat: add mediapipe pose
feat: calculate fall features
feat: implement fall state machine
feat: add fall event contract
feat: add manual demo trigger
```

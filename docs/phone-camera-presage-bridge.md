# Phone Camera to Presage Bridge

This app now includes a local WebRTC bridge for using an iPhone as the live
camera source for the assessment flow.

## What Was Added

- `components/phone-camera/host-camera-bridge.tsx`: creates a host WebRTC
  offer, shows a pairing URL, receives the iPhone video track, and exposes the
  resulting `MediaStream` through `onStream`.
- `app/phone-camera/[sessionId]/page.tsx`: phone-facing capture page.
- `app/api/phone-camera/[sessionId]/route.ts`: small in-memory signaling API for
  local Electron/Next development.

The phone page requests camera constraints of 1920x1080 at 30 FPS, video only:

```ts
navigator.mediaDevices.getUserMedia({
  audio: false,
  video: {
    facingMode: "user",
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { min: 30, ideal: 30 },
  },
});
```

## Presage SDK Handoff

The app reads `SMARTSPECTRA_API_KEY` on the server via
`/api/runtime-config` and uses it to mark the SmartSpectra backend as
configured in the contactless health platform UI. The key is intentionally not
returned to the browser.

The verified Node.js SDK API is native/Node-side, not browser-side. The app must
not import `@smartspectra/node-sdk` in a Next client component. Use one of these
bridges instead:

- `npm run presage:camera-bridge`: opens the Mac camera with
  `SmartSpectraSDK.useCamera()` and posts decoded metrics into
  `/api/mobile-health/:sessionId`.
- Expo/iOS native bridge: uses the native SmartSpectra SDK on the phone and
  posts the same mobile-health payload shape.
- Electron renderer bridge: can use `@smartspectra/node-sdk/renderer` with
  `useMediaStream()` inside an Electron renderer, then forward metrics into the
  same app-level `Vitals` shape.

The current browser `PresageVitalsProvider` remains a guard rail: it does not
pretend the native Node SDK can run in the browser.

## Metrics Mapping

The app's shared `Vitals` type now has slots for the SmartSpectra metric groups:

- `metrics.breathing.rate.at(-1).value` -> `vitals.respiration`
- `metrics.cardio.pulseRate.at(-1).value` -> `vitals.pulse`
- `metrics.cardio.arterialPressureTrace.map((m) => m.value)` ->
  `vitals.pressureWaveform`
- `metrics.cardio.hrv.at(-1)` -> `vitals.hrv`
- `metrics.face.blinking/talking/expression/landmarks` -> `vitals.face`

When the SDK is wired, request at least:

```ts
requestedMetrics: [...breathingMetrics, ...cardioMetrics, ...faceMetrics]
```

Cardio and face fields can stay empty if the subscription does not authorize
them. Treat persistent empties as an authorization/configuration issue before
assuming poor signal quality.

## iPhone / Expo / SwiftUI Notes

For the fastest prototype, the included phone page runs in mobile Safari. iOS
requires camera access from HTTPS, except on localhost. For physical iPhone
testing, run the desktop host with a trusted local HTTPS tunnel or Electron
development certificate.

## Cloudflare Tunnel + LiveKit iPhone Link

When `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` are configured,
the phone pairing link switches from local WebRTC signaling to LiveKit. The
iPhone publishes its camera track to a LiveKit room over WSS, and the responder
screen subscribes to that track and exposes it as a `MediaStream` for the
SmartSpectra handoff.

For iPhone testing, expose the Next app through Cloudflare Tunnel:

```bash
npm run dev
cloudflared tunnel --url http://localhost:3000
```

Copy the generated `https://...trycloudflare.com` URL into `.env`:

```bash
CLOUDFLARE_TUNNEL_URL=https://your-tunnel.trycloudflare.com
```

Then open the assessment page locally and click `USE PHONE CAMERA` -> `NEW LINK`.
The generated iPhone URL will use the Cloudflare HTTPS origin and include:

- `transport=livekit` when LiveKit is configured
- `code=<LIVEKIT_ACCESS_CODE>` when an access code is set

This avoids iOS camera failures from insecure LAN URLs and avoids peer-to-peer
NAT issues by routing the phone track through LiveKit.

For an Expo/SwiftUI-grade version:

- Use Expo as the shell and `expo-camera` or a native SwiftUI camera module for
  capture control.
- Use `react-native-webrtc` for the same offer/answer/candidate exchange.
- Keep the signaling API shape unchanged so the Electron/Next host does not
  care whether the phone client is Safari, Expo, or native SwiftUI.

## Connected Environment Variables

- `SMARTSPECTRA_API_KEY`: enables the SmartSpectra-ready run-mode state.
- `LIVEKIT_URL`: returned with minted LiveKit tokens so clients can connect.
- `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`: used server-side to sign LiveKit
  access tokens at `POST /api/livekit/token`.
- `LIVEKIT_ACCESS_CODE`: optional pairing guard for token requests.

## Headless Smoke Test

The SmartSpectra SDK can be tested without a browser, display, or camera by
feeding a recorded video file through `useFile()`.

Run:

```bash
npm run smartspectra:smoke -- ./test-assets/face.mp4
```

Use a 30-60 second, well-lit, mostly still face clip. The smoke test only
asserts that pulse and breathing readings appear; it does not assert exact
medical values.

Useful smoke-test environment knobs:

- `SMARTSPECTRA_LOG_LEVEL=debug|info|warning|error|none`
- `SMARTSPECTRA_ENABLE_TELEMETRY=0` to opt out during local/CI runs
- `SMARTSPECTRA_FACE_METRICS=1` to include face metrics in the request
- `SMARTSPECTRA_SMOKE_TIMEOUT_MS=120000`
- `SMARTSPECTRA_SMOKE_MAX_DURATION_MS=30000`
- `SMARTSPECTRA_SMOKE_INTERFRAME_DELAY_MS=0`

## Live Mac Camera Bridge

The verified live-camera path uses the Node SDK API:

```js
sdk.useCamera({ deviceIndex: 0, width: 1280, height: 720, fps: 30 });
sdk.start();
```

Start the Next app first:

```bash
npm run dev
```

Then start the bridge in another terminal:

```bash
SMARTSPECTRA_BRIDGE_SESSION_ID=mac-camera npm run presage:camera-bridge
```

The bridge posts real SmartSpectra vitals to:

```text
/api/mobile-health/mac-camera
```

To view those metrics in the responder UI today, use the phone-camera panel's
health session polling path with a matching session ID, or set the Expo app to
the same session. For quick verification without the web UI, run:

```bash
npm run tests:camera
```

That command opens the Mac camera and waits long enough for pulse, respiration,
pressure waveform, and HRV samples.

## Electron SmartSpectra App Path

The preferred app-integrated path is Electron, because the SmartSpectra SDK is a
Node/native SDK. Browser-only Next.js cannot import `@smartspectra/node-sdk`
directly. The Electron shell wires the official SDK IPC path:

- `electron/main.cjs` creates a `BrowserWindow` and calls
  `bindSmartSpectraIpc(win)`.
- `electron/preload.cjs` loads `@smartspectra/node-sdk/preload` and exposes the
  local SmartSpectra API key plus metric bundles to the renderer.
- `PresageVitalsProvider` detects `window.__carefallElectron`, imports
  `@smartspectra/node-sdk/renderer`, sends frames to Electron main, decodes
  metric packets, and emits the same `VitalsSnapshot` shape as the rest of the
  app.

Run:

```bash
npm run dev
```

In another terminal:

```bash
npm run electron:dev
```

Then open Health Vital and use the laptop camera path. In Electron, the
`CONTACTLESS MEASUREMENT` Start button uses the real SmartSpectra SDK instead
of the mock provider. In a normal browser, the app must still use the Node
camera bridge or mock mode.

For the live engine adapter, wire SDK events into `VitalsSnapshot` this way:

- `processingStatus` -> `processingStatus` and `stage`
- `validationStatus(code, ts, hint)` -> `validationCode` + `validationHint`
- `error(code, message, retryable)` -> `errorCode` + `error` + `retryable`
- `metrics(buf)` -> decode with `@smartspectra/node-sdk/messages`, then map
  through `vitalsFromSmartSpectraMetrics()`
- Prefer `stopAsync()` and always await `destroy()` before replacing an SDK
  instance; the API notes native SDK state is process-global.

## Production Considerations

The included signaling store is process-local and expires sessions after 15
minutes. That is appropriate for local Electron development, but production
should use a real signaling backend with short-lived pairing tokens, TLS, and
explicit session ownership.

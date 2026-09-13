# CareFall Vitals Mobile

Expo/TypeScript version of the Presage SmartSpectra iOS vitals demo.

This app mirrors the SwiftUI sample:

- status and validation chips
- camera preview
- pulse rate and breathing rate confidence colors
- HRV RMSSD and expression cards
- arterial pressure waveform
- chest and abdomen breathing waveforms

## Storage-safe default

The default path does not generate an `ios/` folder and does not require Xcode
package resolution. It runs the screen in Expo Go with mock vitals so you can
review the TypeScript UI without filling local storage.

```sh
cd mobile
npm install
npm run start
```

Open the QR code with Expo Go.

## Connect To CareFall Platform

The Expo phone tracker can sync its current vitals back to the CareFall web
platform over your Cloudflare URL. In the responder web app, open Health Vital,
choose **Use Phone Camera**, and click **New Link**. Use the displayed session
ID when starting Expo:

```sh
cd mobile
EXPO_PUBLIC_CAREFALL_PLATFORM_URL=https://your-tunnel.trycloudflare.com \
EXPO_PUBLIC_CAREFALL_SESSION_ID=your-session-id \
npm run start:phone -- --clear
```

When the phone camera is active, the tracker posts pulse, respiration, signal
quality, pressure waveform, HRV, and face analysis to:

```text
/api/mobile-health/:sessionId
```

The responder panel polls that endpoint and updates the Contactless Measurement
numbers from the phone.

## Native SmartSpectra path

SmartSpectra is a native iOS SDK, so real Presage measurements cannot run inside
Expo Go. Use this path only when you are ready to build the native bridge.

```sh
cd mobile
npm install
EXPO_PUBLIC_SMARTSPECTRA_API_KEY=your_key npm run prebuild:native
```

After prebuild, add the Presage Swift package to the generated iOS project:

1. Open `ios/CareFallVitals.xcworkspace` in Xcode.
2. Add `https://github.com/Presage-Security/SmartSpectra` as a package dependency.
3. Pin a released version such as `3.0.0` or the version Presage recommends.
4. Attach it to the app target.
5. Run on a physical iPhone, not the simulator.

Then run:

```sh
EXPO_PUBLIC_SMARTSPECTRA_API_KEY=your_key npm run ios:native
```

The native bridge lives at `modules/smartspectra/ios/SmartSpectraModule.swift`.
It configures the same requested metrics as the iOS demo:

- breathing metrics
- cardio metrics
- expressions

If the app shows the missing bridge warning in a native build, rebuild the dev
client after adding the native package.

## Storage note

The native path can create a large generated `ios/` folder, Swift Package cache,
and Xcode DerivedData. Keep using `npm run start` until you specifically need
real SmartSpectra readings from a physical iPhone.

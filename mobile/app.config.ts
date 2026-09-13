import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "CareFall Vitals",
  slug: "carefall-vitals",
  scheme: "carefall-vitals",
  version: "0.1.0",
  orientation: "portrait",
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.carefall.vitals",
    infoPlist: {
      NSCameraUsageDescription: "This app needs camera access to measure vitals.",
    },
  },
  plugins: [
    "expo-dev-client",
    [
      "expo-camera",
      {
        cameraPermission: "CareFall uses the camera to monitor contactless vitals.",
      },
    ],
  ],
  extra: {
    smartSpectraApiKey: process.env.EXPO_PUBLIC_SMARTSPECTRA_API_KEY ?? "",
    careFallPlatformUrl: process.env.EXPO_PUBLIC_CAREFALL_PLATFORM_URL ?? "",
    careFallSessionId: process.env.EXPO_PUBLIC_CAREFALL_SESSION_ID ?? "",
  },
};

export default config;

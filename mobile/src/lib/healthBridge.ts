import type { SmartSpectraSnapshot } from "../types/vitals";

export type CareFallVitals = {
  pulse?: number;
  respiration?: number;
  signalQuality?: string;
  pressureWaveform?: number[];
  hrv?: {
    rmssd?: number;
    confidence?: number;
    stable?: boolean;
  };
  face?: {
    expression?: string;
  };
  packets?: number;
};

export type HealthBridgeConfig = {
  platformUrl: string;
  sessionId: string;
};

export function vitalsFromSnapshot(
  snapshot: SmartSpectraSnapshot,
  packets: number,
): CareFallVitals {
  const confidence = snapshot.pulseRate?.confidence;

  return {
    pulse: snapshot.pulseRate?.value
      ? Math.round(snapshot.pulseRate.value)
      : undefined,
    respiration: snapshot.breathingRate?.value
      ? Math.round(snapshot.breathingRate.value)
      : undefined,
    signalQuality:
      confidence !== undefined ? `${Math.round(confidence)}%` : undefined,
    pressureWaveform: snapshot.arterialPressureTrace,
    hrv: snapshot.hrvRmssd
      ? {
          rmssd: Number(snapshot.hrvRmssd.toFixed(1)),
          confidence: snapshot.pulseRate?.confidence
            ? snapshot.pulseRate.confidence / 100
            : undefined,
          stable: snapshot.validation.code === "ok",
        }
      : undefined,
    face: snapshot.expression
      ? {
          expression: `${snapshot.expression.label} ${Math.round(snapshot.expression.confidence)}%`,
        }
      : undefined,
    packets,
  };
}

export async function postHealthSnapshot({
  config,
  snapshot,
  packets,
  cameraFacing,
  source,
}: {
  config: HealthBridgeConfig;
  snapshot: SmartSpectraSnapshot;
  packets: number;
  cameraFacing: "front" | "back";
  source: "expo-presage" | "expo-mock";
}) {
  const baseUrl = config.platformUrl.replace(/\/$/, "");
  const response = await fetch(
    `${baseUrl}/api/mobile-health/${encodeURIComponent(config.sessionId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vitals: vitalsFromSnapshot(snapshot, packets),
        source,
        cameraFacing,
        processingStatus: snapshot.processingStatus,
        validation: snapshot.validation,
        capturedAt: Date.now(),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Health bridge failed with ${response.status}`);
  }
}

import type { Vitals } from "@/lib/assessment/types";

type Measurement = {
  value?: number;
};

type HrvMetric = {
  rmssd?: number;
  meanNn?: number;
  sdnn?: number;
  baevsky?: number;
  confidence?: number;
  stable?: boolean;
};

type DecodedSmartSpectraMetrics = {
  breathing?: {
    rate?: Measurement[];
    upperTrace?: Measurement[];
    lowerTrace?: Measurement[];
  };
  cardio?: {
    pulseRate?: Measurement[];
    arterialPressureTrace?: Measurement[];
    hrv?: HrvMetric[];
  };
  face?: {
    landmarks?: unknown[];
    blinking?: Array<{ detected?: boolean }>;
    talking?: Array<{ detected?: boolean }>;
    expression?: Array<{ value?: string; label?: string; expression?: string }>;
  };
};

function last<T>(items?: T[]): T | undefined {
  return items?.at(-1);
}

function cleanNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Maps the generated SmartSpectra protobuf object into the compact app-level
 * vitals model. Keep this SDK-shape handling here so UI/provider code does not
 * learn every protobuf field name.
 */
export function vitalsFromSmartSpectraMetrics(
  metrics: DecodedSmartSpectraMetrics,
  previous: Vitals = {},
): Vitals {
  const pulse = cleanNumber(last(metrics.cardio?.pulseRate)?.value);
  const respiration = cleanNumber(last(metrics.breathing?.rate)?.value);
  const pressureWaveform = metrics.cardio?.arterialPressureTrace
    ?.map((sample) => cleanNumber(sample.value))
    .filter((value): value is number => value !== undefined);
  const hrv = last(metrics.cardio?.hrv);
  const expression = last(metrics.face?.expression);

  return {
    ...previous,
    pulse: pulse ?? previous.pulse,
    respiration: respiration ?? previous.respiration,
    pressureWaveform:
      pressureWaveform && pressureWaveform.length > 0
        ? pressureWaveform
        : previous.pressureWaveform,
    hrv: hrv
      ? {
          rmssd: cleanNumber(hrv.rmssd),
          meanNn: cleanNumber(hrv.meanNn),
          sdnn: cleanNumber(hrv.sdnn),
          baevsky: cleanNumber(hrv.baevsky),
          confidence: cleanNumber(hrv.confidence),
          stable: hrv.stable,
        }
      : previous.hrv,
    face:
      metrics.face?.landmarks || metrics.face?.blinking || metrics.face?.talking || expression
        ? {
            blinking: last(metrics.face?.blinking)?.detected,
            talking: last(metrics.face?.talking)?.detected,
            expression:
              expression?.value ?? expression?.label ?? expression?.expression,
            landmarksCount: metrics.face?.landmarks?.length,
          }
        : previous.face,
    packets: (previous.packets ?? 0) + 1,
  };
}

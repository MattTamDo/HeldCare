import { MockVitalsProvider } from "./mock-provider";
import { PresageVitalsProvider } from "./presage-provider";
import type { VitalsMode, VitalsProvider } from "./types";

export * from "./types";
export { MockVitalsProvider } from "./mock-provider";
export { PresageVitalsProvider } from "./presage-provider";

/**
 * Configured via `NEXT_PUBLIC_PRESAGE_MODE=mock | live` (the provider runs in
 * the browser, so the value has to be public). Anything other than "live"
 * selects the mock.
 */
export function configuredVitalsMode(): VitalsMode {
  if (
    typeof window !== "undefined" &&
    (window as typeof window & { __carefallElectron?: { isElectron?: boolean } })
      .__carefallElectron?.isElectron
  ) {
    return "live";
  }
  return process.env.NEXT_PUBLIC_PRESAGE_MODE === "live" ? "live" : "mock";
}

export function createVitalsProvider(
  mode: VitalsMode = configuredVitalsMode(),
): VitalsProvider {
  return mode === "live" ? new PresageVitalsProvider() : new MockVitalsProvider();
}

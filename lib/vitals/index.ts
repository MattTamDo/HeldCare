import { MockVitalsProvider } from "./mock-provider";
import type { VitalsMode, VitalsProvider } from "./types";

export * from "./types";
export { MockVitalsProvider } from "./mock-provider";

/**
 * Tonight's build always simulates vitals. Live Presage / Electron / LiveKit
 * stay in the tree as unused reference code, but they are not on the demo path.
 */
export function configuredVitalsMode(): VitalsMode {
  return "mock";
}

export function createVitalsProvider(
  _mode: VitalsMode = configuredVitalsMode(),
): VitalsProvider {
  return new MockVitalsProvider();
}

import { EventEmitter, requireNativeModule } from "expo-modules-core";
import type { SmartSpectraSnapshot } from "../types/vitals";

type SmartSpectraNativeModule = {
  configure(options: {
    apiKey: string;
    cameraPosition?: "front" | "back";
    imageOutputEnabled?: boolean;
  }): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

const fallbackSnapshot: SmartSpectraSnapshot = {
  processingStatus: "idle",
  validation: { code: "waiting", label: "Waiting" },
  arterialPressureTrace: [],
  chestTrace: [],
  abdomenTrace: [],
};

let nativeModule: SmartSpectraNativeModule | null = null;

try {
  nativeModule = requireNativeModule<SmartSpectraNativeModule>("SmartSpectra");
} catch {
  nativeModule = null;
}

export const hasSmartSpectraNativeModule = Boolean(nativeModule);

export const SmartSpectra = {
  async configure(options: Parameters<SmartSpectraNativeModule["configure"]>[0]) {
    if (!nativeModule) return;
    await nativeModule.configure(options);
  },
  async start() {
    if (!nativeModule) return;
    await nativeModule.start();
  },
  async stop() {
    if (!nativeModule) return;
    await nativeModule.stop();
  },
  addSnapshotListener(listener: (snapshot: SmartSpectraSnapshot) => void) {
    if (!nativeModule) {
      listener(fallbackSnapshot);
      return { remove() {} };
    }

    const emitter = new EventEmitter(nativeModule as never) as any;
    return emitter.addListener("onSnapshot", listener);
  },
};

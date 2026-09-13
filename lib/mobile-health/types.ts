import type { Vitals } from "@/lib/assessment/types";

export type MobileHealthPacket = {
  sessionId: string;
  vitals: Vitals;
  source: "expo-presage" | "expo-mock" | "ios-presage" | "node-camera";
  cameraFacing?: "front" | "back";
  processingStatus?: string;
  validation?: {
    code: string;
    label: string;
  };
  capturedAt: number;
};

export type MobileHealthSession = {
  latest?: MobileHealthPacket;
  packets: number;
  updatedAt?: number;
};

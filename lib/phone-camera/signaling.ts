import type {
  PhoneCameraSignalRequest,
  PhoneCameraSessionState,
} from "./types";

export function createPhoneCameraSessionId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function phoneCameraPairingUrl(sessionId: string): string {
  return `${window.location.origin}/phone-camera/${sessionId}`;
}

export async function readPhoneCameraSession(
  sessionId: string,
): Promise<PhoneCameraSessionState> {
  const response = await fetch(`/api/phone-camera/${sessionId}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to read camera session.");
  return response.json() as Promise<PhoneCameraSessionState>;
}

export async function sendPhoneCameraSignal(
  sessionId: string,
  body: PhoneCameraSignalRequest,
): Promise<PhoneCameraSessionState> {
  const response = await fetch(`/api/phone-camera/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Unable to update camera session.");
  return response.json() as Promise<PhoneCameraSessionState>;
}

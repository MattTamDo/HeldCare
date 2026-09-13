export type LiveKitTokenResponse = {
  token: string;
  url: string;
};

export function liveKitRoomName(sessionId: string): string {
  return `carefall-phone-${sessionId}`;
}

export async function createLiveKitToken({
  room,
  identity,
  name,
  accessCode,
}: {
  room: string;
  identity: string;
  name?: string;
  accessCode?: string | null;
}): Promise<LiveKitTokenResponse> {
  const response = await fetch("/api/livekit/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room, identity, name, accessCode }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? `LiveKit token failed (${response.status})`);
  }

  return response.json() as Promise<LiveKitTokenResponse>;
}

export async function createPhonePairingLink(sessionId: string): Promise<{
  url: string;
  transport: "livekit" | "local";
  livekitUrl: string | null;
}> {
  const response = await fetch(
    `/api/phone-camera/link?sessionId=${encodeURIComponent(sessionId)}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Unable to create phone pairing link.");
  return response.json() as Promise<{
    url: string;
    transport: "livekit" | "local";
    livekitUrl: string | null;
  }>;
}

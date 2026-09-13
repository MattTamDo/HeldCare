"use client";

import { useEffect, useRef, useState } from "react";

import {
  createPhoneCameraSessionId,
  readPhoneCameraSession,
  sendPhoneCameraSignal,
} from "@/lib/phone-camera/signaling";
import {
  createLiveKitToken,
  createPhonePairingLink,
  liveKitRoomName,
} from "@/lib/phone-camera/livekit";
import type { Vitals } from "@/lib/assessment/types";
import type { PhoneCameraStatus } from "@/lib/phone-camera/types";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

function statusLabel(status: PhoneCameraStatus): string {
  return {
    idle: "Ready to pair",
    creating: "Creating link",
    waiting: "Waiting for iPhone",
    connecting: "Connecting",
    paired: "iPhone paired",
    connected: "iPhone video connected",
    failed: "Connection failed",
  }[status];
}

export default function HostCameraBridge({
  onStream,
  onMobileVitals,
  recordedVitals,
}: {
  onStream?: (stream: MediaStream) => void;
  onMobileVitals?: (vitals: Vitals) => void;
  recordedVitals?: Vitals;
}) {
  const [sessionId, setSessionId] = useState("");
  const [pairUrl, setPairUrl] = useState("");
  const [status, setStatus] = useState<PhoneCameraStatus>("idle");
  const [error, setError] = useState<string>();
  const [mobileHealthPackets, setMobileHealthPackets] = useState(0);
  const [mobileHealthUpdatedAt, setMobileHealthUpdatedAt] = useState<number>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const liveKitRoomRef = useRef<any>(null);
  const lastMetricsPayloadRef = useRef("");
  const remoteSetRef = useRef(false);
  const seenPhoneCandidates = useRef(0);

  useEffect(() => {
    return () => {
      pcRef.current?.close();
      liveKitRoomRef.current?.disconnect();
      pcRef.current = null;
      liveKitRoomRef.current = null;
    };
  }, []);

  async function publishMetricsToPhone(vitals = recordedVitals) {
    const room = liveKitRoomRef.current;
    if (!room || !vitals) return;

    const payload = JSON.stringify({
      type: "carefall.metrics",
      vitals,
      sentAt: Date.now(),
    });
    if (payload === lastMetricsPayloadRef.current) return;
    lastMetricsPayloadRef.current = payload;

    await room.localParticipant.publishData(new TextEncoder().encode(payload), {
      reliable: true,
      topic: "carefall.metrics",
    });
  }

  useEffect(() => {
    if (status !== "paired" && status !== "connected") return;
    void publishMetricsToPhone();
  }, [recordedVitals, status]);

  useEffect(() => {
    if (!sessionId) return;

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/mobile-health/${encodeURIComponent(sessionId)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const session = (await response.json()) as {
          latest?: { vitals?: Vitals };
          packets?: number;
          updatedAt?: number;
        };
        if (!session.latest?.vitals) return;

        setMobileHealthPackets(session.packets ?? 0);
        setMobileHealthUpdatedAt(session.updatedAt);
        onMobileVitals?.(session.latest.vitals);
      } catch {
        // Keep phone camera pairing resilient if the health bridge is not active.
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [onMobileVitals, sessionId]);

  async function startPairing() {
    pcRef.current?.close();
    liveKitRoomRef.current?.disconnect();
    liveKitRoomRef.current = null;
    lastMetricsPayloadRef.current = "";
    remoteSetRef.current = false;
    seenPhoneCandidates.current = 0;
    setError(undefined);
    setStatus("creating");

    const nextSessionId = createPhoneCameraSessionId();
    setSessionId(nextSessionId);
    const link = await createPhonePairingLink(nextSessionId);
    setPairUrl(link.url);

    if (link.transport === "livekit") {
      await startLiveKitHost(nextSessionId, link.url);
      return;
    }

    await sendPhoneCameraSignal(nextSessionId, { role: "host", kind: "reset" });

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.addTransceiver("video", { direction: "recvonly" });
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      if (videoRef.current) videoRef.current.srcObject = stream;
      onStream?.(stream);
      setStatus("connected");
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("connected");
      if (pc.connectionState === "failed") setStatus("failed");
    };
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      void sendPhoneCameraSignal(nextSessionId, {
        role: "host",
        kind: "candidate",
        candidate: event.candidate.toJSON(),
      });
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendPhoneCameraSignal(nextSessionId, {
      role: "host",
      kind: "offer",
      description: offer,
    });
    setStatus("waiting");
  }

  async function startLiveKitHost(nextSessionId: string, nextPairUrl: string) {
    setStatus("connecting");

    const accessCode = new URL(nextPairUrl).searchParams.get("code");
    const { Room, RoomEvent, Track } = await import("livekit-client");
    const token = await createLiveKitToken({
      room: liveKitRoomName(nextSessionId),
      identity: `host-${nextSessionId}`,
      name: "CareFall host",
      accessCode,
    });

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    liveKitRoomRef.current = room;

    room.on(RoomEvent.ParticipantConnected, () => {
      setStatus("paired");
      void publishMetricsToPhone(recordedVitals);
    });
    room.on(RoomEvent.TrackSubscribed, (track: any) => {
      if (track.kind !== Track.Kind.Video) return;
      if (videoRef.current) track.attach(videoRef.current);
      const stream = new MediaStream([track.mediaStreamTrack]);
      onStream?.(stream);
      setStatus("connected");
    });
    room.on(RoomEvent.ConnectionStateChanged, () => {
      if (room.state === "connected") {
        setStatus((current) =>
          current === "paired" || current === "connected" ? current : "waiting",
        );
      }
    });
    room.on(RoomEvent.Disconnected, () => {
      if (status !== "failed") setStatus("idle");
    });

    await room.connect(token.url, token.token);
    if ((room as any).remoteParticipants?.size > 0) {
      setStatus("paired");
      return;
    }
    setStatus("waiting");
  }

  useEffect(() => {
    if (!sessionId || status === "connected" || status === "failed") return;

    const timer = window.setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;

      try {
        const session = await readPhoneCameraSession(sessionId);

        if (session.answer && !remoteSetRef.current) {
          setStatus("connecting");
          await pc.setRemoteDescription(session.answer);
          remoteSetRef.current = true;
        }

        const newCandidates = session.phoneCandidates.slice(
          seenPhoneCandidates.current,
        );
        seenPhoneCandidates.current = session.phoneCandidates.length;
        for (const candidate of newCandidates) {
          await pc.addIceCandidate(candidate);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Phone pairing failed.");
        setStatus("failed");
      }
    }, 900);

    return () => window.clearInterval(timer);
  }, [sessionId, status]);

  return (
    <div className="rounded-xl border border-edge bg-panel-2 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-sky-300">
            IPHONE CAMERA
          </p>
          <p className="mt-1 text-xs text-slate-400">{statusLabel(status)}</p>
        </div>
        <button
          type="button"
          onClick={startPairing}
          className="shrink-0 rounded-lg border border-sky-400/40 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/15"
        >
          NEW LINK
        </button>
      </div>

      {pairUrl ? (
        <div className="mt-3 rounded-lg border border-edge bg-surface p-2">
          <p className="break-all text-xs text-slate-300">{pairUrl}</p>
          <div className="mt-2 rounded-lg border border-sky-400/20 bg-sky-500/10 p-2">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-sky-200">
              EXPO HEALTH BRIDGE
            </p>
            <p className="mt-1 break-all text-[11px] text-slate-400">
              EXPO_PUBLIC_CAREFALL_SESSION_ID={sessionId}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Use this session with EXPO_PUBLIC_CAREFALL_PLATFORM_URL set to your
              Cloudflare URL so phone measurements sync into this panel.
            </p>
          </div>
        </div>
      ) : null}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="mt-3 aspect-video w-full rounded-lg border border-edge bg-black object-cover"
      />

      {error ? <p className="mt-2 text-xs text-alert">{error}</p> : null}
      <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-edge bg-surface px-3 py-2">
        <span className="text-[11px] font-semibold tracking-[0.14em] text-slate-500">
          HEALTH PACKETS
        </span>
        <span className="text-xs font-semibold text-slate-300">
          {mobileHealthPackets > 0
            ? `${mobileHealthPackets} synced`
            : "Waiting for Expo tracker"}
        </span>
      </div>
      {mobileHealthUpdatedAt ? (
        <p className="mt-1 text-[11px] text-slate-500">
          Last phone health update {Math.max(0, Math.round((Date.now() - mobileHealthUpdatedAt) / 1000))}s ago
        </p>
      ) : null}
      <p className="mt-2 text-[11px] text-slate-500">
        Open the link on the iPhone over HTTPS. With Cloudflare Tunnel configured,
        this uses LiveKit over WSS and targets 1080p at 30 FPS with no audio.
      </p>
    </div>
  );
}

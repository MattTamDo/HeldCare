"use client";

import { useEffect, useRef, useState } from "react";

import {
  readPhoneCameraSession,
  sendPhoneCameraSignal,
} from "@/lib/phone-camera/signaling";
import { createLiveKitToken, liveKitRoomName } from "@/lib/phone-camera/livekit";
import type { Vitals } from "@/lib/assessment/types";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

type CaptureStatus =
  | "idle"
  | "camera"
  | "waiting"
  | "answering"
  | "streaming"
  | "error";
type PhoneCameraFacing = "user" | "environment";

function faceSummary(vitals: Vitals): string {
  if (!vitals.face) return "--";
  const parts = [
    vitals.face.expression,
    vitals.face.blinking ? "blinking" : undefined,
    vitals.face.talking ? "talking" : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "ready";
}

function RecordedMetricsPanel({ vitals }: { vitals: Vitals }) {
  const records = [
    {
      label: "Pulse",
      value: vitals.pulse ? `${vitals.pulse} bpm` : "--",
      recorded: vitals.pulse !== undefined,
    },
    {
      label: "Respiration",
      value: vitals.respiration ? `${vitals.respiration} brpm` : "--",
      recorded: vitals.respiration !== undefined,
    },
    {
      label: "Signal quality",
      value: vitals.signalQuality ?? "--",
      recorded: vitals.signalQuality !== undefined,
    },
    {
      label: "Pressure waveform",
      value: vitals.pressureWaveform?.length
        ? `${vitals.pressureWaveform.length} samples`
        : "--",
      recorded: Boolean(vitals.pressureWaveform?.length),
    },
    {
      label: "HRV RMSSD",
      value: vitals.hrv?.rmssd ? `${vitals.hrv.rmssd} ms` : "--",
      recorded: vitals.hrv?.rmssd !== undefined,
    },
    {
      label: "Face analysis",
      value: faceSummary(vitals),
      recorded: vitals.face !== undefined,
    },
  ];
  const recordedCount = records.filter((record) => record.recorded).length;

  return (
    <section className="mt-4 rounded-xl border border-edge bg-panel p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold tracking-[0.16em] text-slate-400">
          RECORDED METRICS
        </h2>
        <span className="text-xs text-slate-500">{recordedCount}/6</span>
      </div>
      <div className="divide-y divide-edge overflow-hidden rounded-lg border border-edge">
        {records.map((record) => (
          <div
            key={record.label}
            className="grid grid-cols-[1fr_auto] items-center gap-3 bg-surface px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  record.recorded ? "bg-emerald-400" : "bg-slate-600"
                }`}
              />
              <p className="truncate text-xs text-slate-400">{record.label}</p>
            </div>
            <p className="text-right text-xs font-semibold tabular-nums text-slate-200">
              {record.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PhoneCameraPage({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [error, setError] = useState<string>();
  const [facingMode, setFacingMode] = useState<PhoneCameraFacing>("user");
  const [vitals, setVitals] = useState<Vitals>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const liveKitRoomRef = useRef<{ disconnect: () => void } | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const seenHostCandidates = useRef(0);
  const answeredRef = useRef(false);

  useEffect(() => {
    return () => {
      pcRef.current?.close();
      liveKitRoomRef.current?.disconnect();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function stopCurrentCapture() {
    pcRef.current?.close();
    pcRef.current = null;
    liveKitRoomRef.current?.disconnect();
    liveKitRoomRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function transportMode(): "livekit" | "local" {
    if (typeof window === "undefined") return "local";
    const params = new URLSearchParams(window.location.search);
    return params.get("transport") === "livekit" ? "livekit" : "local";
  }

  async function begin(nextFacingMode: PhoneCameraFacing = facingMode) {
    setError(undefined);
    setStatus("camera");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: nextFacingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { min: 30, ideal: 30 },
        },
      });

      localStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      if (transportMode() === "livekit") {
        await beginLiveKit(stream);
        return;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setStatus("streaming");
        if (pc.connectionState === "failed") {
          setStatus("error");
          setError("WebRTC connection failed.");
        }
      };
      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        void sendPhoneCameraSignal(sessionId, {
          role: "phone",
          kind: "candidate",
          candidate: event.candidate.toJSON(),
        });
      };

      setStatus("waiting");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Camera permission failed.");
    }
  }

  async function switchCamera(nextFacingMode: PhoneCameraFacing) {
    setFacingMode(nextFacingMode);
    setError(undefined);

    if (status === "idle" || status === "error") return;

    if (transportMode() !== "livekit") {
      setError("Switching cameras after pairing requires a new local WebRTC link.");
      return;
    }

    stopCurrentCapture();
    await begin(nextFacingMode);
  }

  async function beginLiveKit(stream: MediaStream) {
    setStatus("answering");
    const params = new URLSearchParams(window.location.search);
    const accessCode = params.get("code");
    const { Room, RoomEvent, Track } = await import("livekit-client");
    const token = await createLiveKitToken({
      room: liveKitRoomName(sessionId),
      identity: `iphone-${sessionId}`,
      name: "iPhone camera",
      accessCode,
    });

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    liveKitRoomRef.current = room;
    room.on(RoomEvent.DataReceived, (payload: Uint8Array, _participant: unknown, _kind: unknown, topic?: string) => {
      if (topic !== "carefall.metrics") return;
      try {
        const decoded = JSON.parse(new TextDecoder().decode(payload)) as {
          type?: string;
          vitals?: Vitals;
        };
        if (decoded.type === "carefall.metrics" && decoded.vitals) {
          setVitals(decoded.vitals);
        }
      } catch {
        // Ignore malformed room data from other participants.
      }
    });
    room.on(RoomEvent.Disconnected, () => setStatus("idle"));

    await room.connect(token.url, token.token);
    const [videoTrack] = stream.getVideoTracks();
    await room.localParticipant.publishTrack(videoTrack, {
      name: "iphone-camera",
      source: Track.Source.Camera,
    });
    setStatus("streaming");
  }

  useEffect(() => {
    if (status !== "waiting" && status !== "answering" && status !== "streaming") {
      return;
    }

    const timer = window.setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;

      try {
        const session = await readPhoneCameraSession(sessionId);

        if (session.offer && !answeredRef.current) {
          setStatus("answering");
          await pc.setRemoteDescription(session.offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendPhoneCameraSignal(sessionId, {
            role: "phone",
            kind: "answer",
            description: answer,
          });
          answeredRef.current = true;
        }

        const newCandidates = session.hostCandidates.slice(
          seenHostCandidates.current,
        );
        seenHostCandidates.current = session.hostCandidates.length;
        for (const candidate of newCandidates) {
          await pc.addIceCandidate(candidate);
        }
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Unable to pair.");
      }
    }, 900);

    return () => window.clearInterval(timer);
  }, [sessionId, status]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-5">
      <header className="mb-4">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-sky-400">
          CAREFALL CAMERA
        </p>
        <h1 className="mt-2 text-2xl font-semibold">iPhone camera link</h1>
        <p className="mt-2 text-sm text-slate-400">
          Session {sessionId}. Keep this page open while the assessment runs.
        </p>
      </header>

      <RecordedMetricsPanel vitals={vitals} />

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="mt-4 aspect-video w-full rounded-xl border border-edge bg-black object-cover"
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void switchCamera("user")}
          aria-pressed={facingMode === "user"}
          className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${
            facingMode === "user"
              ? "border-sky-400 bg-sky-500/15 text-sky-100"
              : "border-edge bg-panel text-slate-400 hover:border-slate-500"
          }`}
        >
          FRONT CAMERA
        </button>
        <button
          type="button"
          onClick={() => void switchCamera("environment")}
          aria-pressed={facingMode === "environment"}
          className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${
            facingMode === "environment"
              ? "border-sky-400 bg-sky-500/15 text-sky-100"
              : "border-edge bg-panel text-slate-400 hover:border-slate-500"
          }`}
        >
          BACK CAMERA
        </button>
      </div>

      <button
        type="button"
        onClick={() => void begin()}
        disabled={status !== "idle" && status !== "error"}
        className="mt-4 rounded-xl bg-sky-500 px-4 py-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
      >
        {status === "idle" || status === "error"
          ? "START CAMERA"
          : status.toUpperCase()}
      </button>

      {error ? <p className="mt-3 text-sm text-alert">{error}</p> : null}

      <p className="mt-4 text-xs text-slate-500">
        iOS requires HTTPS for camera capture. Cloudflare Tunnel gives this page
        a trusted HTTPS link, while LiveKit carries the camera track over WSS.
      </p>
    </main>
  );
}

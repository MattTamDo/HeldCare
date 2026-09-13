"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";

import type { AssessmentIncident, AssessmentState } from "@/lib/assessment/types";
import { liveConnectConfig, stateBriefing } from "@/lib/gemini/live-config";
import { floatTo16BitPcm, pcm16ToBase64, PcmPlayer } from "@/lib/gemini/pcm";
import {
  observationSchema,
  problemSchema,
  visualGuideSchema,
  type AssessmentAction,
} from "@/lib/gemini/tools";

export type GeminiLiveStatus =
  | "idle"
  | "requesting"
  | "connecting"
  | "live"
  | "error";

type LiveTokenResponse = {
  token: string;
  model: string;
  apiVersion: string;
};

export function useGeminiLive({
  incident,
  state,
  onAction,
  onEnded,
}: {
  incident: AssessmentIncident;
  state: AssessmentState;
  onAction: (action: AssessmentAction) => void | Promise<void>;
  onEnded?: (session: { inputText: string; outputText: string }) => void;
}) {
  const [status, setStatus] = useState<GeminiLiveStatus>("idle");
  const [error, setError] = useState<string>();
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoWrapRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const captureRef = useRef<{
    audio?: AudioContext;
    processor?: ScriptProcessorNode;
    source?: MediaStreamAudioSourceNode;
    frameTimer?: number;
    stream?: MediaStream;
  }>({});
  const incidentRef = useRef(incident);
  const stateRef = useRef(state);
  const onActionRef = useRef(onAction);
  const onEndedRef = useRef(onEnded);
  const inputTextRef = useRef("");
  const outputTextRef = useRef("");
  const liveRef = useRef(false);
  const startingRef = useRef(false);
  incidentRef.current = incident;
  stateRef.current = state;
  onActionRef.current = onAction;
  onEndedRef.current = onEnded;

  const ensureVideo = useCallback(() => {
    if (videoRef.current) return videoRef.current;
    const wrap = document.createElement("div");
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText =
      "position:absolute;width:0;height:0;overflow:hidden;clip:rect(0,0,0,0);pointer-events:none;";
    const video = document.createElement("video");
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.style.pointerEvents = "none";
    wrap.appendChild(video);
    document.body.appendChild(wrap);
    videoWrapRef.current = wrap;
    videoRef.current = video;
    return video;
  }, []);

  const attachVideo = useCallback(
    (media: MediaStream) => {
      const video = ensureVideo();
      video.srcObject = media;
      void video.play().catch(() => undefined);
    },
    [ensureVideo],
  );

  const stopCapture = useCallback(() => {
    const capture = captureRef.current;
    if (capture.frameTimer) window.clearInterval(capture.frameTimer);
    capture.processor?.disconnect();
    capture.source?.disconnect();
    void capture.audio?.close();
    capture.stream?.getTracks().forEach((track) => track.stop());
    captureRef.current = {};
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    const wasLive = liveRef.current;
    sessionRef.current?.close();
    sessionRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
    stopCapture();
    liveRef.current = false;
    setStatus("idle");
    if (wasLive) {
      onEndedRef.current?.({
        inputText: inputTextRef.current,
        outputText: outputTextRef.current,
      });
    }
  }, [stopCapture]);

  useEffect(() => () => {
    sessionRef.current?.close();
    sessionRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
    stopCapture();
    liveRef.current = false;
    videoWrapRef.current?.remove();
    videoWrapRef.current = null;
    videoRef.current = null;
  }, [stopCapture]);

  const handleMessage = useCallback((message: LiveServerMessage) => {
    const content = message.serverContent;
    if (content?.interrupted) {
      playerRef.current?.interrupt();
      setSpeaking(false);
    }
    if (content?.inputTranscription?.text) {
      setInputText((prev) => {
        const next = `${prev}${content.inputTranscription?.text ?? ""}`;
        inputTextRef.current = next;
        return next;
      });
    }
    if (content?.outputTranscription?.text) {
      setSpeaking(true);
      setOutputText((prev) => {
        const next = `${prev}${content.outputTranscription?.text ?? ""}`;
        outputTextRef.current = next;
        return next;
      });
    }
    if (content?.generationComplete || content?.turnComplete) {
      setInputText((prev) => prev.trim());
      setOutputText((prev) => prev.trim());
      window.setTimeout(() => {
        if (!playerRef.current?.isPlaying()) setSpeaking(false);
      }, 250);
    }

    const parts = content?.modelTurn?.parts ?? [];
    for (const part of parts) {
      const audio = part.inlineData?.data;
      if (audio && (part.inlineData?.mimeType?.startsWith("audio/") ?? true)) {
        playerRef.current?.play(audio);
      }
    }

    const calls = message.toolCall?.functionCalls ?? [];
    if (calls.length === 0 || !sessionRef.current) return;

    const responses = calls.map((call) => {
      const name = call.name ?? "";
      const args = (call.args ?? {}) as Record<string, unknown>;

      if (name === "getIncidentContext") {
        return {
          id: call.id,
          name,
          response: { incident: incidentRef.current },
        };
      }
      if (name === "getProtocol") {
        return {
          id: call.id,
          name,
          response: {
            currentStep: stateRef.current.protocolStep,
            briefing: stateBriefing(incidentRef.current, stateRef.current),
          },
        };
      }
      if (name === "recordObservation") {
        const parsed = observationSchema.safeParse(args);
        if (parsed.success) {
          void onActionRef.current({ tool: "recordObservation", args: parsed.data });
        }
        return { id: call.id, name, response: { ok: true } };
      }
      if (name === "recordProblem") {
        const parsed = problemSchema.safeParse(args);
        if (parsed.success) {
          void onActionRef.current({ tool: "recordProblem", args: parsed.data });
        }
        return { id: call.id, name, response: { ok: true } };
      }
      if (name === "showVisualGuide") {
        const parsed = visualGuideSchema.safeParse(args);
        if (parsed.success) {
          void onActionRef.current({ tool: "showVisualGuide", args: parsed.data });
        }
        return { id: call.id, name, response: { ok: true } };
      }
      if (name === "completeAssessment") {
        void onActionRef.current({ tool: "completeAssessment", args: {} });
        return { id: call.id, name, response: { ok: true } };
      }

      return { id: call.id, name, response: { ok: false } };
    });

    sessionRef.current.sendToolResponse({ functionResponses: responses });
  }, []);

  const startCapture = useCallback(
    async (session: Session, media: MediaStream, audioContext: AudioContext) => {
      const player = new PcmPlayer();
      player.onPlayback((playing) => {
        setVoicePlaying(playing);
        setSpeaking(playing);
      });
      await player.resume();
      playerRef.current = player;

      if (audioContext.state === "suspended") await audioContext.resume();
      const source = audioContext.createMediaStreamSource(media);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const mute = audioContext.createGain();
      mute.gain.value = 0;
      source.connect(processor);
      processor.connect(mute);
      mute.connect(audioContext.destination);

      processor.onaudioprocess = (event) => {
        if (!sessionRef.current) return;
        const input = event.inputBuffer.getChannelData(0);
        const pcm = floatTo16BitPcm(input, audioContext.sampleRate, 16_000);
        session.sendRealtimeInput({
          audio: {
            data: pcm16ToBase64(pcm),
            mimeType: "audio/pcm;rate=16000",
          },
        });
      };

      const sendFrame = () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || !sessionRef.current) return;
        const canvas = document.createElement("canvas");
        const width = 640;
        const height = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * width) || 360);
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
        const data = dataUrl.split(",")[1];
        if (!data) return;
        session.sendRealtimeInput({
          video: { data, mimeType: "image/jpeg" },
        });
      };

      const frameTimer = window.setInterval(sendFrame, 1000);
      captureRef.current = {
        audio: audioContext,
        processor,
        source,
        frameTimer,
        stream: media,
      };
    },
    [],
  );

  const start = useCallback(async (media: MediaStream, audioContext: AudioContext) => {
    if (liveRef.current || startingRef.current) return;
    startingRef.current = true;

    setError(undefined);
    inputTextRef.current = "";
    outputTextRef.current = "";
    setInputText("");
    setOutputText("");
    setSpeaking(false);
    setVoicePlaying(false);
    setStatus("requesting");
    setStream(media);
    attachVideo(media);

    try {
      const tokenResponse = await fetch("/api/assessment/live-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident: incidentRef.current,
          state: stateRef.current,
        }),
      });
      if (!tokenResponse.ok) {
        const body = (await tokenResponse.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `Live token failed (${tokenResponse.status})`);
      }

      const token = (await tokenResponse.json()) as LiveTokenResponse;
      setStatus("connecting");

      const ai = new GoogleGenAI({
        apiKey: token.token,
        apiVersion: token.apiVersion,
        httpOptions: { apiVersion: token.apiVersion },
      });

      const session = await ai.live.connect({
        model: token.model,
        config: liveConnectConfig(incidentRef.current, stateRef.current),
        callbacks: {
          onopen: () => setStatus("live"),
          onmessage: handleMessage,
          onerror: (event) => {
            setError(event.message || "Gemini Live connection error.");
            setStatus("error");
          },
          onclose: () => {
            if (sessionRef.current) setStatus("idle");
          },
        },
      });

      sessionRef.current = session;
      liveRef.current = true;
      await startCapture(session, media, audioContext);
      session.sendRealtimeInput({
        text: stateBriefing(incidentRef.current, stateRef.current),
      });
      setStatus("live");
    } catch (err) {
      liveRef.current = false;
      media.getTracks().forEach((track) => track.stop());
      stopCapture();
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start the live copilot.",
      );
    } finally {
      startingRef.current = false;
    }
  }, [attachVideo, handleMessage, startCapture, stopCapture]);

  return {
    status,
    error,
    inputText,
    outputText,
    speaking,
    voicePlaying,
    stream,
    videoRef,
    start,
    stop,
    live: status === "live",
  };
}

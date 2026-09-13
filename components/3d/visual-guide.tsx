"use client";

import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";

import { BODY_REGION_LABELS, type BodyRegion } from "@/lib/assessment/types";

// three/R3F touch browser-only APIs, so the canvas never renders on the server.
const Mannequin = dynamic(() => import("./mannequin"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-slate-500">
      Loading visual guide…
    </div>
  ),
});

/** 3D is optional — if WebGL is unavailable the assessment still completes. */
class CanvasBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center text-xs text-slate-500">
          Visual guide unavailable on this device. The assessment can still be
          completed.
        </div>
      );
    }
    return this.props.children;
  }
}

export default function VisualGuide({
  region,
  onClose,
}: {
  region?: BodyRegion;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <h2 className="text-xs font-semibold tracking-[0.2em] text-slate-300">
          VISUAL GUIDE
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-slate-400 transition hover:text-slate-200"
        >
          CLOSE
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <CanvasBoundary>
          <Mannequin active={region} />
        </CanvasBoundary>
      </div>

      <div className="space-y-3 border-t border-edge px-4 py-4">
        {region ? (
          <p className="text-sm">
            <span className="font-semibold text-rose-400">
              {BODY_REGION_LABELS[region].toUpperCase()}
            </span>{" "}
            <span className="text-slate-400">— area the resident reported.</span>
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            No specific area reported. General orientation view.
          </p>
        )}

        <p className="text-xs text-slate-500">
          Drag to rotate, pinch to zoom. Orientation only — follow facility
          protocol for the reported concern. Left and right follow the
          resident&apos;s body, not the screen.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
        >
          DONE
        </button>
      </div>
    </div>
  );
}

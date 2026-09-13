"use client";

import type { Vitals } from "@/lib/assessment/types";

/**
 * Phone pairing (LiveKit / WebRTC) is not enabled in this build.
 * The assessment still completes with the simulated vitals scan.
 */
export default function HostCameraBridge({
  onStream,
}: {
  onStream?: (stream: MediaStream) => void;
  onMobileVitals?: (vitals: Vitals) => void;
  recordedVitals?: Vitals;
}) {
  void onStream;

  return (
    <div className="rounded-xl border border-edge bg-surface p-3">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-400">
        IPHONE PAIRING
      </p>
      <p className="mt-2 text-sm text-slate-300">
        Live phone camera is not enabled in this build.
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Start the contactless measurement above to use the simulated pulse and
        breathing estimates.
      </p>
    </div>
  );
}

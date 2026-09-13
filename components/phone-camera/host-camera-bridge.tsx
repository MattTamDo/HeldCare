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
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <p className="text-xs font-semibold text-slate-500">iPhone pairing</p>
      <p className="mt-2 text-sm">Live phone camera is not enabled in this build.</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Start the contactless measurement above to use the simulated pulse and
        breathing estimates.
      </p>
    </div>
  );
}

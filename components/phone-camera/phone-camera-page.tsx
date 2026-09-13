"use client";

export default function PhoneCameraPage({ sessionId }: { sessionId: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-12">
      <p className="text-xs font-semibold tracking-[0.2em] text-sky-400">
        HELDCARE
      </p>
      <h1 className="text-2xl font-semibold">Phone camera pairing</h1>
      <p className="text-sm text-slate-400">
        Live iPhone pairing is not enabled in this build. Session {sessionId}{" "}
        can still be assessed from the desktop with simulated vitals.
      </p>
    </main>
  );
}

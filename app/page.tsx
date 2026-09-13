import Link from "next/link";
import { mockIncident } from "@/lib/assessment/incident";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-sky-400">
          CAREFALL
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Post-fall assessment</h1>
        <p className="mt-2 text-sm text-slate-400">
          Module 3. Opens against a mock incident until the incident API is
          available.
        </p>
      </div>

      <Link
        href={`/responder/incident/${mockIncident.id}/assessment`}
        className="rounded-xl bg-sky-500 px-4 py-4 text-center text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
      >
        OPEN DEMO ASSESSMENT
      </Link>

      <p className="text-xs text-slate-500">
        Hackathon demonstration only. Not medical guidance.
      </p>
    </main>
  );
}

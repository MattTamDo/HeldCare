import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 p-8 text-center dark:bg-zinc-950">
      <div>
        <h1 className="text-3xl font-bold">CareFall</h1>
        <p className="mt-1 text-zinc-500">Oakwood Senior Living — emergency response demo</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard?demo=true"
          className="rounded-xl bg-zinc-900 px-5 py-3 font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
        >
          Facility dashboard
        </Link>
        <Link
          href="/responder"
          className="rounded-xl border border-zinc-300 px-5 py-3 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Responder app
        </Link>
      </div>

      <p className="max-w-md text-xs text-zinc-400">
        Camera (<code>/camera/204</code>) and the full post-fall assessment flow are owned by the other
        modules — see PLAN.md.
      </p>
    </div>
  );
}

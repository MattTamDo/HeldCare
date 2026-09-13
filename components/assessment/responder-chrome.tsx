"use client";

import Link from "next/link";

import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { responderPath } from "@/lib/assessment/incident";

export function ResponderChrome({
  incidentId,
  residentName,
  roomId,
  status,
  active,
  children,
}: {
  incidentId: string;
  residentName: string;
  roomId: string;
  status: string;
  active: "assessment" | "copilot";
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-sky-600 uppercase dark:text-sky-400">
              HeldCare
            </p>
            <h1 className="truncate text-base font-bold">{residentName}</h1>
            <p className="truncate text-xs text-slate-500">
              Room {roomId} · {status}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href="/monitor?tab=responder"
              className="min-h-11 px-3 py-2 text-sm font-semibold text-slate-500"
            >
              Dashboard
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <nav
        className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        aria-label="Responder views"
      >
        <div className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-2 px-4 py-2">
          <ChromeTab
            href={responderPath(incidentId, "assessment", roomId)}
            active={active === "assessment"}
            label="Post-fall assessment"
          />
          <ChromeTab
            href={responderPath(incidentId, "copilot", roomId)}
            active={active === "copilot"}
            label="Live copilot"
          />
        </div>
      </nav>

      <div className="mx-auto w-full max-w-3xl px-4 py-4">{children}</div>
    </div>
  );
}

function ChromeTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-12 items-center justify-center rounded-full px-3 text-center text-sm font-semibold ${
        active
          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {label}
    </Link>
  );
}

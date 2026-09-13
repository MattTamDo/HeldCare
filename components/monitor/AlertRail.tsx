"use client";

import { Card, CARD_CLASS } from "@/components/ui/Card";
import {
  BellIcon,
  CheckIcon,
  CheckShieldIcon,
  MicIcon,
  PhoneIcon,
  UsersIcon,
} from "@/components/ui/icons";
import type { IncidentBoardData } from "@/lib/incidents/board";
import { FALL_CONFIG, getMonitoredRoom, type MonitoredRoom } from "@/lib/fall/config";
import type { ReportedFall } from "@/lib/fall/reportFall";
import type { Incident, RoomState } from "@/lib/types/incident";

function timeOf(ms: number) {
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

const ACTION =
  "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition";

/** Two-way audio and family contact have no backend, so they say so. */
function UnavailableAction({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled
      title="Not available in this demo"
      className={`${ACTION} cursor-not-allowed bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-500 dark:ring-slate-700`}
    >
      {icon}
      {label}
    </button>
  );
}

function ActiveAlertCard({
  incident,
  room,
  responders,
  onRespond,
  onResolve,
}: {
  incident: Incident;
  room: RoomState | null;
  responders: IncidentBoardData["responders"];
  onRespond: (responderId: string) => void;
  onResolve: () => void;
}) {
  const claimed = incident.status === "responding";

  return (
    <section
      className={`animate-alert-pulse overflow-hidden rounded-2xl ring-2 ${
        claimed
          ? "bg-amber-50 ring-amber-300 dark:bg-amber-500/10 dark:ring-amber-500/40"
          : "bg-rose-50 ring-rose-300 dark:bg-rose-500/10 dark:ring-rose-500/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-full ${
              claimed
                ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"
                : "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300"
            }`}
          >
            <BellIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2
              className={`text-base font-bold ${
                claimed
                  ? "text-amber-900 dark:text-amber-200"
                  : "text-rose-900 dark:text-rose-200"
              }`}
            >
              {claimed ? "Responder en route" : "Fall detected"}
            </h2>
            <p className="truncate text-sm text-slate-600 dark:text-slate-300">
              Room {incident.roomId}
              {room?.residentName ? ` · ${room.residentName}` : ""}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {timeOf(incident.detectedAt)}
        </span>
      </div>

      {claimed && incident.responderName && (
        <p className="mt-2 px-4 text-sm font-semibold text-amber-800 dark:text-amber-300">
          {incident.responderName} is on the way
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 p-4">
        {claimed ? (
          <>
            <a
              href={`/responder/incident/${incident.id}/assessment`}
              className={`${ACTION} col-span-2 bg-sky-600 text-white hover:bg-sky-500`}
            >
              Open post-fall assessment
            </a>
            <button
              type="button"
              onClick={onResolve}
              className={`${ACTION} col-span-2 bg-emerald-600 text-white hover:bg-emerald-500`}
            >
              <CheckIcon className="size-4" />
              Mark as resolved
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onRespond(responders[0]?.id ?? "sarah")}
            disabled={responders.length === 0}
            className={`${ACTION} col-span-2 bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50`}
          >
            <PhoneIcon className="size-4" />
            Dispatch {responders[0]?.name ?? "responder"}
          </button>
        )}

        <UnavailableAction icon={<MicIcon className="size-4" />} label="Talk to resident" />
        <UnavailableAction icon={<UsersIcon className="size-4" />} label="Contact family" />
      </div>
    </section>
  );
}

function ResidentCard({ room }: { room: MonitoredRoom }) {
  return (
    <Card
      title="Resident information"
      bodyClassName="px-4 pb-4"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          {room.residentName
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{room.residentName}</p>
          <p className="text-sm text-sky-600 dark:text-sky-400">Room {room.roomId}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Floor {room.floor} · Independent living
          </p>
        </div>
      </div>
    </Card>
  );
}

function RecentAlerts({ reports }: { reports: ReportedFall[] }) {
  return (
    <Card title="Recent alerts" bodyClassName="px-4 pb-4">
      {reports.length === 0 ? (
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          No alerts yet. Confirmed falls appear here and are sent to the incident
          workflow as a <span className="font-mono">FALL_DETECTED</span> event.
        </p>
      ) : (
        <ul className="space-y-3">
          {reports.slice(0, 5).map((report, index) => {
            const room = getMonitoredRoom(report.event.roomId);
            return (
              <li
                key={`${report.event.timestamp}-${report.event.roomId}-${index}`}
                className="flex items-start gap-2.5"
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    index === 0 ? "bg-rose-500" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">Fall detected</span>
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                      {timeOf(report.event.timestamp)}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    Room {report.event.roomId} · {room.residentName} ·{" "}
                    {Math.round(report.event.confidence * 100)}%
                    {report.trigger === "manual" ? " · manual" : ""}
                  </span>
                  <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
                    {report.outcome.delivered
                      ? "Sent to incident workflow"
                      : `Logged only — ${report.outcome.reason}`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function AlertRail({
  board,
  activeIncident,
  activeRoom,
  updatedAt,
  onRespond,
  onResolve,
  selectedRoom,
  reports,
  cameraCount,
  onTrigger,
  onResetAll,
  onClearFeed,
  showDemoControls,
}: {
  board: IncidentBoardData;
  activeIncident: Incident | null;
  activeRoom: RoomState | null;
  updatedAt: number;
  onRespond: (responderId: string) => void;
  onResolve: () => void;
  selectedRoom: MonitoredRoom;
  reports: ReportedFall[];
  cameraCount: number;
  onTrigger: () => void;
  onResetAll: () => void;
  onClearFeed: () => void;
  showDemoControls: boolean;
}) {
  return (
    <aside className="flex flex-col gap-4">
      {activeIncident ? (
        <ActiveAlertCard
          incident={activeIncident}
          room={activeRoom}
          responders={board.responders}
          onRespond={onRespond}
          onResolve={onResolve}
        />
      ) : (
        <section className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/30">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckShieldIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
              No active alerts
            </h2>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
              All residents are calm and being monitored.
            </p>
          </div>
        </section>
      )}

      <ResidentCard room={selectedRoom} />
      <RecentAlerts reports={reports} />

      <section className={`${CARD_CLASS} flex items-center gap-3 p-4`}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
          <CheckShieldIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold">All systems operational</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {cameraCount} cameras configured · updated {timeOf(updatedAt)}
          </p>
        </div>
      </section>

      {showDemoControls && (
        <Card title="Demo controls" bodyClassName="space-y-2 px-4 pb-4">
          <button
            type="button"
            onClick={onTrigger}
            className={`${ACTION} w-full bg-rose-600 text-white hover:bg-rose-500`}
          >
            Report fall · Room {selectedRoom.roomId}
            <span className="font-mono text-xs opacity-80">(F)</span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onResetAll}
              className={`${ACTION} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClearFeed}
              className={`${ACTION} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`}
            >
              Clear feed
            </button>
          </div>
          <p className="pt-1 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            Confirmed falls post to{" "}
            <span className="font-mono">
              {FALL_CONFIG.reporting.endpoint || "console only"}
            </span>
            .
          </p>
        </Card>
      )}
    </aside>
  );
}

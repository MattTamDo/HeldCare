"use client";

export type RoomCardStatus = "normal" | "alert" | "responding";

type Props = {
  roomId: string;
  residentName?: string;
  status: RoomCardStatus;
  responderName?: string;
};

const CARD_STYLES: Record<RoomCardStatus, string> = {
  normal:
    "bg-white ring-slate-200 dark:bg-slate-900 dark:ring-slate-800",
  alert:
    "animate-alert-pulse bg-rose-50 ring-2 ring-rose-400 dark:bg-rose-500/10 dark:ring-rose-500/50",
  responding:
    "bg-amber-50 ring-2 ring-amber-300 dark:bg-amber-500/10 dark:ring-amber-500/40",
};

const LABEL: Record<RoomCardStatus, { text: string; dot: string; tone: string }> = {
  normal: {
    text: "Normal",
    dot: "bg-emerald-500",
    tone: "text-slate-500 dark:text-slate-400",
  },
  alert: {
    text: "Fall detected",
    dot: "animate-dot-pulse bg-rose-500",
    tone: "text-rose-700 dark:text-rose-300",
  },
  responding: {
    text: "Responder en route",
    dot: "animate-dot-pulse bg-amber-500",
    tone: "text-amber-700 dark:text-amber-300",
  },
};

export function RoomCard({ roomId, residentName, status, responderName }: Props) {
  const label = LABEL[status];

  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl p-4 text-left shadow-sm ring-1 transition ${CARD_STYLES[status]}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-lg font-bold">Room {roomId}</span>
        {residentName && (
          <span className="truncate text-sm text-slate-500 dark:text-slate-400">
            {residentName}
          </span>
        )}
      </div>

      <span className={`flex items-center gap-2 text-sm font-semibold ${label.tone}`}>
        <span className={`size-2 rounded-full ${label.dot}`} />
        {label.text}
      </span>

      {status === "responding" && responderName && (
        <span className="text-xs text-amber-700/80 dark:text-amber-300/80">
          {responderName}
        </span>
      )}
    </div>
  );
}

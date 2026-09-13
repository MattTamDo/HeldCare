"use client";

export type RoomCardStatus = "normal" | "alert" | "responding";

type Props = {
  roomId: string;
  residentName?: string;
  status: RoomCardStatus;
  responderName?: string;
};

const STATUS_STYLES: Record<RoomCardStatus, string> = {
  normal: "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
  alert: "border-red-500 bg-red-50 dark:bg-red-950/40 animate-pulse shadow-lg shadow-red-500/20",
  responding: "border-amber-400 bg-amber-50 dark:bg-amber-950/30",
};

export function RoomCard({ roomId, residentName, status, responderName }: Props) {
  return (
    <div className={`flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-colors ${STATUS_STYLES[status]}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-semibold">Room {roomId}</span>
        {residentName && <span className="text-sm text-zinc-500">{residentName}</span>}
      </div>

      {status === "normal" && <span className="text-sm font-medium text-zinc-500">● NORMAL</span>}

      {status === "alert" && (
        <span className="text-sm font-bold text-red-600 dark:text-red-400">🔴 FALL DETECTED</span>
      )}

      {status === "responding" && (
        <>
          <span className="text-sm font-bold text-amber-600 dark:text-amber-400">🟡 RESPONDER EN ROUTE</span>
          {responderName && <span className="text-xs text-amber-700 dark:text-amber-300">{responderName}</span>}
        </>
      )}
    </div>
  );
}

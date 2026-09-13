import { MonitorShell } from "@/components/monitor/MonitorShell";
import { buildIncidentBoard } from "@/lib/incidents/board";
import { parseMonitorTab } from "@/lib/monitor/tabs";

export const dynamic = "force-dynamic";

export default async function MonitorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;

  return (
    <MonitorShell
      tab={parseMonitorTab(query.tab)}
      initialBoard={buildIncidentBoard()}
      demoMode={query.demo === "true"}
    />
  );
}

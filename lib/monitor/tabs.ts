export const MONITOR_TABS = ["cameras", "facility", "responder"] as const;
export type MonitorTab = (typeof MONITOR_TABS)[number];

export function parseMonitorTab(
  value: string | string[] | undefined,
): MonitorTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return MONITOR_TABS.includes(tab as MonitorTab) ? (tab as MonitorTab) : "cameras";
}

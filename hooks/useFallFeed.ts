"use client";

import { useCallback, useEffect, useState } from "react";

import {
  clearFallReportHistory,
  getReportedFalls,
  onFallReported,
  type ReportedFall,
} from "@/lib/fall/reportFall";

/**
 * Every fall event this module has handed to the next stage, newest first.
 * Shared by all camera windows.
 */
export function useFallFeed() {
  const [reports, setReports] = useState<ReportedFall[]>(() =>
    getReportedFalls().reverse(),
  );

  useEffect(
    () => onFallReported((report) => setReports((prev) => [report, ...prev])),
    [],
  );

  const clear = useCallback(() => {
    clearFallReportHistory();
    setReports([]);
  }, []);

  return { reports, clear };
}

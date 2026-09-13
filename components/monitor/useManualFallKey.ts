"use client";

import { useEffect } from "react";

/**
 * Mandatory manual fallback: `F` reports a fall through the same
 * `reportFall` contract the detector uses. Registered once per page so four
 * camera windows cannot emit four events from one keypress.
 */
export function useManualFallKey(trigger: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "f" && event.key !== "F") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }

      event.preventDefault();
      trigger();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [trigger, enabled]);
}

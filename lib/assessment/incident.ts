import type { AssessmentIncident } from "./types";

/**
 * Stand-in incident used until Person 2's incident API exists. IDs match the
 * seed data in PLAN.md (room 204, `margaret`, `sarah`).
 */
export const mockIncident: AssessmentIncident = {
  id: "incident-demo-001",
  roomId: "204",
  resident: { id: "margaret", name: "Margaret Davis" },
  responder: { id: "sarah", name: "Sarah Miller", role: "CNA" },
  status: "arrived",
  detectedAt: Date.now() - 25_000,
  arrivedAt: Date.now(),
};

function withId(id: string): AssessmentIncident {
  return { ...mockIncident, id, detectedAt: Date.now() - 25_000, arrivedAt: Date.now() };
}

/**
 * Tries Person 2's incident endpoint and falls back to the mock, so the
 * assessment screen works standalone and lights up once their API lands.
 */
export async function loadIncident(id: string): Promise<{
  incident: AssessmentIncident;
  source: "api" | "mock";
}> {
  try {
    const response = await fetch(`/api/incidents/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`status ${response.status}`);

    const data = (await response.json()) as Partial<AssessmentIncident>;
    return {
      incident: { ...withId(id), ...data, id },
      source: "api",
    };
  } catch {
    return { incident: withId(id), source: "mock" };
  }
}

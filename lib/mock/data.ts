export const FACILITY_NAME = "Oakwood Senior Living";

export const ROOM_IDS = ["201", "202", "203", "204", "205", "206"];

export const RESIDENT_BY_ROOM: Record<string, { id: string; name: string }> = {
  "201": { id: "harold", name: "Harold Jenkins" },
  "202": { id: "doris", name: "Doris Whitfield" },
  "203": { id: "ernest", name: "Ernest Caldwell" },
  "204": { id: "margaret", name: "Margaret Davis" },
};

export type MockResponder = { id: string; name: string; role: string };

export const RESPONDERS: MockResponder[] = [
  { id: "sarah", name: "Sarah Miller", role: "CNA" },
  { id: "john", name: "John Lee", role: "CNA" },
  { id: "linda", name: "Linda Chen", role: "RN" },
  { id: "marcus", name: "Marcus Reid", role: "CNA" },
];

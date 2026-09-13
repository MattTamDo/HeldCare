import {
  FACILITY_NAME,
  RESIDENT_BY_ROOM,
  RESPONDERS,
  ROOM_IDS,
  type MockResponder,
} from "@/lib/mock/data";
import { activeIncidentForRoom, allActiveIncidents } from "@/lib/mock/store";
import type { RoomState } from "@/lib/types/incident";

export type IncidentBoardData = {
  facility: string;
  rooms: RoomState[];
  responders: MockResponder[];
  activeIncidentCount: number;
  /** Server clock, so the client can show "updated at" without guessing. */
  generatedAt: number;
};

/** One view of the facility, shared by `/api/dashboard` and the server render. */
export function buildIncidentBoard(): IncidentBoardData {
  const rooms: RoomState[] = ROOM_IDS.map((roomId) => {
    const incident = activeIncidentForRoom(roomId);
    const resident = RESIDENT_BY_ROOM[roomId];
    return {
      id: roomId,
      status: incident?.status ?? "normal",
      residentId: resident?.id,
      residentName: resident?.name,
      incident,
    };
  });

  return {
    facility: FACILITY_NAME,
    rooms,
    responders: RESPONDERS,
    activeIncidentCount: allActiveIncidents().length,
    generatedAt: Date.now(),
  };
}

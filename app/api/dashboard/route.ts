import { NextResponse } from "next/server";
import { FACILITY_NAME, RESIDENT_BY_ROOM, RESPONDERS, ROOM_IDS } from "@/lib/mock/data";
import { activeIncidentForRoom, allActiveIncidents } from "@/lib/mock/store";
import type { RoomState } from "@/lib/types/incident";

export async function GET() {
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

  return NextResponse.json({
    facility: FACILITY_NAME,
    rooms,
    responders: RESPONDERS,
    activeIncidentCount: allActiveIncidents().length,
  });
}

// FallEvent is the one contract Person 1's camera module depends on — keep this shape stable.
export type FallEvent = {
  type: "FALL_DETECTED";
  roomId: string;
  residentId: string;
  timestamp: number;
  confidence: number;

  evidence?: {
    torsoAngle?: number;
    hipVelocity?: number;
    aspectRatio?: number;
    persistenceMs?: number;
  };
};

export type IncidentStatus = "alert" | "responding";

export type Incident = {
  id: string;
  roomId: string;
  residentId: string;
  status: IncidentStatus;
  fallConfidence: number;
  detectedAt: number;
  responderId?: string;
  responderName?: string;
};

export type RoomState = {
  id: string;
  status: "normal" | "alert" | "responding";
  residentId?: string;
  residentName?: string;
  incident?: Incident;
};

export type RealtimeEventType = "incident_created" | "incident_responding" | "incident_resolved";

export type RealtimeEvent = {
  type: RealtimeEventType;
  incident: Incident;
};

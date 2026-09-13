export type PhoneCameraRole = "host" | "phone";

export type PhoneCameraSignalKind = "offer" | "answer" | "candidate" | "reset";

export type PhoneCameraSignalRequest =
  | {
      role: PhoneCameraRole;
      kind: "offer" | "answer";
      description: RTCSessionDescriptionInit;
    }
  | {
      role: PhoneCameraRole;
      kind: "candidate";
      candidate: RTCIceCandidateInit;
    }
  | {
      role: PhoneCameraRole;
      kind: "reset";
    };

export type PhoneCameraSessionState = {
  sessionId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  hostCandidates: RTCIceCandidateInit[];
  phoneCandidates: RTCIceCandidateInit[];
  updatedAt: number;
};

export type PhoneCameraStatus =
  | "idle"
  | "creating"
  | "waiting"
  | "connecting"
  | "paired"
  | "connected"
  | "failed";

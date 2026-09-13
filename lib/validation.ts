import { z } from "zod";

export const fallEventSchema = z.object({
  type: z.literal("FALL_DETECTED"),
  roomId: z.string().min(1),
  residentId: z.string().min(1),
  timestamp: z.number(),
  confidence: z.number().min(0).max(1),
  evidence: z
    .object({
      torsoAngle: z.number().optional(),
      hipVelocity: z.number().optional(),
      aspectRatio: z.number().optional(),
      persistenceMs: z.number().optional(),
    })
    .optional(),
});

export const respondSchema = z.object({
  responderId: z.string().min(1),
});

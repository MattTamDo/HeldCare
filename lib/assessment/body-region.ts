import type { BodyRegion } from "./types";

/**
 * Maps a free-text reported concern onto a mannequin region.
 *
 * This is orientation only — it points the responder at the area the resident
 * mentioned. It is not a diagnosis and carries no clinical meaning.
 */

type RegionRule = {
  /** Region when no side word is present, or when the region has no sides. */
  base: BodyRegion;
  left?: BodyRegion;
  right?: BodyRegion;
  keywords: string[];
};

const RULES: RegionRule[] = [
  {
    base: "head",
    keywords: ["head", "skull", "forehead", "temple", "scalp", "face", "jaw", "neck"],
  },
  {
    base: "pelvis",
    keywords: ["hip", "pelvis", "pelvic", "groin", "buttock", "tailbone", "coccyx"],
  },
  {
    base: "torso",
    keywords: [
      "torso", "chest", "rib", "ribs", "back", "spine", "abdomen",
      "stomach", "belly", "side",
    ],
  },
  {
    base: "left-arm",
    left: "left-arm",
    right: "right-arm",
    keywords: ["arm", "shoulder", "elbow", "wrist", "hand", "forearm", "finger", "thumb"],
  },
  {
    base: "left-leg",
    left: "left-leg",
    right: "right-leg",
    keywords: ["leg", "knee", "ankle", "thigh", "shin", "calf", "foot", "toe"],
  },
];

/** Returns the region a concern refers to, or undefined when nothing matches. */
export function regionFromConcern(concern?: string): BodyRegion | undefined {
  if (!concern) return undefined;
  const text = concern.toLowerCase();

  // Word-boundary match so "backache" still hits but "arms race" style
  // substrings inside unrelated words do not fire on short keywords.
  const hit = RULES.find((rule) =>
    rule.keywords.some((keyword) => new RegExp(`\\b${keyword}`).test(text)),
  );
  if (!hit) return undefined;

  if (!hit.left || !hit.right) return hit.base;
  if (/\bright\b/.test(text)) return hit.right;
  if (/\bleft\b/.test(text)) return hit.left;
  return hit.left;
}

/** Protocol `visualKey` implied by the current concern. */
export function visualKeyFromConcern(concern?: string): "general" | "body-region" {
  return regionFromConcern(concern) ? "body-region" : "general";
}

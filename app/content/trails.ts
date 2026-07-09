import type { TrailMarker } from "~/lib/trail/generate";
import trailDesktop from "./trail.desktop.json";
import trailMobile from "./trail.mobile.json";

export interface TrailVariant {
  d: string;
  viewBox: [number, number];
  markers: TrailMarker[];
  sourceHash: string;
}

function asVariant(raw: {
  d: string;
  viewBox: number[];
  markers: TrailMarker[];
  sourceHash: string;
}): TrailVariant {
  return { ...raw, viewBox: [raw.viewBox[0]!, raw.viewBox[1]!] };
}

export const trails = {
  mobile: asVariant(trailMobile),
  desktop: asVariant(trailDesktop),
} as const;

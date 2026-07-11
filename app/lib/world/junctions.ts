import {
  emptyLineLutSample,
  sampleLineLut,
  type LineAnchor,
  type LineLut,
  type LineLutSample,
} from "../line/lut3d.ts";

/**
 * Junction forks (PLAN-3D §5, amended): at every career bench the ride turns
 * off the fall line — these are the trails it doesn't take. Each fork is a
 * straight groomed continuation of the approach heading, derived from the
 * LUT (never authored twice), and carved into the heightfield by the terrain
 * builder so the choice reads as real snow, not an overlay.
 *
 * Pure data, deterministic, unit-testable — same contract as scatter/town.
 */

export interface ForkBranch {
  /** Fork origin on the line, just uphill of the turn. */
  x0: number;
  z0: number;
  y0: number;
  /** Unit continuation direction in the ground plane (the untaken heading). */
  dirX: number;
  dirZ: number;
  /** Descent per meter along the branch (≥ 0, from the approach grade). */
  slope: number;
  lengthM: number;
  halfWidthM: number;
}

export interface ForkOptions {
  /** How far uphill of the anchor the fork sits, meters. */
  forkLeadM?: number;
  /** Baseline for the approach heading, further uphill again, meters. */
  headingLeadM?: number;
  lengthM?: number;
  halfWidthM?: number;
}

/** March along the LUT by an approximate metric distance (init-time only). */
export function advanceByMeters(
  lut: LineLut,
  fromT: number,
  distanceM: number,
  scratch: LineLutSample,
): number {
  const direction = Math.sign(distanceM);
  let remaining = Math.abs(distanceM);
  let t = Math.min(1, Math.max(0, fromT));
  while (remaining > 1e-6) {
    sampleLineLut(lut, t, scratch);
    const stepM = Math.min(2, remaining);
    const dt = stepM / Math.max(1e-3, scratch.dsdt);
    const nextT = Math.min(1, Math.max(0, t + direction * dt));
    if (nextT === t) break;
    t = nextT;
    remaining -= stepM;
  }
  return t;
}

export function deriveForkBranches(
  lut: LineLut,
  anchors: readonly LineAnchor[],
  opts: ForkOptions = {},
): ForkBranch[] {
  const forkLead = opts.forkLeadM ?? 34;
  const headingLead = opts.headingLeadM ?? 52;
  const lengthM = opts.lengthM ?? 80;
  const halfWidthM = opts.halfWidthM ?? 5.5;
  const fork = emptyLineLutSample();
  const back = emptyLineLutSample();
  const scratch = emptyLineLutSample();

  return anchors.map((anchor) => {
    const forkT = advanceByMeters(lut, anchor.t, -forkLead, scratch);
    const backT = advanceByMeters(lut, anchor.t, -headingLead, scratch);
    sampleLineLut(lut, forkT, fork);
    sampleLineLut(lut, backT, back);
    // The untaken heading is the approach direction, before the turn begins.
    const dx = fork.pos[0] - back.pos[0];
    const dz = fork.pos[2] - back.pos[2];
    const run = Math.hypot(dx, dz) || 1;
    const drop = Math.max(0, back.pos[1] - fork.pos[1]);
    return {
      x0: fork.pos[0],
      z0: fork.pos[2],
      y0: fork.pos[1],
      dirX: dx / run,
      dirZ: dz / run,
      slope: drop / run,
      lengthM,
      halfWidthM,
    };
  });
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Ground influence of one branch at (x, z): returns the carve weight ∈ [0,1]
 * and the branch's target elevation there. Shared by the terrain builder
 * (carving) and the tree scatter (clearance).
 */
export function branchInfluence(
  b: ForkBranch,
  x: number,
  z: number,
  shoulderM = 14,
): { weight: number; y: number } {
  const px = x - b.x0;
  const pz = z - b.z0;
  const along = px * b.dirX + pz * b.dirZ;
  if (along < -6 || along > b.lengthM + shoulderM) return { weight: 0, y: b.y0 };
  const aside = Math.abs(px * b.dirZ - pz * b.dirX);
  const s = Math.min(Math.max(along, 0), b.lengthM);
  // The cut fades where the decoy dissolves back into the hillside, and
  // opens gently at the fork mouth so the junction reads as one surface.
  const taper = 1 - smoothstep(b.lengthM * 0.55, b.lengthM, along);
  const mouth = smoothstep(-6, 6, along);
  const across = 1 - smoothstep(b.halfWidthM, b.halfWidthM + shoulderM, aside);
  return { weight: across * taper * mouth, y: b.y0 - b.slope * s - 0.4 };
}

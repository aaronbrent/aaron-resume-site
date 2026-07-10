import type { LinePoint } from "../../content/types.ts";
import { LINE_LIMITS } from "./constants.ts";
import { buildLineLut, type LineAnchor } from "./lut3d.ts";

/**
 * Line validator (PLAN-3D §2): the authoring gates that make a queasy or
 * unreadable segment impossible to commit. Runs in CI (`pnpm line:validate`)
 * and in unit tests against the real content line.
 */

export interface LineValidation {
  ok: boolean;
  errors: string[];
  stats: {
    lengthM: number;
    dropM: number;
    maxGradeDeg: number;
    maxLateralAccel: number;
    dwellSeconds: Record<string, number>;
  };
}

const deg = (rad: number) => (rad * 180) / Math.PI;

export function validateLine(
  points: readonly LinePoint[],
  anchors: readonly LineAnchor[],
): LineValidation {
  const errors: string[] = [];
  const L = LINE_LIMITS;
  let lut;
  try {
    lut = buildLineLut(points, anchors);
  } catch (e) {
    return {
      ok: false,
      errors: [e instanceof Error ? e.message : String(e)],
      stats: {
        lengthM: 0,
        dropM: 0,
        maxGradeDeg: 0,
        maxLateralAccel: 0,
        dwellSeconds: {},
      },
    };
  }
  const { n } = lut;

  // Every content anchor must exist on the line.
  const lineIds = new Set(points.map((p) => p.waypointId).filter(Boolean));
  for (const a of anchors) {
    if (!lineIds.has(a.id)) errors.push(`waypoint "${a.id}" has no anchored line point`);
  }

  let maxGradeDeg = 0;
  let maxAccel = 0;
  for (let i = 0; i < n - 1; i++) {
    const t = i / (n - 1);
    const dy = lut.pos[(i + 1) * 3 + 1]! - lut.pos[i * 3 + 1]!;
    if (dy > L.uphillToleranceM) {
      errors.push(`uphill at t=${t.toFixed(3)}: Δy=+${dy.toFixed(3)}m`);
    }
    const gradeDeg = deg(lut.grade[i]!);
    maxGradeDeg = Math.max(maxGradeDeg, gradeDeg);
    const speed = lut.speed[i]!;
    if (gradeDeg > L.maxGradeDeg) {
      errors.push(
        `grade ${gradeDeg.toFixed(1)}° > ${L.maxGradeDeg}° at t=${t.toFixed(3)}`,
      );
    }
    if (speed >= L.fullSpeed && gradeDeg < L.minGradeDeg) {
      errors.push(
        `full-speed grade ${gradeDeg.toFixed(1)}° < ${L.minGradeDeg}° at t=${t.toFixed(3)}`,
      );
    }
    if (speed <= L.benchSpeed && gradeDeg > L.benchMaxGradeDeg) {
      errors.push(
        `bench grade ${gradeDeg.toFixed(1)}° > ${L.benchMaxGradeDeg}° at t=${t.toFixed(3)}`,
      );
    }
    // Comfort: lateral acceleration at the pace the warped profile implies.
    const v = lut.dsdt[i]! / L.referenceRideSeconds;
    const accel = Math.abs(lut.curvature[i]!) * v * v;
    maxAccel = Math.max(maxAccel, accel);
    if (accel > L.maxLateralAccel) {
      errors.push(
        `lateral accel ${accel.toFixed(1)} m/s² > ${L.maxLateralAccel} at t=${t.toFixed(3)} (κ=${lut.curvature[i]!.toFixed(4)}, v=${v.toFixed(1)} m/s)`,
      );
    }
  }

  // Dwell: contiguous bench time around each anchor at reference pace.
  const dwellSeconds: Record<string, number> = {};
  for (const a of anchors) {
    if (!lineIds.has(a.id)) continue;
    const center = Math.round(a.t * (n - 1));
    let lo = center;
    let hi = center;
    while (lo > 0 && lut.speed[lo - 1]! <= L.benchSpeed) lo--;
    while (hi < n - 1 && lut.speed[hi + 1]! <= L.benchSpeed) hi++;
    const seconds =
      lut.speed[center]! <= L.benchSpeed
        ? ((hi - lo) / (n - 1)) * L.referenceRideSeconds
        : 0;
    dwellSeconds[a.id] = Math.round(seconds * 100) / 100;
    if (seconds < L.minDwellSeconds) {
      errors.push(
        `dwell at "${a.id}" is ${seconds.toFixed(2)}s < ${L.minDwellSeconds}s at reference pace`,
      );
    }
  }

  const dropM = lut.pos[1]! - lut.pos[(n - 1) * 3 + 1]!;
  return {
    ok: errors.length === 0,
    errors,
    stats: {
      lengthM: Math.round(lut.length),
      dropM: Math.round(dropM),
      maxGradeDeg: Math.round(maxGradeDeg * 10) / 10,
      maxLateralAccel: Math.round(maxAccel * 10) / 10,
      dwellSeconds,
    },
  };
}

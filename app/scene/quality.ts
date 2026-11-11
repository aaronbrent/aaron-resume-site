/**
 * Quality tiers (docs/PLAN-STAR-SYSTEM.md §6, W5): resolution, planet detail
 * and dust density (antialiasing is native and fixed). Pure: the scene picks a
 * starting tier from the device, then a governor steps down (never up) if
 * the measured frame rate can't hold. `?qa=1` pins the top tier so visual
 * snapshots don't depend on the machine; `?tier=0|1|2` forces one (tuning).
 */

export type Tier = 0 | 1 | 2;

export interface TierSettings {
  /** Device-pixel-ratio ceiling. */
  dprMax: number;
  /** Planet geometry detail (PlanetBody `detail`). */
  detail: number;
  /** Dust motes drawn. */
  dust: number;
}

export const TIERS: Record<Tier, TierSettings> = {
  2: { dprMax: 1.5, detail: 1, dust: 700 },
  1: { dprMax: 1.25, detail: 0.65, dust: 440 },
  0: { dprMax: 1, detail: 0.45, dust: 240 },
};

export interface DeviceInfo {
  devicePixelRatio: number;
  width: number;
  height: number;
  /** `(pointer: coarse)` — phones and tablets. */
  coarsePointer: boolean;
  /** navigator.hardwareConcurrency, if known. */
  cores?: number;
}

/** Physical pixels per frame above which we start a tier lower. */
export const PIXEL_BUDGET = 3_200_000;

export function initialTier(device: DeviceInfo): Tier {
  const dpr = Math.min(device.devicePixelRatio, TIERS[2].dprMax);
  const pixels = dpr * dpr * device.width * device.height;
  let tier: Tier = 2;
  if (device.coarsePointer || pixels > PIXEL_BUDGET) tier = 1;
  if (device.cores !== undefined && device.cores <= 2) tier = 0;
  return tier;
}

/** Tier forced by the URL: `?qa=1` → 2, `?tier=n` → n, else null. */
export function forcedTier(search: string): Tier | null {
  const params = new URLSearchParams(search);
  const t = params.get("tier");
  if (t === "0" || t === "1" || t === "2") return Number(t) as Tier;
  if (params.get("qa") === "1") return 2;
  return null;
}

/**
 * Below this sustained frame rate the governor steps down a tier. Just under
 * 30, so a display or power mode capped at 30 Hz (iOS Low Power Mode) keeps
 * its tier instead of always sinking to the bottom.
 */
export const MIN_FPS = 27;

/**
 * Frame-rate governor state machine. Feed it frame deltas (seconds); it
 * ignores a warm-up period (shader compiles), then judges fixed windows.
 */
export class FpsGovernor {
  private elapsed = 0;
  private frames = 0;
  private warm = 0;

  constructor(
    private readonly warmup = 1.5,
    private readonly window = 2,
  ) {}

  /**
   * Discards the current window and restarts the warm-up. Call when the page
   * was hidden: a background tab's long frames say nothing about the GPU,
   * and the first frame back carries the whole hidden interval as its delta
   * — the warm-up absorbs it instead of judging it. (Long frames are
   * otherwise counted — on the slowest devices they are the signal.)
   */
  reset(): void {
    this.elapsed = 0;
    this.frames = 0;
    this.warm = 0;
  }

  /** Returns true when the last window averaged below MIN_FPS. */
  sample(delta: number): boolean {
    if (this.warm < this.warmup) {
      this.warm += delta;
      return false;
    }
    this.elapsed += delta;
    this.frames += 1;
    if (this.elapsed < this.window) return false;
    const fps = this.frames / this.elapsed;
    this.elapsed = 0;
    this.frames = 0;
    if (fps >= MIN_FPS) return false;
    this.warm = 0; // give the new tier its own warm-up
    return true;
  }
}

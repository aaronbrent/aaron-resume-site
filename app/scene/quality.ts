/**
 * Quality tiers (docs/PLAN-STAR-SYSTEM.md §6, W5). Pure: the scene picks a
 * starting tier from the device, then a governor steps down (never up) if
 * the measured frame rate can't hold. `?qa=1` pins the top tier so visual
 * snapshots don't depend on the machine; `?tier=0|1|2` forces one (tuning).
 */

export type Tier = 0 | 1 | 2;

export interface TierSettings {
  /** Device-pixel-ratio ceiling. */
  dprMax: number;
  /** Composer MSAA samples (0 = off). */
  multisampling: number;
  /** HDR bloom on the sun and lava (the composer stays for tone mapping). */
  bloom: boolean;
  /** Planet geometry detail (PlanetBody `detail`). */
  detail: number;
  /** Dust motes drawn. */
  dust: number;
}

export const TIERS: Record<Tier, TierSettings> = {
  2: { dprMax: 1.5, multisampling: 4, bloom: true, detail: 1, dust: 420 },
  1: { dprMax: 1.25, multisampling: 0, bloom: true, detail: 0.65, dust: 260 },
  0: { dprMax: 1, multisampling: 0, bloom: false, detail: 0.45, dust: 140 },
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

/** Below this sustained frame rate the governor steps down a tier. */
export const MIN_FPS = 40;

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

  /** Returns true when the last window averaged below MIN_FPS. */
  sample(delta: number): boolean {
    // A long frame from a background tab says nothing about the GPU.
    if (delta > 0.5) return false;
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

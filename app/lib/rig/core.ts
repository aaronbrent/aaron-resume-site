import { smooth } from "./lut";

/**
 * rig-core (PLAN-3D §4): the scroll-driven damped loop shared by the 2D rider
 * rig and the 3D camera rig. One target fed by a passive scroll listener, one
 * rAF loop running a critically-damped smoother that parks when settled and
 * wakes on demand. The loop owns *when* frames happen; the apply hook owns
 * what a frame means.
 */

export interface ScrollLoopOptions {
  /** Smoother time constant, ms. */
  tauMs?: number;
  /** Distance from target below which the smoother snaps and settles. */
  settlePx?: number;
  /** Current scroll target; read on wake() and snap(). */
  getTarget(): number;
  /**
   * Renders one frame at the smoothed position. While the smoother is
   * settled, returning true keeps the loop alive for one more frame (e.g.
   * particles still in flight); the loop parks once it returns false.
   */
  apply(position: number, velocity: number, frameMs: number): boolean;
}

export interface ScrollLoop {
  /** Re-reads the target and unparks (call from the scroll listener). */
  wake(): void;
  /** Jumps to the target without smoothing and applies one frame. */
  snap(): void;
  /** Permits the loop to run; call snap()/wake() after to kick a frame. */
  start(): void;
  /** Cancels any pending frame and refuses wake() until start(). */
  stop(): void;
  readonly parked: boolean;
  readonly dropped: number;
}

export function createScrollLoop(opts: ScrollLoopOptions): ScrollLoop {
  const tauMs = opts.tauMs ?? 110;
  const settlePx = opts.settlePx ?? 0.4;
  let current = opts.getTarget();
  let target = current;
  let rafId = 0;
  let parked = true;
  let running = false;
  let lastTs = 0;
  let dropped = 0;

  function frame(ts: number) {
    const dt = lastTs ? ts - lastTs : 16.7;
    lastTs = ts;
    if (dt > 34) dropped++;
    const prev = current;
    current = smooth(current, target, dt, tauMs);
    const velocity = (current - prev) / Math.max(dt, 1);
    if (Math.abs(current - target) < settlePx) {
      current = target;
      // The apply hook may remain busy inside this same rAF (spray settling,
      // fades) — only when it reports done does the loop truly park, with one
      // final frame so telemetry reports the parked state.
      parked = false;
      if (opts.apply(current, 0, dt)) {
        rafId = requestAnimationFrame(frame);
        return;
      }
      parked = true;
      opts.apply(current, 0, dt);
      return;
    }
    opts.apply(current, velocity, dt);
    rafId = requestAnimationFrame(frame);
  }

  return {
    wake() {
      target = opts.getTarget();
      if (parked && running) {
        parked = false;
        lastTs = 0;
        rafId = requestAnimationFrame(frame);
      }
    },
    snap() {
      current = target = opts.getTarget();
      opts.apply(current, 0, 0);
    },
    start() {
      running = true;
    },
    stop() {
      cancelAnimationFrame(rafId);
      parked = true;
      running = false;
    },
    get parked() {
      return parked;
    },
    get dropped() {
      return dropped;
    },
  };
}

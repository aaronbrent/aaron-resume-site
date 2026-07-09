import type { RiderPose } from "./pose";

/** One pooled canvas effect, rendered by the rig's existing rAF (§5). */
const PARTICLE_COUNT = 128;
const FRAME_MS = 1000 / 60;

export interface SprayFrame {
  x: number;
  y: number;
  headingDeg: number;
  velocity: number;
  curvature: number;
  pose: RiderPose;
  frameMs: number;
}

export interface Spray {
  /** True while particles still need frames to fall and fade. */
  draw(frame: SprayFrame): boolean;
  destroy(): void;
}

/**
 * Preallocated particle pool: each particle uses six packed scalar channels.
 * No per-frame arrays, objects, gradients, or animation frames are created.
 */
export function createSpray(canvas: HTMLCanvasElement): Spray {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return { draw: () => false, destroy() {} };
  const ctx: CanvasRenderingContext2D = context;

  const x = new Float32Array(PARTICLE_COUNT);
  const y = new Float32Array(PARTICLE_COUNT);
  const vx = new Float32Array(PARTICLE_COUNT);
  const vy = new Float32Array(PARTICLE_COUNT);
  const life = new Float32Array(PARTICLE_COUNT);
  const maxLife = new Float32Array(PARTICLE_COUNT);
  const size = new Float32Array(PARTICLE_COUNT);
  let cursor = 0;
  let carry = 0;
  let wasBraking = false;
  let dpr = 1;
  let color = "#ffffff";

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    color =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-powder")
        .trim() || "#ffffff";
  }

  function spawn(frame: SprayFrame, count: number) {
    const board = (frame.headingDeg * Math.PI) / 180;
    // Snow leaves the trailing edge, approximately perpendicular to the board.
    const outward = board + Math.PI / 2;
    const edge = Math.min(1, Math.abs(frame.curvature) / 55);
    const speed = Math.min(7, Math.abs(frame.velocity));
    for (let n = 0; n < count; n++) {
      const i = cursor;
      cursor = (cursor + 1) % PARTICLE_COUNT;
      const spread = (Math.random() - 0.5) * (0.9 + edge * 0.7);
      const force = 0.35 + Math.random() * (0.7 + speed * 0.16);
      x[i] = frame.x + Math.cos(board) * (Math.random() - 0.5) * 13;
      y[i] = frame.y + Math.sin(board) * (Math.random() - 0.5) * 6;
      vx[i] = Math.cos(outward + spread) * force + frame.velocity * 0.1;
      vy[i] = Math.sin(outward + spread) * force - 0.22 - Math.random() * 0.3;
      maxLife[i] = 260 + Math.random() * 260;
      life[i] = maxLife[i]!;
      size[i] = 1 + Math.random() * (1.5 + edge * 1.5);
    }
  }

  function drawParticles(dt: number): boolean {
    const step = Math.min(3, Math.max(0, dt / FRAME_MS));
    let alive = false;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.fillStyle = color;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (life[i]! <= 0) continue;
      life[i] = life[i]! - dt;
      if (life[i]! <= 0) continue;
      alive = true;
      x[i] = x[i]! + vx[i]! * step;
      y[i] = y[i]! + vy[i]! * step;
      vy[i] = vy[i]! + 0.035 * step;
      vx[i] = vx[i]! * 0.985;
      const alpha = Math.max(0, life[i]! / maxLife[i]!);
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillRect(x[i]!, y[i]!, size[i]!, size[i]!);
    }
    ctx.globalAlpha = 1;
    return alive;
  }

  const onResize = () => resize();
  window.addEventListener("resize", onResize, { passive: true });
  resize();

  return {
    draw(frame) {
      const edge = Math.min(1, Math.abs(frame.curvature) / 55);
      const rate = Math.abs(frame.velocity) * edge * 4;
      carry += rate * (Math.min(50, Math.max(0, frame.frameMs)) / FRAME_MS);
      const emitted = Math.min(7, Math.floor(carry));
      if (emitted) {
        carry -= emitted;
        spawn(frame, emitted);
      }

      // The base gets the same emitter with a 10× burst multiplier (§5).
      const braking = frame.pose === "brake";
      if (braking && !wasBraking) {
        spawn(frame, Math.min(PARTICLE_COUNT, Math.max(10, emitted || 1) * 10));
      }
      wasBraking = braking;
      return drawParticles(frame.frameMs);
    },
    destroy() {
      window.removeEventListener("resize", onResize);
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    },
  };
}

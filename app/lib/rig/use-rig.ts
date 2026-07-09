import { useLayoutEffect, useRef } from "react";
import { trails } from "~/content/trails";
import { samplePath } from "~/lib/trail/validate";
import { buildLut, sampleLut, smooth, type Lut } from "./lut";

/**
 * The scroll rig (PLAN ADR-2): one passive scroll listener writes the target;
 * one rAF loop runs a time-based smoother, samples the LUT, and writes a
 * transform to the rider ref. The loop parks when settled and wakes on the
 * next scroll. React never re-renders from this — pure imperative writes.
 *
 * Init order (§3): breakpoint → current scroll → synchronous snap placement
 * (before first paint, closes the deep-link flash window) → LUT → listeners.
 */

export const RIDER_SCREEN_ANCHOR = 0.38; // rider parks at 38% of viewport height
const TAU_MS = 110; // smoother time constant — HUD-tunable territory (risk #2)
const SETTLE_PX = 0.4;

export interface RigTelemetry {
  t: number;
  thetaDeg: number;
  dThetaDy: number;
  velocity: number; // px/ms of smoothed scroll
  frameMs: number;
  dropped: number;
  parked: boolean;
}

interface RigRefs {
  rider: HTMLElement;
  container: HTMLElement;
}

export function startRig(
  { rider, container }: RigRefs,
  onFrame?: (t: RigTelemetry) => void,
): () => void {
  const desktopQuery = window.matchMedia("(min-width: 768px)");
  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let lut: Lut = buildVariantLut(desktopQuery.matches);
  let containerW = container.offsetWidth;
  let containerH = container.offsetHeight;
  let current = window.scrollY;
  let target = current;
  let rafId = 0;
  let parked = true;
  let lastTs = 0;
  let lastCurrent = current;
  let dropped = 0;
  let active = false;

  function buildVariantLut(desktop: boolean): Lut {
    const variant = desktop ? trails.desktop : trails.mobile;
    return buildLut(samplePath(variant.d, 24), 2000);
  }

  function apply(scrollPos: number, velocity: number, frameMs: number) {
    const anchorY = scrollPos + window.innerHeight * RIDER_SCREEN_ANCHOR;
    const t = Math.min(1, Math.max(0, anchorY / containerH));
    const s = sampleLut(lut, t);
    const sx = containerW / 1000;
    const sy = containerH / lut.height;
    const xPx = s.x * sx;
    const yPx = t * containerH;
    // Screen-space tangent under the non-uniform viewBox stretch.
    const thetaScreen = Math.atan2(sy * Math.sin(s.theta), sx * Math.cos(s.theta));
    const thetaDeg = (thetaScreen * 180) / Math.PI - 90; // 0 = board across the fall line
    rider.style.transform = `translate3d(${xPx.toFixed(2)}px, ${yPx.toFixed(2)}px, 0) rotate(${thetaDeg.toFixed(2)}deg)`;
    onFrame?.({
      t,
      thetaDeg,
      dThetaDy: s.dThetaDy,
      velocity,
      frameMs,
      dropped,
      parked,
    });
  }

  function frame(ts: number) {
    const dt = lastTs ? ts - lastTs : 16.7;
    lastTs = ts;
    if (dt > 34) dropped++;
    current = smooth(current, target, dt, TAU_MS);
    const velocity = (current - lastCurrent) / Math.max(dt, 1);
    lastCurrent = current;
    if (Math.abs(current - target) < SETTLE_PX) {
      current = target;
      parked = true;
      apply(current, 0, dt);
      return; // park: no rAF churn at rest
    }
    apply(current, velocity, dt);
    rafId = requestAnimationFrame(frame);
  }

  function wake() {
    target = window.scrollY;
    if (parked && active) {
      parked = false;
      lastTs = 0;
      rafId = requestAnimationFrame(frame);
    }
  }

  function measure() {
    containerW = container.offsetWidth;
    containerH = container.offsetHeight;
  }

  function snap() {
    if (!active) return; // reduced motion: the rig never writes transforms
    measure();
    current = target = window.scrollY;
    apply(current, 0, 0);
  }

  function onBreakpoint() {
    lut = buildVariantLut(desktopQuery.matches);
    snap(); // discrete, rare: one-frame re-init is acceptable (§2)
  }

  function setActive(on: boolean) {
    if (on === active) return;
    active = on;
    rider.dataset.rigActive = on ? "true" : "false";
    if (on) {
      rider.style.left = "0";
      rider.style.top = "0";
      snap();
      wake();
    } else {
      cancelAnimationFrame(rafId);
      parked = true;
      rider.style.transform = "";
      rider.style.left = "";
      rider.style.top = "";
    }
  }

  // §3 init order: snap placement happens synchronously inside useLayoutEffect
  // (this function), before the browser paints the hydrated frame.
  const ro = new ResizeObserver(() => {
    measure();
    snap();
  });
  ro.observe(container);
  const onScroll = () => wake();
  const onPageShow = () => snap(); // bfcache restore re-sync
  const onReduced = () => setActive(!reducedQuery.matches);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pageshow", onPageShow);
  reducedQuery.addEventListener("change", onReduced);
  desktopQuery.addEventListener("change", onBreakpoint);
  setActive(!reducedQuery.matches);

  return () => {
    setActive(false);
    ro.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("pageshow", onPageShow);
    reducedQuery.removeEventListener("change", onReduced);
    desktopQuery.removeEventListener("change", onBreakpoint);
  };
}

/** Mounts the rig against #rider / .run-container once, pre-paint. */
export function useRig(onFrame?: (t: RigTelemetry) => void) {
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  useLayoutEffect(() => {
    const rider = document.querySelector<HTMLElement>("[data-rider]");
    const container = document.querySelector<HTMLElement>(".run-container");
    if (!rider || !container) return;
    return startRig({ rider, container }, (t) => onFrameRef.current?.(t));
  }, []);
}

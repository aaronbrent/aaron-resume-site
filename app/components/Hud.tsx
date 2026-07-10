import { useEffect, useState } from "react";
import type { RigTelemetry } from "~/lib/rig/use-rig";
import type { Rig3dTelemetry } from "~/lib/rig3d/rig3d";

/**
 * Dev HUD (PLAN §6, PLAN-3D §5): live rig telemetry behind ?hud=1 for both
 * tiers. Client-only (never SSR'd), written imperatively per frame — it must
 * not cause React renders.
 */
export function Hud() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(new URLSearchParams(window.location.search).get("hud") === "1");
  }, []);
  useEffect(() => {
    // Wake the (possibly parked) rig for one frame so the panel fills
    // immediately instead of waiting for the next real scroll.
    if (enabled) window.dispatchEvent(new Event("scroll"));
  }, [enabled]);
  if (!enabled) return null;
  return (
    <div
      id="hud"
      className="fixed right-2 top-2 z-50 w-44 border border-ink bg-ink/90 p-2 font-mono text-[11px] leading-relaxed text-powder"
    >
      <div data-hud="tier" />
      <div data-hud="t" />
      <div data-hud="theta" />
      <div data-hud="curve" />
      <div data-hud="vel" />
      <div data-hud="pose" />
      <div data-hud="lean" />
      <div data-hud="spray" />
      <div data-hud="draws" />
      <div data-hud="dpr" />
      <div data-hud="frame" />
      <div data-hud="dropped" />
      <div data-hud="state" />
    </div>
  );
}

function set(k: string, v: string) {
  const n = document.querySelector(`#hud [data-hud="${k}"]`);
  if (n) n.textContent = v;
}

export function writeHud(tel: RigTelemetry) {
  if (!document.getElementById("hud")) return;
  set("tier", "tier    1 · map");
  set("t", `t       ${tel.t.toFixed(4)}`);
  set("theta", `θ       ${tel.thetaDeg.toFixed(1)}°`);
  set("curve", `dθ/dy   ${tel.dThetaDy.toExponential(2)}`);
  set("vel", `vel     ${tel.velocity.toFixed(2)} px/ms`);
  set("pose", `pose    ${tel.pose}`);
  set("lean", `lean    ${tel.leanDeg.toFixed(1)}° / ${tel.crouch.toFixed(2)}`);
  set("spray", `spray   ${tel.sprayActive ? "active" : "off"}`);
  set("draws", "");
  set("dpr", "");
  set("frame", `frame   ${tel.frameMs.toFixed(1)} ms`);
  set("dropped", `dropped ${tel.dropped}`);
  set("state", tel.parked ? "parked" : "running");
}

export function writeHud3d(tel: Rig3dTelemetry) {
  if (!document.getElementById("hud")) return;
  set("tier", "tier    2 · ride");
  set("t", `t       ${tel.t.toFixed(4)}`);
  set("theta", `init    ${tel.initMs} ms`);
  set("curve", `fov     ${tel.fovDeg.toFixed(1)}°`);
  set("vel", `vel     ${tel.velocity.toFixed(2)} px/ms`);
  set("pose", "");
  set("lean", "");
  set("spray", "");
  set("draws", `draws   ${tel.draws}`);
  set("dpr", `dpr     ${tel.dpr.toFixed(2)}`);
  set("frame", `frame   ${tel.frameMs.toFixed(1)} ms`);
  set("dropped", `dropped ${tel.dropped}`);
  set("state", tel.parked ? "parked" : "running");
}

import { useLayoutEffect, useRef } from "react";
import { DifficultyIcon } from "~/components/DifficultyIcon";
import { closedTrail } from "~/content/closed-trail";
import type { Waypoint } from "~/content/types";
import { waypoints } from "~/content/waypoints";
import { startRig3d, type Rig3dTelemetry } from "~/lib/rig3d/rig3d";

/**
 * Tier 2's visual layer (PLAN-3D §4): the lazy-loaded 3D viewport. This
 * module (and everything it imports, including three.js) lives in its own
 * chunk — the document never waits on it. aria-hidden, pointer-events none:
 * presentation only, the flow document stays the site (and stays the screen
 * reader's, keyboard's, and printer's copy — these panels are its shadow).
 *
 * Three DOM layers ride with the canvas:
 * - the sign layer: real text panels matrix3d-projected onto the 3D trail
 *   signs (ADR-8), expanding while the ride dwells in a sign's read zone;
 * - the POV rider (§5): board nose + mitten sprites driven via CSS variables.
 */

const years = (period: Waypoint["period"]) =>
  `${period.start.slice(0, 4)}—${
    period.end === "present" ? "Now" : period.end.slice(0, 4)
  }`;

function SignCard({ waypoint }: { waypoint: Waypoint }) {
  return (
    <div className="sign-card">
      <p className="sign-kicker">
        <DifficultyIcon difficulty={waypoint.difficulty} />
        <span>{waypoint.trailName}</span>
      </p>
      <p className="sign-org">{waypoint.org}</p>
      <p className="sign-meta">
        {waypoint.role} · {years(waypoint.period)}
      </p>
      <p className="sign-claim">{waypoint.claim}</p>
      <div className="sign-more">
        <ul>
          {waypoint.evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="sign-why">{waypoint.whyCare}</p>
      </div>
    </div>
  );
}

function ClosedTrailCard() {
  return (
    <div className="sign-card">
      <p className="sign-kicker">
        <span className="sign-rope" />
        <span>Closed · {closedTrail.trailName}</span>
      </p>
      <p className="sign-org">Closed trail</p>
      <p className="sign-meta">{closedTrail.period}</p>
      <p className="sign-claim">{closedTrail.story}</p>
    </div>
  );
}

function SignPanel({ waypoint }: { waypoint: Waypoint }) {
  return (
    <div className="sign-panel" data-sign-id={waypoint.id} data-side={waypoint.side}>
      <SignCard waypoint={waypoint} />
    </div>
  );
}

export default function DropIn({
  onFrame,
  onReady,
  onFallback,
}: {
  onFrame?: (t: Rig3dTelemetry) => void;
  onReady?: () => void;
  onFallback: (reason: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const povRef = useRef<HTMLDivElement>(null);
  const signLayerRef = useRef<HTMLDivElement>(null);
  const signCameraRef = useRef<HTMLDivElement>(null);
  const hooks = useRef({ onFrame, onReady, onFallback });
  hooks.current = { onFrame, onReady, onFallback };
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const container = document.querySelector<HTMLElement>(".run-container");
    if (!canvas || !container) return;
    const panels = new Map<string, HTMLElement>();
    signCameraRef.current
      ?.querySelectorAll<HTMLElement>("[data-sign-id]")
      .forEach((el) => panels.set(el.dataset.signId!, el));
    const sheets = new Map<string, HTMLElement>();
    signLayerRef.current
      ?.querySelectorAll<HTMLElement>("[data-sheet-id]")
      .forEach((el) => sheets.set(el.dataset.sheetId!, el));
    return startRig3d({
      canvas,
      container,
      pov: povRef.current,
      signs:
        signLayerRef.current && signCameraRef.current
          ? {
              layer: signLayerRef.current,
              cameraEl: signCameraRef.current,
              panels,
              sheets,
            }
          : null,
      onFrame: (t) => hooks.current.onFrame?.(t),
      onReady: () => hooks.current.onReady?.(),
      onFallback: (reason) => hooks.current.onFallback(reason),
    });
  }, []);
  return (
    <div aria-hidden="true" role="presentation" data-print-hidden="true">
      <canvas ref={canvasRef} className="run-canvas" data-run-canvas />
      <div ref={povRef} className="pov-rider" data-pov-rider>
        <img
          className="pov-arm"
          src="/art/pov-arm.webp"
          alt=""
          draggable={false}
          decoding="async"
        />
        <img
          className="pov-board"
          src="/art/pov-board.webp"
          alt=""
          draggable={false}
          decoding="async"
        />
      </div>
      <div ref={signLayerRef} className="sign-layer" data-sign-layer>
        <div ref={signCameraRef} className="sign-camera">
          {waypoints.map((waypoint) => (
            <SignPanel key={waypoint.id} waypoint={waypoint} />
          ))}
          <div
            className="sign-panel"
            data-sign-id={closedTrail.id}
            data-side="left"
            data-closed
          >
            <ClosedTrailCard />
          </div>
        </div>
        {/* Narrow-viewport read pose (ADR-8): on phones the dwell presents a
            full-width sheet instead of growing the world-anchored panel. The
            rig flips data-active; React never re-renders. */}
        <div className="sign-sheet">
          {waypoints.map((waypoint) => (
            <div
              key={waypoint.id}
              className="sign-sheet-card"
              data-sheet-id={waypoint.id}
            >
              <SignCard waypoint={waypoint} />
            </div>
          ))}
          <div className="sign-sheet-card" data-sheet-id={closedTrail.id} data-closed>
            <ClosedTrailCard />
          </div>
        </div>
      </div>
    </div>
  );
}

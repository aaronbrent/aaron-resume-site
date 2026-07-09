import { trails } from "~/content/trails";
import type { CSSProperties } from "react";

const summitX = (d: string) => Number(d.trim().split(/[\s,]+/)[1]) / 10; // → %

const parkCss = `
.rider-park { left: ${summitX(trails.mobile.d)}%; top: 12px; }
@media (min-width: 768px) { .rider-park { left: ${summitX(trails.desktop.d)}%; } }
`;

/**
 * The rider (PLAN §5): server-rendered parked at the summit — the exact spot
 * the rig's first frame computes, so hydration never flashes. The rig takes
 * over transforms imperatively; under reduced motion / no JS he stays parked.
 * The glyph is offset so the board-contact point sits on the element origin —
 * the rig's translate lands the contact point on the trail, and rotation
 * pivots around it.
 */
export function Rider() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: parkCss }} />
      <div
        data-rider
        data-pose="idle"
        className="rider-park absolute z-[5] will-change-transform"
        style={{ "--lean": "0deg", "--crouch": "0" } as CSSProperties}
      >
        <svg
          className="rider-svg"
          width="44"
          height="54"
          viewBox="0 0 44 54"
          style={{ transform: "translate(-50%, -96%)" }}
          focusable="false"
        >
          <g className="rider-pose">
            {/* board */}
            <g className="rider-board">
              <rect x="4" y="48" width="36" height="5" rx="2.5" fill="var(--color-ink)" />
            </g>
            {/* back + front legs */}
            <path
              className="rider-legs"
              d="M 17 36 L 14 48 M 27 36 L 30 48"
              stroke="var(--color-ink)"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            <g className="rider-body">
              {/* torso (patrol jacket) */}
              <path d="M 15 20 L 29 20 L 27 38 L 17 38 Z" fill="var(--color-patrol)" />
              {/* arms */}
              <path
                className="rider-arms"
                d="M 16 23 L 8 30 M 28 23 L 36 28"
                stroke="var(--color-patrol)"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* head + goggles */}
              <circle cx="22" cy="12" r="7" fill="var(--color-ink)" />
              <rect
                className="rider-goggles"
                x="16.5"
                y="9"
                width="11"
                height="4"
                rx="2"
                fill="var(--color-bluebird)"
              />
            </g>
          </g>
        </svg>
      </div>
    </>
  );
}

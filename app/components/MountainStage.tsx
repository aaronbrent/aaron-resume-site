import type { TrailVariant } from "~/content/trails";
import { trails } from "~/content/trails";
import { waypoints } from "~/content/waypoints";
import type { Difficulty } from "~/content/types";
import { samplePath } from "~/lib/trail/validate";

/**
 * The visual layer (PLAN §3): aria-hidden, presentation only, complete and
 * correct-looking with zero JS — this IS the reduced-motion/no-JS backdrop.
 * Both breakpoint variants are server-rendered; CSS displays exactly one.
 */

function Diamond({ cx, cy, s = 8 }: { cx: number; cy: number; s?: number }) {
  return (
    <path
      d={`M ${cx} ${cy - s} L ${cx + s} ${cy} L ${cx} ${cy + s} L ${cx - s} ${cy} Z`}
      fill="var(--color-ink)"
    />
  );
}

function DifficultyGlyph({ d, cx, cy }: { d: Difficulty; cx: number; cy: number }) {
  switch (d) {
    case "green":
      return <circle cx={cx} cy={cy} r={7} fill="var(--color-evergreen)" />;
    case "blue":
      return (
        <rect x={cx - 7} y={cy - 7} width={14} height={14} fill="var(--color-bluebird)" />
      );
    case "black":
      return <Diamond cx={cx} cy={cy} />;
    case "double-black":
      return (
        <>
          <Diamond cx={cx - 6} cy={cy} s={7} />
          <Diamond cx={cx + 6} cy={cy} s={7} />
        </>
      );
  }
}

/** Deterministic PRNG so server render === client hydration, always. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Tree({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d={`M 0 ${-14 * s} L ${9 * s} ${4 * s} L ${-9 * s} ${4 * s} Z`}
        fill="var(--color-evergreen)"
        opacity="0.75"
      />
      <rect
        x={-1.5 * s}
        y={4 * s}
        width={3 * s}
        height={5 * s}
        fill="var(--color-ink)"
        opacity="0.5"
      />
    </g>
  );
}

function TrailSvg({ variant, id }: { variant: TrailVariant; id: string }) {
  const [w, h] = variant.viewBox;
  const pts = samplePath(variant.d, 8);
  const xAt = (y: number) => {
    let best = pts[0]!;
    for (const p of pts) if (Math.abs(p[1] - y) < Math.abs(best[1] - y)) best = p;
    return best[0];
  };

  // Scattered treeline, kept out of the trail corridor. Seeded: SSR == client.
  const rand = mulberry32(1337);
  const trees: Array<{ x: number; y: number; s: number }> = [];
  const target = Math.round(h / 160);
  for (let i = 0; i < target * 4 && trees.length < target; i++) {
    const y = 120 + rand() * (h - 300);
    const x = 30 + rand() * 940;
    const s = 1.6 + rand() * 1.6;
    if (Math.abs(x - xAt(y)) < 150) continue;
    trees.push({ x, y, s: Math.round(s * 10) / 10 });
  }

  // Contour lines: gentle horizontal squiggles, printed-map style.
  const contours: string[] = [];
  const contourCount = Math.max(4, Math.round(h / 1400));
  for (let i = 0; i < contourCount; i++) {
    const y = ((i + 0.7) / (contourCount + 0.5)) * h;
    const amp = 14 + rand() * 22;
    let d = `M -20 ${y.toFixed(0)}`;
    for (let x = 100; x <= 1060; x += 120) {
      const dy = (rand() - 0.5) * amp * 2;
      d += ` Q ${x - 60} ${(y + dy).toFixed(0)} ${x} ${y.toFixed(0)}`;
    }
    contours.push(d);
  }

  // Gondola lift line: straight run from base area back up to the summit.
  const liftTop = { x: 120, y: 40 };
  const liftBottom = { x: 210, y: h - 160 };
  const towers = 7;

  const summitX = pts[0]![0];
  const markers = variant.markers;
  const wpById = new Map<string, (typeof waypoints)[number]>(
    waypoints.map((wp) => [wp.id, wp]),
  );

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={`trail-svg trail-svg-${id} absolute inset-0 h-full w-full`}
      focusable="false"
    >
      {/* contours */}
      {contours.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth="1.2"
          opacity="0.08"
        />
      ))}

      {/* treeline */}
      {trees.map((t) => (
        <Tree key={`${t.x}-${t.y}`} {...t} />
      ))}

      {/* lift line + towers + parked cabin at the summit station */}
      <line
        x1={liftBottom.x}
        y1={liftBottom.y}
        x2={liftTop.x}
        y2={liftTop.y}
        stroke="var(--color-ink)"
        strokeWidth="2"
        strokeDasharray="2 10"
        opacity="0.55"
      />
      {Array.from({ length: towers }, (_, i) => {
        const f = (i + 0.5) / towers;
        const x = liftBottom.x + (liftTop.x - liftBottom.x) * f;
        const y = liftBottom.y + (liftTop.y - liftBottom.y) * f;
        return (
          <line
            key={i}
            x1={x - 8}
            y1={y + 10}
            x2={x + 8}
            y2={y - 10}
            stroke="var(--color-ink)"
            strokeWidth="2.5"
            opacity="0.5"
          />
        );
      })}
      <g transform={`translate(${liftTop.x + 14} ${liftTop.y + 26})`} opacity="0.9">
        <line x1="0" y1="-14" x2="0" y2="-4" stroke="var(--color-ink)" strokeWidth="2" />
        <rect
          x="-11"
          y="-4"
          width="22"
          height="18"
          rx="3"
          fill="var(--color-powder)"
          stroke="var(--color-ink)"
          strokeWidth="2"
        />
        <rect
          x="-5"
          y="1"
          width="10"
          height="7"
          fill="var(--color-bluebird)"
          opacity="0.6"
        />
      </g>

      {/* the run: powder casing + ink line */}
      <path
        d={variant.d}
        fill="none"
        stroke="var(--color-powder)"
        strokeWidth="22"
        strokeLinecap="round"
      />
      <path
        d={variant.d}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="3.5"
        strokeDasharray="14 10"
        strokeLinecap="round"
      />

      {/* parked rider at the drop-in (Phase 3 takes over the transforms) */}
      <g transform={`translate(${summitX} 26)`} data-rider-parked="true">
        <circle cx="0" cy="-26" r="7" fill="var(--color-ink)" />
        <path d="M -3 -19 L 3 -19 L 6 -2 L -6 -2 Z" fill="var(--color-patrol)" />
        <rect x="-16" y="2" width="32" height="4" rx="2" fill="var(--color-ink)" />
      </g>

      {/* waypoint markers with difficulty geometry */}
      {markers.map((m) => {
        const wp = wpById.get(m.id);
        if (!wp) return null;
        return (
          <g key={m.id} data-marker={m.id} transform={`translate(${m.x} ${m.y})`}>
            <circle
              r="17"
              fill="var(--color-powder)"
              stroke="var(--color-ink)"
              strokeWidth="2.5"
            />
            <DifficultyGlyph d={wp.difficulty} cx={0} cy={0} />
          </g>
        );
      })}
    </svg>
  );
}

export function MountainStage() {
  return (
    <div
      aria-hidden="true"
      role="presentation"
      className="absolute inset-0"
      data-print-hidden="true"
    >
      <TrailSvg variant={trails.mobile} id="mobile" />
      <TrailSvg variant={trails.desktop} id="desktop" />
      {/* fold creases: the map lived a season folded in a jacket pocket */}
      <div className="fold-crease-h" />
      <div className="fold-crease-v" />
    </div>
  );
}

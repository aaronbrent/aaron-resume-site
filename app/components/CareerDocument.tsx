import { DifficultyIcon } from "~/components/DifficultyIcon";
import { closedTrail } from "~/content/closed-trail";
import { runMeta } from "~/content/meta";
import { skills } from "~/content/skills";
import type { Waypoint } from "~/content/types";
import { waypoints } from "~/content/waypoints";
import { deriveRunHeightSvh } from "~/lib/run-height";

const skillLabel = new Map(skills.map((s) => [s.id, s.label]));
const runHeightSvh = deriveRunHeightSvh(runMeta, waypoints.length);

function formatPeriod(period: Waypoint["period"]): string {
  const fmt = (ym: string) => {
    const [y, m] = ym.split("-");
    const names = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
    return `${names[Number(m) - 1]} ${y}`;
  };
  const end = period.end === "present" ? "Present" : fmt(period.end);
  return `${fmt(period.start)} — ${end}`;
}

function WaypointSection({ waypoint }: { waypoint: Waypoint }) {
  return (
    <section
      id={waypoint.id}
      data-waypoint
      aria-labelledby={`${waypoint.id}-title`}
      className={`reveal scroll-mt-24 border border-ink/20 bg-powder/95 p-6 shadow-sm sm:p-8 ${
        waypoint.side === "right" ? "md:col-start-2" : "md:col-start-1"
      }`}
    >
      <p className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em]">
        <DifficultyIcon difficulty={waypoint.difficulty} />
        <span>{waypoint.trailName}</span>
      </p>
      <h2
        id={`${waypoint.id}-title`}
        className="mt-3 font-display text-4xl font-bold uppercase tracking-wide"
      >
        {waypoint.org}
      </h2>
      <p className="mt-1 text-sm text-ink/70">
        {waypoint.role} · {formatPeriod(waypoint.period)}
      </p>
      <p className="mt-5 text-lg font-semibold leading-relaxed">{waypoint.claim}</p>
      <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed">
        {waypoint.evidence.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-5 border-l-4 border-patrol pl-4 italic leading-relaxed">
        {waypoint.whyCare}
      </p>
      <ul className="mt-5 flex flex-wrap gap-2" aria-label="Skills used">
        {waypoint.tech.map((id) => (
          <li
            key={id}
            className="rounded-sm border border-ink/25 bg-powder px-2 py-0.5 text-xs"
          >
            {skillLabel.get(id)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClosedTrailSection() {
  return (
    <section
      id={closedTrail.id}
      data-closed-trail-card
      aria-labelledby={`${closedTrail.id}-title`}
      className="closed-trail-card reveal scroll-mt-24 border-2 border-patrol/70 bg-powder/95 p-6 shadow-sm md:col-start-1 sm:p-8"
    >
      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-patrol-deep">
        Closed · {closedTrail.trailName}
      </p>
      <h2
        id={`${closedTrail.id}-title`}
        className="mt-3 font-display text-4xl font-bold uppercase tracking-wide"
      >
        Closed trail
      </h2>
      <p className="mt-1 text-sm text-ink/70">{closedTrail.period}</p>
      <p className="mt-5 max-w-prose leading-relaxed">{closedTrail.story}</p>
    </section>
  );
}

/**
 * The run (§2): waypoint sections positioned at t × runHeight, exactly where
 * the SVG marker sits — pure data, no client facts. DOM order = t order.
 * Desktop honors `side`; mobile is always a full-width card.
 */
export function CareerDocument() {
  return (
    <>
      <h2 className="sr-only">The run — career history</h2>
      {waypoints.map((waypoint) => (
        <div
          key={waypoint.id}
          className="waypoint-slot absolute inset-x-0"
          style={{ top: `calc(${waypoint.t} * ${runHeightSvh}svh)` }}
        >
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 sm:px-8 md:grid-cols-2 md:px-14">
            <WaypointSection waypoint={waypoint} />
          </div>
        </div>
      ))}
      <div
        className="waypoint-slot absolute inset-x-0"
        style={{ top: `calc(${closedTrail.t} * ${runHeightSvh}svh)` }}
      >
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 sm:px-8 md:grid-cols-2 md:px-14">
          <ClosedTrailSection />
        </div>
      </div>
    </>
  );
}

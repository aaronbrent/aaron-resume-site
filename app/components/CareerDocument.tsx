import { DifficultyIcon } from "~/components/DifficultyIcon";
import { skills } from "~/content/skills";
import type { Waypoint } from "~/content/types";
import { waypoints } from "~/content/waypoints";

const skillLabel = new Map(skills.map((s) => [s.id, s.label]));

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
      aria-labelledby={`${waypoint.id}-title`}
      className="scroll-mt-24 border-t border-ink/15 py-14"
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
      <p className="mt-5 max-w-2xl text-lg font-semibold leading-relaxed">
        {waypoint.claim}
      </p>
      <ul className="mt-4 max-w-2xl list-disc space-y-2 pl-5 leading-relaxed">
        {waypoint.evidence.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-5 max-w-2xl border-l-4 border-patrol pl-4 italic leading-relaxed">
        {waypoint.whyCare}
      </p>
      <ul className="mt-5 flex max-w-2xl flex-wrap gap-2" aria-label="Skills used">
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

export function CareerDocument() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6">
      <h2 className="sr-only">The run — career history</h2>
      {waypoints.map((waypoint) => (
        <WaypointSection key={waypoint.id} waypoint={waypoint} />
      ))}
    </div>
  );
}

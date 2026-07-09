import { describe, expect, it } from "vitest";
import { closedTrail } from "./closed-trail";
import { gondolaCredits } from "./gondola";
import { runMeta } from "./meta";
import { skills } from "./skills";
import { waypoints } from "./waypoints";

const MIN_DWELL_T = 0.1; // §2: waypoint t spacing ≥ minimum dwell

describe("waypoints", () => {
  it("has unique ids", () => {
    const ids = waypoints.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every t in (0, 1), strictly increasing (DOM order = t order)", () => {
    for (const w of waypoints) {
      expect(w.t).toBeGreaterThan(0);
      expect(w.t).toBeLessThan(1);
    }
    for (let i = 1; i < waypoints.length; i++) {
      expect(waypoints[i]!.t).toBeGreaterThan(waypoints[i - 1]!.t);
    }
  });

  it("spaces waypoints at least the minimum dwell apart", () => {
    for (let i = 1; i < waypoints.length; i++) {
      expect(waypoints[i]!.t - waypoints[i - 1]!.t).toBeGreaterThanOrEqual(MIN_DWELL_T);
    }
  });

  it("has 2–4 concrete evidence bullets per waypoint (§4)", () => {
    for (const w of waypoints) {
      expect(w.evidence.length).toBeGreaterThanOrEqual(2);
      expect(w.evidence.length).toBeLessThanOrEqual(4);
    }
  });

  it("cross-references only skills that exist in the legend", () => {
    const known = new Set(skills.map((s) => s.id));
    for (const w of waypoints) {
      for (const t of w.tech) expect(known.has(t)).toBe(true);
    }
  });

  it("uses valid ISO year-month periods in chronological order", () => {
    const ym = /^\d{4}-(0[1-9]|1[0-2])$/;
    for (const w of waypoints) {
      expect(w.period.start).toMatch(ym);
      if (w.period.end !== "present") {
        expect(w.period.end).toMatch(ym);
        expect(w.period.end > w.period.start).toBe(true);
      }
    }
  });

  it("one named run per waypoint, names unique (restraint rule §4)", () => {
    const names = waypoints.map((w) => w.trailName);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("skills legend", () => {
  it("has unique ids and non-empty labels", () => {
    const ids = skills.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of skills) expect(s.label.length).toBeGreaterThan(0);
  });
});

describe("gondola", () => {
  it("keeps the ride short: 3–5 credits (§5)", () => {
    expect(gondolaCredits.length).toBeGreaterThanOrEqual(3);
    expect(gondolaCredits.length).toBeLessThanOrEqual(5);
  });
});

describe("closed trail", () => {
  it("is a concise, post-run story placed after the career waypoints", () => {
    expect(closedTrail.id).toBe("closed-trail");
    expect(closedTrail.t).toBeGreaterThan(waypoints.at(-1)!.t);
    expect(closedTrail.t).toBeLessThan(1);
    expect(closedTrail.story.length).toBeLessThanOrEqual(240);
  });
});

describe("run meta", () => {
  it("matches the §2 derivation for the current waypoint count", () => {
    const total =
      runMeta.introSvh + waypoints.length * runMeta.dwellSvh + runMeta.outroSvh;
    expect(total).toBe(880);
  });
});

import { describe, expect, it } from "vitest";
import { educationCredits } from "./education";
import { formatPeriod, formatYearMonth } from "./format";
import { planets } from "./planets";
import { skills } from "./skills";

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

describe("planets", () => {
  it("has five planets with unique ids", () => {
    const ids = planets.map((p) => p.id);
    expect(ids).toEqual(["sofi", "public", "empirium", "nuvalabs", "topstep"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps index equal to array position (orbit order)", () => {
    planets.forEach((p, i) => expect(p.index).toBe(i));
  });

  it("uses valid year-month periods, chronological and non-overlapping", () => {
    planets.forEach((p, i) => {
      expect(p.period.start).toMatch(YM);
      const isLast = i === planets.length - 1;
      if (isLast) {
        expect(p.period.end).toBe("present");
      } else {
        expect(p.period.end).toMatch(YM);
        expect(p.period.end >= p.period.start).toBe(true);
        expect(planets[i + 1]!.period.start > p.period.end).toBe(true);
      }
    });
  });

  it("has 2–4 evidence bullets per planet", () => {
    for (const p of planets) {
      expect(p.evidence.length).toBeGreaterThanOrEqual(2);
      expect(p.evidence.length).toBeLessThanOrEqual(4);
    }
  });

  it("cross-references only skills that exist", () => {
    const known = new Set<string>(skills.map((s) => s.id));
    for (const p of planets) {
      for (const t of p.tech) expect(known.has(t)).toBe(true);
    }
  });

  it("places orbits strictly outward with unique nicknames", () => {
    for (let i = 1; i < planets.length; i++) {
      expect(planets[i]!.visual.orbitRadius).toBeGreaterThan(
        planets[i - 1]!.visual.orbitRadius,
      );
    }
    const names = planets.map((p) => p.nickname);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps the May → Oct 2026 gap visible (no filler)", () => {
    const nuva = planets.find((p) => p.id === "nuvalabs")!;
    const topstep = planets.find((p) => p.id === "topstep")!;
    expect(nuva.period.end).toBe("2026-05");
    expect(topstep.period.start).toBe("2026-10");
  });
});

describe("skills", () => {
  it("has unique ids and non-empty labels", () => {
    const ids = skills.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of skills) expect(s.label.length).toBeGreaterThan(0);
  });
});

describe("education", () => {
  it("keeps the list short: 3–5 credits", () => {
    expect(educationCredits.length).toBeGreaterThanOrEqual(3);
    expect(educationCredits.length).toBeLessThanOrEqual(5);
  });
});

describe("formatPeriod", () => {
  it("renders month names and Present", () => {
    expect(formatYearMonth("2024-06")).toBe("Jun 2024");
    expect(formatPeriod({ start: "2026-10", end: "present" })).toBe("Oct 2026 — Present");
  });
});

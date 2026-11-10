import type { EducationCredit } from "./types";

/** Education + personal projects, listed on /resume. */
export const educationCredits = [
  {
    year: "2014–17",
    label:
      "My Menu Plans — built, ran, and sunset a meal-planning product solo; WordPress → React/Node",
  },
  { year: "2016", label: "freeCodeCamp — Full Stack certification" },
  { year: "2017", label: "V School — full-stack immersive" },
] as const satisfies readonly EducationCredit[];

import type { GondolaCredit } from "./types";

/** The ride up (PLAN §5): education + personal projects, tower signs on the lift line. */
export const gondolaCredits = [
  {
    year: "2014–17",
    label:
      "My Menu Plans — built, ran, and sunset a meal-planning product solo; WordPress → React/Node",
  },
  { year: "2016", label: "freeCodeCamp — Full Stack certification" },
  { year: "2017", label: "V School — full-stack immersive" },
] as const satisfies readonly GondolaCredit[];

import type { Difficulty } from "~/content/types";

export const difficultyLabels: Record<Difficulty, string> = {
  green: "Green circle — foundations",
  blue: "Blue square — solid production delivery",
  black: "Black diamond — deep technical ownership at scale",
  "double-black": "Double black diamond — security-critical, staff-scope systems",
};

/** Piste-map difficulty geometry. Decorative; pair with visible/sr text. */
export function DifficultyIcon({ difficulty }: { difficulty: Difficulty }) {
  const size = 14;
  switch (difficulty) {
    case "green":
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="7" r="6" fill="var(--color-evergreen)" />
        </svg>
      );
    case "blue":
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
          <rect x="1" y="1" width="12" height="12" fill="var(--color-bluebird)" />
        </svg>
      );
    case "black":
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
          <path d="M7 0 L14 7 L7 14 L0 7 Z" fill="var(--color-ink)" />
        </svg>
      );
    case "double-black":
      return (
        <svg width={size * 2} height={size} viewBox="0 0 28 14" aria-hidden="true">
          <path d="M7 0 L14 7 L7 14 L0 7 Z" fill="var(--color-ink)" />
          <path d="M21 0 L28 7 L21 14 L14 7 Z" fill="var(--color-ink)" />
        </svg>
      );
  }
}

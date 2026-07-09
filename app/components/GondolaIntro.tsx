import { gondolaCredits } from "~/content/gondola";
import type { CSSProperties } from "react";

/**
 * The ride up (§5): server-rendered content with a CSS-only six-second
 * sequence. A pre-paint scroll listener adds html.has-scrolled, resolving the
 * final state instantly if a visitor chooses to drop in before it completes.
 */
export function GondolaIntro() {
  return (
    <section className="gondola-intro" aria-labelledby="gondola-title">
      <div className="gondola-line" aria-hidden="true" />
      <div className="gondola-cabin" aria-hidden="true">
        <span className="gondola-hanger" />
        <span className="gondola-window" />
      </div>
      <div className="gondola-copy">
        <p
          id="gondola-title"
          className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-evergreen"
        >
          The ride up
        </p>
        <ol className="gondola-credits">
          {gondolaCredits.map((credit, index) => (
            <li key={credit.year} style={{ "--credit-index": index } as CSSProperties}>
              <span>{credit.year}</span>
              <span>{credit.label}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

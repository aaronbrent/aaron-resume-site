import { DifficultyIcon, difficultyLabels } from "~/components/DifficultyIcon";
import { gondolaCredits } from "~/content/gondola";
import { contact } from "~/content/meta";
import { skillGroupLabels, skills } from "~/content/skills";
import type { Difficulty, SkillGroup } from "~/content/types";

const groups: SkillGroup[] = ["frontend", "backend", "cloud", "leadership-ai"];
const difficulties: Difficulty[] = ["green", "blue", "black", "double-black"];

export function BaseCamp() {
  return (
    <footer
      id="base-camp"
      aria-labelledby="base-camp-title"
      className="mt-14 border-t-2 border-ink/25 bg-powder/50"
    >
      <div className="mx-auto w-full max-w-3xl px-6 py-14">
        <h2
          id="base-camp-title"
          className="font-display text-4xl font-bold uppercase tracking-wide"
        >
          Base Camp
        </h2>

        <section aria-labelledby="contact-title" className="mt-8">
          <h3
            id="contact-title"
            className="font-display text-lg font-semibold uppercase tracking-[0.15em] text-evergreen"
          >
            Get in touch
          </h3>
          <ul className="mt-3 space-y-1.5">
            <li>
              <a
                className="text-bluebird-deep underline underline-offset-2"
                href={`mailto:${contact.email}`}
              >
                {contact.email}
              </a>
            </li>
            <li>
              <a
                className="text-bluebird-deep underline underline-offset-2"
                href={contact.linkedin}
              >
                LinkedIn
              </a>
            </li>
            <li>
              <a
                className="text-bluebird-deep underline underline-offset-2"
                href={contact.github}
              >
                GitHub
              </a>
            </li>
            <li>
              <a
                className="text-bluebird-deep underline underline-offset-2"
                href={contact.resumePdf}
              >
                Resume (PDF)
              </a>{" "}
              ·{" "}
              <a
                className="text-bluebird-deep underline underline-offset-2"
                href="/resume"
              >
                Resume (plain page)
              </a>
            </li>
          </ul>
        </section>

        <section aria-labelledby="education-title" className="mt-10">
          <h3
            id="education-title"
            className="font-display text-lg font-semibold uppercase tracking-[0.15em] text-evergreen"
          >
            The ride up — education &amp; personal projects
          </h3>
          <ul className="mt-3 space-y-1.5">
            {gondolaCredits.map((credit) => (
              <li key={credit.label}>
                <span className="font-semibold">{credit.year}</span> — {credit.label}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="legend-title" className="mt-10">
          <h3
            id="legend-title"
            className="font-display text-lg font-semibold uppercase tracking-[0.15em] text-evergreen"
          >
            Legend
          </h3>
          <p className="mt-3 text-sm text-ink/80">
            Difficulty rates the terrain — technical depth and consequence of failure —
            not seniority or recency.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {difficulties.map((d) => (
              <li key={d} className="flex items-center gap-2">
                <DifficultyIcon difficulty={d} />
                <span>{difficultyLabels[d]}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {groups.map((group) => (
              <div key={group}>
                <h4 className="font-display text-sm font-semibold uppercase tracking-[0.15em]">
                  {skillGroupLabels[group]}
                </h4>
                <ul className="mt-2 space-y-1 text-sm">
                  {skills
                    .filter((s) => s.group === group)
                    .map((s) => (
                      <li key={s.id}>{s.label}</li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="colophon-title" className="mt-10">
          <h3
            id="colophon-title"
            className="font-display text-lg font-semibold uppercase tracking-[0.15em] text-evergreen"
          >
            Colophon
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/80">
            Built with React Router v7 (prerendered to static HTML), TypeScript strict,
            and Tailwind CSS v4. The animation system is hand-rolled — zero animation
            dependencies.{" "}
            <a
              className="text-bluebird-deep underline underline-offset-2"
              href="https://github.com/aaronbrent/aaron-resume-site"
            >
              View source
            </a>
            .
          </p>
        </section>
      </div>
    </footer>
  );
}

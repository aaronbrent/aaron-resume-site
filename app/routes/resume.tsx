import { educationCredits } from "~/content/education";
import { formatPeriod } from "~/content/format";
import { contact, site } from "~/content/meta";
import { planets } from "~/content/planets";
import { skillGroupLabels, skills } from "~/content/skills";
import type { SkillGroup } from "~/content/types";

export function meta() {
  return [
    { title: "Resume — Aaron Ellis" },
    { name: "description", content: site.description },
  ];
}

const groups: SkillGroup[] = ["frontend", "backend", "cloud", "leadership-ai"];

/** ATS-clean: single column, semantic headings, no visual layer, no tricks. */
export default function Resume() {
  const experience = [...planets].reverse(); // most recent first
  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-6 py-12">
      <header>
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide">
          {site.name}
        </h1>
        <p className="mt-2">{site.positioning}</p>
        <ul className="mt-3 text-sm">
          <li>
            Email:{" "}
            <a
              className="text-nebula underline underline-offset-2"
              href={`mailto:${contact.email}`}
            >
              {contact.email}
            </a>
          </li>
          <li>
            GitHub:{" "}
            <a className="text-nebula underline underline-offset-2" href={contact.github}>
              {contact.github}
            </a>
          </li>
          <li>
            LinkedIn:{" "}
            <a
              className="text-nebula underline underline-offset-2"
              href={contact.linkedin}
            >
              {contact.linkedin}
            </a>
          </li>
        </ul>
        <p className="mt-3 text-sm print:hidden">
          <a
            className="text-nebula underline underline-offset-2"
            href={contact.resumePdf}
          >
            Download PDF
          </a>{" "}
          ·{" "}
          <a className="text-nebula underline underline-offset-2" href="/">
            Back to the star system
          </a>
        </p>
      </header>

      <section aria-labelledby="experience-title" className="mt-10">
        <h2
          id="experience-title"
          className="border-b border-starlight/25 pb-1 font-display text-2xl font-bold uppercase tracking-wide"
        >
          Experience
        </h2>
        {experience.map((w) => (
          <article key={w.id} className="mt-6 break-inside-avoid">
            <h3 className="text-lg font-semibold">
              {w.role} — {w.org}
            </h3>
            {"roleSubtitle" in w ? <p className="text-sm">{w.roleSubtitle}</p> : null}
            <p className="text-sm text-dust">{formatPeriod(w.period)}</p>
            <p className="mt-2">{w.claim}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {w.evidence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section aria-labelledby="skills-title" className="mt-10">
        <h2
          id="skills-title"
          className="border-b border-starlight/25 pb-1 font-display text-2xl font-bold uppercase tracking-wide"
        >
          Skills
        </h2>
        {groups.map((group) => (
          <p key={group} className="mt-3">
            <strong>{skillGroupLabels[group]}:</strong>{" "}
            {skills
              .filter((s) => s.group === group)
              .map((s) => s.label)
              .join(", ")}
          </p>
        ))}
      </section>

      <section aria-labelledby="edu-title" className="mt-10">
        <h2
          id="edu-title"
          className="border-b border-starlight/25 pb-1 font-display text-2xl font-bold uppercase tracking-wide"
        >
          Education &amp; Personal Projects
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {educationCredits.map((credit) => (
            <li key={credit.label}>
              {credit.year} — {credit.label}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

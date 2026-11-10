import { useEffect } from "react";
import { formatPeriod } from "~/content/format";
import { contact, site } from "~/content/meta";
import { planets } from "~/content/planets";
import { installPanelFades } from "~/lib/panels";
import { SceneMount } from "~/scene/SceneMount";

export function meta() {
  return [
    { title: site.title },
    { name: "description", content: site.description },
    { property: "og:title", content: site.title },
    { property: "og:description", content: site.description },
    { property: "og:type", content: "profile" },
    { property: "og:url", content: site.url },
    // Rendered from the real scene by `pnpm poster` (W5).
    { property: "og:image", content: `${site.url}/poster/og.jpg` },
    { property: "og:image:type", content: "image/jpeg" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    {
      property: "og:image:alt",
      content: "Aaron Ellis — a career drawn as a star system",
    },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: `${site.url}/poster/og.jpg` },
  ];
}

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  jobTitle: "Staff Software Engineer",
  description: site.positioning,
  email: `mailto:${contact.email}`,
  url: site.url,
  sameAs: [contact.github, contact.linkedin],
};

const link = "text-nebula underline underline-offset-2 hover:text-starlight";

/**
 * The star system (docs/PLAN-STAR-SYSTEM.md). The prerendered sections below
 * ARE the page: hero + one section per planet, one viewport each, so native
 * scroll progress maps 1:1 onto the camera's stops (app/lib/progress.ts).
 * The 3D layer (W2a+) mounts into [data-scene-root] as an aria-hidden
 * backdrop; without JS, WebGL, or with reduced motion, this document stands
 * on its own.
 */
export default function Index() {
  useEffect(() => installPanelFades(), []);
  return (
    <>
      <div
        data-scene-root
        aria-hidden="true"
        data-print-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-lvh"
      >
        <SceneMount />
      </div>
      <main id="main">
        <header
          tabIndex={-1}
          className="flex min-h-svh flex-col justify-center px-6 py-16 md:px-16"
        >
          {/* The plate keeps the hero readable over anything behind it — the
              poster's sun, the canvas, any viewport (gate 2, finding 1). */}
          <div
            data-hero-plate
            className="w-fit max-w-2xl rounded-2xl bg-void/80 p-6 shadow-lg ring-1 ring-starlight/10 backdrop-blur-sm md:p-10"
          >
            <p className="font-display text-sm font-semibold uppercase tracking-[0.3em] text-sunlight">
              A career in orbit
            </p>
            <h1 className="mt-3 font-display text-6xl font-bold uppercase tracking-wide md:text-8xl">
              {site.name}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-dust">{site.positioning}</p>
            <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              <a className={link} href="/resume">
                Skip to text
              </a>
              <a className={link} href={contact.resumePdf}>
                Download PDF
              </a>
            </p>
            <p
              className="scroll-cue mt-10 text-sm uppercase tracking-[0.2em] text-dust"
              aria-hidden="true"
            >
              Scroll <span className="scroll-cue-arrow inline-block">↓</span>
            </p>
          </div>
        </header>

        {planets.map((p) => (
          <section
            key={p.id}
            id={p.id}
            aria-labelledby={`${p.id}-title`}
            data-planet={p.id}
            tabIndex={-1}
            className="flex min-h-svh items-center px-6 py-16 md:px-16"
          >
            <article className="max-w-xl rounded-2xl bg-void/80 p-6 shadow-lg ring-1 ring-starlight/10 backdrop-blur-sm md:p-8">
              <p className="font-display text-sm font-semibold uppercase tracking-[0.25em] text-sunlight">
                {p.nickname}
              </p>
              <h2
                id={`${p.id}-title`}
                className="mt-1 font-display text-4xl font-bold uppercase tracking-wide"
              >
                {p.org}
              </h2>
              <p className="mt-2 font-semibold">{p.role}</p>
              {"roleSubtitle" in p ? <p className="text-dust">{p.roleSubtitle}</p> : null}
              <p className="mt-1 text-sm text-dust">{formatPeriod(p.period)}</p>
              <p className="mt-4">{p.claim}</p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
                {p.evidence.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-4 italic text-dust">{p.whyCare}</p>
            </article>
          </section>
        ))}
      </main>

      <footer
        aria-labelledby="contact-title"
        className="flex min-h-[60svh] flex-col justify-center px-6 py-16 md:px-16"
      >
        <h2
          id="contact-title"
          className="font-display text-3xl font-bold uppercase tracking-wide"
        >
          Contact
        </h2>
        <ul className="mt-4 space-y-2">
          <li>
            <a className={link} href={`mailto:${contact.email}`}>
              {contact.email}
            </a>
          </li>
          <li>
            <a className={link} href={contact.github}>
              GitHub
            </a>
          </li>
          <li>
            <a className={link} href={contact.linkedin}>
              LinkedIn
            </a>
          </li>
          <li>
            <a className={link} href="/resume">
              Plain-text resume
            </a>
          </li>
        </ul>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
    </>
  );
}

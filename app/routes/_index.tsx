import { BaseCamp } from "~/components/BaseCamp";
import { CareerDocument } from "~/components/CareerDocument";
import { MountainStage } from "~/components/MountainStage";
import { PaperFrame } from "~/components/PaperFrame";
import { SummitHero } from "~/components/SummitHero";
import { contact, runMeta, site } from "~/content/meta";
import { waypoints } from "~/content/waypoints";
import { deriveRunHeightSvh } from "~/lib/run-height";
import { useReveal } from "~/lib/use-reveal";
import { useRig } from "~/lib/rig/use-rig";
import { Hud, writeHud } from "~/components/Hud";

export function meta() {
  return [
    { title: site.title },
    { name: "description", content: site.description },
    { property: "og:title", content: site.title },
    { property: "og:description", content: site.description },
    { property: "og:type", content: "profile" },
    { property: "og:url", content: site.url },
    { name: "twitter:card", content: "summary" },
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

const runHeightSvh = deriveRunHeightSvh(runMeta, waypoints.length);

export default function Index() {
  useReveal();
  useRig(writeHud);
  return (
    <>
      <main id="main">
        {/* The run: one tall container, world scroll (§1). The mountain is an
            aria-hidden backdrop; the document lives on top of it. */}
        <div className="run-container relative" style={{ height: `${runHeightSvh}svh` }}>
          <MountainStage />
          <div className="relative">
            <SummitHero />
          </div>
          <CareerDocument />
        </div>
      </main>
      <BaseCamp />
      <PaperFrame />
      <Hud />
      <div className="paper-texture" aria-hidden="true" data-print-hidden="true" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
    </>
  );
}

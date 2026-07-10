import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BaseCamp } from "~/components/BaseCamp";
import { CareerDocument } from "~/components/CareerDocument";
import { Hud, writeHud, writeHud3d } from "~/components/Hud";
import { MountainStage } from "~/components/MountainStage";
import { PaperFrame } from "~/components/PaperFrame";
import { SummitHero } from "~/components/SummitHero";
import { contact, runMeta, site } from "~/content/meta";
import { waypoints } from "~/content/waypoints";
import { deriveRunHeightSvh } from "~/lib/run-height";
import { useReveal } from "~/lib/use-reveal";
import { useRig } from "~/lib/rig/use-rig";
import { demoteTier, probeRideCapability, resolveTier, type Tier } from "~/lib/tier";

// Tier 2's chunk (three.js and all) loads only when the tier gate says ride.
const DropIn = lazy(() => import("~/components/DropIn"));

export function meta() {
  const ogImage = `${site.url}/og-trail-map.png`;
  return [
    { title: site.title },
    { name: "description", content: site.description },
    { property: "og:title", content: site.title },
    { property: "og:description", content: site.description },
    { property: "og:type", content: "profile" },
    { property: "og:url", content: site.url },
    { property: "og:image", content: ogImage },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Aaron Ellis trail map portfolio" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: ogImage },
    { name: "twitter:image:alt", content: "Aaron Ellis trail map portfolio" },
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
  // SSR and first paint are always Tier 1 (the map is the loading state, §6).
  // The real GL probe happens after that first paint, before the dynamic
  // renderer import, so a fallback visitor never downloads Three.js.
  const [tier, setTier] = useState<Tier>(1);
  const [rideReady, setRideReady] = useState(false);
  const tierRequest = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      const request = ++tierRequest.current;
      if (resolveTier() !== 2) {
        setTier(1);
        return;
      }
      const capable = await probeRideCapability();
      if (!cancelled && request === tierRequest.current) setTier(capable ? 2 : 1);
    };
    void update();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReduced = () => void update();
    reduced.addEventListener("change", onReduced);
    window.addEventListener("tierchange", onReduced);
    return () => {
      cancelled = true;
      reduced.removeEventListener("change", onReduced);
      window.removeEventListener("tierchange", onReduced);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.tier = tier === 2 ? "ride" : "map";
    if (tier !== 2) setRideReady(false);
  }, [tier]);
  // The 2D rig keeps carrying the run until the 3D view's first frame — a
  // scroll before the chunk is warm rides the printed map (§6).
  useRig(writeHud, tier !== 2 || !rideReady);
  return (
    <>
      <main id="main">
        {/* The run: one tall container, world scroll (§1). The mountain is an
            aria-hidden backdrop; the document lives on top of it. */}
        <div className="run-container relative" style={{ height: `${runHeightSvh}svh` }}>
          {tier === 2 ? (
            <Suspense fallback={null}>
              <DropIn
                onFrame={writeHud3d}
                onReady={() => setRideReady(true)}
                onFallback={() => demoteTier()}
              />
            </Suspense>
          ) : null}
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

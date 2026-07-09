import { BaseCamp } from "~/components/BaseCamp";
import { CareerDocument } from "~/components/CareerDocument";
import { SummitHero } from "~/components/SummitHero";
import { contact, site } from "~/content/meta";

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

export default function Index() {
  return (
    <>
      <main id="main">
        <SummitHero />
        <CareerDocument />
      </main>
      <BaseCamp />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
    </>
  );
}

import { contact, site } from "~/content/meta";

export function SummitHero() {
  return (
    <header className="flex min-h-svh flex-col justify-center px-6 py-16">
      {/* The cartouche (§8): map furniture framing the title block. */}
      <div className="mx-auto w-full max-w-3xl border-2 border-ink bg-paper/90 p-2 shadow-sm">
        <div className="border border-ink/40 px-6 py-10 sm:px-10">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-evergreen">
            {site.seasons} · Trail map
          </p>
          <h1 className="mt-3 font-display text-6xl font-bold uppercase leading-none tracking-wide sm:text-7xl">
            Aaron Ellis
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed">{site.positioning}</p>
          <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a className="text-bluebird-deep underline underline-offset-2" href="/resume">
              Plain resume
            </a>
            <a
              className="text-bluebird-deep underline underline-offset-2"
              href={contact.resumePdf}
            >
              Download PDF
            </a>
            <a
              className="text-bluebird-deep underline underline-offset-2"
              href={`mailto:${contact.email}`}
            >
              {contact.email}
            </a>
          </p>
          <p
            className="mt-16 font-display text-sm font-semibold uppercase tracking-[0.2em] text-patrol-deep"
            aria-hidden="true"
          >
            The run starts below ↓
          </p>
        </div>
      </div>
    </header>
  );
}

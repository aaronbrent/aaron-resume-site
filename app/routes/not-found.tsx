import { site } from "~/content/meta";

export function meta() {
  return [{ title: `Not found — ${site.name}` }, { name: "robots", content: "noindex" }];
}

/**
 * Catch-all route. Prerendered as /404/index.html, which the production
 * server (scripts/serve.mjs) returns with a 404 status for unknown paths.
 * Because the client router matches the same splat route for any path,
 * hydration renders exactly what was prerendered.
 */
export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide">
        404 — Nothing in this orbit
      </h1>
      <p className="mt-4">There&apos;s no page at this address.</p>
      <ul className="mt-8 space-y-2">
        <li>
          <a href="/" className="text-nebula underline underline-offset-2">
            Back to the star system
          </a>
        </li>
        <li>
          <a href="/resume" className="text-nebula underline underline-offset-2">
            Plain-text resume
          </a>
        </li>
      </ul>
    </main>
  );
}

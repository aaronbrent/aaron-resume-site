import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  // Preloaded so font-display: optional almost always wins the first paint.
  ...[
    "/fonts/public-sans-latin-wght-normal.woff2",
    "/fonts/barlow-condensed-latin-600-normal.woff2",
    "/fonts/barlow-condensed-latin-700-normal.woff2",
  ].map((href) => ({
    rel: "preload" as const,
    href,
    as: "font" as const,
    type: "font/woff2",
    crossOrigin: "anonymous" as const,
  })),
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-void text-starlight">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="font-body antialiased">
        {/* html.js gates any JS-only styling, so a no-JS visit sees the
            plain document. Runs pre-paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-starlight focus:px-4 focus:py-2 focus:text-void focus:outline-2 focus:outline-offset-2 focus:outline-sunlight"
        >
          Skip to content
        </a>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Lost in space";
  let details = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404 — Nothing in this orbit" : "Error";
    details =
      error.status === 404
        ? "There's no page at this address. Head back to the sun."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
  }

  return (
    <main id="main" className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide">
        {message}
      </h1>
      <p className="mt-4">{details}</p>
      <p className="mt-8">
        <a href="/" className="text-nebula underline">
          Back to the star system
        </a>
      </p>
    </main>
  );
}

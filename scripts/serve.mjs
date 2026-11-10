/**
 * Production static server (Railway: `pnpm start`). Serves build/client:
 *   - HTML: `no-cache` (revalidate), so a redeploy never leaves a cached
 *     page pointing at hashed chunks that no longer exist.
 *   - /assets/* (content-hashed): one year, immutable.
 *   - everything else (fonts, poster, PDF): one hour.
 *   - unknown paths: the app's own 404 page, with a real 404 status.
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import sirv from "sirv";

const root = fileURLToPath(new URL("../build/client", import.meta.url));
const notFound = readFileSync(`${root}/__spa-fallback.html`);
const port = Number(process.env.PORT) || 3000;

const assets = sirv(root, {
  etag: true,
  gzip: false,
  setHeaders(res, pathname) {
    // Pages: "/", "/resume", "/resume/", "/x.html" (anything without an extension).
    if (pathname.endsWith(".html") || !/\.[a-z0-9]+$/i.test(pathname)) {
      res.setHeader("Cache-Control", "no-cache");
    } else if (pathname.startsWith("/assets/")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      res.setHeader("Cache-Control", "public, max-age=3600");
    }
  },
  onNoMatch(_req, res) {
    res.writeHead(404, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    res.end(notFound);
  },
});

createServer(assets).listen(port, "0.0.0.0", () => {
  console.log(`Serving build/client on :${port}`);
});

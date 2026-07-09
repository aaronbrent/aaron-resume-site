/**
 * One-shot: print /resume from the static build to public/aaron-ellis-resume.pdf.
 * Run after `pnpm build`:  node scripts/generate-resume-pdf.mjs
 * The PDF is committed (PLAN §7) so the download link never depends on a build step.
 */
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const root = new URL("../build/client", import.meta.url).pathname;
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  let path = req.url.split("?")[0];
  if (path.endsWith("/")) path += "index.html";
  if (!extname(path)) path += "/index.html";
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, {
      "content-type": types[extname(path)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const page = await browser.newPage();
await page.goto(`http://localhost:${port}/resume`, { waitUntil: "networkidle" });
await page.pdf({
  path: new URL("../public/aaron-ellis-resume.pdf", import.meta.url).pathname,
  format: "Letter",
  margin: { top: "0.6in", bottom: "0.6in", left: "0.7in", right: "0.7in" },
  printBackground: false,
});
await browser.close();
server.close();
console.log("Wrote public/aaron-ellis-resume.pdf");

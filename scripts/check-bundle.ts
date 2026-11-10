/**
 * CI gate (docs/PLAN-STAR-SYSTEM.md §7, §11). Requires a fresh `pnpm build`.
 *   pnpm bundle:check
 *
 * - Critical path = every script the prerendered pages load up front (their
 *   modulepreload links + entry imports), measured from the built HTML, not
 *   guessed. It must stay ≤ 130 KB gz and must not contain three.js.
 * - Lazy 3D chunk(s) = everything else that carries the renderer; ≤ 260 KB gz.
 * - Dev-only tooling (leva) must not ship anywhere.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const SCENE_BUDGET_KB = 260;
const CRITICAL_BUDGET_KB = 130;
const REQUIRE_3D_DEFAULT = true;
const require3d = process.env.REQUIRE_3D
  ? process.env.REQUIRE_3D === "1"
  : REQUIRE_3D_DEFAULT;

const client = fileURLToPath(new URL("../build/client", import.meta.url));
const assets = join(client, "assets");

/** Asset file names a page loads up front. */
export function criticalScripts(html: string): string[] {
  const refs = [
    ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/assets\/([^"]+\.js)"/g),
    ...html.matchAll(/<script[^>]+src="\/assets\/([^"]+\.js)"/g),
    ...html.matchAll(/import\(["']\/assets\/([^"']+\.js)["']\)/g),
  ].map((m) => m[1]!);
  return [...new Set(refs)];
}

const critical = new Set<string>();
for (const page of ["index.html", "resume/index.html"]) {
  for (const f of criticalScripts(readFileSync(join(client, page), "utf8")))
    critical.add(f);
}

let sceneKb = 0;
let criticalKb = 0;
const failures: string[] = [];
const rows: string[] = [];
for (const file of readdirSync(assets).sort()) {
  if (!file.endsWith(".js")) continue;
  const source = readFileSync(join(assets, file));
  const kb = gzipSync(source, { level: 9 }).length / 1024;
  const text = source.toString();
  const hasThree = text.includes("WebGLRenderer");
  const isCritical = critical.has(file);
  if (isCritical) {
    criticalKb += kb;
    if (hasThree) failures.push(`three.js is on the critical path (${file})`);
  } else if (hasThree) {
    sceneKb += kb;
  }
  // leva's store/panel identifiers; dev-only, must be tree-shaken out.
  if (/\bleva\b|useControls\(|LevaPanel/.test(text)) {
    failures.push(`leva (dev-only) found in production chunk ${file}`);
  }
  const tag = isCritical ? "crit" : hasThree ? " 3D " : "lazy";
  rows.push(`  ${tag} ${kb.toFixed(1).padStart(7)} kB gz  ${file}`);
}
console.log(rows.join("\n"));
console.log(
  `critical path ${criticalKb.toFixed(1)} kB gz (budget ${CRITICAL_BUDGET_KB}) · ` +
    `3D chunk ${sceneKb.toFixed(1)} kB gz (budget ${SCENE_BUDGET_KB})`,
);
if (critical.size === 0) failures.push("no critical scripts found in the built HTML");
if (sceneKb === 0 && require3d) {
  failures.push("no lazy chunk containing WebGLRenderer found — is the build fresh?");
}
if (sceneKb > SCENE_BUDGET_KB) {
  failures.push(`3D chunk over budget: ${sceneKb.toFixed(1)} > ${SCENE_BUDGET_KB} kB gz`);
}
if (criticalKb > CRITICAL_BUDGET_KB) {
  failures.push(
    `critical path over budget: ${criticalKb.toFixed(1)} > ${CRITICAL_BUDGET_KB} kB gz`,
  );
}
for (const f of failures) console.error(`✗ ${f}`);
if (failures.length === 0) console.log("✓ bundle within budgets");
process.exit(failures.length ? 1 : 0);

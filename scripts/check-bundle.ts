/**
 * CI gate (docs/PLAN-STAR-SYSTEM.md §11): the 3D chunk stays lazy and within
 * budget, the critical path stays small, and dev-only tooling (leva) never
 * ships.   pnpm bundle:check   (requires a fresh `pnpm build`)
 *
 * Until W2a lands the scene there is no 3D chunk; that is a warning unless
 * REQUIRE_3D=1. W2a flips REQUIRE_3D_DEFAULT to true.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const SCENE_BUDGET_KB = 260;
const CRITICAL_BUDGET_KB = 130;
const REQUIRE_3D_DEFAULT = false;
const require3d = process.env.REQUIRE_3D
  ? process.env.REQUIRE_3D === "1"
  : REQUIRE_3D_DEFAULT;

const dir = fileURLToPath(new URL("../build/client/assets", import.meta.url));
let sceneKb = 0;
let criticalKb = 0;
const levaChunks: string[] = [];
const rows: string[] = [];
for (const file of readdirSync(dir).sort()) {
  if (!file.endsWith(".js")) continue;
  const source = readFileSync(join(dir, file));
  const kb = gzipSync(source, { level: 9 }).length / 1024;
  // The lazy scene chunk(s) carry the renderer.
  const isScene = source.includes("WebGLRenderer");
  if (isScene) sceneKb += kb;
  else criticalKb += kb;
  // leva's store/panel identifiers; dev-only, must be tree-shaken out.
  if (/\bleva\b|useControls\(|LevaPanel/.test(source.toString())) levaChunks.push(file);
  rows.push(`  ${isScene ? "3D " : "    "}${kb.toFixed(1).padStart(7)} kB gz  ${file}`);
}
console.log(rows.join("\n"));
console.log(
  `critical path ${criticalKb.toFixed(1)} kB gz (budget ${CRITICAL_BUDGET_KB}) · ` +
    `3D chunk ${sceneKb.toFixed(1)} kB gz (budget ${SCENE_BUDGET_KB})`,
);
let failed = false;
if (sceneKb === 0) {
  const msg = "no chunk containing WebGLRenderer found";
  if (require3d) {
    console.error(`✗ ${msg} — is the build fresh?`);
    failed = true;
  } else {
    console.warn(
      `⚠ ${msg} (expected until the scene lands; set REQUIRE_3D=1 to enforce)`,
    );
  }
}
if (sceneKb > SCENE_BUDGET_KB) {
  console.error(
    `✗ 3D chunk over budget: ${sceneKb.toFixed(1)} > ${SCENE_BUDGET_KB} kB gz`,
  );
  failed = true;
}
if (criticalKb > CRITICAL_BUDGET_KB) {
  console.error(
    `✗ critical path over budget: ${criticalKb.toFixed(1)} > ${CRITICAL_BUDGET_KB} kB gz`,
  );
  failed = true;
}
if (levaChunks.length > 0) {
  console.error(`✗ leva (dev-only) found in production chunks: ${levaChunks.join(", ")}`);
  failed = true;
}
if (!failed) console.log("✓ bundle within budgets");
process.exit(failed ? 1 : 0);

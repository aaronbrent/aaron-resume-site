/**
 * CI gate (PLAN-3D §7): the 3D chunk stays lazy and within budget, and the
 * critical path (everything that isn't the DropIn chunk) keeps v1's budget.
 *   pnpm bundle:check   (requires a fresh `pnpm build`)
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const DROPIN_BUDGET_KB = 180;
const CRITICAL_BUDGET_KB = 130;

const dir = new URL("../build/client/assets", import.meta.url).pathname;
let dropinKb = 0;
let criticalKb = 0;
const rows: string[] = [];
for (const file of readdirSync(dir).sort()) {
  if (!file.endsWith(".js")) continue;
  const source = readFileSync(join(dir, file));
  const kb = gzipSync(source, { level: 9 }).length / 1024;
  // The DropIn chunk is the one that carries the renderer.
  const isDropin = source.includes("WebGLRenderer");
  if (isDropin) dropinKb += kb;
  else criticalKb += kb;
  rows.push(`  ${isDropin ? "3D " : "    "}${kb.toFixed(1).padStart(7)} kB gz  ${file}`);
}
console.log(rows.join("\n"));
console.log(
  `critical path ${criticalKb.toFixed(1)} kB gz (budget ${CRITICAL_BUDGET_KB}) · ` +
    `3D chunk ${dropinKb.toFixed(1)} kB gz (budget ${DROPIN_BUDGET_KB})`,
);
let failed = false;
if (dropinKb === 0) {
  console.error("✗ no chunk containing WebGLRenderer found — is the build fresh?");
  failed = true;
}
if (dropinKb > DROPIN_BUDGET_KB) {
  console.error(
    `✗ 3D chunk over budget: ${dropinKb.toFixed(1)} > ${DROPIN_BUDGET_KB} kB gz`,
  );
  failed = true;
}
if (criticalKb > CRITICAL_BUDGET_KB) {
  console.error(
    `✗ critical path over budget: ${criticalKb.toFixed(1)} > ${CRITICAL_BUDGET_KB} kB gz`,
  );
  failed = true;
}
if (!failed) console.log("✓ bundle within PLAN-3D §7 budgets");
process.exit(failed ? 1 : 0);

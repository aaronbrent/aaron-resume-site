/**
 * CI gate (PLAN §2): validate the committed trail modules and confirm they
 * are in sync with the configs (regenerating must be a no-op).
 *   node scripts/trail-validate.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { trailConfigs } from "../app/lib/trail/configs.ts";
import { generateTrail } from "../app/lib/trail/generate.ts";
import { validateTrail } from "../app/lib/trail/validate.ts";

let failed = false;
for (const [bp, config] of Object.entries(trailConfigs)) {
  const path = new URL(`../app/content/trail.${bp}.json`, import.meta.url).pathname;
  const committed = JSON.parse(readFileSync(path, "utf8"));
  const result = validateTrail(committed);
  if (!result.ok) {
    failed = true;
    console.error(`✗ ${bp} invalid:`);
    for (const e of result.errors) console.error(`  - ${e}`);
  } else {
    console.log(`✓ ${bp} valid:`, result.stats);
  }
  const expectedHash = createHash("sha256")
    .update(JSON.stringify(config))
    .digest("hex")
    .slice(0, 12);
  if (committed.sourceHash !== expectedHash) {
    failed = true;
    console.error(
      `✗ ${bp} stale: sourceHash ${committed.sourceHash} != config ${expectedHash}. Run: pnpm trail:gen`,
    );
  }
  const regenerated = { ...generateTrail(config), sourceHash: expectedHash };
  if (JSON.stringify(regenerated) !== JSON.stringify(committed)) {
    failed = true;
    console.error(`✗ ${bp} drift: regenerating produces a different committed artifact`);
  }
}
process.exit(failed ? 1 : 0);

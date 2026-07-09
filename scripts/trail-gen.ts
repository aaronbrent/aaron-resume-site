/**
 * Regenerate the committed trail modules from the configs:
 *   node scripts/trail-gen.ts
 * Emits app/content/trail.{mobile,desktop}.json — reviewable diffs, no
 * binaries, no runtime fetching (PLAN §2).
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { trailConfigs } from "../app/lib/trail/configs.ts";
import { generateTrail } from "../app/lib/trail/generate.ts";
import { validateTrail } from "../app/lib/trail/validate.ts";

for (const [bp, config] of Object.entries(trailConfigs)) {
  const trail = generateTrail(config);
  const result = validateTrail(trail);
  if (!result.ok) {
    console.error(`✗ ${bp} failed validation:`);
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  const sourceHash = createHash("sha256")
    .update(JSON.stringify(config))
    .digest("hex")
    .slice(0, 12);
  const out = { ...trail, sourceHash };
  const path = new URL(`../app/content/trail.${bp}.json`, import.meta.url).pathname;
  writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
  console.log(`✓ ${bp}: ${trail.d.length} bytes of path, stats:`, result.stats);
}

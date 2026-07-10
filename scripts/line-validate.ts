/**
 * CI gate (PLAN-3D §2): validate the authored 3D line against the grade,
 * comfort, and dwell limits, with time anchors from the content model.
 *   pnpm line:validate
 */
import { line3d } from "../app/content/line3d.ts";
import { contentAnchors } from "../app/lib/line/anchors.ts";
import { validateLine } from "../app/lib/line/validate.ts";

const result = validateLine(line3d.points, contentAnchors());
if (result.ok) {
  console.log("✓ line valid:", JSON.stringify(result.stats, null, 2));
} else {
  console.error(`✗ line invalid (${result.errors.length} problems):`);
  const shown = result.errors.slice(0, 40);
  for (const e of shown) console.error(`  - ${e}`);
  if (result.errors.length > shown.length) {
    console.error(`  … and ${result.errors.length - shown.length} more`);
  }
  console.error("stats:", JSON.stringify(result.stats, null, 2));
}
process.exit(result.ok ? 0 : 1);

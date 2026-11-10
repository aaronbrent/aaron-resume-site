/**
 * Post-build: writes .br and .gz siblings for every compressible file in
 * build/client, so scripts/serve.mjs can serve them precompressed (sirv's
 * brotli/gzip options). Railway's edge doesn't compress for us.
 *   node scripts/compress.mjs   (run by `pnpm build`)
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const root = fileURLToPath(new URL("../build/client", import.meta.url));
const COMPRESSIBLE = /\.(js|mjs|css|html|svg|json|txt|xml|webmanifest)$/;
const MIN_BYTES = 1024;

let files = 0;
let before = 0;
let after = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (!COMPRESSIBLE.test(name)) continue;
    const source = readFileSync(path);
    if (source.length < MIN_BYTES) continue;
    const br = brotliCompressSync(source, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    });
    writeFileSync(`${path}.br`, br);
    writeFileSync(`${path}.gz`, gzipSync(source, { level: 9 }));
    files += 1;
    before += source.length;
    after += br.length;
  }
}
walk(root);
console.log(
  `compressed ${files} files: ${(before / 1024).toFixed(0)} kB → ${(after / 1024).toFixed(0)} kB brotli`,
);

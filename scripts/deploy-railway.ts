/**
 * One-command Railway deploy (docs/PLAN-STAR-SYSTEM.md §8).
 *
 *   railway login            # once, interactive
 *   pnpm run deploy:railway  # everything else
 *
 * Idempotent: creates and links the project + service on the first run,
 * reuses them afterwards. Builds on Railway (Railpack, railway.toml), then
 * ensures a Railway-provided *.up.railway.app domain exists and prints it.
 *
 * Flags: --dry-run prints the commands without running them.
 * Env:   RAILWAY_BIN overrides the CLI path; RAILWAY_PROJECT / RAILWAY_SERVICE
 *        override the default names.
 */
import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import { pathToFileURL } from "node:url";

const BIN = process.env.RAILWAY_BIN ?? "railway";
const PROJECT = process.env.RAILWAY_PROJECT ?? "aaron-ellis";
const SERVICE = process.env.RAILWAY_SERVICE ?? "web";
const DRY = process.argv.includes("--dry-run");

class StepError extends Error {}

function railway(args: string[], opts: { inherit?: boolean } = {}): string {
  if (DRY) {
    console.log(`  [dry-run] ${BIN} ${args.join(" ")}`);
    return "";
  }
  const options: ExecFileSyncOptions = {
    encoding: "utf8",
    stdio: opts.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
  };
  try {
    return String(execFileSync(BIN, args, options) ?? "");
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    if (err.code === "ENOENT") {
      throw new StepError(
        "The Railway CLI isn't installed. Install it with `npm i -g @railway/cli` " +
          "(or `brew install railway`), then run `railway login`.",
      );
    }
    const detail = (err.stderr || err.stdout || err.message).split("\n")[0];
    throw new StepError(`\`railway ${args.join(" ")}\` failed: ${detail}`);
  }
}

function tryRailway(args: string[]): string | null {
  try {
    return railway(args);
  } catch (error) {
    if (error instanceof StepError && /isn't installed/.test(error.message)) throw error;
    return null;
  }
}

/** Every *.up.railway.app hostname mentioned in a CLI response. */
export function findRailwayDomains(text: string): string[] {
  const hosts =
    text.match(/[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.up\.railway\.app/gi) ?? [];
  return [...new Set(hosts.map((h) => h.toLowerCase()))];
}

/** Service names from `railway service list --json` (shape-tolerant). */
export function findServiceNames(json: string): string[] {
  try {
    const names: string[] = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (typeof record.name === "string") names.push(record.name);
        Object.values(record).forEach(walk);
      }
    };
    walk(JSON.parse(json));
    return names;
  } catch {
    return [];
  }
}

function step(label: string) {
  console.log(`\n▸ ${label}`);
}

function main() {
  step("Checking the Railway CLI and login");
  const version = railway(["--version"]).trim();
  if (version) console.log(`  ${version}`);
  if (!DRY && tryRailway(["whoami"]) === null) {
    throw new StepError(
      "Not logged in. Run `railway login` once, then re-run this script.",
    );
  }

  step(`Linking project "${PROJECT}"`);
  if (DRY || tryRailway(["status", "--json"]) === null) {
    railway(["init", "--name", PROJECT]);
    console.log(`  created and linked project "${PROJECT}"`);
  } else {
    console.log("  already linked");
  }

  step(`Linking service "${SERVICE}"`);
  const services = DRY
    ? []
    : findServiceNames(tryRailway(["service", "list", "--json"]) ?? "");
  if (!services.includes(SERVICE)) {
    // If `service list` isn't supported by this CLI version we can't tell,
    // so a failing `add` (the service already exists) isn't fatal: linking
    // below is what has to succeed.
    if (tryRailway(["add", "--service", SERVICE]) !== null) {
      console.log(`  created service "${SERVICE}"`);
    } else {
      console.log(`  "${SERVICE}" exists (or couldn't be created); linking it`);
    }
  }
  railway(["service", "link", SERVICE]);

  step("Setting NODE_ENV=production");
  railway([
    "variable",
    "set",
    "NODE_ENV=production",
    "--service",
    SERVICE,
    "--skip-deploys",
  ]);

  step("Building and deploying (railway up)");
  railway(["up", "--ci", "--service", SERVICE], { inherit: true });

  step("Ensuring a public *.up.railway.app domain");
  let domains = findRailwayDomains(
    DRY ? "" : (tryRailway(["domain", "list", "--service", SERVICE, "--json"]) ?? ""),
  );
  if (domains.length === 0) {
    domains = findRailwayDomains(railway(["domain", "--service", SERVICE, "--json"]));
  }

  if (DRY) {
    console.log("\n✓ dry run complete");
    return;
  }
  if (domains.length === 0) {
    throw new StepError(
      "Deployed, but no *.up.railway.app domain was reported. Run `railway domain` and check the dashboard (`railway open`).",
    );
  }
  console.log(`\n✓ Live at https://${domains[0]}`);
  console.log(
    "  Next: set site.url in app/content/meta.ts, public/sitemap.xml and public/robots.txt to this URL.",
  );
}

// Run only when executed directly (the helpers are unit-tested).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

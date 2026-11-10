# aaronellis star system

A personal resume/portfolio site where the career is a Pixar-style star system: the
sun is Aaron, and five planets — SoFi → Public.com → Empirium → NuvaLabs → Topstep —
orbit outward in chronological order. Scrolling flies the camera from planet to
planet. See [docs/PLAN-STAR-SYSTEM.md](./docs/PLAN-STAR-SYSTEM.md) for the plan,
decisions, and work breakdown. The previous ski trail-map plans live in
[docs/archive/](./docs/archive/).

`/resume` is the ATS-clean plain document; `/aaron-ellis-resume.pdf` is a committed
print of it.

## Stack

React Router v7 (framework mode, fully prerendered static output) · React 19 ·
TypeScript strict · Tailwind CSS v4 · three.js via @react-three/fiber, drei and
postprocessing (lazy-loaded 3D layer over a complete semantic document).

## Commands

| Command                     | What it does                                                        |
| --------------------------- | ------------------------------------------------------------------- |
| `pnpm dev`                  | Dev server with HMR                                                 |
| `pnpm build`                | Static prerender to `build/client/`                                 |
| `pnpm preview`              | Production server (`scripts/serve.mjs`) on :4173                    |
| `pnpm typecheck`            | React Router typegen + `tsc`                                        |
| `pnpm lint` / `pnpm format` | ESLint (flat, jsx-a11y) / Prettier check                            |
| `pnpm test`                 | Vitest unit tests (content, scroll progress, scene layout)          |
| `pnpm qa:smoke [url]`       | Smoke test: scene renders, compression, 404, no console errors      |
| `pnpm test:e2e`             | Playwright + axe against the static build (build first)             |
| `pnpm bundle:check`         | Critical-path / lazy-3D-chunk gzip budgets, no dev-only tools       |
| `pnpm lighthouse`           | Lighthouse CI against the production server (`pnpm start`)          |
| `pnpm poster`               | Render the posters + social card from the real scene (build first)  |
| `pnpm pdf`                  | Re-print `/resume` to `public/aaron-ellis-resume.pdf` (build first) |

In sandboxes with a system Chromium, prefix Playwright-based commands with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium`.

## Content

All copy lives in `app/content/` — `planets.ts` (roles + each planet's look and
orbit), `education.ts`, `skills.ts`, `meta.ts`. After editing content, run
`pnpm build && pnpm pdf` so the downloadable PDF matches.

## Deploy (Railway)

Full step-by-step guide, with troubleshooting: [docs/DEPLOY.md](./docs/DEPLOY.md).

The build is static. Railway runs `pnpm build` (Railpack, see `railway.toml`) and
serves `build/client` with `pnpm start` (`scripts/serve.mjs`, on `$PORT`). HTML is
served `no-cache`, hashed `/assets/` are cached for a year (immutable), and unknown
paths get the app's 404 page with a real 404 status.

1. Install the CLI and log in (one time, opens a browser):

   ```bash
   npm i -g @railway/cli
   ```

   ```bash
   railway login
   ```

2. Deploy. This creates and links the `aaron-ellis` project and its `web` service
   on the first run, sets `NODE_ENV=production`, builds, makes sure a
   `*.up.railway.app` domain exists, and prints the live URL:

   ```bash
   pnpm run deploy:railway
   ```

   Use `pnpm run deploy:railway --dry-run` to see the commands without running
   them. Use `pnpm run deploy:railway`, not `pnpm deploy`, which is a built-in
   pnpm command.

3. After the first deploy, set `site.url` in `app/content/meta.ts`,
   `public/sitemap.xml` and `public/robots.txt` to the printed URL.

4. Optional, later: attach a custom domain. The CLI prints the DNS record to add
   at your registrar:

   ```bash
   railway domain example.com --service web
   ```

To check the production server locally: `pnpm build && PORT=3000 pnpm start`.

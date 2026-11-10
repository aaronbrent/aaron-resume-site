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
| `pnpm preview`              | Serve the static build on :4173                                     |
| `pnpm typecheck`            | React Router typegen + `tsc`                                        |
| `pnpm lint` / `pnpm format` | ESLint (flat, jsx-a11y) / Prettier check                            |
| `pnpm test`                 | Vitest unit tests (content, scroll progress, scene layout)          |
| `pnpm test:e2e`             | Playwright + axe against the static build (build first)             |
| `pnpm bundle:check`         | Critical-path / lazy-3D-chunk gzip budgets, no dev-only tools       |
| `pnpm lighthouse`           | Lighthouse CI with `budgets.json` assertions                        |
| `pnpm pdf`                  | Re-print `/resume` to `public/aaron-ellis-resume.pdf` (build first) |

In sandboxes with a system Chromium, prefix Playwright-based commands with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium`.

## Content

All copy lives in `app/content/` — `planets.ts` (roles + each planet's look and
orbit), `education.ts`, `skills.ts`, `meta.ts`. After editing content, run
`pnpm build && pnpm pdf` so the downloadable PDF matches.

## Deploy

Railway, serving the static build — setup guide lands with W7 (see the plan).

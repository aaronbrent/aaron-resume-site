# aaronellis trail map

A personal resume/portfolio site where the career is a snowboard run down a mountain.
See [PLAN.md](./PLAN.md) for the full build plan, architecture decisions, and phase gates.

## Stack

React Router v7 (framework mode, fully prerendered static output) · React 19 ·
TypeScript strict · Tailwind CSS v4 · zero animation dependencies · Cloudflare Pages.

## Commands

| Command                     | What it does                                            |
| --------------------------- | ------------------------------------------------------- |
| `pnpm dev`                  | Dev server with HMR                                     |
| `pnpm build`                | Static prerender to `build/client/`                     |
| `pnpm preview`              | Serve the static build on :4173                         |
| `pnpm typecheck`            | React Router typegen + `tsc`                            |
| `pnpm lint` / `pnpm format` | ESLint (flat, jsx-a11y) / Prettier check                |
| `pnpm test`                 | Vitest unit tests                                       |
| `pnpm test:e2e`             | Playwright + axe against the static build (build first) |
| `pnpm lighthouse`           | Lighthouse CI with `budgets.json` assertions            |

## Deploy

Static output in `build/client/` deploys to Cloudflare Pages. CI deploys on push to
`main` once `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets are
set (see `.github/workflows/ci.yml`). Any static host works.

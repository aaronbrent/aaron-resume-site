# Plan: Pixar-style cartoon star system portfolio

**Status:** Approved, amended after review (2026-11-10). W1–W7 and review gates 1–2 complete; deploy is run by Aaron.
**Scope:** Complete rewrite of the portfolio site, replacing the ski trail-map / 3D-POV
experience. The earlier plans are archived in `docs/archive/`.

This is Aaron's plan with the review amendments folded in. Where they differ, this
document wins.

---

## 1. Product vision

A single-page scrolling experience where the camera flies through a stylized solar
system. The sun at the center represents Aaron; five planets represent his roles in
chronological order outward. Native page scroll drives a continuous camera flight: at
each planet the camera turns to the next one in the distance, then moves in on it; each
planet's role card fades in on final approach.

- **Art direction:** Pixar/Dreamworks — soft rounded shading, bounce-light rims, faked
  contact shading, bloom on emissive bodies, painterly nebula backdrop. No audio.
- **Scroll model:** continuous flight (not snap-to).
- **Layout:** the sun, then five planets scattered around it on tilted orbits (seeded,
  see §4), with no orbit lines. Planets spin but never move, so the camera's dwell
  points stay put; the flight slingshots around each body on its way to the next.
- **`/resume`** stays an ATS-clean HTML document; `/aaron-ellis-resume.pdf` stays
  downloadable and is regenerated whenever content changes (`pnpm build && pnpm pdf`).

## 2. Architecture

- **Static prerender** (`ssr: false, prerender: true`). There is no Node runtime;
  Railway serves `build/client` with `sirv`.
- **The document is the site.** Hero, five `<section aria-labelledby>` panels and the
  contact footer are prerendered HTML, one viewport each. They work without JavaScript,
  without WebGL and under reduced motion, and they are what screen readers, SEO and
  `/#id` deep links see.
- **The 3D layer is an enhancement.** It mounts into the fixed
  `[data-scene-root][aria-hidden]` behind the document after hydration, and loads only
  if `canRenderScene()` (`app/lib/capability.ts`) passes: no reduced motion, real WebGL2
  rather than software GL, more than 2 GB of device memory. It is loaded with
  `React.lazy`.
- **Scroll progress** comes from `app/lib/progress.ts`, which uses native document
  scroll and no drei `ScrollControls`. `getProgress()` reads it inside `useFrame`;
  `subscribe()` is for DOM panels. Never put progress in React state.
  - Stop 0 is the hero; stop `i + 1` is planet `i`.
  - `planetIndexAt` and `dwellRange` define dwell (parked) versus travel.

### Stack

- **Kept:** React Router 7, three.js, Tailwind v4, Playwright, Lighthouse CI, pnpm.
- **Added:** `@react-three/fiber` 9, `@react-three/drei` 10 (`Environment`,
  `Lightformer`, imported per module), `@react-three/postprocessing`
  3 and `postprocessing`.
- **Dev only:** `leva` behind `import.meta.env.DEV` with a dynamic import.
  `bundle:check` fails if it ships.

## 3. Content

`app/content/planets.ts` is the single source of truth for copy, palettes, sizes and
orbit radii. The schema is `Planet` in `app/content/types.ts`. Where on its orbit each
planet sits comes from the seeded layout (§4).

| idx | id         | org        | period            | biome            | radius |
| --- | ---------- | ---------- | ----------------- | ---------------- | ------ |
| 0   | `sofi`     | SoFi       | 2017-06 → 2021-03 | molten           | 10     |
| 1   | `public`   | Public.com | 2021-04 → 2023-05 | ocean            | 24     |
| 2   | `empirium` | Empirium   | 2023-06 → 2024-05 | desert           | 40     |
| 3   | `nuvalabs` | NuvaLabs   | 2024-06 → 2026-05 | ice-ringed       | 58     |
| 4   | `topstep`  | Topstep    | 2026-10 → present | gas-giant-banded | 78     |

- Copy for the first four roles is carried over verbatim from the old site.
- Topstep's copy is mandate-focused ("Owns…", "Sets…", "Defines…") and gets refreshed
  once the first deliverables ship. Check whether "thousands of active traders" is a
  figure Aaron can stand behind.
- May → October 2026 is a visible gap. No filler.
- Education and personal projects live in `education.ts` and appear on `/resume`.

## 4. Scene spec

**Contracts (W1):** `app/scene/constants.ts` (`SUN_RADIUS = 1`, `DPR_MAX`, `NEBULA_SEED`,
`LAYOUT_SEED`, `isQaMode()`), `app/scene/types.ts` (`PlanetBodyProps`),
`app/scene/layout.ts` (`orbitPosition(radius, orbit)`) and
`app/scene/system-layout.ts` (`getSystemLayout()`).

- **World units:** the sun's radius is 1. +y is up; orbits are circles around the sun,
  each tilted 4°–14° out of y = 0.
- **Angles:** 0 points along +x; positive angles turn counter-clockwise seen from above.

### Layout (seeded)

`generateLayout(seed)` places each planet on its content orbit radius at a seeded
bearing, inclination and node, and draws every moon's orbit (radius, inclination,
node, phase, speed — about one in four retrograde) per planet. It re-rolls, still
deterministically, until `checkLayout` passes:

- neighbours ≥ 14 units apart; consecutive bearings 60°–150° apart;
- no empty sector wider than 150°, so the planets surround the sun;
- planets both above and below the sun's plane;
- every slingshot sweeps 60°–210° round its body, and the sampled flight clears the
  sun's corona and every planet's rings and moons, in landscape and portrait.

`LAYOUT_SEED` is the shipped layout (an outward spiral round the sun). `?seed=N`
previews another one on the home page and in `/lab`; seeds 1–200 are tested valid.

### Sun

An emissive sphere with a warm gradient core, a soft halo and gentle rotation. (The
original faint orbit guides were removed to give a sense of open space.)

### Planets

Palettes are sampled from each company's own site CSS tokens; moons take their own
brand color (`palette.moons`).

| Planet                    | Visual notes                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------ |
| SoFi — "The Rewrite"      | Aubergine crust, glowing SoFi-teal lava cracks, sky rim, 1 butter-yellow moon        |
| Public.com — "Corduroy"   | Public brand-blue ocean, cyan shallows, periwinkle clouds, 1 bright-blue moon        |
| Empirium — "The Traverse" | Ochre sands with bone highlights, a steel-blue ring                                  |
| NuvaLabs — "Prime Face"   | Periwinkle ice, violet caps and ring bands, sky-blue rim, 2 moons (blue, NUVA mint)  |
| Topstep — "Charts"        | Topstep gold with royal-purple bands that evoke a chart grid, subtle storm, no moons |

### Lighting

- A low-intensity studio HDR, or drei `Lightformer`s, for ambient fill.
- A keyed point light at the sun with physical falloff.
- A cool fill from the camera side.
- A per-planet rim, color-matched to its palette.

### Post-processing: none (renders natively)

- The original bloom/vignette/SMAA chain (`@react-three/postprocessing`) was removed
  after it drew only a strip of the frame on a real Mac GPU — a failure software-GL QA
  could not see (see §7).
- The scene renders straight to the canvas: native MSAA, ACES tone mapping and sRGB
  output on the renderer. Custom shaders include three's tonemapping/colorspace chunks.
- Glow without bloom: a billboard halo behind the sun, the corona shell, emissive lava,
  thin atmosphere shells (`ATMOSPHERE_GAIN`), and a CSS vignette.
- Quality steps down through a small custom FPS governor (`app/scene/quality.ts`):
  DPR cap, planet detail and dust count.

### Background

A painterly nebula gradient with a few GPU-instanced dust motes, seeded by
`NEBULA_SEED`.

## 5. Scroll choreography

- **Page 0 (hero):** the sun fills the frame, with the name, tagline and a "Scroll"
  cue.
- **Pages 1–5:** each leg of the flight (`app/scene/camera-path.ts`) is one smooth
  curve, eased from rest to rest:
  - **slingshot** (first 45%): the camera swings round the body it is leaving (the sun
    on the first leg), spiralling in to a periapsis just outside its rings and moons,
    and leaves on the tangent toward the next planet. The aim turns from the parked
    shot to the next planet, pulled toward the slung body mid-swing so it whips past
    the edge of frame;
  - **cruise**: a Bézier from that tangent onto the next planet's approach line;
  - **approach + settle**: a straight run into the parked pose; from 68% of the leg the
    aim eases off-centre so the planet slides to the right as the role card fades in.
  - Each planet's parked pose is on its sunlit side (within 60° of the sun), turned
    away from the next planet so the next slingshot has room to swing, a touch above
    for a ¾ view.
- **Navigation:**
  - "Skip to text" goes to `/resume`.
  - ArrowDown/ArrowUp step between planets; Home/End jump to the sun or the outermost
    planet.
  - Deep links (`/#topstep`) keep working, because the sections are real document
    anchors.

- **Role cards** (wide landscape screens, scene on): each prerendered `<article>` is a
  glass card **fixed to the left**, vertically centred, while the planet is framed on
  the right. It fades in only on **final approach** (`app/lib/panels.ts`, from 0.36 stops
  out) and out quickly on departure, so only one card ever shows. Phones and short
  windows keep the card in flow below the planet. The DOM, deep links, print and no-JS
  are unchanged. In `?qa=1`, `PlanetProbe` exposes each planet's screen position so
  e2e can assert the card never covers it.

## 6. Mobile, accessibility, reduced motion

- **Mobile:** DPR clamped to 1.5, reduced moon and ring detail, a lower-resolution
  environment map, and postprocessing gated by the FPS governor's quality tiers.
- **Reduced motion, no WebGL or no JS:** no canvas. A static poster PNG sits behind the
  same prerendered sections. There is no separate card layout.
- **Accessibility:**
  - Landmark-labeled sections.
  - Focus order is chronological.
  - axe must pass clean at the hero and at the last planet.
  - Lighthouse a11y = 100.

## 7. QA

**Visual baselines** are Linux/SwiftShader renders and the suite skips on other
platforms (`pnpm test:e2e` on a Mac runs everything else); regenerate them on Linux
or from a CI run's artifacts.

**Lesson learned:** every automated check runs on SwiftShader (software GL), so a
real-GPU-only failure shipped once. Two guards now exist: a black-frame check
(`e2e/support/frame.ts`: the scene never draws pure black) in the visual, scene and
smoke checks, including a natural-tier DPR 2 run; and `pnpm qa:gpu`, a headed
fly-through on a real GPU that the owner runs before deploying.

- **Playwright** projects: `desktop-chromium`, and `mobile` (an iPhone 13 viewport on
  Chromium; CI installs Chromium only).
- **Today (W1):** `e2e/a11y.spec.ts` covers axe, no-JS, heading order, deep links, the
  PDF and `/resume` roles.
- **W6 adds:**
  - checks that each planet's title and period are visible in its scroll range
  - a reduced-motion check that the canvas is absent
  - visual regression with `toHaveScreenshot` under `?qa=1` at scroll 0/20/40/60/80/100,
    desktop and mobile. Baselines come from **Linux only**, with
    `maxDiffPixelRatio` ≈ 0.02.
- **Lighthouse:** perf ≥ 0.85 on mobile, a11y = 1, best-practices ≥ 0.95, CLS = 0. The
  script budget is raised to fit the lazy chunk. It gates the static path (`/`,
  `/resume/`): what every visitor gets first, since the 3D layer loads after paint.
  A `?gl=full` run is _not_ gated: in CI the scene renders on SwiftShader (CPU), which
  under Lighthouse's 4× CPU throttle reads as ~150 s of blocking time — a property of
  software GL, not of real GPUs. Scene runtime is covered by `qa:smoke` (FPS on real
  GPUs) and the tier governor.
- **`bundle:check`:** critical path ≤ 130 KB gz, lazy 3D chunk ≤ 235 KB gz, no leva. W2a
  flips `REQUIRE_3D_DEFAULT` to true once the scene exists.
- **`scripts/qa-smoke.ts`:**
  - CI asserts that a WebGL context is acquired, that there are no console errors and
    that at least one frame renders.
  - The FPS > 30 sample is local only, because SwiftShader in CI can't hold it.

## 8. Deploy: Railway

- `railway.toml` uses `builder = "RAILPACK"`, a build command of `pnpm build`, a start
  command of `pnpm start` and `healthcheckPath = "/"`.
- `pnpm start` runs `sirv build/client --host 0.0.0.0 --port $PORT --single` with
  caching flags. Move `sirv-cli` into dependencies.
- `scripts/deploy-railway.ts`, run as `pnpm run deploy:railway`. (A bare `deploy` would
  collide with pnpm's built-in command.) Its steps:
  1. `railway status`; if no project is linked, `railway init --name aaron-ellis`.
  2. Set `NODE_ENV=production`.
  3. `railway up`.
  4. `railway domain` (with no arguments). This is required: it creates the
     `*.up.railway.app` URL.
  5. Print the URL.
- **Aaron runs the first deploy locally:** `railway login` once, then
  `pnpm run deploy:railway`.
- **After the first deploy:**
  - Set `site.url` in `app/content/meta.ts`, `public/sitemap.xml` and
    `public/robots.txt` to the live URL.
  - Remove the Cloudflare `deploy` job from CI.
  - Add a README deploy guide that includes the optional `railway domain <custom>`.

## 9. Work breakdown

| #             | Worker               | Scope                                                                                                                                                                                                                       | Depends on   |
| ------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **W1** ✅     | Cleanup + scaffold   | Delete the trail-map code; add R3F deps; `planets.ts`, `education.ts`, skills, meta; contracts (`app/scene/*`, `app/lib/progress.ts`, `app/lib/capability.ts`); stub `_index.tsx`; `/resume` on planets; regenerate the PDF | —            |
| **W2a** ✅    | Scene + lighting     | Lazy Canvas in `[data-scene-root]`, sun, orbit guides, environment, postprocessing                                                                                                                                          | W1           |
| **W2b** ✅    | Planet designer      | Five `PlanetBody` components (biome shaders) against `PlanetBodyProps`                                                                                                                                                      | W1           |
| **W3** ✅     | Camera + scroll      | Curve from the seeded layout, dwell/travel easing on `getProgress()`, keyboard navigation                                                                                                                                   | W2a          |
| **W4** ✅     | Panels + copy        | Fade the prerendered sections by `dwellRange()`; hero polish; typography and token pass                                                                                                                                     | W3           |
| **Gate 1** ✅ | Reviewer             | Diffs and self-tests from W1–W4                                                                                                                                                                                             | W1–W4        |
| **W5** ✅     | Mobile tune + poster | `PerformanceMonitor` tiers; `scripts/render-poster.ts` (`?qa=1`) for the poster, the fallback and the OG image                                                                                                              | W2a, W2b, W4 |
| **W6** ✅     | QA automation        | Remaining Playwright specs, Linux visual baselines, Lighthouse config, smoke script                                                                                                                                         | W4, W5       |
| **Gate 2** ✅ | Reviewer             | Diffs and self-tests from W5–W6                                                                                                                                                                                             | W5–W6        |
| **W7** ✅     | Railway config       | `railway.toml`, `start`, the deploy script, the README guide, removing the Cloudflare job (can start any time after W1)                                                                                                     | W1           |
| **Deploy**    | Aaron (local)        | `railway login` → `pnpm run deploy:railway` → paste the URL back                                                                                                                                                            | Gate 2, W7   |
| **Final**     | Reviewer             | Smoke-test the live URL; check against the Done criteria                                                                                                                                                                    | Deploy       |

Each worker returns a diff and a self-test command. The reviewer runs the self-tests
independently.

## 10. Done criteria

- `pnpm dev` renders the system with smooth scrolling through all five planets.
- `pnpm typecheck`, `lint`, `format`, `test`, `build`, `bundle:check` and `test:e2e`
  are all green.
- Lighthouse thresholds from §7 are met.
- `/resume` lists all five roles, and the committed PDF matches it.
- `pnpm run deploy:railway` puts the site live on Railway and prints the URL.
- Reduced-motion, no-JS and no-WebGL visitors get the fully readable document.

## 11. Risks

| Risk                                                    | Mitigation                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Bundle size (R3F, drei, postprocessing on top of three) | Lazy chunk after the capability probe; per-module drei imports; a 235 KB gz gate |
| Mobile GPU                                              | `PerformanceMonitor` tiers, DPR cap, no SSAO                                     |
| Visual-regression flakiness                             | Snapshots only under `?qa=1`; Linux-only baselines; a small diff tolerance       |
| Topstep copy is mandate-only                            | Honest framing; refresh after the first deliverables                             |

## 12. Decisions log

| Decision       | Choice                                                         | Rejected alternatives                                                          |
| -------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Art style      | Pixar/Dreamworks                                               | Flat vector; Ghibli painterly; low-poly                                        |
| Scroll model   | Continuous flight on native document scroll                    | Snap-to; drei ScrollControls                                                   |
| Existing site  | Replace entirely                                               | Archive branch; easter-egg route                                               |
| Layout         | Seeded scatter round the sun on tilted orbits, slingshot legs  | Hand-placed line; concentric orbit guides; orbiting planets; re-roll per visit |
| Semantics      | Prerendered document always; canvas as an aria-hidden backdrop | Reduced-motion-only cards; drei `<Html>`                                       |
| Mobile         | Same 3D, dialed down                                           | 3D intro + cards; full parity                                                  |
| Postprocessing | Bloom, vignette, SMAA                                          | SSAO; FXAA                                                                     |
| Hosting        | Static build on Railway (sirv)                                 | SSR on Railway; stay on Cloudflare Pages                                       |
| First deploy   | Aaron runs it locally                                          | Project token in a cloud session                                               |
| Quality bar    | a11y 100, CLS 0, perf ≥ 85                                     | Plan's a11y 95; today's perf 90                                                |
| Domain         | `*.up.railway.app` for now                                     | Custom domain now                                                              |
| Audio          | None                                                           | Opt-in ambient                                                                 |

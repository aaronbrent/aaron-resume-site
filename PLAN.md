# PLAN.md — Scroll-Driven Snowboarder Portfolio

**Project:** aaronellis trail map — a personal site where the career is a snowboard run down a mountain.
**Audience:** Hiring managers/recruiters for SE, sales engineering, DevRel, and TAM roles. Mostly non-engineers, arriving from LinkedIn on phones.
**Appetite:** 2–3 weeks, phased. Phase 1 ships a complete, hireable site by itself; everything after is compounding.
**How to use this doc:** Every phase ends at something demoable. Check boxes as we go. Exit criteria are gates — we don't start the next phase until they pass. Sections 1–8 are the decisions; sections 9–11 are the work, the risks, and what's still open.

---

## 0. Decisions at a glance

| Decision | Choice |
|---|---|
| Framework | React Router v7, framework mode, `prerender` → fully static output |
| Language | TypeScript, `strict`, no `any` |
| Camera | World scroll + constant-vertical-speed path reparameterization (implicit follow-cam) |
| Animation | Hand-rolled rig: one passive scroll listener + one rAF loop + precomputed path LUT. Zero animation dependencies. |
| Content reveals | IntersectionObserver + CSS transitions |
| Styling | Tailwind CSS v4 (CSS-first `@theme` tokens) + small plain-CSS files for keyframes |
| Rider | Layered SVG puppet, pose = data-attribute + CSS vars, driven imperatively |
| Spray | Single `<canvas>` overlay, pooled particles, drawn in the same rAF |
| Art | Flat trail-map vector, authored in code; Figma only for drawing/tuning the trail path |
| Intro | Gondola ride up (pure-CSS keyframe sequence on load) carrying education + personal projects, incl. My Menu Plans |
| Waypoints | 4 on the run: SoFi, Public.com, Empirium, NuvaLabs. Base camp = contact + legend + colophon. |
| Deploy | Cloudflare Pages (static output), GitHub Actions CI, Lighthouse CI budgets |
| Escape hatches | `/resume` (ATS-clean), print stylesheet, committed PDF |

---

## 1. Architecture Decision Records

### ADR-1: Camera model — world scroll with constant-vertical-speed reparameterization

**Decision.** One tall page, native scroll, no pinning. The trail path is resampled at build/init time so that **arc position is uniform in world Y** — i.e., the rider moves at constant *vertical* speed. Because the rider's world Y advances 1:1 with scroll, his screen Y is constant: `screenY = worldY − scrollY = const` (we'll park him at ~38% of viewport height). 

This is the load-bearing insight: **constant-vertical parameterization makes world scroll and follow-camera the same thing.** We get the "rider holds a stable band while terrain moves past" feel of a platformer camera with zero pinning, zero scroll interception, zero second synchronized layer. The only thing that moves horizontally is the rider carving across the viewport — which is exactly the part that should feel alive.

**What we give up:**
- **True rollers and uphill sections.** The path must be monotonically descending in Y. We fake rollers with the *pose system* (compression/unweighting from curvature) rather than actual Y-reversals. A real roller would make the rider drift vertically on screen; a compression pose at the same spot reads the same to a viewer and costs nothing.
- **Constant arc-length speed.** On near-horizontal traverses the rider sweeps across the screen fast; on steeps he drops slowly. This is actually *correct to the sport* (traverses are where you cover ground), but it imposes an authoring rule: **keep every path segment between ~30° and ~75° from horizontal.** The trail validator (§2) enforces this.

**Rejected:**
- *Pinned viewport* — position-sticky pinning with terrain parallax is the option most likely to read as scroll-jack, behaves worst with iOS toolbar collapse and find-in-page, and decouples document flow from visual flow, which poisons the accessibility story.
- *Follow camera with deadzone* — the honest platformer solution, but it requires a scroll-linked world transform (a second moving system to keep frame-synced with native scroll) and only pays for itself when the path is non-monotonic. We just decided it won't be.

### ADR-2: Animation approach — hand-rolled rig, no animation library

**Decision.** The rider rig is ~300 lines we own:

1. One `passive` scroll listener writes `targetScrollY`. Nothing else happens in the handler.
2. One rAF loop runs a critically-damped smoother from `currentT` toward `targetT` (time-based, frame-rate independent), samples a precomputed lookup table, and writes `transform` strings to refs. The loop **parks itself** when settled (no rAF churn at rest) and wakes on the next scroll event.
3. The LUT is a `Float32Array` built once per breakpoint: N≈2,000 rows of `{x, tangentθ, dθ/dy}` sampled at uniform Y. `getPointAtLength` — which is slow — is called only at init/breakpoint-change, never per frame. Per-frame cost is an index + lerp.

Content reveals are not the rig's job: server-rendered sections get a one-time IntersectionObserver class-toggle and a CSS transition. SSR-safe, free, and they keep working if the rig dies.

**Why not the libraries:**
- **Motion** (`useScroll`/`useTransform`): its scroll plumbing is fine, but the hard 20% — LUT sampling, tangent/curvature derivation, the pose state machine — would still be custom transform functions we write ourselves. We'd ship ~15–18 kB gz to get a nicer name for `requestAnimationFrame`.
- **GSAP ScrollTrigger + MotionPathPlugin**: now free, genuinely good at position+rotation along a path. But it doesn't give us curvature-driven pose derivation (the actual differentiator), it's ~30 kB gz, and it's an imperative timeline system layered over a React app that needs exactly one timeline. 
- **CSS `scroll-timeline`**: still not universal (Safari support remains partial in mid-2026), and it fundamentally can't run the pose logic — it maps scroll to property values, not to a state machine. Reserved as a progressive enhancement for dumb parallax layers (clouds, far ridgeline) later, where a JS fallback is "the layer doesn't parallax," which is fine.

**The tradeoff accepted:** we own the edge cases — resize, breakpoint crossing, bfcache restore, scroll restoration, deep-link entry. They're enumerated in §3 and §7 so they're built, not discovered. The payoff beyond bundle size: the colophon gets to say *"the animation system is ~300 lines, zero dependencies — view source."* For an SE/DevRel audience, that line is the demo.

### ADR-3: Styling — Tailwind CSS v4 + surgical plain CSS

**Decision.** Tailwind v4, CSS-first config: the palette, type scale, and spacing live as design tokens in an `@theme` block — which makes them real CSS custom properties the rig and canvas can read (`getComputedStyle` for spray color, no duplicated constants). Utilities for layout and the document; plain CSS files for the things Tailwind is bad at: keyframes (gondola, idle breathing, scroll cue), the paper texture, the print stylesheet.

**Rejected:** CSS Modules / vanilla-extract (fine, but Tailwind is in your stated stack and this project should showcase your actual stack); styled-components/Emotion (runtime CSS-in-JS in 2026 on a site with a 60fps budget is an unforced error); UI kits of any kind (nothing here is a standard component).

### ADR-4: Rendering & deploy — prerender everything, static host

**Decision.** RR v7 framework mode with `prerender: true` for all routes (`/`, `/resume`, plus 404). Full SSR code path at build time, pure static HTML+assets at runtime, deployed to **Cloudflare Pages**. No server, no cold starts, trivially cacheable, free tier covers it. If a dynamic need ever appears, the same codebase redeploys to Workers with SSR on — that's the escape hatch, not the default.

**Rejected:** runtime SSR on Workers/Vercel (paying latency-variance and complexity for zero dynamic data); plain Vite SPA (loses the server-rendered document that the entire accessibility and SEO story stands on).

---

## 2. The path system

### Coordinate space

- Paths are authored in a **normalized viewBox: 1000 units wide**, height per breakpoint (below). All rig math happens in normalized units; a single scale factor (from ResizeObserver, cached — never read in the rAF loop) converts to screen pixels. Resizes within a breakpoint are a scale-factor update, **not** a LUT rebuild.
- **Scroll height is derived, never magic:**

```
runHeight = INTRO(100svh) + waypoints × DWELL(160svh) + OUTRO(140svh)
          = 100 + 4×160 + 140 = 880svh   (~8.8 screens, ~60–90s at a natural pace)
```

- `DWELL` is the one tuning constant. Adding a 5th waypoint = add an object, run regenerates, page gets 160svh taller. Waypoint `t` values position both the SVG marker **and** the document section (via `top` spacing derived from `Δt × runHeight`, computed from pure data at build — no client facts, no hydration risk). DOM order = t order = visual order, always.

### Two paths, desktop and mobile — yes, they're different lines

A 1440px mountain and a 390px portrait phone want different runs: mobile needs a taller, tighter line with more switchbacks to stay inside 1000 normalized units of width.

- `trail.mobile.ts` — viewBox ≈ 1000 × 18,600 (390×844 device, 880svh). Portrait-first: this is the primary artifact.
- `trail.desktop.ts` — viewBox ≈ 1000 × 5,400 (1440×900, 880svh). Wider carves, longer traverses.

**Swap without hydration mismatch:** both `<path>` elements are server-rendered into the SVG; a CSS media query displays exactly one. No JS decision, no mismatch, cost is one extra path string (~2 kB). The rig picks its LUT source via `matchMedia` and rebuilds only on an actual breakpoint crossing (a discrete, rare event where a one-frame re-init is acceptable).

### Authoring workflow (Figma-in-the-loop)

1. `pnpm gen:template -- --breakpoint mobile` emits an SVG template: correct viewBox, horizontal guide lines at each waypoint's Y, slope-angle protractor marks. Import into Figma.
2. Draw the run over the template with the pen tool. One continuous path, top to bottom.
3. Export SVG → `pnpm trail:normalize` — svgo, flatten transforms, absolute coordinates, emit `trail.{bp}.ts` with the `d` string + a header comment carrying source hash and date.
4. `pnpm trail:validate` (also runs in CI):
   - Y strictly monotonic (no uphill)
   - every segment slope within 30°–75° of horizontal
   - x stays within [40, 960] (viewport margin)
   - waypoint `t` spacing ≥ minimum dwell
   - curvature spikes flagged (a kink the pose system would interpret as a crash)

Paths are versioned as generated TS modules in git — reviewable diffs, no binary assets, no runtime fetching.

### Sampling strategy

- Build-time/init: walk the live path via `getPointAtLength` at fine intervals, then **resample to uniform Y** into the LUT. Store per row: `x`, `θ` (tangent via forward difference + `atan2`), `dθ/dy` (curve rate, smoothed with a small box filter so poses don't flicker on authoring noise).
- Runtime per frame: `row = t × (N−1)`, lerp two rows. O(1), allocation-free.
- The second derivative for compression/unweighting is computed as the frame-to-frame delta of `dθ/dy` scaled by scroll velocity — velocity lives in the rig, not the LUT, because it's a property of the *visitor's* scrolling, not the mountain.

---

## 3. Component tree & client/server boundaries

```
root.tsx                          server · fonts, meta, theme class, skip-link
├── routes/_index.tsx             server · prerendered
│   ├── <SummitHero>              server · h1 name, positioning line, "run starts below" cue
│   │   └── <GondolaIntro>        server-rendered markup, PURE CSS keyframe animation —
│   │                             runs before hydration, no flash possible, paused by
│   │                             prefers-reduced-motion. Carries the credits (§below).
│   ├── <CareerDocument>          server · THE content. Semantic <section> per waypoint,
│   │   │                         real headings, correct order, complete without JS/CSS.
│   │   ├── <WaypointSection id="sofi" …>      (h2, claim/evidence/why-care, named run)
│   │   ├── <WaypointSection id="public" …>
│   │   ├── <WaypointSection id="empirium" …>
│   │   ├── <WaypointSection id="nuvalabs" …>
│   │   └── <ClosedTrail>         server · slot reserved, renders nothing until content exists
│   ├── <BaseCamp>                server · contact (the last thing on screen), legend, colophon
│   └── <MountainStage>           aria-hidden, role="presentation" · the visual layer
│       ├── <TrailMap>            server · static SVG: terrain shapes, both trail paths,
│       │                         waypoint markers, difficulty icons, paper frame. Complete
│       │                         and correct-looking with zero JS — this IS the
│       │                         reduced-motion/no-JS backdrop.
│       ├── <Rider>               server-rendered at t=0 idle pose (matches rig's first
│       │                         frame exactly → no hydration flash). Client rig takes
│       │                         over transforms imperatively.
│       └── <SprayCanvas>         client-only (mounted post-hydration; it's additive polish)
└── routes/resume.tsx             server · ATS-clean semantic resume, print styles, PDF link
```

**The boundary rule:** React renders the scene once. After hydration, nothing in `<MountainStage>` ever re-renders from state — the rig mutates `transform`, `data-pose`, and CSS custom properties through refs. React state exists only where React should own it: reveal classes (IO), reduced-motion flag, breakpoint identity.

**Deferred to `useLayoutEffect` (pre-first-paint on client), in order:**
1. Read `matchMedia` → select path variant.
2. Read current `scrollY` (deep links / scroll restoration mean it's not always 0).
3. Sample the path *synchronously at just the current t* and place the rider — snap, no smoothing from summit. This closes the mid-page-load flash window.
4. Build the full LUT (a few ms; if it ever grows, chunk it — position is already correct from step 3).
5. Attach scroll/resize/visibility listeners; start the (parked) rAF loop.

**Enumerated edge cases we own (from ADR-2):** bfcache restore (`pagehide`/`pageshow` re-sync), browser scroll restoration (native, left on; step 2–3 handle it), find-in-page jumps (native scroll → IO fires → reveals run), anchor navigation (native; `scroll-margin-top` on sections), breakpoint crossing mid-scroll (rebuild LUT, re-snap, one frame).

---

## 4. Data schema

Content is typed TS data in `app/content/` — `satisfies` for inference, no runtime validation dependency (it's our own build; the validator script and `tsc` are the gate).

```ts
type Difficulty = 'green' | 'blue' | 'black' | 'double-black';

interface Waypoint {
  id: string;                 // anchor + deep link: /#sofi
  t: number;                  // normalized position along the run, ∈ (0,1)
  side: 'left' | 'right';     // desktop content placement (mobile: always full-width card)
  difficulty: Difficulty;
  trailName: string;          // "Corduroy" — the run's name on the map
  org: string; role: string;
  period: { start: string; end: string | 'present' };  // ISO dates
  claim: string;              // one sentence: what I did that mattered
  evidence: string[];         // 2–4 bullets, concrete, numbers where honest
  whyCare: string;            // one sentence aimed at a non-engineer
  tech: SkillId[];            // legend cross-refs
}

interface GondolaCredit {     // the ride up: education + personal projects
  year: string;
  label: string;              // "freeCodeCamp — Full Stack cert", "My Menu Plans —
                              //  WordPress → React/Node, ran it solo for 3 years", …
}

interface Skill { id: SkillId; label: string; group: 'frontend'|'backend'|'cloud'|'leadership-ai'; }

interface ClosedTrail {       // slot reserved — content TBD (open question #1)
  trailName: string;          // shown roped off with a CLOSED sign
  story: string;              // what it was, why it didn't work, what it taught
  period: string;
}

interface TrailMeta {
  dwellSvh: number;           // 160 — the one scroll-length tuning constant
  introSvh: number; outroSvh: number;
  breakpoints: { mobile: TrailVariant; desktop: TrailVariant };
}
interface TrailVariant { d: string; viewBox: [number, number]; sourceHash: string; }
```

### The four waypoints (draft content direction — copy written in Phase 1)

| id | t | Difficulty | Trail name (proposal) | The claim |
|---|---|---|---|---|
| `sofi` | ~0.18 | ⬛ black | **The Rewrite** | Primary frontend engineer for SoFi Invest; led the company-wide Angular→React migration, architecture adopted org-wide, millions of members |
| `public` | ~0.45 | ⬛ black | **Corduroy** | Built the bond screener for an industry-leading fractional platform; led CWV/perf work with measured funnel gains (corduroy = freshly groomed = performance work; the metaphor does the talking) |
| `empirium` | ~0.65 | 🟦 blue | **The Traverse** | Contract full-stack: escrow.com checkout end-to-end, org admin portal, RBAC — a working traverse between big-mountain lines |
| `nuvalabs` | ~0.82 | ⬛⬛ double-black | **Prime Face** | Staff engineer on security-critical RWA fintech: nvPRIME end-to-end, Auth0/Privy hardening, AML enforcement, multi-agent AI dev workflows |

**Difficulty mapping (the metaphor earning its keep):** difficulty rates the *terrain* — technical depth and consequence-of-failure — not seniority or recency. Green = foundations and learning in public (lives on the gondola). Blue = solid production delivery. Black = deep technical ownership at scale. Double-black = security-critical, staff-scope systems where falling costs real money. The legend states this mapping in one line, so the ratings read as considered, not decorative.

**Restraint rule for trail names:** one named run per waypoint, zero puns per screen beyond it. "Corduroy" works because it's real mountain vocabulary that happens to describe the work. Anything that needs explaining gets cut.

---

## 5. The rider

### Rendering

One inline SVG puppet (~2 kB): grouped parts — board, front/back leg, torso, arms, head. No sprite sheets, no Lottie, no image sequences. Two kinds of motion:

- **Continuous** (every frame, imperative): root transform `translate(x,y) rotate(θ)` from the LUT; CSS custom props `--lean` (from dθ/dy) and `--crouch` (from the second-derivative signal) consumed by part-group transforms. Transform/opacity only, one composited layer, `will-change: transform` on the rider root and nothing else uninvited.
- **Discrete poses** (state machine, ~150ms CSS transitions between): `data-pose` attribute on the root.

### Pose state machine — derived, never triggered

| Pose | Condition (evaluated per frame, with hysteresis) |
|---|---|
| `idle` | `t ≈ 0`, velocity ≈ 0 — breathing loop, board tap, goggle adjust (CSS keyframes) |
| `tuck` | low \|curvature\|, high scroll velocity |
| `carve-left` / `carve-right` | sign of dθ/dy; `--lean` scales with magnitude |
| `compress` / `unweight` | second-derivative signal over rollers (fakes the terrain ADR-1 gave up) |
| `switch` | sustained reverse scroll velocity (see below) |
| `brake` | `t > 0.97` and decelerating — hockey stop, hold |

Thresholds live in one tunable constants file with the dev HUD (§6) displaying live values — tuning is observation, not recompiling guesses.

### Snow spray

Single full-viewport `<canvas>`, pooled 128 particles in a preallocated Float32Array (zero GC), drawn inside the same rAF tick — one loop owns the frame, always. Emitter at the board contact point (known from the LUT sample); emission rate and cone = `scrollVelocity × |dθ/dy|` (speed × edge angle). Big carves at speed throw big spray; a gentle scroll barely dusts. The **hockey stop at the base is the same system with a 10× burst multiplier** — the run *lands*, the spray settles, and the last thing on screen is how to reach you. Canvas is skipped entirely under reduced-motion and never mounts if the rig doesn't.

### The summit idle & the gondola

Page loads at the summit: name, positioning line, scroll cue rendered instantly (SSR). Behind the hero, a **pure-CSS gondola sequence** (~6s, runs once, before hydration even finishes): a cabin rides the lift line to the top station while the gondola credits tick past like tower signs — freeCodeCamp '16, V School '17, My Menu Plans '14–'17 (built, ran, and sunset a real product solo), personal projects. Cabin arrives, rider unloads, ratchets a binding, taps the board: idle. **"Ready to drop" is legible** because the rider is poised at the lip of a visible line that leads below the fold, with the scroll cue pointing down it. A skimmer who never watches the gondola loses nothing — education also lives in `/resume` and the base camp. Scrolling mid-sequence instantly resolves it (animation jumps to end state; scroll is never gated).

### Scroll-up: switch. You're right, and here's the argument made properly.

The alternative — running the tape backward — turns the rider into a scrubbed video and shatters the fiction that he's a character. Riding switch keeps him *alive*: scroll-up is the visitor's action, and the rider responding with a stance flip (mirrored pose + trailing hand, `scaleX(-1)` on the pose layer — near-zero cost) is the site acknowledging the visitor without obeying-the-scrollbar theatrics. Yes, riding switch *uphill* is physically absurd — but so is time-reversal, and switch is absurd in a way that reads as intentional character, not as a rendering artifact. One guard: **150ms sustained-reverse hysteresis** before the flip, or trackpad inertia bounce will strobe the stance.

---

## 6. Performance plan

### Budgets (stated now, built to, enforced in CI)

| Budget | Target |
|---|---|
| Total JS | ≤ 130 kB gz (React+RR ~75, rig+poses+spray ≤ 15, rest ≤ 40) |
| CSS | ≤ 35 kB gz |
| Fonts | ≤ 120 kB total, 2 families, variable, subset, self-hosted |
| LCP (Moto G-class, 4G) | < 1.8s |
| CLS | 0. Not "near zero." |
| INP | < 200ms |
| Lighthouse | Performance ≥ 95, Accessibility = 100 |
| Frame budget | ≤ 8ms of main-thread work per frame during scroll (rig ≤ 2ms, spray ≤ 2ms, browser keeps the rest of 16.6ms) |

### How it stays inside

- **Nothing renders per frame.** React paints the scene once; the rAF loop touches `transform`, `data-pose`, two CSS custom props, and one canvas. No layout-triggering property ever animates. All layout reads (viewport, scale factor, LUT) are cached and refreshed only by ResizeObserver / `visualViewport` events.
- rAF loop parks when settled; zero idle cost.
- Composited layers, counted: rider, spray canvas, ≤ 2 parallax terrain groups. `will-change` on exactly those.
- Fonts: `size-adjust`-matched fallback metrics so swap causes zero shift; SVG/hero area has explicit dimensions from first paint.

### Verification (not assumption)

- **Dev HUD** (`?hud=1`): live rAF ms, dropped-frame counter, pose state, t, velocity. On from Phase 3 day one.
- Chrome DevTools trace at **6× CPU throttle** on every rig PR; `PerformanceObserver('longtask')` logs regressions in dev.
- **Real hardware gate:** Moto G-class Android via `chrome://inspect` and a real iPhone (momentum + toolbar behavior) — Phase 3 and Phase 4 exit criteria, on-device, not emulated.
- **Lighthouse CI** in GitHub Actions with `budgets.json` asserting the table above on every PR to main. A regression fails the build, not the launch.

---

## 7. Accessibility plan — the document is the site

**Order of construction is the plan:** Phase 1 builds the complete semantic document — real `<section>`s, h1→h2→h3 hierarchy, DOM order = narrative order, complete and navigable with CSS off, JS off, or both. The mountain arrives in Phase 2+ as an `aria-hidden` presentation layer painted *behind* a document that was already done. Keyboard nav, screen readers, find-in-page, anchor links, and print all work because there's nothing to retrofit.

- **Reduced motion is a first-class art direction, not an apology:** the full trail map renders as a beautiful static piste map — trail line, waypoint markers, difficulty icons, legend, paper frame — with the rider parked at the summit and the gondola parked at the station. Content reveals become 200ms opacity-only on intersection (no translate). Everything else — every fact, link, and section — is identical. A reduced-motion visitor gets a *printed trail map of a career*, which honestly might be the second-best version of the site. Gate: all motion behind `@media (prefers-reduced-motion: no-preference)` + a rig-level `matchMedia` check (live, not just load-time).
- **Reveals are no-JS-safe:** content is visible by default; the hidden-then-reveal state applies only under `html.js` (class set by an inline snippet). No JS → everything simply visible. Find-in-page jump → native scroll → IO fires → section reveals.
- **Focus:** visible 2px `patrol`-orange focus ring, offset, on everything interactive. Skip link. Tabbing moves through the document in order; because the camera is native scroll, focus-driven scrolling carries the rider automatically — free, as designed.
- Every waypoint `id`'d and deep-linkable (`/#nuvalabs`), `scroll-margin-top` respected; recruiters can forward a section.
- `<MountainStage>` is `aria-hidden="true"` with zero focusable descendants (validator-checked).
- **Escape hatches:** `/resume` — semantic, single-column, ATS-parseable, no mountain. Print stylesheet on both routes (mountain hidden, ink on white, URLs printed after links, sane page breaks). PDF download — **commit the proven resume PDF as a static asset** (generalized from the NerdWallet tailoring — see open question #4); a Playwright print-to-PDF build step is a Phase 5 nice-to-have, not a dependency.
- CI: `eslint-plugin-jsx-a11y` + Playwright+axe on `/` and `/resume` (zero violations = green), keyboard-traversal test, `prefers-reduced-motion` emulation test.

---

## 8. Visual direction

**The register:** not cold blues and lens-flare powder. A **printed piste map** — flat, numbered, legend in the corner, the kind that lived a season folded in a jacket pocket. The National-Forest-Service register: ink on paper, difficulty geometry, quiet authority.

### Palette (6, named)

| Token | Hex | Role |
|---|---|---|
| `paper` | `#F4EFE3` | Ground — aged map paper, the page itself |
| `ink` | `#22303A` | Type, contour lines, trail strokes — printed ink, not #000 |
| `evergreen` | `#2E5E4E` | Treeline, green-circle difficulty, legend accents |
| `bluebird` | `#3D7DB5` | Blue-square difficulty, sky hints, links |
| `patrol` | `#E4572E` | Patrol orange: CTAs, focus rings, the closed-trail rope, the scroll cue. Used scarcely so it always means "look here" |
| `powder` | `#FFFFFF` | Snowfield, trail fill, card surfaces |

Light/print aesthetic only at launch — a paper map has no dark mode; that's a coherent position, not a gap. ("Night skiing" variant: post-launch candidate.)

### Type

- **Display: Barlow Condensed** (600/700, caps, tracked) — lift-tower signage, trail names, difficulty labels. Industrial, condensed, real-mountain vernacular.
- **Body: Public Sans** (400/600) — the U.S. government's own open-source face; the USFS-map register is exactly this. Excellent at text sizes, and quietly a *fintech-credible* choice.
- Both variable, subset to Latin, self-hosted woff2, metric-matched fallbacks. ≤ 120 kB total.

### The signature element

**The page is the map — literally.** A thin ink border frames the whole site with map furniture: grid references in the margins, "AARON ELLIS · TRAIL MAP · SEASONS 2014–2026" in the cartouche, the legend bottom-corner doing legend things (skills grouped as Frontend/Backend/Cloud/Leadership·AI, difficulty key with the depth mapping), a faint cross fold-crease across the paper, corners slightly worn. The run animates *on the printed artifact*. It's the cheapest thing in this section — borders, one SVG crease overlay, texture via CSS — and it's what people will describe to someone else, which is the test. The kinetic signature is the hockey-stop spray; the artifact signature is the map. One each.

---

## 9. Build phases

Each phase ends demoable and deployed. **Do not start phase N+1 with phase N's exit gate red.**

### Phase 0 — Rail (day 1) ✅ = deployed hello-world at a real URL
- [ ] `git init`, GitHub repo (public — the repo is part of the demo; colophon links to it)
- [ ] Scaffold RR v7 framework mode, TypeScript `strict`, `prerender: true`
- [ ] Tailwind v4 with `@theme` tokens (§8 palette + type in from day one)
- [ ] ESLint (flat, + `jsx-a11y`) + Prettier, Vitest, Playwright+axe
- [ ] GitHub Actions: typecheck → lint → unit → e2e/axe → Lighthouse CI (budgets.json from §6) → deploy
- [ ] Cloudflare Pages connected; preview deploys per PR
- **Exit:** CI green, page live, Lighthouse Perf ≥ 95 / A11y = 100 on the skeleton.

### Phase 1 — The document (days 2–4) ✅ = a complete, hireable resume site. If everything after this fell over, this ships.
- [ ] Content model files (`waypoints.ts`, `gondola.ts`, `skills.ts`, `meta.ts`) — **final copy, not lorem**: claim/evidence/why-care per waypoint, gondola credits, trail names decided
- [ ] `<SummitHero>`: name, positioning line ("Staff full-stack engineer — TypeScript, React, Node. 12 years of consumer fintech."), scroll cue. Skim test: name/level/specialty in <10s, no scroll
- [ ] `<CareerDocument>` semantic sections, heading hierarchy, waypoint `id`s, deep links
- [ ] `<BaseCamp>`: contact block (email, LinkedIn, GitHub), legend v1 (static), colophon stub
- [ ] `/resume` route: ATS-clean, single column
- [ ] Print stylesheet (both routes); generalized PDF committed + download link
- [ ] Meta, OG tags, JSON-LD Person, sitemap, robots
- [ ] Axe zero-violations; keyboard pass; JS-off and CSS-off manual pass
- **Exit:** you would send this URL to a recruiter today. Lighthouse gates hold.

### Phase 2 — The map (days 5–8) ✅ = the reduced-motion experience, complete
- [ ] Figma template generation script; author mobile + desktop trail paths; normalize + validate scripts in CI
- [ ] `<TrailMap>`: terrain shapes, treeline, both paths (CSS-toggled), waypoint markers + difficulty icons, lift line for the gondola
- [ ] Paper frame signature: border, cartouche, grid refs, fold-crease, legend in its corner
- [ ] Section reveal system (IO + CSS, `html.js`-gated, no-JS-safe)
- [ ] Waypoint sections visually keyed to markers (`side` on desktop, cards on mobile); scroll height derived from `TrailMeta`
- [ ] `prefers-reduced-motion` complete: static map, parked rider + gondola, opacity-only reveals
- **Exit:** with the rig stubbed out, the site is a beautiful static piste map with revealing content. CLS = 0. This *is* the reduced-motion deliverable, finished early, not last.

### Phase 3 — The rig (days 9–12) ✅ = rider carves the mountain at 60fps on real hardware
- [ ] LUT builder (+ Vitest against analytic curves: line, arc, S-curve — position/tangent/curvature within tolerance)
- [ ] Scroll rig: passive listener, damped smoother, park/wake, transform writes
- [ ] `useLayoutEffect` init sequence (§3) — deep-link entry, scroll restoration, bfcache verified by test plan
- [ ] Rider follows path, board tangent to slope; breakpoint-crossing rebuild
- [ ] Dev HUD (`?hud=1`)
- [ ] iOS momentum feel check (real iPhone); toolbar collapse → zero rider jitter
- [ ] **Gate: 6× throttle trace ≤ 8ms/frame; Moto G-class device 60fps sustained; fling test correct ("rockets down" = pass)**
- **Exit:** the core fantasy works: scroll drives, rider carves, nothing hijacked.

### Phase 4 — Alive (days 13–16) ✅ = a character, not a sticker
- [ ] Pose state machine + thresholds file; poses: tuck, carve L/R, compress/unweight, brake
- [ ] `--lean` / `--crouch` continuous channels
- [ ] Spray canvas: pool, emitter, velocity×edge scaling; hockey-stop burst at the base
- [ ] Gondola intro sequence (pure CSS) + summit idle loop; scroll-resolves-instantly guard
- [ ] Switch on scroll-up with 150ms hysteresis
- [ ] Re-run full perf gate on-device with spray active
- **Exit:** the run lands — summit idle reads "ready," the stop reads "arrived," and frame budget still holds.

### Phase 5 — Season opening (days 17–21) ✅ = launched
- [ ] Colophon: stack, the "~300 lines, zero animation deps" story, link to repo
- [ ] Closed trail: content in (pending open question #1), roped-off treatment with `patrol` rope + CLOSED sign
- [ ] OG image (the trail map itself as the card); link-preview check in LinkedIn/iMessage/Slack
- [ ] Cross-browser pass: Safari iOS, Chrome Android, Firefox, Edge; find-in-page, print, deep links re-verified
- [ ] Copy edit — the twee pass: cut anything needing explanation; one metaphor per screen max
- [ ] Domain + DNS on Cloudflare; analytics decision (open question #3)
- [ ] Final on-device perf ceremony; Lighthouse from the field, not just CI
- [ ] Launch: LinkedIn featured link, resume header URL, GitHub profile
- **Exit:** live on the domain, budgets green, you've watched a non-engineer scroll it on their phone without instructions.

---

## 10. Risk register

| # | Risk | Early warning sign | Mitigation |
|---|---|---|---|
| 1 | **Mid-range Android can't hold 60fps** — the classic killer | HUD shows >8ms frames in Phase 3, *before* spray exists | Cut order pre-agreed: spray density → parallax layers → pose transition frequency → promote reduced-motion variant on weak devices (`navigator.hardwareConcurrency` heuristic, last resort) |
| 2 | **Damped smoothing reads as scroll-jack** — rider lags, feels like the page fights you | Hallway test: anyone says "floaty"; rider >150ms behind a fling | Damping constant in HUD, tune down toward near-instant; the *design* (native scroll, no interception) is safe — only the smoother can betray it, and it's one number |
| 3 | **iOS toolbar collapse causes jump/jitter** | Rider hops when Safari chrome hides; CLS > 0 in field data | `svh` for layout, `visualViewport` for rig math, tested on real iPhone in Phase 3 — this is exactly why the phase gate is on-device |
| 4 | **Content copy lags the build** — the real schedule killer on portfolio sites | Phase 2 starts with placeholder copy in waypoint sections | Copy is a Phase 1 *deliverable*, not a garnish. Plan front-loads it deliberately |
| 5 | **Art scope creep on the "simple" flat mountain** | >2 days on `<TrailMap>` without a merged PR | Timebox; the paper-frame signature carries the aesthetic even if terrain stays minimal; iterate post-launch |
| 6 | **Hydration mismatch / responsive path bugs** | React hydration warning in dev console — treat as build-breaking, never ignore | Both paths SSR'd + CSS toggle (no JS decision); rig owns client-only facts strictly post-hydration; Playwright test loads both viewports cold |
| 7 | **Twee overload** — the metaphor starts explaining itself | A label needs a tooltip; a second pun appears on one screen | Phase 5 twee pass is a formal checklist item with cut authority |
| 8 | **Job-search timing pressure** vs. a 3-week build | It's day 4 and Phase 1 isn't live | Phase 1 *is* a complete professional site; keep it deployed and current from day 4 onward — every later phase enhances a live asset instead of blocking it |

---

## 11. Open questions

1. **The closed trail.** Slot, schema, and roped-off visual treatment are all planned; only the story is missing. Candidates worth considering: a technical bet from the SoFi/Public years that you'd unwind, or a personal product that didn't become a business. It ships gated only on your copy — and it will be the most-remembered thing on the site, so don't rush it.
2. **Domain.** `aaronellis.dev`? `aaronbrentellis.com`? Needed by Phase 5; buy early, DNS on Cloudflare either way.
3. **Analytics.** Recommend Cloudflare Web Analytics (cookieless, free, no consent banner needed) or nothing at all. A consent banner on this site would be a self-inflicted wound.
4. **The committed PDF.** The NerdWallet version is tailored to one employer; the site should serve a generalized master. Confirm you'll produce one (same bones, employer-neutral summary), or I'll spec the delta.
5. **Gondola credits copy.** Which personal projects ride up alongside freeCodeCamp / V School / My Menu Plans? 3–5 lines max; the gondola is short.
6. **Trail names.** "The Rewrite," "Corduroy," "The Traverse," "Prime Face" are proposals with reasoning (§4). Veto or rename freely — they're your runs.
7. **Post-launch candidates (explicitly out of scope now):** night-skiing dark mode; Playwright print-to-PDF pipeline; `scroll-timeline` parallax enhancement for far-terrain layers.

---

*Plan drafted 2026-07-08. Stack: React Router v7 (framework mode, prerendered) · React · TypeScript strict · Tailwind v4 · zero animation dependencies · Cloudflare Pages.*

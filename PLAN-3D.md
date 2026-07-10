# PLAN-3D.md — The Drop-In: First-Person 3D Redesign

**Project:** aaronellis trail map v2 — the career is still a snowboard run down a mountain, but now you _ride it_: first-person POV, carving at speed past full-size resort signage that carries the work history.
**Relationship to PLAN.md:** v1 (the 2D scroll-driven piste map) is built and shipped. This plan does not discard it — it **demotes it to the fallback tier and builds the 3D experience on top of it**. Every architectural insight from v1 that survived contact with reality (native scroll as camera, LUT-driven O(1) sampling, the semantic document as the real site, derived-not-triggered motion) is carried forward and generalized to three dimensions.
**Appetite:** 3–4 weeks, phased. Phase A ends with a rideable gray-box mountain; nothing ships to `main` until the tier system guarantees v1 remains intact for every visitor the 3D can't serve.
**How to use this doc:** same contract as PLAN.md — every phase ends demoable, exit criteria are gates, sections 1–8 are decisions, 9–12 are the work, the risks, what's open, and what's deferred.

---

## 0. Decisions at a glance

| Decision             | Choice                                                                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer             | **three.js** (raw, tree-shaken ESM, pinned) targeting WebGL2. No react-three-fiber, no drei.                                                                                                   |
| Loading              | 3D is a **lazy, code-split chunk** warmed immediately post-hydration; the prerendered hero paints first (LCP unchanged) and the summit POV fades in behind it                                  |
| The open             | **The site opens in POV at the summit lip** — no intro ceremony; the first scroll is already the descent. The OG card is this exact frame (§6).                                                |
| Experience tiers     | **Tier 0**: semantic document (no-JS/SR/print). **Tier 1**: v1 2D map + rider (reduced-motion, weak devices, WebGL failure, user toggle). **Tier 2**: 3D POV run.                              |
| Camera model         | Native scroll (unchanged) → existing damped smoother → t → **speed-profile-reparameterized 3D spline LUT** → camera pose. No pointer lock, no scroll hijack, ever.                             |
| The line             | Authored control points in typed TS (`line.3d.ts`), Catmull-Rom, validated in CI like v1 trails                                                                                                |
| Info presentation    | **In-world resort signage** (3D geometry) + **DOM content panels** projected into the scene via a hand-rolled CSS-matrix sync layer; real selectable text, zero canvas-rendered type           |
| Readability at speed | **Dwell zones** (speed profile flattens at waypoints, terrain benches make it diegetic) + **magnetic read** (panel eases into a clamped readable rect while in the zone)                       |
| Terrain & art        | 100% procedural, zero GLB/model assets: low-poly flat-shaded heightfield in the v1 paper palette, **contour-line shader** (the map made 3D), fog that fades to `paper`, instanced trees/towers |
| Rider in POV         | Board nose + subtle glove hints, camera bank/crouch/FOV driven by the same derived signals as v1's pose machine                                                                                |
| Spray                | GPU point sprites in-scene (v1's 2D canvas spray remains in Tier 1)                                                                                                                            |
| Audio                | Future work (§12) — liked, deferred out of this effort; muted-by-default design already specced                                                                                                |
| Accessibility        | The flow document **stays in the DOM at its scroll positions** (visually hidden in Tier 2) — find-in-page, anchors, deep links, and screen readers keep working unchanged                      |
| Comfort              | Motion-sickness budget: roll ≤ 12°, FOV swing ≤ 13°, no head-bob, stable horizon option; visible tier toggle in the legend                                                                     |
| Budgets              | Critical path unchanged (≤ 130 kB gz). 3D chunk ≤ 180 kB gz, lazy. CLS = 0 and LCP < 1.8s unchanged.                                                                                           |
| Deploy/CI            | Unchanged pipeline + spline unit tests, line validator, Playwright WebGL (SwiftShader) smoke + deterministic screenshot                                                                        |

---

## 1. Architecture Decision Records

### ADR-5: Rendering — raw three.js, no react-three-fiber

**Decision.** Import three.js directly as tree-shaken ESM and drive it imperatively from the rig, exactly the way v1 drives the SVG rider: React renders a `<canvas>` mount point once; after that, nothing in the 3D layer ever re-renders from React state. One rAF loop (the _same_ loop pattern as `use-rig.ts` — park/wake, damped smoother, allocation-free frame records) owns the camera, the panels, and the particles.

**Why not react-three-fiber + drei.** R3F is the right tool when a scene graph needs to be reactive — ours is the opposite: a static world with one moving camera. R3F + drei would add ~35–45 kB gz and a reconciler whose entire job is to bridge React state into the scene, which v1's boundary rule ("React renders the scene once; the rig mutates through refs") already forbids. The rig architecture is built, tested, and tuned; three.js slots in as a _render target for the same rig_, not a new paradigm. This also keeps the colophon story honest: it changes from "zero animation dependencies" to **"one dependency — a renderer. Every line that decides what moves is still ours, view source."** For the SE/DevRel audience, owning the camera math is a better demo than owning a `<Canvas>` wrapper.

**Why not Babylon.js / PlayCanvas / WebGPU-first.** Babylon is a game engine (~1 MB class problem, wrong register). PlayCanvas wants to own the toolchain. WebGPU lacks coverage in exactly the browsers this audience arrives in (LinkedIn/iMessage in-app WebViews); it's a post-launch renderer swap behind the same rig, not a launch bet. WebGL2 is the floor — it has been universal in evergreen browsers for years, and anything that fails the context check gets Tier 1, which is a complete site, not an apology.

**The tradeoff accepted:** we own resize, context-loss, DPR management, and the render loop's interaction with iOS toolbar collapse. These are enumerated in §7/§8 as built-not-discovered, same discipline as v1's ADR-2.

### ADR-6: Experience tiers — 3D is an enhancement with two complete fallbacks below it

**Decision.** Three tiers, strictly layered, each complete on its own:

- **Tier 0 — the document.** Unchanged from v1: server-rendered semantic sections, `/resume`, print, PDF. No JS, no CSS, screen readers, ATS parsers. Still the real site.
- **Tier 1 — the printed map.** The _entire v1 experience_ (2D trail map, SVG rider, canvas spray, gondola intro) becomes the fallback presentation: `prefers-reduced-motion`, no WebGL2, weak-device heuristic, WebGL context loss mid-session, 3D chunk load failure, or the user flipping the map toggle. v1 code is not deleted, forked, or allowed to rot — it is the guaranteed floor, and its existing e2e suite keeps guarding it.
- **Tier 2 — the drop-in.** The 3D POV run, lazy-loaded, capability-gated.

**Tier selection is a runtime decision the rig owns** (one function, HUD-visible): reduced-motion → 1; no WebGL2 context → 1; `deviceMemory ≤ 2` → 1; else → 2 — cheap synchronous checks only, because the summit open (§6) can't wait on a timed probe; the first seconds of real frame timings serve as the probe, with a live downgrade path (context loss or sustained missed frames swaps to Tier 1 at the same t — the map shows the rider exactly where the camera was). The toggle in the legend makes the demotion path a _feature_: "prefer the printed map" is a legitimate aesthetic choice, and its presence signals confidence, not compromise.

**Rejected:** replacing v1 outright (throws away a tested accessibility story and a finished reduced-motion deliverable to save ~30 kB of retained code); shipping 3D as the only motion tier with the document as the sole fallback (reduced-motion visitors would lose the map art direction v1 built specifically for them).

### ADR-7: Camera model — native scroll, speed-reparameterized spline (ADR-1, generalized)

**Decision.** The page keeps its tall scroll container and native scroll. The v1 insight was _constant-vertical-speed reparameterization makes world scroll and follow-cam the same thing_. The 3D generalization: **reparameterize the 3D spline by an authored speed profile so that scroll distance maps to ride time, not arc length.** At init we build a LUT (same discipline as `lut.ts`: Float32Array, built once, O(1) index+lerp per frame) whose rows are sampled at uniform _profile time_: fast fall-line segments cover lots of spline per scroll unit; **dwell zones at waypoints cover very little** — the camera glides slowly past the signage while the visitor scrolls at their natural pace. The one tuning constant survives: `DWELL` becomes a per-waypoint speed multiplier with a global default.

`scrollY` → (existing `smooth()` damper, unchanged, same τ) → `t` → LUT row → `{position, tangent, signed curvature, grade}` → camera pose. Scroll-up traverses the line in reverse with the v1 150 ms hysteresis; in first person, with no visible character to break, reverse reads as the visitor rewinding their own run — we add a subtle look-back yaw and FOV pull-in so it feels acknowledged, not scrubbed (v1's "switch" argument, resolved for POV).

**What we give up vs. a free camera:** nothing we want. The run is an authored line; the visitor controls _when_, never _where_ — that constraint is the whole reason scroll can drive it and accessibility survives.

**Rejected:** pointer-lock / WASD free ride (it's a resume, not a demo disc; kills mobile; kills scroll semantics); scroll-jacked timeline libraries (same rejection as v1 ADR-2, with the same receipts); physics simulation of the descent (non-deterministic camera = non-deterministic content presentation = unreviewable).

### ADR-8: Trail markers — 3D signage geometry + projected DOM content panels

**Decision.** Each waypoint is a **full-size resort trail sign** standing beside the line: posts, panel frame, difficulty plaque (⬛ geometry, not emoji), trail name in Barlow Condensed — built from primitives, styled like the v1 map furniture. The _content_ (role, claim, evidence, tech) is **real DOM** — a panel element rendered from the same `waypoints.ts` data, positioned every frame by a hand-rolled CSS-matrix sync layer (~150 lines: perspective-matched container + per-panel `matrix3d` from the camera's view-projection — the CSS3DRenderer technique, owned rather than imported). Text stays crisp at any distance, selectable, zoomable, and never becomes a texture.

**The accessibility keystone:** the v1 semantic `<CareerDocument>` **remains in normal document flow at its scroll heights**, visually hidden (not `display:none`) while Tier 2 is active, `aria-hidden` stays on the visual layer. Consequences, all free: screen readers read the same document as v1; find-in-page and anchor `/#nuvalabs` jumps scroll to the section's height → the same scroll position drives the camera → **the camera arrives at that sign**. Deep links literally fly you to the waypoint. DOM order = t order = ride order, still.

**Reading at speed — the two-part answer to v1's "awkward info boxes":**

1. **Dwell zones (diegetic):** the terrain flattens into a cat-track bench at each waypoint and the speed profile drops to ~25% — slowing down where the signs are is what the _mountain_ does, so it never reads as the page braking you.
2. **Magnetic read (the signature interaction):** as the camera enters a sign's read zone, its DOM panel eases from its in-world projected pose toward a clamped, comfortable screen rect (still subtly tilted — it keeps its 3D identity), holds while you're in the zone, then releases and whips past as you leave. One sign owns the screen at a time. On a 390 px portrait phone the clamped rect is a full-width card — the mobile layout is the magnetic pose, no separate design.

**Rejected:** rendering content to CanvasTexture signboards (blurry, unselectable, invisible to find-in-page, retranslates nothing); pure screen-space HUD cards with no in-world anchor (that's v1's floating-boxes problem restated in 3D); making the flow sections themselves the projected panels (breaks find-in-page positioning and print).

### ADR-9: Art direction — the map stands up

**Decision.** v2 does not get a new aesthetic; it gets the _same one, extruded_. The register is still the printed USFS piste map — now you're standing on it:

- **Terrain:** low-poly flat-shaded heightfield, vertex-colored in the v1 palette — `powder` snowfields, `ink` rock faces, `evergreen` treeline bands.
- **The signature shader:** terrain fragments draw **elevation contour lines** (`fwidth`-based, in `ink`, heavier index contours) — the mountain is literally rendered as its own topographic map. This is v2's artifact signature, the analog of v1's paper frame, and it costs one shader, not an art team.
- **Distance = paper:** fog fades to `paper` (#F4EFE3), so the world dissolves into the page at the horizon. The paper frame, cartouche, and legend stay as the DOM border around the viewport — the 3D run plays _inside the map's frame_.
- **Props:** instanced cone-and-trunk trees, instanced lift towers along the first traverse, rope-and-sign for the closed trail (`patrol` orange, roped off in 3D beside the line — you ride _past_ the trail you can't take, which is better storytelling than v1 could afford).
- **Sky:** clear-color + fog + two or three far-ridge silhouette planes. No skybox texture, no HDRI, no PBR — flat shading is the point.
- **Zero imported assets.** Everything is primitives, instancing, and shaders authored in the repo. No GLB, no Blender dependency, no binary blobs in git. (v1's "authored in code" rule, kept.)

**Rejected:** realistic snow/PBR (wrong register, quadruple the budget, uncanny next to the paper frame); Blender-authored terrain meshes (binary assets, art-tool dependency, kills the reviewable-diff property the trail system has).

---

## 2. The line — 3D path system

### Authoring

`app/content/line.3d.ts` — typed control points, versioned in git, reviewable diffs (the v1 trail-module discipline):

```ts
interface LinePoint {
  p: [x: number, y: number, z: number]; // meters-ish world units, y = elevation
  speed?: number; // profile multiplier, default 1; waypoint benches ≈ 0.25
  waypointId?: string; // binds a waypoint's sign + dwell zone to this stretch
}
interface Line3D {
  points: LinePoint[];
  seed: number; // terrain noise seed — deterministic world
  summit: [number, number, number];
  basecamp: [number, number, number];
}
```

One line serves all viewports (the camera is the responsive system now — FOV and read-rect adapt, the mountain doesn't). Catmull-Rom through the points; the summit→base drop is sized so the full run at natural scroll pace lasts roughly the same 65–100 s as v1 (`runHeight` derivation in `run-height.ts` is reused as-is — scroll length is still derived, never magic).

### Validation (`line:validate`, in CI beside `trail:validate`)

- Elevation strictly monotonic downhill between benches; bench grade ≤ 4°
- Grade everywhere within 8°–38° (rideable; steeper reads as falling)
- Horizontal curvature under the comfort cap (§8) at the speed the profile allows there — **curvature × speed² is the real limit**, validated together
- Waypoint dwell: read-zone traversal at profile speed ≥ 3.5 s at reference scroll pace, per sign
- Signs' standoff from the line within [3 m, 8 m]; no terrain intersection after carving (checked against the generated heightfield)

### Sampling

Init-time (same shape as `buildLut`): densely sample the Catmull-Rom → arc-length table → **re-integrate by the speed profile** into N ≈ 4,000 uniform-profile-time rows of `{pos(3), tangent(3), signedCurvature, grade}` in one Float32Array. Curvature box-smoothed (v1's anti-flicker window). Per-frame: index + lerp, allocation-free. Unit-tested against analytic curves (helix, banked arc, straight chute) exactly like `lut.test.ts`.

---

## 3. Terrain & world generation

- **Heightfield:** ~257×513 grid over a corridor bounding the line. Simplex noise (tiny vendored implementation, ~1 kB) + ridge shaping, then **carve the corridor**: a smooth distance-field flatten along the spline (half-width ~6 m, eased shoulders) so the run is visibly a groomed trail; benches stamped flat at dwell zones. Built at init from `seed` (< 20 ms budget, measured; if exceeded, build in a worker or serialize at build time — decision gate in Phase B).
- **Mesh:** single indexed BufferGeometry, vertex colors by elevation/slope bands, custom ShaderMaterial: flat shading via `flatShading`/derivatives, contour lines in fragment (`fract(elevation/interval)` + `fwidth` AA), `paper` fog.
- **Instancing:** trees (two InstancedMeshes: canopy cones, trunks), scattered by noise density masked away from the corridor; lift towers along the intro traverse; sign posts. Target ≤ 40 draw calls total, counted in the HUD.
- **Culling:** the camera only ever looks down-line — a coarse chunk split (8–16 chunks) with frustum culling is sufficient; no LOD system unless the Phase B frame gate fails (pre-agreed cut order in §10).

---

## 4. Content presentation & document boundaries

```
routes/_index.tsx                    server · prerendered (unchanged shell)
├── <SummitHero>                     server · LCP element; Tier 2 overlays it on the summit
│                                      POV and thins it on first scroll (gondola intro
│                                      remains Tier 1's opening beat)
├── <CareerDocument>                 server · unchanged sections at unchanged scroll heights
│                                      Tier 0/1: visible (v1 reveal system)
│                                      Tier 2: visually-hidden skeleton (SR/find-in-page/anchors)
├── <BaseCamp> / <PaperFrame>        server · unchanged — the frame now frames the viewport
├── <MountainStage>                  aria-hidden · Tier 1 visual layer (v1, intact)
└── <DropIn>                         client-only, lazy — Tier 2:
    ├── <RunCanvas>                  the WebGL2 canvas, fixed, aria-hidden
    ├── <SignLayer>                  DOM panels (from waypoints.ts), aria-hidden,
    │                                  matrix3d-synced, magnetic-read behavior
    └── (rig-3d)                     not a component: the imperative loop —
                                       camera, panels, particles, tier watchdog
```

**Boundary rule, restated for v2:** React mounts `<DropIn>` once when Tier 2 is selected; after that the rig mutates the camera, panel matrices, and particle buffers through refs. React state holds only tier identity. The v1 rig and the v2 rig share the smoother, the park/wake skeleton, the telemetry shape, and the HUD — `use-rig.ts` splits into `rig-core` (shared) + `rig-2d` (current behavior) + `rig-3d` (new), with the 2D e2e specs (`rig.spec.ts`, `map.spec.ts`) pinned green throughout as the refactor's regression net.

---

## 5. Sensation — what makes it feel like riding

All derived from the same LUT signals, never keyframed (v1's derived-not-triggered rule):

| Channel                 | Source                                                                              | Cap                         |
| ----------------------- | ----------------------------------------------------------------------------------- | --------------------------- |
| Camera bank (roll)      | signed curvature × speed                                                            | ±12°                        |
| Crouch (eye-height dip) | grade delta (compressions)                                                          | −0.35 m                     |
| FOV                     | speed (65° base → 78° max)                                                          | 13° swing, 400 ms ease      |
| Look-ahead              | target = LUT sample at t+Δ, Δ ∝ speed                                               | horizon stays in frame      |
| Board nose              | small mesh at frame bottom: yaw with carve, pitch with grade, edge-set on bank      | subtle — POV, not periscope |
| Spray                   | GPU points from the lee edge, rate = speed × \|curvature\| (v1's emitter law)       | 2,048 pool, one draw call   |
| Speed streaks           | stretched particles near screen edge past a speed threshold                         | fade in, never strobe       |
| Hockey stop             | t > 0.97 + decelerating: bank to 90° cut, 10× spray burst wall, settle on Base Camp | the kinetic signature, kept |

The pose state machine's _conditions_ (`pose.ts`) transfer nearly verbatim — tuck/carve/compress/brake become camera-dynamic blends instead of `data-pose` attributes. Thresholds stay in the tunable constants file; the HUD (`?hud=1`) grows: tier, draw calls, GPU frame estimate, DPR scale, active sign, camera roll/FOV.

**Audio:** deferred to future work (§12) — decided 2026-07-10. The telemetry record already carries every signal audio will need, so it bolts on later without touching the loop.

---

## 6. Loading & the summit open

**Decided 2026-07-10: the site opens in POV.** No map-tilt ceremony, no 2D interlude on capable devices — the load resolves into the rider's view at the summit lip, and the first scroll is already the descent.

1. **Paint:** the prerendered hero (name, positioning line, scroll cue) is the LCP element, exactly as in v1 — in Tier 2 it doubles as the summit overlay, so this step never waits on 3D.
2. **Warm:** immediately post-hydration (not idle-deferred — the summit view is the opening shot now), if the tier gate says 2: fetch the 3D chunk, create the context, build terrain + LUT, render the summit frame off-screen.
3. **Open:** the summit POV fades in behind the hero text (≤ 400 ms opacity, no camera move — the view is already framed: board nose at the lip, the line dropping away, the first sign visible down-slope). The hero thins to its overlay treatment. Target: POV visible well inside the first two seconds on a desktop connection.
4. **The drop:** the first scroll begins the descent instantly — there is no ceremony to skip because there is no ceremony. If the visitor scrolls before the 3D is warm, Tier 1's map carries the run (v1's rule: scroll is never gated) and the POV fades in at their current t the moment it's ready.
5. **Failure at any step:** stay in Tier 1 silently. No spinner ever appears; the 2D site _is_ the loading state.

Warming immediately instead of on idle costs LCP nothing (the chunk is fetched after the document is interactive and the hero has painted), but it does put terrain generation on the early main thread — the < 20 ms init budget in §3 is now load-bearing, and Phase B's build-time-serialization decision gate inherits that pressure.

The gondola credits stay in the hero markup (CSS — Tier 1's opening beat). In Tier 2 the summit view takes the opening instead; the credits' 3D home — signs hanging from the lift towers on the first traverse — is the Phase E stretch item.

### The OG image is the opening shot

**Decided 2026-07-10:** the OG/social card is **the summit POV frame itself** — board nose, the line, the first sign down-slope. The card someone taps in LinkedIn is literally the first thing the site shows them; preview → load → same view → it moves. Generated deterministically (fixed seed, fixed camera, DPR 2, 1200×630) by a Playwright script in Phase F and committed like the current `og-trail-map.png`.

---

## 7. Performance plan

### Budgets (revised where v2 demands, held where it doesn't)

| Budget                                                               | v1          | v2                                                                                              |
| -------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| Critical-path JS (document + Tier 1)                                 | ≤ 130 kB gz | **unchanged**                                                                                   |
| 3D chunk (lazy: three tree-shaken ≈ 130 + rig-3d/world/shaders ≤ 40) | —           | ≤ 180 kB gz                                                                                     |
| Lighthouse script budget (`budgets.json`)                            | 130         | 320 (post-hydration chunk counts; documented)                                                   |
| Total resources                                                      | 500         | 800 kB                                                                                          |
| LCP (Moto G-class, 4G)                                               | < 1.8 s     | **unchanged** (3D never blocks)                                                                 |
| CLS                                                                  | 0           | **0** (canvas is fixed/overlaid, reserves nothing)                                              |
| INP                                                                  | < 200 ms    | unchanged                                                                                       |
| Lighthouse Perf / A11y                                               | ≥ 95 / 100  | ≥ 90 gate, 95 target / **100, non-negotiable**                                                  |
| Frame (Tier 2)                                                       | —           | 60 fps desktop & modern mobile; ≤ 6 ms main-thread JS/frame; draw calls ≤ 40; triangles ≤ 300 k |

### How it stays inside

- **One rAF owns everything** (rig, panel matrices, particles, render call) — parks when settled just like v1; a parked page renders zero frames and costs zero battery.
- **Adaptive DPR:** frame-time controller scales render resolution 2.0 → 0.75 before anything else degrades; then particle count; then tree density; then contour shader → flat; then **tier demotion** — the cut order is pre-agreed and HUD-observable, not discovered in panic (v1 risk-#1 discipline).
- **Zero per-frame allocation** in the rig (reused records, preallocated buffers — the standard is already set in `use-rig.ts` and it carries over).
- **Context loss:** `webglcontextlost`/`restored` handled; loss → Tier 1 at the same t, restore offers Tier 2 again via the toggle.
- **Verification:** 6× CPU throttle traces on every rig-3d PR; real-device gates (mid-range Android + iPhone) at Phases A and D exactly like v1 Phases 3–4; Lighthouse CI budgets updated in the same `budgets.json` CI step.

---

## 8. Accessibility & comfort

- **Nothing regresses from v1 — structurally guaranteed:** Tier 0/1 _are_ v1, whose axe/keyboard/reduced-motion/print tests remain in CI untouched. Every fact, link, section, anchor, and the `/resume` escape hatch are identical across tiers because they come from the same content modules.
- **Reduced motion → Tier 1**, which v1 built as a first-class art direction (static piste map, opacity-only reveals). A reduced-motion visitor still gets the _better-than-most-sites_ version, not a text dump.
- **Motion sickness is a first-class constraint, not a QA note.** POV-at-speed is the highest-nausea genre on the web. The budget: roll ≤ 12°, FOV swing ≤ 13° eased over 400 ms, zero head-bob, no camera shake, dwell zones give regular vestibular rest, fog shortens the visual flow field, and the legend's map toggle is always one tap away. The line validator enforces curvature×speed² (§2) so a queasy segment can't even be authored. Hallway-test with motion-sensitive people in Phase D — "felt fine" from someone who gets carsick is the gate.
- **Find-in-page / anchors / deep links:** work via the hidden flow document (§4) — jump scrolls to the section height, the camera flies to the sign. Tested in e2e both tiers.
- **Focus:** interactive elements live only in the DOM layers (legend, toggle, links in panels during magnetic read — panels are reachable in DOM order matching ride order). Canvas and sign layer are `aria-hidden`, zero focusable descendants, validator-checked (v1 rule).
- **The toggle** ("map view" ⇄ "ride view", patrol-orange, in the legend and the HUD) is persistent (localStorage), honored pre-hydration via the existing `html.js` inline-snippet pattern to avoid a tier flash.

---

## 9. Build phases

Each phase ends demoable and deployed to a preview. **Tier 1 e2e stays green in every phase — it's the net.**

### Phase A — Gray-box drop (days 1–4) ✅ = you can ride the mountain

- [x] `rig-core` extraction: smoother/park-wake/telemetry shared; `rig-2d` = current behavior; **existing rig/map e2e green** on the refactor alone before any 3D lands
- [x] three.js dep, lazy `<DropIn>` chunk, tier gate v1 (reduced-motion / WebGL2 / toggle / `?tier=` override), bundle-size check wired into CI _(chunk 129.5 kB gz of the 180 budget; critical path 120.8 of 130)_
- [x] `line.3d.ts` first authoring + Catmull-Rom → speed-profile LUT + `line:validate` in CI + unit tests vs. analytic curves _(1,355 m, 370 m drop, max 29°, comfort 8.4 m/s², dwells ≥ 4.1 s; the anchor warp makes the post-closed-trail schuss the fastest stretch — its line is dead straight by construction, and Phase D owns how that speed feels)_
- [x] Camera on the line from native scroll: flat-shaded heightfield, corridor carve, paper fog _(lighting bakes into vertex colors → MeshBasicMaterial, so software GL — CI's Lighthouse, weakest devices — compiles and rasterizes it cheaply; 8 z-band chunks for frustum culling; init sliced across frames, ~300 ms worst-case TBT vs 2.6 s naive)_
- [x] HUD v2: tier, init ms, fov, draw calls, DPR, t alongside the v1 fields
- **Exit:** _emulated pass:_ scroll carves the mountain, deep link `/#public` lands the camera inside the Public.com dwell zone, toggle returns v1 with the rider rig live, 69/69 e2e green, Lighthouse ≥ 0.90 on software GL — **real-hardware 60 fps pass (desktop + mid-range phone) still needs your devices**, same as v1's Phase 3 gate.

### Phase B — The map stands up (days 5–8) ✅ = it looks like the site, not a tech demo

- [ ] Contour-line terrain shader, palette vertex colors, `paper` fog tuned
- [ ] Instanced trees, far-ridge silhouettes, lift towers on the intro traverse
- [ ] Terrain benches at dwell zones stamped by the generator; init-time budget measured (< 20 ms or move to build-time — decision gate, now load-bearing for the summit open §6)
- [ ] Paper frame + legend + cartouche framing the run viewport
- **Exit:** a screenshot at any t is recognizably the v1 map's world; draw calls ≤ 40; frame gate holds with the full world.

### Phase C — The signs (days 9–13) ✅ = the content rides the mountain

- [ ] Sign geometry (posts/panel/difficulty plaque/trail name) per waypoint from `waypoints.ts`
- [ ] DOM sign layer: matrix3d sync (hand-rolled), panels rendered from the same content data
- [ ] Magnetic read: approach → clamp → release; mobile clamped rect = the card layout
- [ ] Dwell speed profile tuned per waypoint; validator's ≥ 3.5 s read gate enforced
- [ ] Flow-document visibility swap for Tier 2 + SR pass (NVDA/VoiceOver: reads like v1) + find-in-page/anchor e2e for both tiers
- [ ] Closed trail roped off in-world beside the line
- **Exit:** a non-engineer on a phone reads all four waypoints without instructions and can quote the SoFi claim back; axe = 0 both tiers.

### Phase D — Sensation (days 14–17) ✅ = it feels like riding, and nobody feels sick

- [ ] Camera dynamics (bank/crouch/FOV/look-ahead) from LUT signals, comfort caps enforced
- [ ] Board nose + GPU spray + speed streaks; hockey-stop wall at Base Camp
- [ ] Reverse-scroll treatment (hysteresis + look-back), bfcache/restoration/resize/toolbar passes on real iPhone
- [ ] Adaptive DPR controller + cut ladder verified by forcing throttle
- [ ] **Motion-sensitive hallway test** (≥ 3 people, one who gets carsick) — pass required
- **Exit:** 6× throttle ≤ 6 ms/frame; real mid-range Android 60 fps sustained with spray; fling test "rockets down and it's thrilling, not queasy."

### Phase E — The summit open & polish (days 18–20)

- [ ] Summit open tuning (§6): POV fade-in behind the hero, hero overlay treatment, time-to-POV measured on a mid-range phone
- [ ] Scroll-before-warm path: Tier 1 carries the run, POV fades in at the current t — e2e covered
- [ ] Live tier demotion (context loss / sustained frame misses → Tier 1 at same t) + e2e for context-loss path
- [ ] Gondola credits on lift towers — stretch, cut-eligible
- [ ] Colophon rewrite: "one dependency — the renderer; the camera, the mountain, and every rule about what moves is ~1,200 lines we own — view source"
- **Exit:** cold load opens at the summit in POV, the first scroll drops in, full run → hockey stop → contact, on a phone, no instructions, no jank.

### Phase F — Season re-opening (days 21–24)

- [ ] Budgets updated in `budgets.json` + Lighthouse CI green at the new numbers; Perf ≥ 90 gate (95 target), A11y = 100
- [ ] Playwright WebGL smoke in CI (SwiftShader): Tier 2 mounts, camera responds to scroll, zero console errors, deterministic-seed screenshot diff at fixed t
- [ ] Cross-browser/device matrix: Safari iOS, Chrome Android, Firefox, Edge + **LinkedIn and iMessage in-app WebViews** (the actual arrival surfaces — verify tier gate behavior in each)
- [ ] OG card = the summit POV frame (§6): deterministic Playwright render (fixed seed/camera, 1200×630), committed in place of the map card; meta copy pass
- [ ] The twee pass, now for 3D: cut any prop that needs explaining; one metaphor per screen still
- [ ] Field Lighthouse + final on-device ceremony; launch notes
- **Exit:** live, budgets green, and the hallway test ends with someone asking to scroll it again.

---

## 10. Risk register

| #   | Risk                                                                               | Early warning                                             | Mitigation                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Mobile GPU can't hold 60 fps** — v2's version of the classic killer              | HUD frame ms in Phase A gray-box, before art exists       | Cut ladder pre-agreed: DPR → particles → tree density → contour shader → **tier demotion**, which is a complete site, not a degraded one                          |
| 2   | **Motion sickness** — POV at speed nauseates a real fraction of people             | Anyone in hallway tests reports discomfort                | Comfort caps validated at author time (§2, §8); dwell rests; fog; map toggle one tap away; Phase D gate includes a motion-sensitive tester                        |
| 3   | **Bundle creep** — three.js pulls in the kitchen sink                              | Chunk > 180 kB gz in the CI size check (wired Phase A)    | Tree-shaken ESM imports only; no drei/examples imports without a size note in the PR; renderer features audited (no shadows, no postprocessing at launch)         |
| 4   | **Text unreadable at speed** — the original sin, restated in 3D                    | Phase C non-engineer test needs a second pass on any sign | Dwell validator gate (≥ 3.5 s) + magnetic read clamp; if still failing, slow the profile — the mountain serves the resume, never the reverse                      |
| 5   | **iOS toolbar collapse + canvas resize jitter**                                    | Rider-era risk #3, now with a WebGL canvas                | `svh` layout + `visualViewport` for camera aspect; resize = projection-matrix update only, never a world rebuild; real-iPhone gate in Phase D                     |
| 6   | **WebGL context loss** (backgrounding, GPU resets — common on mobile)              | Any lost-context report in dev                            | Handled from Phase A: demote to Tier 1 at same t; e2e simulates loss in Phase E                                                                                   |
| 7   | **Art scope creep on the mountain**                                                | > 2 days in Phase B without a merged PR                   | Timebox; contour shader + fog _is_ the look — trees and towers are garnish; v1 risk-#5 discipline                                                                 |
| 8   | **Refactor regression in Tier 1** while extracting rig-core                        | v1 e2e flakes during Phase A                              | Refactor lands alone, before any three.js code, with the existing suite as the contract                                                                           |
| 9   | **In-app WebViews mis-tier** (LinkedIn/iMessage — the actual first-visit surfaces) | Tier gate probe results from the Phase F matrix           | Conservative gate defaults; the first-seconds frame watchdog demotes on any ambiguity — the fallback is the finished v1, so a false negative costs almost nothing |
| 10  | **The demo eats the resume** — visitors remember the ride, not the work            | Phase C test: viewer can't recall a single claim          | Magnetic read forces one readable sign at a time; dwell gates in the validator; the twee pass gets cut authority over any effect that competes with content       |

---

## 11. Open questions

**Decided 2026-07-10:** audio is future work (§12 — liked, out of this effort); the OG card is the summit POV frame (§6); there is no intro ceremony — the site opens in POV and the first scroll is already the descent (§6).

1. **Tier 1's long-term role.** This plan keeps v1 fully alive as the fallback and toggle target. Post-launch, is it maintained forever or eventually frozen? (Recommend: maintained — it's the reduced-motion deliverable and the print register's home.)
2. **Gondola credits on lift towers** (stretch): worth it, or does the hero gondola stay the sole home of the education story?
3. **WebGPU** as a post-launch renderer swap behind the same rig — park it in the same bucket as v1's night-skiing mode?
4. **Domain/analytics** — v1 open questions #2/#3 remain open and unchanged by this plan.

---

## 12. Future work — wanted, specced, not in this effort

- **Ride audio (deferred 2026-07-10).** Wind bed + edge-carve loop, gain and filter cutoff driven by the same LUT signals as the camera (speed → gain, |curvature| → carve intensity), spray hiss on the hockey stop. Off by default, patrol-orange unmute in the legend, `muted` persisted, never autoplays — this is a resume opened in offices. Web Audio, synthesized or tiny loops ≤ 30 kB, fetched only on unmute so it costs the bundle nothing until asked for. The rig telemetry already carries every input it needs, so it bolts onto the loop without changing it.
- **Night-skiing dark mode** (inherited from v1's post-launch list) — in 3D it's a sky/fog palette swap and a headlamp cone in the terrain shader; cheaper here than it ever was in 2D.
- **Playwright print-to-PDF pipeline** (inherited from v1).
- **WebGPU renderer swap** stays parked behind open question #3 until the run is live.

---

_Plan drafted 2026-07-10. Stack: React Router v7 (framework mode, prerendered) · React · TypeScript strict · Tailwind v4 · three.js (the one dependency that earns its keep) · Cloudflare Pages._

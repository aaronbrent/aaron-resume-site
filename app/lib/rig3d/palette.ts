import { Color, Vector3 } from "three";

/**
 * The ride's art direction (PLAN-3D ADR-9, amended): golden-hour alpenglow in
 * the anime-key style — deep blue zenith, peach horizon, warm-lit snow with
 * vivid blue shadows, sienna rock, and haze that layers the distance. One
 * module so the sky, the terrain bake, the far ranges, and the town all light
 * from the same low sun and dissolve into the same haze.
 *
 * Everything here is authored data, not loaded assets: the world is still
 * primitives, instancing, and shaders — the palette is the only paint.
 */

/** Low sun, ahead-right of the fall line: the descent rides into the light. */
export const SUN_DIR = new Vector3(0.35, 0.26, 0.9).normalize();

export const ANIME = {
  // Sky, top to bottom.
  skyZenith: new Color("#2c4da2"),
  skyMid: new Color("#7191da"),
  skyHorizon: new Color("#f6d9b4"),
  sunGlow: new Color("#ffcf9a"),
  // Clouds: cream bodies shaded salmon from below (the sunset underlight).
  cloudLit: new Color("#fdefe1"),
  cloudShade: new Color("#f2a58a"),
  // Airborne haze — also the fog color, so distance always reads as air.
  haze: new Color("#bcc9e8"),
  // Snowfields: warm where the sun grazes, saturated blue in shadow.
  snowLit: new Color("#fff6ea"),
  snowShade: new Color("#b4c6ee"),
  // Rock faces breaking through the steeps.
  rockLit: new Color("#b98a60"),
  rockShade: new Color("#5c6690"),
  // Contour lines survive from the printed map, whispered into the shadows.
  contour: new Color("#93a7d8"),
  // Treeline: cold spruce with snow dust on the crowns.
  spruce: new Color("#20514a"),
  spruceShade: new Color("#1d3b58"),
  snowDust: new Color("#eaf1fc"),
  trunk: new Color("#41332a"),
  // Far-range paint, nearest ring to farthest.
  rangeSnow: new Color("#eef2fc"),
  rangeRock: new Color("#7c8cc0"),
  rangeWarm: new Color("#e2ac85"),
  // Steel and wood for furniture (lift towers, sign posts).
  steel: new Color("#5d6a7e"),
  wood: new Color("#7a5638"),
} as const;

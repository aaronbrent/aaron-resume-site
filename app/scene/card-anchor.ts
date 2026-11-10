/**
 * Where a role card floats beside its planet (docs/PLAN-STAR-SYSTEM.md §5).
 * Pure screen-space geometry, CSS pixels, origin top-left. The card goes on
 * the side of the planet facing the open screen (the camera frames planets
 * right of centre, so normally left), vertically centred on the planet and
 * clamped inside the viewport, and never over the planet's disc. A short
 * connector runs from the card's facing edge to the planet's rim.
 */

export interface ScreenCircle {
  x: number;
  y: number;
  r: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface CardAnchor {
  x: number;
  y: number;
  side: "left" | "right";
  /** True when no placement could avoid the disc (window too small). */
  overlaps: boolean;
  /** Connector in card-local coordinates: start point, length, angle (rad). */
  connector: { x: number; y: number; length: number; angle: number };
}

export interface AnchorOptions {
  /** Space between the card and the planet's rim. */
  gap?: number;
  /** Minimum distance from the viewport edges. */
  margin?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Does a rectangle intersect a circle? */
export function rectHitsCircle(
  rect: { x: number; y: number; w: number; h: number },
  c: ScreenCircle,
): boolean {
  const nx = clamp(c.x, rect.x, rect.x + rect.w);
  const ny = clamp(c.y, rect.y, rect.y + rect.h);
  return (c.x - nx) ** 2 + (c.y - ny) ** 2 < c.r * c.r;
}

export function anchorCard(
  planet: ScreenCircle,
  card: Size,
  viewport: Size,
  { gap = 28, margin = 24 }: AnchorOptions = {},
): CardAnchor {
  const y = clamp(
    planet.y - card.h / 2,
    margin,
    Math.max(margin, viewport.h - margin - card.h),
  );
  const leftX = planet.x - planet.r - gap - card.w;
  const rightX = planet.x + planet.r + gap;
  const fitsLeft = leftX >= margin;
  const fitsRight = rightX + card.w <= viewport.w - margin;
  const prefer: "left" | "right" = planet.x >= viewport.w / 2 ? "left" : "right";

  let side: "left" | "right";
  if (prefer === "left" ? fitsLeft : fitsRight) side = prefer;
  else if (prefer === "left" ? fitsRight : fitsLeft)
    side = prefer === "left" ? "right" : "left";
  else side = planet.x - margin >= viewport.w - margin - planet.x ? "left" : "right";

  const maxX = Math.max(margin, viewport.w - margin - card.w);
  const x = clamp(side === "left" ? leftX : rightX, margin, maxX);
  const overlaps = rectHitsCircle({ x, y, w: card.w, h: card.h }, planet);

  // Connector: from the facing edge (at the planet's height, kept off the
  // card's corners) to the nearest point on the planet's rim.
  const edgeX = side === "left" ? x + card.w : x;
  const edgeY = clamp(planet.y, y + 24, y + card.h - 24);
  const dx = planet.x - edgeX;
  const dy = planet.y - edgeY;
  const dist = Math.hypot(dx, dy);
  const length = Math.max(0, dist - planet.r);
  return {
    x,
    y,
    side,
    overlaps,
    connector: { x: edgeX - x, y: edgeY - y, length, angle: Math.atan2(dy, dx) },
  };
}

import { BufferAttribute, BufferGeometry, type Color } from "three";

/**
 * Bake a kit of fixed-color parts into one vertex-colored geometry (Phase G
 * draw-call discipline): each part arrives pre-posed in the kit's local
 * frame (translate/rotate/scale applied to the geometry), gets painted one
 * flat color, and the whole kit renders as a single InstancedMesh draw.
 * Input geometries are consumed — disposed here — so callers only track the
 * merged result.
 */
export function mergeColoredParts(
  parts: Array<{ geometry: BufferGeometry; color: Color }>,
): BufferGeometry {
  const expanded = parts.map((part) => {
    const nonIndexed = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    if (nonIndexed !== part.geometry) part.geometry.dispose();
    return { geometry: nonIndexed, color: part.color };
  });
  let total = 0;
  for (const part of expanded) total += part.geometry.getAttribute("position").count;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  let offset = 0;
  for (const part of expanded) {
    const pos = part.geometry.getAttribute("position");
    positions.set(pos.array as Float32Array, offset * 3);
    for (let v = 0; v < pos.count; v++) {
      colors[(offset + v) * 3] = part.color.r;
      colors[(offset + v) * 3 + 1] = part.color.g;
      colors[(offset + v) * 3 + 2] = part.color.b;
    }
    offset += pos.count;
    part.geometry.dispose();
  }
  const merged = new BufferGeometry();
  merged.setAttribute("position", new BufferAttribute(positions, 3));
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  return merged;
}

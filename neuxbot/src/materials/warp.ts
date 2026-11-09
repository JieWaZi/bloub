import type { Silhouette } from "../bot/shape";

/**
 * SVG adaptation of plush/warp.ts from the pinned Bloub source. Each sector
 * maps the complete sprite's source radius to the sampled engine radius. This
 * preserves the photographed volume and transparent fringe without WebGL
 * contexts in avatar lists, canvas readbacks, or a flat texture fill.
 */
export function radialBodyWarp(
  source: readonly number[],
  target: readonly number[],
) {
  if (
    source.length === target.length &&
    source.every(
      (radius, index) => Math.abs(radius - (target[index] ?? radius)) < 0.0001,
    )
  )
    return [];
  return source.map((radius, index) => {
    const next = (index + 1) % source.length;
    const a = (index * Math.PI * 2) / source.length;
    const b = ((index + 1) * Math.PI * 2) / source.length;
    // The sectors extend beyond all four corners, so alpha, fuzz and shadows
    // outside the silhouette travel with the body rather than getting cut off.
    const extent = 800;
    const ax = Math.cos(a) * radius * extent;
    const ay = Math.sin(a) * radius * extent;
    const bx = Math.cos(b) * (source[next] ?? radius) * extent;
    const by = Math.sin(b) * (source[next] ?? radius) * extent;
    const ar = (target[index] ?? radius) / radius;
    const br =
      (target[next] ?? source[next] ?? radius) / (source[next] ?? radius);
    const det = ax * by - ay * bx;
    const m = [
      (ax * ar * by - bx * br * ay) / det,
      (ay * ar * by - by * br * ay) / det,
      (bx * br * ax - ax * ar * bx) / det,
      (by * br * ax - ay * ar * bx) / det,
    ];
    // Sub-pixel overlap avoids hairline antialias seams between adjacent slices.
    const overlap = 0.0005;
    const points = `0,0 ${Math.cos(a - overlap) * radius * extent * ar},${Math.sin(a - overlap) * radius * extent * ar} ${Math.cos(b + overlap) * (source[next] ?? radius) * extent * br},${Math.sin(b + overlap) * (source[next] ?? radius) * extent * br}`;
    return { matrix: `matrix(${m.join(",")},0,0)`, points };
  });
}

/** Same order as shape.toPoints: rotation, screen squash, then translation. */
export function silhouetteTransform(sil: Silhouette): string {
  return `translate(${sil.cx * 100},${sil.cy * 100}) scale(${sil.sx},${sil.sy}) rotate(${(sil.rot * 180) / Math.PI})`;
}

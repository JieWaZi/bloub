import type { Silhouette } from "../bot/shape";
import { SHAPE_BY_ID, type ShapeId } from "../bot/skins";
import { bodySurfaceBounds } from "./layout";

/** Body rotation in degrees: positive yaw faces right; positive pitch faces up. */
export interface BodyOrientation {
  yaw: number;
  pitch: number;
}

interface PointerBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

const neutral = (): BodyOrientation => ({ yaw: 0, pitch: 0 });
const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));

/** Normalize host pointer coordinates without retaining DOM or event state. */
export function pointerOrientation(
  bounds: PointerBounds,
  pointer: { x: number; y: number } | null,
): BodyOrientation {
  if (
    !pointer ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    ![
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height,
      pointer.x,
      pointer.y,
    ].every(Number.isFinite)
  )
    return neutral();
  const radius = Math.max(bounds.width, 1) * 2;
  const x = (pointer.x - bounds.left - bounds.width / 2) / radius;
  const y = (bounds.top + bounds.height / 2 - pointer.y) / radius;
  return { yaw: clamp(x, 1) * 20 || 0, pitch: clamp(y, 1) * 16 || 0 };
}

/** Frame-rate independent 110ms response, with an exact settled neutral frame. */
export function dampOrientation(
  current: BodyOrientation,
  target: BodyOrientation,
  seconds: number,
): BodyOrientation {
  const from = finiteOrientation(current);
  if (!Number.isFinite(seconds) || seconds <= 0) return from;
  const to = finiteOrientation(target);
  const amount = -Math.expm1(-seconds / 0.11);
  const axis = (a: number, b: number) => {
    const value = a + (b - a) * amount;
    return Math.abs(b - value) < 0.005 ? b : value;
  };
  return { yaw: axis(from.yaw, to.yaw), pitch: axis(from.pitch, to.pitch) };
}

function finiteOrientation(value: BodyOrientation): BodyOrientation {
  return Number.isFinite(value.yaw) && Number.isFinite(value.pitch)
    ? { yaw: clamp(value.yaw, 35), pitch: clamp(value.pitch, 28) }
    : neutral();
}

interface Point {
  x: number;
  y: number;
}
interface Vertex extends Point {
  z: number;
}
type Triangle = readonly [Vertex, Vertex, Vertex];

interface SurfaceFace {
  vertices: Triangle;
  fringe: boolean;
}

interface Surface {
  radii: readonly number[];
  faces: SurfaceFace[];
}

export interface DepthPatch {
  /** Non-overlapping visible polygons; only atlas alpha defines material edges. */
  clipPath: string;
  /** Affine texture mapping of one independently projected surface triangle. */
  matrix: string;
}

export interface BodyDepthProjection {
  patches: DepthPatch[];
  /** Union of visible solid faces for the untextured loading/fallback body. */
  surfacePath: string;
}

const TAU = Math.PI * 2;
const SEGMENTS = 32;
const surfaceCache = new Map<ShapeId, Surface>();
const compact = (value: number) => Math.round(value * 1e6) / 1e6 || 0;
const xy = ({ x, y }: Point) => `${compact(x)},${compact(y)}`;

function radiusAt(radii: readonly number[], angle: number): number {
  if (!radii.length) return 1;
  const at = ((((angle / TAU) % 1) + 1) % 1) * radii.length;
  const index = Math.floor(at);
  const a = radii[index % radii.length] ?? 1;
  const b = radii[(index + 1) % radii.length] ?? a;
  const radius = a + (b - a) * (at - index);
  return Number.isFinite(radius) ? Math.max(0, radius) : 0;
}

/**
 * A closed, rounded extrusion of a radial silhouette. Front and rear share the
 * photographed atlas coordinates, so turning reveals a textured side rather
 * than stretching one flat rectangle. The outer coplanar apron transports all
 * transparent fuzz/shadow pixels without cropping them to an analytic contour.
 * All geometry is derived from this library's own shapes and atlas calibration.
 */
function surfaceOf(shape: ShapeId): Surface {
  const cached = surfaceCache.get(shape);
  if (cached) return cached;
  const radii = SHAPE_BY_ID.get(shape)?.radii ?? Array<number>(64).fill(1);
  const outline = radii.map((radius, index) => ({
    x: Math.cos((index * TAU) / radii.length) * radius * 100,
    y: Math.sin((index * TAU) / radii.length) * radius * 100,
  }));
  const left = Math.min(...outline.map(({ x }) => x));
  const right = Math.max(...outline.map(({ x }) => x));
  const top = Math.min(...outline.map(({ y }) => y));
  const bottom = Math.max(...outline.map(({ y }) => y));
  const [x0, y0, x1, y1] = bodySurfaceBounds(shape);
  const sx = (x1 - x0) / (right - left);
  const sy = (y1 - y0) / (bottom - top);
  const cx = x0 - left * sx;
  const cy = y0 - top * sy;
  const thickness = Math.min(x1 - x0, y1 - y0) * 0.38;
  const ring = (radius: number, z: number): Vertex[] =>
    Array.from({ length: SEGMENTS }, (_, index) => {
      const angle = (index * TAU) / SEGMENTS;
      const r = radiusAt(radii, angle) * 100 * radius;
      return {
        x: cx + Math.cos(angle) * r * sx,
        y: cy + Math.sin(angle) * r * sy,
        z,
      };
    });
  const faces: SurfaceFace[] = [];
  const join = (
    inner: Vertex[],
    outer: Vertex[],
    reverse: boolean,
    fringe = false,
  ) => {
    const add = (a: Vertex, b: Vertex, c: Vertex) => {
      faces.push({ vertices: reverse ? [a, c, b] : [a, b, c], fringe });
    };
    for (let index = 0; index < SEGMENTS; index++) {
      const next = (index + 1) % SEGMENTS;
      const a = inner[index]!,
        b = outer[index]!,
        c = outer[next]!;
      add(a, b, c);
      if (
        inner.length > 1 &&
        Math.hypot(a.x - inner[next]!.x, a.y - inner[next]!.y) > 1e-8
      ) {
        add(a, c, inner[next]!);
      }
    }
  };
  for (const back of [false, true]) {
    let previous = ring(0, back ? -thickness : thickness);
    for (let band = 1; band <= 4; band++) {
      const latitude = (band * Math.PI) / 8;
      const next = ring(
        Math.sin(latitude),
        Math.cos(latitude) * thickness * (back ? -1 : 1),
      );
      join(previous, next, back);
      previous = next;
    }
  }
  // Six radii cover the complete 316px square even for narrow/concave shapes.
  // It is drawn once: two coincident alpha fringes would darken the soft edge.
  join(ring(1, 0), ring(6, 0), false, true);
  const surface = { radii, faces };
  surfaceCache.set(shape, surface);
  return surface;
}

const signedArea = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

function textureMatrix(source: Triangle, target: Triangle): string {
  const [p, q, r] = source,
    [a, b, c] = target;
  const ux = q.x - p.x,
    uy = q.y - p.y;
  const vx = r.x - p.x,
    vy = r.y - p.y;
  const tx = b.x - a.x,
    ty = b.y - a.y;
  const wx = c.x - a.x,
    wy = c.y - a.y;
  const determinant = ux * vy - uy * vx;
  const m0 = (tx * vy - wx * uy) / determinant;
  const m1 = (ty * vy - wy * uy) / determinant;
  const m2 = (wx * ux - tx * vx) / determinant;
  const m3 = (wy * ux - ty * vx) / determinant;
  return `matrix(${[m0, m1, m2, m3, a.x - m0 * p.x - m2 * p.y, a.y - m1 * p.x - m3 * p.y].map(compact).join(",")})`;
}

const polygonPath = (polygon: readonly Point[]) =>
  `M${polygon.map(xy).join("L")}Z`;
const polygonArea = (polygon: readonly Point[]) =>
  Math.abs(
    polygon.reduce((area, point, index) => {
      const next = polygon[(index + 1) % polygon.length]!;
      return area + point.x * next.y - next.x * point.y;
    }, 0),
  ) / 2;

/** Clip a convex polygon to a signed half plane without enlarging its alpha. */
function halfPlane(
  polygon: readonly Point[],
  distance: (point: Point) => number,
): Point[] {
  const result: Point[] = [];
  for (let index = 0; index < polygon.length; index++) {
    const point = polygon[index]!,
      next = polygon[(index + 1) % polygon.length]!;
    const a = distance(point),
      b = distance(next);
    if (a >= 0) result.push(point);
    if ((a < 0 && b > 0) || (a > 0 && b < 0)) {
      const ratio = a / (a - b);
      result.push({
        x: point.x + (next.x - point.x) * ratio,
        y: point.y + (next.y - point.y) * ratio,
      });
    }
  }
  return result;
}

function intersection(
  subject: readonly Point[],
  clip: readonly Point[],
): Point[] {
  let result = [...subject];
  for (let index = 0; index < clip.length && result.length; index++) {
    const a = clip[index]!,
      b = clip[(index + 1) % clip.length]!;
    result = halfPlane(result, (point) => signedArea(a, b, point));
  }
  return result;
}

/** Difference of convex polygons, partitioned into disjoint convex fragments. */
function subtract(
  subject: readonly Point[],
  clip: readonly Point[],
): Point[][] {
  if (polygonArea(intersection(subject, clip)) < 1e-7) return [[...subject]];
  const result: Point[][] = [];
  let remaining = [...subject];
  for (let index = 0; index < clip.length && remaining.length; index++) {
    const a = clip[index]!,
      b = clip[(index + 1) % clip.length]!;
    const outside = halfPlane(remaining, (point) => -signedArea(a, b, point));
    if (polygonArea(outside) > 1e-7) result.push(outside);
    remaining = halfPlane(remaining, (point) => signedArea(a, b, point));
  }
  return result;
}

interface ProjectedFace extends SurfaceFace {
  target: Triangle;
  bounds: readonly [number, number, number, number];
  plane: readonly [number, number, number];
}

function projectedFace(face: SurfaceFace, target: Triangle): ProjectedFace {
  const [a, b, c] = target;
  const area = signedArea(a, b, c);
  const zx = ((b.z - a.z) * (c.y - a.y) - (c.z - a.z) * (b.y - a.y)) / area;
  const zy = ((c.z - a.z) * (b.x - a.x) - (b.z - a.z) * (c.x - a.x)) / area;
  return {
    ...face,
    target,
    bounds: [
      Math.min(a.x, b.x, c.x),
      Math.min(a.y, b.y, c.y),
      Math.max(a.x, b.x, c.x),
      Math.max(a.y, b.y, c.y),
    ],
    plane: [zx, zy, a.z - zx * a.x - zy * a.y],
  };
}

/**
 * Resolve depth before rasterization, including concave lobes and the fringe
 * apron. Every point then belongs to a single texture patch. Exact clip AA can
 * be added inside an isolated plus-lighter group without dark alpha joins or
 * bright additive overlaps at genuinely occluded surface regions.
 */
function visiblePolygons(
  face: ProjectedFace,
  faces: readonly ProjectedFace[],
): Point[][] {
  let polygons: Point[][] = [[...face.target]];
  for (const other of faces) {
    if (other === face || !polygons.length) continue;
    const a = face.bounds,
      b = other.bounds;
    if (a[0] >= b[2] || b[0] >= a[2] || a[1] >= b[3] || b[1] >= a[3]) continue;
    const overlap = intersection(face.target, other.target);
    if (polygonArea(overlap) < 1e-7) continue;
    const dx = other.plane[0] - face.plane[0];
    const dy = other.plane[1] - face.plane[1];
    const dz = other.plane[2] - face.plane[2];
    const occluded = halfPlane(
      overlap,
      (point) => dx * point.x + dy * point.y + dz - 1e-7,
    );
    if (polygonArea(occluded) < 1e-7) continue;
    polygons = polygons.flatMap((polygon) => subtract(polygon, occluded));
  }
  return polygons;
}

/** Project a real depth surface; neutral/invalid input keeps the original SVG. */
export function bodyDepthProjection(
  shape: ShapeId,
  silhouette: Silhouette,
  orientation?: BodyOrientation,
): BodyDepthProjection | undefined {
  const direction = finiteOrientation(orientation ?? neutral());
  if (!direction.yaw && !direction.pitch) return undefined;
  const surface = surfaceOf(shape);
  const yaw = (direction.yaw * Math.PI) / 180;
  const pitch = (direction.pitch * Math.PI) / 180;
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  const depthScale =
    surface.radii.reduce(
      (sum, radius, index) =>
        sum +
        radiusAt(silhouette.radii, (index * TAU) / surface.radii.length) /
          Math.max(radius, 1e-6),
      0,
    ) / surface.radii.length;
  const project = (point: Vertex): Vertex => {
    const angle = Math.atan2(point.y, point.x);
    const ratio =
      radiusAt(silhouette.radii, angle) /
      Math.max(radiusAt(surface.radii, angle), 1e-6);
    const x = point.x * ratio,
      y = point.y * ratio,
      z = point.z * depthScale;
    // Match eyePoses' tangent frame: pitch about local right, then yaw.
    const py = y * cp - z * sp;
    const pz = y * sp + z * cp;
    return { x: x * cy + pz * sy, y: py, z: pz * cy - x * sy };
  };
  const visible = surface.faces.flatMap((face) => {
    const target: Triangle = [
      project(face.vertices[0]),
      project(face.vertices[1]),
      project(face.vertices[2]),
    ];
    if (signedArea(...target) <= 1e-5) return [];
    return [projectedFace(face, target)];
  });
  return {
    patches: visible.flatMap((face) => {
      const polygons = visiblePolygons(face, visible);
      return polygons.length
        ? [
            {
              clipPath: polygons.map(polygonPath).join(""),
              matrix: textureMatrix(face.vertices, face.target),
            },
          ]
        : [];
    }),
    surfacePath: visible
      .filter((face) => !face.fringe)
      .map(({ target }) => `M${target.map(xy).join("L")}Z`)
      .join(""),
  };
}

import type { BotFrame } from "../bot/engine";
import { mixHex, SHAPE_BY_ID, type ShapeId } from "../bot/skins";
import { radiusAtAngle, type Silhouette } from "../bot/shape";
import type { Material } from "./catalogue";
import type { BodyOrientation } from "./depth";
import type { SvgDrawing } from "./drawing";
import { enlargedEyes } from "./eyes";
import { bodySurfaceBounds } from "./layout";
import { matrixOf } from "../plush/motion";

interface Vec3 {
  x: number;
  y: number;
  z: number;
}
/** Indexed manifold; each edge belongs to exactly two outward-facing triangles. */
export interface SolidGeometry {
  vertices: Vec3[];
  faces: [number, number, number][];
}
const TAU = Math.PI * 2;
const SEGMENTS = 48;
const BANDS = 16;
const round = (v: number) => Math.round(v * 1000) / 1000 || 0;
const path = (points: readonly Vec3[]) =>
  `M${points.map((p) => `${round(p.x)},${round(p.y)}`).join("L")}Z`;
const node = (
  tag: string,
  attributes: SvgDrawing["attributes"],
  ...children: SvgDrawing[]
): SvgDrawing => ({ tag, attributes, children });
const sub = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const unit = (p: Vec3): Vec3 => {
  const s = Math.hypot(p.x, p.y, p.z) || 1;
  return { x: p.x / s, y: p.y / s, z: p.z / s };
};
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const area = (a: Vec3, b: Vec3, c: Vec3) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Same camera convention as the native eye engine, with unrestricted rotations. */
function rotation(orientation: BodyOrientation) {
  const yaw = Number.isFinite(orientation.yaw)
    ? (orientation.yaw * Math.PI) / 180
    : 0;
  const pitch = Number.isFinite(orientation.pitch)
    ? (orientation.pitch * Math.PI) / 180
    : 0;
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  return (p: Vec3): Vec3 => {
    const y = p.y * cp - p.z * sp,
      z = p.y * sp + p.z * cp;
    return { x: p.x * cy + z * sy, y, z: z * cy - p.x * sy };
  };
}

function surface(shape: ShapeId, sil: Silhouette) {
  const base = SHAPE_BY_ID.get(shape)?.radii ?? Array<number>(64).fill(1);
  const outline = base.map((r, i) => ({
    x: Math.cos((i * TAU) / base.length) * r * 100,
    y: Math.sin((i * TAU) / base.length) * r * 100,
  }));
  const left = Math.min(...outline.map((p) => p.x)),
    right = Math.max(...outline.map((p) => p.x));
  const top = Math.min(...outline.map((p) => p.y)),
    bottom = Math.max(...outline.map((p) => p.y));
  const [x0, y0, x1, y1] = bodySurfaceBounds(shape);
  const sx = (x1 - x0) / (right - left),
    sy = (y1 - y0) / (bottom - top);
  const cx = x0 - left * sx,
    cy = y0 - top * sy;
  const deform =
    sil.radii.reduce(
      (sum, r, i) =>
        sum +
        r / Math.max(radiusAtAngle(base, (i * TAU) / sil.radii.length), 0.001),
      0,
    ) / Math.max(1, sil.radii.length);
  const depth =
    Math.min(x1 - x0, y1 - y0) * (shape === "cercle" ? 0.5 : 0.44) * deform;
  // The .72 exponent is the rounded loft used by the reference's cloud volume.
  // Unlike an atlas sheet, both hemispheres have their own geometry and normals.
  const loft = shape === "nuage" || shape === "triangle" ? 0.72 : 1;
  const pose = (p: Vec3): Vec3 => {
    const c = Math.cos(sil.rot),
      s = Math.sin(sil.rot);
    return {
      x: (p.x * c - p.y * s) * sil.sx + sil.cx * 100,
      y: (p.x * s + p.y * c) * sil.sy + sil.cy * 100,
      z: p.z,
    };
  };
  const sample = (phi: number, theta: number): Vec3 => {
    const rho = Math.max(0, Math.sin(phi)) ** loft;
    const r = radiusAtAngle(sil.radii, theta) * 100 * rho;
    return pose({
      x: cx + Math.cos(theta) * r * sx,
      y: cy + Math.sin(theta) * r * sy,
      z: Math.cos(phi) * depth,
    });
  };
  const front = (x: number, y: number): Vec3 | undefined => {
    const c = Math.cos(sil.rot),
      s = Math.sin(sil.rot);
    const px = (x - sil.cx * 100) / sil.sx,
      py = (y - sil.cy * 100) / sil.sy;
    const qx = (px * c + py * s - cx) / sx,
      qy = (-px * s + py * c - cy) / sy;
    const rho =
      Math.hypot(qx, qy) /
      Math.max(0.001, radiusAtAngle(sil.radii, Math.atan2(qy, qx)) * 100);
    if (rho >= 0.998) return undefined;
    return {
      x,
      y,
      z: Math.sqrt(Math.max(0, 1 - rho ** (2 / loft))) * depth + 0.65,
    };
  };
  return { sample, front, depth };
}

/** A single indexed, closed surface including shared front and rear poles. */
export function buildSolidGeometry(
  shape: ShapeId,
  silhouette: Silhouette,
): SolidGeometry {
  const { sample } = surface(shape, silhouette);
  const vertices = [sample(0, 0)];
  const faces: [number, number, number][] = [];
  for (let band = 1; band < BANDS; band++)
    for (let i = 0; i < SEGMENTS; i++)
      vertices.push(sample((band * Math.PI) / BANDS, (i * TAU) / SEGMENTS));
  const back = vertices.push(sample(Math.PI, 0)) - 1;
  for (let i = 0; i < SEGMENTS; i++) {
    const next = (i + 1) % SEGMENTS;
    faces.push([0, 1 + i, 1 + next]);
    for (let band = 0; band < BANDS - 2; band++) {
      const a = 1 + band * SEGMENTS + i,
        b = 1 + (band + 1) * SEGMENTS + i,
        c = 1 + (band + 1) * SEGMENTS + next,
        d = 1 + band * SEGMENTS + next;
      faces.push([a, b, c], [a, c, d]);
    }
    const last = 1 + (BANDS - 2) * SEGMENTS;
    faces.push([last + i, back, last + next]);
  }
  return { vertices, faces };
}

interface Face {
  bounds: readonly [number, number, number, number];
  d: string;
  points: [Vec3, Vec3, Vec3];
  normal: Vec3;
  z: number;
}
function depthAt(p: Vec3, faces: readonly Face[]): number {
  let nearest = -Infinity;
  for (const {
    points: [a, b, c],
  } of faces) {
    if (
      p.x < Math.min(a.x, b.x, c.x) ||
      p.x > Math.max(a.x, b.x, c.x) ||
      p.y < Math.min(a.y, b.y, c.y) ||
      p.y > Math.max(a.y, b.y, c.y)
    )
      continue;
    const denominator = area(a, b, c);
    const u = area(p, b, c) / denominator,
      v = area(a, p, c) / denominator,
      w = 1 - u - v;
    if (u >= -1e-6 && v >= -1e-6 && w >= -1e-6)
      nearest = Math.max(nearest, a.z * u + b.z * v + c.z * w);
  }
  return nearest;
}
const visible = (p: Vec3, faces: readonly Face[]) =>
  p.z >= depthAt(p, faces) - 0.8;
/** Convex polygon clipping is restricted to overlapping grid cells. */
function halfPlane(
  polygon: readonly Vec3[],
  distance: (p: Vec3) => number,
): Vec3[] {
  const result: Vec3[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!,
      b = polygon[(i + 1) % polygon.length]!,
      da = distance(a),
      db = distance(b);
    if (da >= 0) result.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      result.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
      });
    }
  }
  return result;
}
const polygonArea = (p: readonly Vec3[]) =>
  Math.abs(
    p.reduce((sum, a, i) => {
      const b = p[(i + 1) % p.length]!;
      return sum + a.x * b.y - b.x * a.y;
    }, 0),
  ) / 2;
function intersection(subject: readonly Vec3[], clip: readonly Vec3[]): Vec3[] {
  let polygon = [...subject];
  for (let i = 0; i < clip.length && polygon.length; i++) {
    const a = clip[i]!,
      b = clip[(i + 1) % clip.length]!;
    polygon = halfPlane(polygon, (p) => area(a, b, p));
  }
  return polygon;
}
function subtract(subject: readonly Vec3[], clip: readonly Vec3[]): Vec3[][] {
  const pieces: Vec3[][] = [];
  let remaining = [...subject];
  for (let i = 0; i < clip.length && remaining.length; i++) {
    const a = clip[i]!,
      b = clip[(i + 1) % clip.length]!;
    const outside = halfPlane(remaining, (p) => -area(a, b, p));
    if (polygonArea(outside) > 1e-6) pieces.push(outside);
    remaining = halfPlane(remaining, (p) => area(a, b, p));
  }
  return pieces;
}
function planeOf([a, b, c]: readonly [Vec3, Vec3, Vec3]) {
  const determinant = area(a, b, c);
  const x =
    ((b.z - a.z) * (c.y - a.y) - (c.z - a.z) * (b.y - a.y)) / determinant;
  const y =
    ((c.z - a.z) * (b.x - a.x) - (b.z - a.z) * (c.x - a.x)) / determinant;
  return { x, y, z: a.z - x * a.x - y * a.y };
}
function hasConcavity(radii: number[]): boolean {
  const outline = radii.map((r, i) => ({
    x: r * Math.cos((i * TAU) / radii.length),
    y: r * Math.sin((i * TAU) / radii.length),
    z: 0,
  }));
  return outline.some(
    (p, i) =>
      area(
        p,
        outline[(i + 1) % outline.length]!,
        outline[(i + 2) % outline.length]!,
      ) < -1e-6,
  );
}

const LIGHT = unit({ x: -0.45, y: -0.65, z: 1 });
const HALF = unit({ x: LIGHT.x, y: LIGHT.y, z: LIGHT.z + 1 });

/** Whole-surface material and eyes. No photographed front sprite is sampled. */
export function solidAvatarDrawing(
  frame: Pick<BotFrame, "silhouette" | "eyes">,
  material: Material,
  color: string,
  id: string,
  orientation: BodyOrientation = { yaw: 0, pitch: 0 },
  time = 0,
): SvgDrawing[] {
  const geometry = buildSolidGeometry("cercle", frame.silhouette);
  return renderSolid(
    frame,
    material,
    color,
    id,
    orientation,
    time,
    "cercle",
    geometry,
  );
}

/** Shape-aware entry shared by animated and static drawings. */
export function solidShapeDrawing(
  frame: Pick<BotFrame, "silhouette" | "eyes">,
  material: Material,
  color: string,
  id: string,
  orientation: BodyOrientation,
  time: number,
  shape: ShapeId,
): SvgDrawing[] {
  return renderSolid(
    frame,
    material,
    color,
    id,
    orientation,
    time,
    shape,
    buildSolidGeometry(shape, frame.silhouette),
  );
}

function renderSolid(
  frame: Pick<BotFrame, "silhouette" | "eyes">,
  material: Material,
  color: string,
  id: string,
  orientation: BodyOrientation,
  time: number,
  shape: ShapeId,
  geometry: SolidGeometry,
): SvgDrawing[] {
  const rotate = rotation(orientation);
  const points = geometry.vertices.map(rotate);
  const vertexNormals = points.map(() => ({ x: 0, y: 0, z: 0 }));
  for (const [a, b, c] of geometry.faces) {
    const normal = cross(
      sub(points[b]!, points[a]!),
      sub(points[c]!, points[a]!),
    );
    for (const i of [a, b, c]) {
      const n = vertexNormals[i]!;
      n.x += normal.x;
      n.y += normal.y;
      n.z += normal.z;
    }
  }
  const faces: Face[] = geometry.faces
    .flatMap(([a, b, c]) => {
      const p: [Vec3, Vec3, Vec3] = [points[a]!, points[b]!, points[c]!];
      if (area(...p) <= 1e-6) return [];
      const normals = [
        vertexNormals[a]!,
        vertexNormals[b]!,
        vertexNormals[c]!,
      ].map(unit);
      const n = unit({
        x: normals.reduce((v, p) => v + p.x, 0),
        y: normals.reduce((v, p) => v + p.y, 0),
        z: normals.reduce((v, p) => v + p.z, 0),
      });
      return [
        {
          bounds: [
            Math.min(p[0].x, p[1].x, p[2].x),
            Math.min(p[0].y, p[1].y, p[2].y),
            Math.max(p[0].x, p[1].x, p[2].x),
            Math.max(p[0].y, p[1].y, p[2].y),
          ] as const,
          d: path(p),
          points: p,
          normal: n,
          z: (p[0].z + p[1].z + p[2].z) / 3,
        },
      ];
    })
    .sort((a, b) => a.z - b.z);
  const cells = new Map<string, Face[]>();
  const cell = (v: number) => Math.floor(v / 16);
  for (const face of faces) {
    const xs = face.points.map((p) => p.x),
      ys = face.points.map((p) => p.y);
    for (let x = cell(Math.min(...xs)); x <= cell(Math.max(...xs)); x++)
      for (let y = cell(Math.min(...ys)); y <= cell(Math.max(...ys)); y++) {
        const key = `${x}:${y}`,
          list = cells.get(key) ?? [];
        list.push(face);
        cells.set(key, list);
      }
  }
  const isVisible = (p: Vec3) =>
    visible(p, cells.get(`${cell(p.x)}:${cell(p.y)}`) ?? []);
  // Visibility is resolved before regrouping by shade: a rear lobe must not
  // paint over a nearer one merely because it has a brighter material sample.
  if (hasConcavity(frame.silhouette.radii)) {
    const planes = new Map(faces.map((face) => [face, planeOf(face.points)]));
    for (const face of faces) {
      const candidates = new Set<Face>();
      const xs = face.points.map((p) => p.x),
        ys = face.points.map((p) => p.y);
      for (let x = cell(Math.min(...xs)); x <= cell(Math.max(...xs)); x++)
        for (let y = cell(Math.min(...ys)); y <= cell(Math.max(...ys)); y++)
          for (const other of cells.get(`${x}:${y}`) ?? [])
            if (other !== face) candidates.add(other);
      let polygons: Vec3[][] = [[...face.points]];
      const plane = planes.get(face)!;
      for (const other of candidates) {
        const a = face.bounds,
          b = other.bounds;
        if (
          a[0] >= b[2] - 1e-6 ||
          b[0] >= a[2] - 1e-6 ||
          a[1] >= b[3] - 1e-6 ||
          b[1] >= a[3] - 1e-6
        )
          continue;
        const otherPlane = planes.get(other)!;
        const dx = otherPlane.x - plane.x,
          dy = otherPlane.y - plane.y,
          dz = otherPlane.z - plane.z;
        if (face.points.every((p) => dx * p.x + dy * p.y + dz <= 1e-6))
          continue;
        const overlap = intersection(face.points, other.points);
        if (polygonArea(overlap) < 1e-6) continue;
        const q = planes.get(other)!;
        const occluded = halfPlane(
          overlap,
          (p) =>
            (q.x - plane.x) * p.x +
            (q.y - plane.y) * p.y +
            q.z -
            plane.z -
            1e-6,
        );
        if (polygonArea(occluded) < 1e-6) continue;
        polygons = polygons.flatMap((p) => subtract(p, occluded));
        if (!polygons.length) break;
      }
      face.d = polygons.map(path).join("");
    }
  }
  const silhouette = faces.map((f) => f.d).join("");
  const url = (name: string) => `url(#${id}-solid-${name})`;
  const definitions: SvgDrawing[] = [
    node(
      "clipPath",
      { id: `${id}-solid-clip`, clipPathUnits: "userSpaceOnUse" },
      node("path", { d: silhouette }),
    ),
    node(
      "filter",
      {
        id: `${id}-solid-smooth`,
        x: "-5%",
        y: "-5%",
        width: "110%",
        height: "110%",
        colorInterpolationFilters: "sRGB",
      },
      node("feGaussianBlur", { stdDeviation: 5 }),
    ),
    node(
      "radialGradient",
      { id: `${id}-solid-eye`, cx: ".3", cy: ".2", r: ".9" },
      node("stop", { offset: 0, stopColor: "#fffef6" }),
      node("stop", { offset: 0.7, stopColor: "#fff8dc" }),
      node("stop", { offset: 1, stopColor: "#c5b68c" }),
    ),
  ];
  // Equal-shade faces share one path. This keeps DOM cost bounded independently
  // of mesh resolution and makes a list of avatars practical to animate.
  const shades = new Map<number, string[]>();
  for (const face of faces) {
    const diffuse = Math.max(0, dot(face.normal, LIGHT));
    const specular =
      Math.max(0, dot(face.normal, HALF)) **
      (material === "balloon" ? 36 : material === "particles" ? 18 : 5);
    const light = Math.min(
      1,
      0.14 +
        diffuse * 0.6 +
        specular *
          (material === "balloon"
            ? 0.58
            : material === "particles"
              ? 0.34
              : 0.12),
    );
    const band = Math.round(light * 47);
    const group = shades.get(band) ?? [];
    group.push(face.d);
    shades.set(band, group);
  }
  const pigment = (light: number) =>
    light < 0.56
      ? mixHex("#1a1228", color, Math.min(1, 0.28 + light * 1.3))
      : mixHex(color, "#ffffff", Math.min(0.86, (light - 0.56) * 1.8));
  const body: SvgDrawing[] = [
    node("path", {
      "data-solid-silhouette": "",
      d: silhouette,
      fill: pigment(0.24),
    }),
    node(
      "g",
      { clipPath: url("clip") },
      node(
        "g",
        { filter: url("smooth") },
        ...[...shades].map(([band, paths]) =>
          node("path", {
            "data-solid-face": band,
            d: paths.join(""),
            fill: pigment(band / 47),
            stroke: pigment(band / 47),
            strokeWidth: 0.7,
            strokeLinejoin: "round",
          }),
        ),
      ),
    ),
  ];
  const s = surface(shape, frame.silhouette);
  const rng = (seed: number) => {
    const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const count = material === "plush" ? 800 : material === "particles" ? 300 : 0;
  const details: SvgDrawing[] = [];
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count),
      theta = i * 2.399963229728653;
    const p = s.sample(phi, theta),
      q = rotate(p);
    const du = sub(s.sample(phi + 0.001, theta), s.sample(phi - 0.001, theta));
    const dv = sub(s.sample(phi, theta + 0.001), s.sample(phi, theta - 0.001));
    const normal = unit(rotate(cross(du, dv)));
    if (normal.z <= 0 || !isVisible(q)) continue;
    const light = Math.max(0, dot(normal, LIGHT));
    if (material === "plush") {
      const tangent = unit(rotate(dv));
      const length = 3.5 + rng(i + 2) * 3.5;
      const tip = {
        x: q.x + normal.x * length + tangent.x * 0.8,
        y: q.y + normal.y * length + tangent.y * 0.8,
        z: q.z,
      };
      details.push(
        node("path", {
          "data-solid-fiber": i,
          d: `M${round(q.x)},${round(q.y)}q${round((tip.x - q.x) * 0.25 - 0.25)},${round((tip.y - q.y) * 0.6 - 0.3)} ${round(tip.x - q.x)},${round(tip.y - q.y)}`,
          fill: "none",
          stroke: mixHex(color, "#fff6e5", 0.2 + light * 0.52),
          strokeWidth: 0.6 + rng(i + 5) * 0.35,
          strokeLinecap: "round",
          opacity: 0.38 + light * 0.34,
        }),
      );
    } else {
      const pulse = 0.72 + Math.sin(time * 1.2 + i * 1.3) * 0.28;
      details.push(
        node("circle", {
          "data-material-particle": i,
          cx: round(q.x),
          cy: round(q.y),
          r: round(0.35 + rng(i + 7) * 0.95),
          fill: mixHex(color, "#f1efff", 0.42 + light * 0.5),
          opacity: round((0.38 + rng(i) * 0.55) * pulse),
        }),
      );
    }
  }
  if (material === "plush") {
    const fibers = new Map<string, string[]>();
    for (const detail of details) {
      const opacity = Number(detail.attributes.opacity),
        band = Math.round(opacity * 8);
      const key = String(band),
        paths = fibers.get(key) ?? [];
      paths.push(String(detail.attributes.d));
      fibers.set(key, paths);
    }
    body.push(
      node(
        "g",
        { "data-solid-detail": material },
        ...[...fibers].map(([band, paths]) =>
          node("path", {
            "data-solid-fiber": band,
            d: paths.join(""),
            fill: "none",
            stroke: mixHex(color, "#fff6e5", Number(band) / 8),
            strokeWidth: 0.7,
            strokeLinecap: "round",
            opacity: 0.65,
          }),
        ),
      ),
    );
  } else if (details.length)
    body.push(node("g", { "data-solid-detail": material }, ...details));
  const eyes: SvgDrawing[] = [];
  for (const [index, eye] of enlargedEyes(frame.eyes, 1.3).entries()) {
    const [a = 1, b = 0, c = 0, d = 1, x = 0, y = 0] = matrixOf(eye.matrix);
    const hw = eye.w / 2,
      hh = eye.h / 2,
      r = Math.min(hw, hh);
    const boundary: Vec3[] = [];
    for (let corner = 0; corner < 4; corner++) {
      const angle = -Math.PI + (corner * Math.PI) / 2;
      const centerX = corner === 0 || corner === 3 ? -hw + r : hw - r;
      const centerY = corner < 2 ? -hh + r : hh - r;
      for (let step = 0; step <= 5; step++) {
        const t = angle + (step * Math.PI) / 10;
        const ex = centerX + Math.cos(t) * r,
          ey = centerY + Math.sin(t) * r;
        const p = s.front(a * ex + c * ey + x, b * ex + d * ey + y);
        if (p) boundary.push(p);
      }
    }
    const center = s.front(x, y);
    if (!center || boundary.length < 3) continue;
    const pieces: string[] = [];
    // Subdivision at the body surface, rather than a tangent billboard, also
    // curves the eye boundary. The depth test hides eyes behind side lobes.
    for (let i = 0; i < boundary.length; i++) {
      const p = boundary[i]!,
        q = boundary[(i + 1) % boundary.length]!;
      for (let band = 0; band < 4; band++) {
        const at = (v: Vec3, k: number): Vec3 => {
          const px = x + (v.x - x) * k,
            py = y + (v.y - y) * k;
          return rotate(s.front(px, py) ?? center);
        };
        const triangle: [Vec3, Vec3, Vec3] = [
          at(p, band / 4),
          at(p, (band + 1) / 4),
          at(q, (band + 1) / 4),
        ];
        const triangles: [Vec3, Vec3, Vec3][] = [triangle];
        if (band) triangles.push([triangle[0], triangle[2], at(q, band / 4)]);
        for (const vertices of triangles) {
          const centroid = {
            x: vertices.reduce((v, p) => v + p.x, 0) / 3,
            y: vertices.reduce((v, p) => v + p.y, 0) / 3,
            z: vertices.reduce((v, p) => v + p.z, 0) / 3,
          };
          if (area(...vertices) > 1e-5 && isVisible(centroid))
            pieces.push(path(vertices));
        }
      }
    }
    if (pieces.length)
      eyes.push(
        node("path", {
          "data-eye": index,
          "data-solid-eye": "",
          d: pieces.join(""),
          opacity: eye.alpha,
          fill: url("eye"),
          stroke: "#fff8df",
          strokeWidth: 0.2,
          strokeLinejoin: "round",
        }),
      );
  }
  return [
    node("defs", {}, ...definitions),
    node(
      "g",
      { "data-body-solid": material, "data-body-depth": "closed-solid" },
      ...body,
      ...eyes,
    ),
  ];
}

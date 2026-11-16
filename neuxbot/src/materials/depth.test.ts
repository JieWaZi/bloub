import { describe, expect, it } from "vitest";
import { BotEngine } from "../bot/engine";
import { SHAPE_BY_ID, type ShapeId } from "../bot/skins";
import { MATERIALS, type Material } from "./catalogue";
import * as drawing from "./drawing";
import type { SvgDrawing } from "./drawing";
import { bodyDepthProjection } from "./depth";

function find(nodes: SvgDrawing[], attribute: string): SvgDrawing[] {
  return nodes.flatMap((node) => [
    ...(attribute in node.attributes ? [node] : []),
    ...find(node.children, attribute),
  ]);
}

function draw(
  shape: ShapeId,
  orientation?: { yaw: number; pitch: number },
  material: Material = "plush",
  state: "idle" | "working" | "waiting-approval" | "unread" = "idle",
) {
  const frame = new BotEngine(100, state, SHAPE_BY_ID.get(shape)!.radii).sample(
    1.6,
  );
  return drawing.avatarDrawing(
    frame,
    material,
    "#8b5cf6",
    "avatar",
    "atlas.png",
    [],
    [],
    "translate(2 -3)",
    shape,
    1.6,
    { bodyOrientation: orientation },
  );
}

const numbers = (value: unknown) =>
  String(value)
    .match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)
    ?.map(Number) ?? [];

function surfaceTriangles(shape: ShapeId, yaw: number, pitch = 0) {
  const frame = new BotEngine(
    100,
    "idle",
    SHAPE_BY_ID.get(shape)!.radii,
  ).sample(0);
  const projection = bodyDepthProjection(shape, frame.silhouette, {
    yaw,
    pitch,
  })!;
  return (projection.surfacePath.match(/M[^Z]+Z/g) ?? []).map((path) => {
    const values = numbers(path);
    return [0, 2, 4].map((index) => ({
      x: values[index]!,
      y: values[index + 1]!,
    }));
  });
}

function inSurface(
  triangles: ReturnType<typeof surfaceTriangles>,
  x: number,
  y: number,
) {
  return triangles.some((triangle) =>
    triangle.every((point, index) => {
      const next = triangle[(index + 1) % 3]!;
      return (
        (next.x - point.x) * (y - point.y) -
          (next.y - point.y) * (x - point.x) >=
        -1e-7
      );
    }),
  );
}

function patchCoverage(
  shape: ShapeId,
  yaw: number,
  pitch: number,
  x: number,
  y: number,
) {
  const frame = new BotEngine(
    100,
    "idle",
    SHAPE_BY_ID.get(shape)!.radii,
  ).sample(0);
  const projection = bodyDepthProjection(shape, frame.silhouette, {
    yaw,
    pitch,
  })!;
  return projection.patches.filter((patch) => {
    const paths = patch.clipPath.match(/M[^Z]+Z/g) ?? [];
    return paths.some((path) => {
      const coordinates = numbers(path);
      const polygon = Array.from(
        { length: coordinates.length / 2 },
        (_, index) => ({
          x: coordinates[index * 2]!,
          y: coordinates[index * 2 + 1]!,
        }),
      );
      return polygon.every((point, index) => {
        const next = polygon[(index + 1) % polygon.length]!;
        return (
          (next.x - point.x) * (y - point.y) -
            (next.y - point.y) * (x - point.x) >
          1e-7
        );
      });
    });
  }).length;
}

describe("body depth projection", () => {
  it("covers each semi-transparent fringe sample once when departing from neutral", () => {
    // Actual plush atlas texel centers: alpha128 at (180,52), alpha64 at
    // (152,53). Painting either more than once changes its visible alpha.
    for (const [x, y] of [
      [180.5, 52.5],
      [152.5, 53.5],
    ]) {
      expect(
        patchCoverage(
          "cercle",
          0.0001,
          0,
          (x! * 316) / 362 - 158,
          (y! * 316) / 362 - 158,
        ),
      ).toBe(1);
    }
  });

  it("resolves genuine concave-cloud occlusion before adding antialiased texture patches", () => {
    expect(
      patchCoverage("nuage", 20, 16, -98.629, -48.381),
    ).toBeLessThanOrEqual(1);
    expect(
      patchCoverage("nuage", -20, -16, -98.629, -48.381),
    ).toBeLessThanOrEqual(1);
  });

  it.each(["idle", "working", "waiting-approval", "unread"] as const)(
    "preserves the exact existing %s drawing when direction is neutral or invalid",
    (state) => {
      for (const material of MATERIALS) {
        const original = draw("nuage", undefined, material, state);
        expect(draw("nuage", { yaw: 0, pitch: 0 }, material, state)).toEqual(
          original,
        );
        expect(
          draw("nuage", { yaw: NaN, pitch: Infinity }, material, state),
        ).toEqual(original);
      }
    },
  );

  it.each(["cercle", "capsule", "triangle", "nuage"] as const)(
    "projects %s texture through a curved surface with distinct local transforms",
    (shape) => {
      const neutral = draw(shape);
      const turned = draw(shape, { yaw: 20, pitch: 12 });
      expect(find(turned, "data-body-depth")).toHaveLength(1);
      const patches = find(turned, "data-depth-triangle");
      expect(patches.length).toBeGreaterThan(24);
      expect(patches.length).toBeLessThan(400);
      const transforms = patches.map((patch) =>
        String(patch.attributes.transform),
      );
      expect(new Set(transforms).size).toBeGreaterThan(24);
      for (const transform of transforms) {
        expect(numbers(transform)).toHaveLength(6);
        expect(numbers(transform).every(Number.isFinite)).toBe(true);
      }
      // Engine gaze already moves the eyes on its sphere; the drawing must not
      // add a second copy of the body yaw/pitch to their positions or tangents.
      expect(find(turned, "data-eye")).toEqual(find(neutral, "data-eye"));
      expect(find(turned, "data-body-material")[0]?.attributes.transform).toBe(
        "translate(2 -3)",
      );
    },
  );

  it("changes the concave cloud outline in all four directions without flattening its lobes", () => {
    const outlines = [
      { yaw: 20, pitch: 0 },
      { yaw: -20, pitch: 0 },
      { yaw: 0, pitch: 16 },
      { yaw: 0, pitch: -16 },
    ].map((orientation) => {
      const projected = find(
        draw("nuage", orientation),
        "data-depth-surface",
      )[0];
      expect(projected).toBeDefined();
      const coordinates = numbers(projected!.attributes.d);
      expect(coordinates.length).toBeGreaterThan(100);
      expect(coordinates.every(Number.isFinite)).toBe(true);
      return projected!.attributes.d;
    });
    expect(new Set(outlines).size).toBe(4);
    expect(
      find(draw("nuage", { yaw: 20, pitch: 0 }), "data-depth-surface")[0]
        ?.attributes.d,
    ).not.toBe(
      find(draw("cercle", { yaw: 20, pitch: 0 }), "data-depth-surface")[0]
        ?.attributes.d,
    );
  });

  it("retains the cloud's inward notch rather than replacing it with a convex hull", () => {
    const triangles = surfaceTriangles("nuage", 20);
    expect(inSurface(triangles, -30, -96)).toBe(true);
    expect(inSurface(triangles, 30, -96)).toBe(true);
    expect(inSurface(triangles, 0, -96)).toBe(false);
  });

  it("reveals volume at the side instead of merely narrowing a flat sprite by cosine", () => {
    const width = (yaw: number) => {
      const xs = surfaceTriangles("cercle", yaw)
        .flat()
        .map(({ x }) => x);
      return Math.max(...xs) - Math.min(...xs);
    };
    const original = width(0.0001);
    const turned = width(20);
    expect(turned).toBeLessThan(original);
    expect(turned).toBeGreaterThan(
      original * Math.cos((20 * Math.PI) / 180) + 3,
    );
  });

  it("uses the same yaw/pitch order as the engine's eye tangent frame", () => {
    const frontCenter = (yaw: number) => {
      const frequency = new Map<string, { y: number; count: number }>();
      for (const point of surfaceTriangles("cercle", yaw, 16).flat()) {
        const key = `${point.x},${point.y}`;
        const entry = frequency.get(key) ?? { y: point.y, count: 0 };
        entry.count++;
        frequency.set(key, entry);
      }
      // Every central fan face shares the front pole. Ring vertices have a
      // smaller valence, so this locates the same material point after rotation.
      return [...frequency.values()].sort((a, b) => b.count - a.count)[0]!.y;
    };
    expect(frontCenter(20)).toBeCloseTo(frontCenter(0), 5);
  });

  it("uses identical geometry for calibrated materials and retains the alpha-edged atlas", () => {
    const drawings = MATERIALS.map((material) =>
      draw("squircle", { yaw: -18, pitch: -14 }, material),
    );
    const reference = drawings[0]!;
    for (const projected of drawings) {
      expect(
        find(projected, "data-depth-triangle").map(
          ({ attributes }) => attributes,
        ),
      ).toEqual(
        find(reference, "data-depth-triangle").map(
          ({ attributes }) => attributes,
        ),
      );
      expect(find(projected, "data-body-sprite")).toHaveLength(1);
      expect(find(projected, "data-texture")[0]?.attributes.href).toBe(
        "atlas.png",
      );
      expect(find(projected, "data-body")[0]?.attributes.opacity).toBe(0);
      expect(find(projected, "data-eye")).toEqual(find(reference, "data-eye"));
    }
  });

  it("keeps collapsing and extreme but finite inputs finite", () => {
    const frame = new BotEngine(
      100,
      "idle",
      SHAPE_BY_ID.get("nuage")!.radii,
    ).sample(0);
    for (const radii of [
      frame.silhouette.radii.map(() => 0),
      frame.silhouette.radii.map(() => 0.001),
    ]) {
      const nodes = drawing.avatarDrawing(
        { ...frame, silhouette: { ...frame.silhouette, radii } },
        "plush",
        "#8b5cf6",
        "avatar",
        "atlas.png",
        [],
        [],
        undefined,
        "nuage",
        0,
        { bodyOrientation: { yaw: 1e20, pitch: -1e20 } },
      );
      expect(JSON.stringify(nodes)).not.toMatch(/NaN|Infinity/);
    }
  });

  it("draws the untextured fallback as one continuous surface without unused texture patches", () => {
    const frame = new BotEngine(
      100,
      "idle",
      SHAPE_BY_ID.get("nuage")!.radii,
    ).sample(0);
    const nodes = drawing.avatarDrawing(
      frame,
      "plush",
      "#8b5cf6",
      "avatar",
      undefined,
      [],
      [],
      undefined,
      "nuage",
      0,
      { bodyOrientation: { yaw: 20, pitch: 16 } },
    );
    expect(find(nodes, "data-body")[0]?.attributes.opacity).toBe(1);
    expect(find(nodes, "data-depth-surface")).toHaveLength(1);
    expect(find(nodes, "data-body-sprite")).toHaveLength(0);
    expect(find(nodes, "data-depth-triangle")).toHaveLength(0);
  });
});

describe("pointer orientation", () => {
  const bounds = { left: 10, top: 20, width: 100, height: 80 };
  it("normalizes cardinal positions around the body using a two-width radius", () => {
    expect(drawing.pointerOrientation).toBeTypeOf("function");
    expect(drawing.pointerOrientation(bounds, { x: 60, y: 60 })).toEqual({
      yaw: 0,
      pitch: 0,
    });
    expect(drawing.pointerOrientation(bounds, { x: 260, y: 60 })).toEqual({
      yaw: 20,
      pitch: 0,
    });
    expect(drawing.pointerOrientation(bounds, { x: -140, y: 60 })).toEqual({
      yaw: -20,
      pitch: 0,
    });
    expect(drawing.pointerOrientation(bounds, { x: 60, y: -140 })).toEqual({
      yaw: 0,
      pitch: 16,
    });
    expect(drawing.pointerOrientation(bounds, { x: 60, y: 260 })).toEqual({
      yaw: 0,
      pitch: -16,
    });
    expect(drawing.pointerOrientation(bounds, { x: 1e4, y: -1e4 })).toEqual({
      yaw: 20,
      pitch: 16,
    });
  });

  it("returns neutral after pointer exit or an unmeasured/nonfinite box", () => {
    expect(drawing.pointerOrientation).toBeTypeOf("function");
    for (const badBounds of [
      { ...bounds, width: 0 },
      { ...bounds, height: 0 },
      { ...bounds, left: NaN },
      { ...bounds, top: Infinity },
    ]) {
      expect(drawing.pointerOrientation(badBounds, { x: 260, y: 60 })).toEqual({
        yaw: 0,
        pitch: 0,
      });
    }
    expect(drawing.pointerOrientation(bounds, null)).toEqual({
      yaw: 0,
      pitch: 0,
    });
    expect(drawing.pointerOrientation(bounds, { x: NaN, y: 0 })).toEqual({
      yaw: 0,
      pitch: 0,
    });
  });
});

describe("orientation damping", () => {
  it("uses elapsed time so equivalent 30/60/120Hz intervals converge identically", () => {
    expect(drawing.dampOrientation).toBeTypeOf("function");
    const neutral = { yaw: 0, pitch: 0 };
    const target = { yaw: 20, pitch: -16 };
    const once = drawing.dampOrientation(neutral, target, 0.11);
    expect(once.yaw).toBeCloseTo(12.642411, 5);
    expect(once.pitch).toBeCloseTo(-10.113929, 5);
    for (const hz of [30, 60, 120]) {
      let current = neutral;
      for (let step = 0; step < hz; step++)
        current = drawing.dampOrientation(current, target, 1 / hz);
      expect(current.yaw).toBeCloseTo(20, 2);
      expect(current.pitch).toBeCloseTo(-16, 2);
    }
    const twice = drawing.dampOrientation(
      drawing.dampOrientation(neutral, target, 0.055),
      target,
      0.055,
    );
    expect(twice.yaw).toBeCloseTo(once.yaw, 12);
    expect(twice.pitch).toBeCloseTo(once.pitch, 12);
  });

  it("holds for invalid elapsed time and snaps the return to exact neutral", () => {
    expect(drawing.dampOrientation).toBeTypeOf("function");
    const current = { yaw: 8, pitch: -6 };
    for (const elapsed of [0, -1, NaN, Infinity]) {
      expect(
        drawing.dampOrientation(current, { yaw: 20, pitch: 16 }, elapsed),
      ).toEqual(current);
    }
    expect(
      drawing.dampOrientation(
        { yaw: 0.001, pitch: -0.001 },
        { yaw: 0, pitch: 0 },
        0.016,
      ),
    ).toEqual({ yaw: 0, pitch: 0 });
  });
});

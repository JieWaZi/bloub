import { describe, expect, it } from "vitest";
import { SHAPES } from "../bot/skins";
import { circle } from "../bot/shape";
import * as solid from "./solid";

describe("closed avatar volume", () => {
  it("has a watertight manifold for every shape, rather than two textured sheets", () => {
    expect(solid.buildSolidGeometry).toBeTypeOf("function");
    for (const shape of SHAPES) {
      const mesh = solid.buildSolidGeometry(shape.id, {
        ...circle(1),
        radii: shape.radii,
      });
      const edges = new Map<string, number>();
      for (const face of mesh.faces)
        for (let i = 0; i < 3; i++) {
          const a = face[i]!,
            b = face[(i + 1) % 3]!;
          const key = [a, b].sort((x, y) => x - y).join(":");
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      expect(
        [...edges.values()].every((count) => count === 2),
        shape.id,
      ).toBe(true);
      expect(
        mesh.vertices.every((p) => [p.x, p.y, p.z].every(Number.isFinite)),
      ).toBe(true);
      expect(Math.max(...mesh.vertices.map((p) => p.z))).toBeGreaterThan(40);
      expect(Math.min(...mesh.vertices.map((p) => p.z))).toBeLessThan(-40);
    }
  });

  it("preserves a filled side and rear body and hides front eyes behind the body", () => {
    expect(solid.solidAvatarDrawing).toBeTypeOf("function");
    const frame = {
      silhouette: { ...circle(1), radii: Array(64).fill(1) },
      eyes: [
        {
          d: "",
          matrix: "matrix(1,0,0,1,-27,0)",
          w: 18,
          h: 40,
          alpha: 1,
          open: 1,
          rest: 1,
        },
        {
          d: "",
          matrix: "matrix(1,0,0,1,27,0)",
          w: 18,
          h: 40,
          alpha: 1,
          open: 1,
          rest: 1,
        },
      ],
    };
    const flatten = (
      nodes: ReturnType<typeof solid.solidAvatarDrawing>,
    ): typeof nodes => nodes.flatMap((n) => [n, ...flatten(n.children)]);
    for (const yaw of [0, 90, 180, 270, 360]) {
      const drawing = flatten(
        solid.solidAvatarDrawing(
          frame,
          "balloon",
          "#8b5cf6",
          "test",
          { yaw, pitch: 0 },
          0,
        ),
      );
      expect(
        drawing.some(
          (n) => n.attributes["data-solid-silhouette"] !== undefined,
        ),
      ).toBe(true);
      expect(
        drawing
          .filter((n) => n.attributes["data-solid-face"] !== undefined)
          .reduce(
            (sum, n) => sum + String(n.attributes.d).split("M").length - 1,
            0,
          ),
      ).toBeGreaterThan(100);
      expect(drawing.some((n) => n.tag === "image" || n.tag === "use")).toBe(
        false,
      );
      const eyes = drawing.filter(
        (n) => n.attributes["data-eye"] !== undefined,
      );
      if (yaw === 0 || yaw === 360) expect(eyes).toHaveLength(2);
      if (yaw === 180) expect(eyes).toHaveLength(0);
    }
  });
});

import { BotEngine } from "../bot/engine";
import { MATERIALS } from "./catalogue";
import { avatarDrawing, type SvgDrawing } from "./drawing";
const allNodes = (nodes: SvgDrawing[]): SvgDrawing[] =>
  nodes.flatMap((n) => [n, ...allNodes(n.children)]);
const select = (nodes: SvgDrawing[], attribute: string) =>
  allNodes(nodes).filter((n) => attribute in n.attributes);

describe("complete material rendering", () => {
  it("uses the same complete geometry and curved eyes for all three materials at rest and while turned", () => {
    for (const shape of SHAPES)
      for (const orientation of [
        { yaw: 0, pitch: 0 },
        { yaw: 35, pitch: -28 },
        { yaw: 110, pitch: 45 },
        { yaw: 180, pitch: 0 },
      ]) {
        const frame = new BotEngine(100, "idle", shape.radii).sample(0.3);
        const drawings = MATERIALS.map((material) =>
          avatarDrawing(
            frame,
            material,
            "#8b5cf6",
            "test",
            undefined,
            [],
            [],
            undefined,
            shape.id,
            0,
            { bodyOrientation: orientation },
          ),
        );
        for (const drawing of drawings) {
          expect(
            select(drawing, "data-solid-silhouette")[0]?.attributes.d,
          ).toEqual(
            select(drawings[0]!, "data-solid-silhouette")[0]?.attributes.d,
          );
          expect(select(drawing, "data-eye")).toEqual(
            select(drawings[0]!, "data-eye"),
          );
          expect(JSON.stringify(drawing)).not.toMatch(/NaN|Infinity/);
          expect(allNodes(drawing).length).toBeLessThan(300);
        }
        if (orientation.yaw === 0)
          expect(select(drawings[0]!, "data-eye"), shape.id).toHaveLength(2);
        if (orientation.yaw === 180)
          expect(select(drawings[0]!, "data-eye"), shape.id).toHaveLength(0);
      }
  });

  it("covers visible side and rear surfaces with fibers or luminous particles instead of a blank back", () => {
    const frame = new BotEngine(100, "idle").sample(0.3);
    for (const yaw of [0, 90, 180, 270]) {
      const plush = avatarDrawing(
        frame,
        "plush",
        "#8b5cf6",
        "test",
        undefined,
        [],
        [],
        undefined,
        "cercle",
        0,
        { bodyOrientation: { yaw, pitch: 15 } },
      );
      const particles = avatarDrawing(
        frame,
        "particles",
        "#8b5cf6",
        "test",
        undefined,
        [],
        [],
        undefined,
        "cercle",
        0,
        { bodyOrientation: { yaw, pitch: 15 } },
      );
      expect(
        select(plush, "data-solid-fiber").reduce(
          (sum, n) => sum + String(n.attributes.d).split("M").length - 1,
          0,
        ),
      ).toBeGreaterThan(100);
      expect(
        select(particles, "data-material-particle").length,
      ).toBeGreaterThan(80);
    }
  });
});

it("resolves concave side-lobe visibility before combining material shades", () => {
  const frame = new BotEngine(
    100,
    "idle",
    SHAPES.find((shape) => shape.id === "nuage")!.radii,
  ).sample(0.3);
  // Independently raycast against the indexed closed mesh. These locations were
  // previously overpainted by brighter, more distant cloud lobes.
  for (const [yaw, x, y, shade] of [
    [90, -98, -22, 25],
    [90, -98, -18, 24],
    [90, 30, -94, 18],
    [110, -90, -18, 19],
    [110, -86, -38, 25],
    [110, -82, -46, 24],
    [110, -78, -54, 26],
  ]) {
    const drawing = avatarDrawing(
      frame,
      "balloon",
      "#8b5cf6",
      "test",
      undefined,
      [],
      [],
      undefined,
      "nuage",
      0,
      { bodyOrientation: { yaw: yaw!, pitch: 35 } },
    );
    const covering = select(drawing, "data-solid-face").filter((n) =>
      String(n.attributes.d)
        .split("M")
        .slice(1)
        .some((part) => {
          const values = (part.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
          const points = Array.from({ length: values.length / 2 }, (_, i) => ({
            x: values[i * 2]!,
            y: values[i * 2 + 1]!,
          }));
          return points.every((a, i) => {
            const b = points[(i + 1) % points.length]!;
            return (b.x - a.x) * (y! - a.y) - (b.y - a.y) * (x! - a.x) >= 0;
          });
        }),
    );
    expect(
      covering.at(-1)?.attributes["data-solid-face"],
      `yaw ${yaw}, sample ${x},${y}`,
    ).toBe(shade);
  }
});

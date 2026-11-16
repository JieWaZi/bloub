import { describe, expect, it } from "vitest";
import { BotEngine } from "../bot/engine";
import { SHAPES, SHAPE_BY_ID, type ShapeId } from "../bot/skins";
import { MATERIALS, type Material } from "./catalogue";
import { avatarDrawing, type SvgDrawing } from "./drawing";

function find(nodes: SvgDrawing[], attribute: string): SvgDrawing[] {
  return nodes.flatMap((node) => [
    ...(attribute in node.attributes ? [node] : []),
    ...find(node.children, attribute),
  ]);
}

function draw(shape: ShapeId, material: Material, yaw: number, pitch: number) {
  const frame = new BotEngine(
    100,
    "idle",
    SHAPE_BY_ID.get(shape)!.radii,
  ).sample(0);
  return avatarDrawing(
    frame,
    material,
    "#38bdf8",
    "avatar",
    undefined,
    [],
    [],
    undefined,
    shape,
    0,
    { bodyOrientation: { yaw, pitch } },
  );
}

describe("材质身体布局", () => {
  it.each(SHAPES.map(({ id }) => id))(
    "%s 的三种实体材质共用身体轮廓和眼睛投影",
    (shape) => {
      for (const [yaw, pitch] of [
        [0, 0],
        [32, -18],
      ] as const) {
        const reference = draw(shape, "plush", yaw, pitch);
        const silhouette = find(reference, "data-solid-silhouette");
        const eyes = find(reference, "data-eye");
        expect(silhouette).toHaveLength(1);
        expect(silhouette[0]!.attributes.d).toMatch(/^M.*Z$/);
        expect(eyes).toHaveLength(2);
        for (const material of MATERIALS) {
          const drawing = draw(shape, material, yaw, pitch);
          expect(find(drawing, "data-solid-silhouette")).toEqual(silhouette);
          expect(find(drawing, "data-eye")).toEqual(eyes);
        }
      }
    },
  );

  it.each(["idle", "thinking", "working", "waiting-answer", "unread"] as const)(
    "%s 的动作、眨眼和通知沿用共同坐标",
    (state) => {
      const engine = new BotEngine(
        100,
        state,
        SHAPE_BY_ID.get("squircle")!.radii,
      );
      for (const time of [0.1, 1.4, 3]) {
        const frame = engine.sample(time);
        const drawings = MATERIALS.map((material) =>
          avatarDrawing(
            frame,
            material,
            "#38bdf8",
            "avatar",
            undefined,
            [],
            [],
            "translate(10 -6) rotate(8)",
            "squircle",
            time,
          ),
        );
        const reference = drawings[0]!;
        for (const drawing of drawings) {
          for (const attribute of [
            "data-solid-silhouette",
            "data-eye",
            "data-native-dot",
            "data-native-attention",
            "data-native-attention-cut",
            "data-native-attention-outline",
          ]) {
            expect(find(drawing, attribute)).toEqual(
              find(reference, attribute),
            );
          }
          expect(
            find(drawing, "data-body-material")[0]?.attributes.transform,
          ).toBe("translate(10 -6) rotate(8)");
        }
      }
    },
  );
});

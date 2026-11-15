import { describe, expect, it } from "vitest";
import { BotEngine } from "../bot/engine";
import { SHAPE_BY_ID, type ShapeId } from "../bot/skins";
import { MATERIALS, type Material } from "./catalogue";
import { avatarDrawing, type SvgDrawing } from "./drawing";

// 图集 alpha > 100 的实测边界（含端点）；用实际输出图格验收身体尺寸和中心。
const measured = [
  ["cercle", [52, 52, 301, 304], [66, 66, 294, 295], [66, 66, 295, 295]],
  ["galet", [43, 74, 296, 291], [65, 82, 293, 283], [66, 83, 293, 283]],
  ["squircle", [41, 61, 287, 299], [70, 70, 290, 291], [71, 71, 290, 290]],
  ["capsule", [32, 98, 296, 263], [62, 109, 299, 252], [62, 110, 299, 251]],
  ["triangle", [45, 27, 305, 264], [66, 52, 297, 265], [64, 52, 297, 264]],
  ["hexagone", [39, 38, 306, 280], [62, 73, 298, 288], [62, 74, 299, 287]],
  ["nuage", [35, 55, 293, 277], [69, 91, 290, 283], [69, 92, 290, 283]],
  ["carre", [40, 37, 289, 282], [75, 75, 286, 286], [76, 76, 285, 285]],
  ["losange", [35, 16, 313, 299], [50, 50, 310, 310], [50, 50, 311, 311]],
  ["pentagone", [37, 23, 306, 282], [62, 57, 298, 287], [62, 58, 299, 287]],
] as const;

type Bounds = readonly [number, number, number, number];
function find(nodes: SvgDrawing[], attribute: string): SvgDrawing[] {
  return nodes.flatMap((node) => [
    ...(attribute in node.attributes ? [node] : []),
    ...find(node.children, attribute),
  ]);
}
function warpMatrices(nodes: SvgDrawing[]): SvgDrawing["attributes"][] {
  return nodes.flatMap((node) => [
    ...(node.tag === "use" ? [node.attributes] : []),
    ...warpMatrices(node.children),
  ]);
}
function draw(shape: ShapeId, material: Material) {
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
    "atlas.png",
    [],
    [],
    undefined,
    shape,
  );
}
function visibleBounds(drawing: SvgDrawing[], bounds: Bounds) {
  const sprite = find(drawing, "data-body-sprite")[0]!.attributes;
  const x = Number(sprite.x),
    y = Number(sprite.y);
  const width = Number(sprite.width),
    height = Number(sprite.height);
  return [
    x + (bounds[0] * width) / 362,
    y + (bounds[1] * height) / 362,
    x + ((bounds[2] + 1) * width) / 362,
    y + ((bounds[3] + 1) * height) / 362,
  ];
}

describe("材质身体布局", () => {
  it.each(measured)(
    "%s 的三种身体在同一视域中大小、中心一致，眼睛不移动",
    (shape, plush, particles, balloon) => {
      const reference = draw(shape, "plush");
      const target = visibleBounds(reference, plush);
      for (const [material, bounds] of [
        ["particles", particles],
        ["balloon", balloon],
      ] as const) {
        const drawing = draw(shape, material);
        visibleBounds(drawing, bounds).forEach((value, index) => {
          expect(value).toBeCloseTo(target[index]!, 8);
        });
        expect(find(drawing, "data-eye")).toEqual(find(reference, "data-eye"));
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
            "atlas.png",
            [],
            [],
            "translate(10 -6) rotate(8)",
            "squircle",
            time,
          ),
        );
        const reference = drawings[0]!;
        for (const drawing of drawings.slice(1)) {
          for (const attribute of [
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
          // 校准位于径向形变之前，形变矩阵仍由原生引擎统一给出。
          expect(
            find(drawing, "data-body-warp").map((node) => node.attributes),
          ).toEqual(
            find(reference, "data-body-warp").map((node) => node.attributes),
          );
          expect(warpMatrices(drawing)).toEqual(warpMatrices(reference));
        }
      }
    },
  );
});

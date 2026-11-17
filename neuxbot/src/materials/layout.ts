import type { Material } from "./catalogue";
import type { ShapeId } from "../bot/skins";
import type { SvgDrawing } from "./drawing";

type Bounds = readonly [number, number, number, number];

// 当前 362px 图格中 alpha > 100 的可见边界（含端点），不计稀疏微尘。
// 所有材质匹配毛绒主体尺寸，并将可见边界居中于原生坐标；不移动面部或外层视域。
type BodyLayout = Record<Material, Bounds> & {
  /** 各材质共同使用的主体尺寸，独立于图集留白与新旧素材。 */
  size: readonly [number, number];
};

const bodyLayouts: Partial<Record<ShapeId, BodyLayout>> = {
  cercle: {
    size: [250, 253],
    plush: [54, 60, 300, 307],
    particles: [66, 66, 294, 295],
    balloon: [66, 66, 295, 295],
  },
  galet: {
    size: [254, 218],
    plush: [46, 74, 298, 298],
    particles: [65, 82, 293, 283],
    balloon: [66, 83, 293, 283],
  },
  squircle: {
    size: [247, 239],
    plush: [52, 61, 302, 305],
    particles: [70, 70, 290, 291],
    balloon: [71, 71, 290, 290],
  },
  capsule: {
    size: [265, 166],
    plush: [42, 104, 305, 267],
    particles: [62, 109, 299, 252],
    balloon: [62, 110, 299, 251],
  },
  triangle: {
    size: [261, 238],
    plush: [49, 53, 307, 288],
    particles: [66, 52, 297, 265],
    balloon: [64, 52, 297, 264],
  },
  hexagone: {
    size: [268, 243],
    plush: [42, 61, 307, 304],
    particles: [62, 73, 298, 288],
    balloon: [62, 74, 299, 287],
  },
  nuage: {
    size: [259, 223],
    plush: [43, 81, 305, 302],
    particles: [69, 91, 290, 283],
    balloon: [69, 92, 290, 283],
  },
  carre: {
    size: [250, 246],
    plush: [53, 62, 304, 304],
    particles: [75, 75, 286, 286],
    balloon: [76, 76, 285, 285],
  },
  losange: {
    size: [279, 284],
    plush: [41, 40, 315, 314],
    particles: [50, 50, 310, 310],
    balloon: [50, 50, 311, 311],
  },
  pentagone: {
    size: [270, 260],
    plush: [42, 44, 309, 302],
    particles: [62, 57, 298, 287],
    balloon: [62, 58, 299, 287],
  },
};

/** 在原生形变之前校准图格，保持眼睛、眨眼和动作坐标不受材质影响。 */
export function alignMaterialDrawing(
  drawing: SvgDrawing[],
  material: Material,
  shape: ShapeId,
): SvgDrawing[] {
  const layout = bodyLayouts[shape];
  if (!layout) return drawing;
  const source = layout[material];
  const sx = layout.size[0] / (source[2] - source[0] + 1);
  const sy = layout.size[1] / (source[3] - source[1] + 1);
  const center = (min: number, max: number) =>
    (((min + max + 1) / 2 - 181) * 316) / 362;
  // 每种图集都可能有不对称留白，目标中心始终为原生坐标原点。
  const x = -center(source[0], source[2]) * sx;
  const y = -center(source[1], source[3]) * sy;
  const align = (node: SvgDrawing): SvgDrawing => ({
    ...node,
    attributes:
      node.attributes["data-body-sprite"] !== undefined
        ? {
            ...node.attributes,
            x: -158 * sx + x,
            y: -158 * sy + y,
            width: 316 * sx,
            height: 316 * sy,
          }
        : node.attributes["data-particle-layer"] !== undefined
          ? {
              ...node.attributes,
              transform: `translate(${x},${y}) scale(${sx},${sy})`,
            }
          : node.attributes,
    children: node.children.map(align),
  });
  return drawing.map(align);
}

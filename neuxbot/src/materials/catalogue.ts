import sprites from "../../materials/sprites.json";
/** 身体材质共用形状和原生形变；软胶由库内着色器准备完整彩色图集。 */
export const MATERIALS = ["plush", "particles", "balloon"] as const;
export type Material = (typeof MATERIALS)[number];
export const PALETTE = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#38bdf8",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#e152b0",
  "#f472b6",
  "#a8324e",
  "#8b5e3c",
  "#d6b98c",
  "#a3a3a3",
] as const;
export const DEFAULT_COLOR = "#8b5cf6";
export const TEXTURES: Record<Material, string> = {
  plush: new URL("../../materials/body-plush.png", import.meta.url).href,
  particles: new URL("../../materials/body-particles.svg", import.meta.url)
    .href,
  balloon: new URL("../../materials/body-balloon.svg", import.meta.url).href,
};
export const BODY_SHAPES = sprites.shapes;
export const BODY_COLUMNS = sprites.columns;
export const BODY_ROWS = sprites.rows;

export const BODY_SPRITES = sprites.materials;

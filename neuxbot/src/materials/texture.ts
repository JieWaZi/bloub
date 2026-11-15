import { TEXTURES, type Material } from "./catalogue";
import { tinted } from "../plush/tint";

/** 材质自行拥有纹理准备；宿主仅等待完整图集并控制显示交接。 */
export function materialTexture(
  material: Material,
  color: string,
): Promise<string> {
  const source = TEXTURES[material];
  return material === "balloon"
    ? import("./balloon-renderer.js").then(({ bakeBalloonMaterial }) =>
        bakeBalloonMaterial(source, color),
      )
    : tinted(source, color);
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MATERIALS, TEXTURES } from "./catalogue";
import { materialTexture } from "./texture";

const mocks = vi.hoisted(() => ({ tinted: vi.fn(), balloon: vi.fn() }));
vi.mock("../plush/tint", () => ({ tinted: mocks.tinted }));
vi.mock("./balloon-renderer.js", () => ({
  bakeBalloonMaterial: mocks.balloon,
}));
beforeEach(() => vi.clearAllMocks());

describe("材质纹理入口", () => {
  it("目录包含毛绒、粒子与软胶，软胶不经过灰度换色而保留白色高光", async () => {
    expect(MATERIALS).toEqual(["plush", "particles", "balloon"]);
    mocks.balloon.mockResolvedValue("data:image/png;base64,balloon");
    await expect(materialTexture("balloon", "#22c55e")).resolves.toBe(
      "data:image/png;base64,balloon",
    );
    expect(mocks.balloon).toHaveBeenCalledExactlyOnceWith(
      TEXTURES.balloon,
      "#22c55e",
    );
    expect(mocks.tinted).not.toHaveBeenCalled();
  });
  it.each(["plush", "particles"] as const)(
    "%s 沿用既有图集换色入口",
    async (material) => {
      mocks.tinted.mockResolvedValue("data:image/webp;base64,original");
      await expect(materialTexture(material, "#8b5cf6")).resolves.toBe(
        "data:image/webp;base64,original",
      );
      expect(mocks.tinted).toHaveBeenCalledExactlyOnceWith(
        TEXTURES[material],
        "#8b5cf6",
      );
      expect(mocks.balloon).not.toHaveBeenCalled();
    },
  );
});

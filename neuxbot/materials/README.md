# 通用头像身体图集

[body-plush.png](body-plush.png) 与 [body-particles.svg](body-particles.svg) 是完整立体身体图集。每张采用 4 列 × 3 行等大方格，按行排列 10 种几何形状，末尾两格不放置身体。每个身体包含凸起前表面、圆润侧缘、左上柔光与右下自身暗部，无面部、肢体或地面投影。

| 文件                                     | 用途                     | 实际尺寸    | 仓库输出路径                                |
| ---------------------------------------- | ------------------------ | ----------- | ------------------------------------------- |
| [body-template.png](body-template.png)   | 原创几何轮廓与布局指导图 | 1264 × 948  | `vendor/bloub/materials/body-template.png`  |
| [body-plush.png](body-plush.png)         | 中灰细短毛绒身体         | 1448 × 1086 | `vendor/bloub/materials/body-plush.png`     |
| [body-particles.svg](body-particles.svg) | 中性灰银发光粒子身体     | 1448 × 1086 | `vendor/bloub/materials/body-particles.svg` |

[sprites.json](sprites.json) 记录图集尺寸、行列与形状顺序。10 种形状依次为 `cercle`、`galet`、`squircle`、`capsule`、`triangle`、`hexagone`、`nuage`、`carre`、`losange`、`pentagone`。渲染器按格显示完整身体，保留绒毛和粒子边缘；颜色可以根据身体的中灰明暗映射。

`visualScale` 只补偿显示时的视觉体积，不改变图集或头像布局槽：毛绒为 1，粒子为 1.2。粒子微尘透明度使同样边界的可见面积较小，整体视域放大 20% 后，身体、眼睛和状态动作仍保持相同比例。

粒子材质是由三维球内细光尘投影生成的原生 SVG 图集。核心因前后光点叠加而浓密，边缘自然稀疏；光照按深度和左上方向计算，没有实心表面、珍珠或凸点基底。微点按深度、明暗、透明度和直径合批为路径，经过已有换色与缓存链路只解码一次，不在运行时逐点创建 React 节点。[effects.ts](../src/materials/effects.ts) 只补少量细光点，以调用方已有绘图时钟缓慢漂移和闪烁；128px 头像中的单点直径小于 1px。[drawing.ts](../src/materials/drawing.ts) 保留图集正常透明度和径向形变，最后绘制眼睛，不擦除眼睛周围的细点。毛绒继续直接使用原始完整图集。

重新生成与检查：

```sh
node vendor/bloub/tools/generate-particle-atlas.mjs
node vendor/bloub/tools/generate-particle-atlas.mjs --check
```

[生成脚本](../tools/generate-particle-atlas.mjs) 直接读取现有 `SHAPES`、固定随机种子和 [sprites.json](sprites.json)，不依赖第三方图像素材或新增运行库。SVG 的物理尺寸为 1448 × 1086，内部坐标为 1264 × 948，与现有图格比例一致；末尾两格不生成任何内容。生成文件不手工编辑。

## 来源与检查

几何指导图使用项目 `BotEngine(100, 'idle', shape.radii, null).sample(1.4).bodyPath` 绘制，形状取 [skins.ts](../src/bot/skins.ts) 的 `SHAPES` 并排除 `goutte`。使用项目已有 esbuild 与 `@napi-rs/canvas`，每格 316 × 316，原点平移到格内 `(158, 158)`，只填充中性灰前凸渐变，不绘制眼睛。

毛绒身体通过 built-in `image_gen` 编辑几何指导图生成，`transparent_background` 为 `true`，PNG 为工具交付原件的逐字节副本，未做像素编辑、裁切或缩放。粒子图集由上述原生脚本生成，没有采用图像生成结果或旧系统专属角色轮廓。

离线静态预览按实际图集、换色和眼睛绘图链路合成，检查橙色、玫粉和紫色在浅／暗背景下的 32、56、128px 表现，以及无眼睛的表面覆盖。该检查不代表运行中应用或真实平台的视觉验收。粒子图集使用真实透明背景，没有底色矩形，未生成形状之外的空格也没有路径。

## 完整生成提示词

### body-plush.png

```text
Use case: style-transfer
Edit the attached original geometry template into a clean transparent sprite atlas. Preserve the exact 4-column × 3-row layout, 4:3 canvas, the ten gray silhouettes' shapes, centers and sizes, and the two empty bottom-right cells. Each shape remains in its own cell with wide empty spacing. The template's alpha mask is authoritative: do not add anything at all outside the ten body silhouettes except a 1–2 pixel natural fur fringe directly touching the contour. Completely transparent padding, including every pixel of the two empty cells; actual RGBA zero-alpha, no backdrop.
Replace each gray body with a thick, plump, fully three-dimensional short soft plush body in neutral medium gray, around RGB 140. Dense fine soft furry tufts bend around the inflated convex front and thick rolled sides; a tiny neat soft fur fringe follows the contour. Strict front orthographic view. Soft upper-left studio illumination, gentle light-gray front highlights, clearly darker gray lower-right self-shadows, natural fine material detail and strong rounded volume, like a premium tactile sculpted toy. Every body's interior is solid and fully opaque, not a translucent texture. Original materials, no existing character reference.
Critical edge treatment: no white outer border, no white patches sticking out, no edge glow, no bloom, no light haze, no white fringe matte, no floating specks. Edge fibers/leaves use the body's own mid-gray color and dark self-shadow, never white halos. Do not depict a floor or any cast shadow. No eyes, mouth, face, nose, limbs, letters, text, outlines, frames, grid lines or labels. Do not paint a black, white, gray or checkerboard background. Output only the ten shaded bodies on real alpha transparency.
```

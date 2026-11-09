# 通用头像身体图集

[body-plush.png](body-plush.png) 与 [body-particles.png](body-particles.png) 是完整立体身体图集。每张采用 4 列 × 3 行等大方格，按行排列 10 种几何形状，末尾两格不放置身体。每个身体包含凸起前表面、圆润侧缘、左上柔光与右下自身暗部，无面部、肢体或地面投影。

| 文件 | 用途 | 实际尺寸 | 仓库输出路径 |
| --- | --- | --- | --- |
| [body-template.png](body-template.png) | 原创几何轮廓与布局指导图 | 1264 × 948 | `vendor/bloub/materials/body-template.png` |
| [body-plush.png](body-plush.png) | 中灰细短毛绒身体 | 1448 × 1086 | `vendor/bloub/materials/body-plush.png` |
| [body-particles.png](body-particles.png) | 中性灰银发光粒子身体 | 1448 × 1086 | `vendor/bloub/materials/body-particles.png` |

[sprites.json](sprites.json) 记录图集尺寸、行列与形状顺序。10 种形状依次为 `cercle`、`galet`、`squircle`、`capsule`、`triangle`、`hexagone`、`nuage`、`carre`、`losange`、`pentagone`。渲染器按格显示完整身体，保留绒毛和粒子边缘；颜色可以根据身体的中灰明暗映射。

## 来源与检查

几何指导图使用项目 `BotEngine(100, 'idle', shape.radii, null).sample(1.4).bodyPath` 绘制，形状取 [skins.ts](../src/bot/skins.ts) 的 `SHAPES` 并排除 `goutte`。使用项目已有 esbuild 与 `@napi-rs/canvas`，每格 316 × 316，原点平移到格内 `(158, 158)`，只填充中性灰前凸渐变，不绘制眼睛。

两种身体分别通过 built-in `image_gen` 编辑指导图生成，`transparent_background` 为 `true`。毛绒仅引用指导图；粒子额外引用用户自有旧系统的材质参考，仅借鉴闪烁粒子密度与半透明发光体积，形状、排布和占格尺寸仍只由指导图决定，不采用参考中的专属身体轮廓或肢体。不使用第三方角色或毛绒素材，不使用生成 CLI。仓库 PNG 是工具交付原件的逐字节副本，未做像素编辑、裁切或缩放。

逐张检查了形状顺序、布局、无面部与立体材质；使用正常 alpha 合成的静态预览检查了背景下的边缘和空白区域，粒子同时检查了浅灰与深灰背景。原件有真实透明通道，无可见背景；生成工具在空白区域保留少量接近零的 alpha 噪点，两种图集末尾空格的最大 alpha 均为 1/255，未对原件做阈值处理。

## 完整生成提示词

### body-plush.png

```text
Use case: style-transfer
Edit the attached original geometry template into a clean transparent sprite atlas. Preserve the exact 4-column × 3-row layout, 4:3 canvas, the ten gray silhouettes' shapes, centers and sizes, and the two empty bottom-right cells. Each shape remains in its own cell with wide empty spacing. The template's alpha mask is authoritative: do not add anything at all outside the ten body silhouettes except a 1–2 pixel natural fur fringe directly touching the contour. Completely transparent padding, including every pixel of the two empty cells; actual RGBA zero-alpha, no backdrop.
Replace each gray body with a thick, plump, fully three-dimensional short soft plush body in neutral medium gray, around RGB 140. Dense fine soft furry tufts bend around the inflated convex front and thick rolled sides; a tiny neat soft fur fringe follows the contour. Strict front orthographic view. Soft upper-left studio illumination, gentle light-gray front highlights, clearly darker gray lower-right self-shadows, natural fine material detail and strong rounded volume, like a premium tactile sculpted toy. Every body's interior is solid and fully opaque, not a translucent texture. Original materials, no existing character reference.
Critical edge treatment: no white outer border, no white patches sticking out, no edge glow, no bloom, no light haze, no white fringe matte, no floating specks. Edge fibers/leaves use the body's own mid-gray color and dark self-shadow, never white halos. Do not depict a floor or any cast shadow. No eyes, mouth, face, nose, limbs, letters, text, outlines, frames, grid lines or labels. Do not paint a black, white, gray or checkerboard background. Output only the ten shaded bodies on real alpha transparency.
```

### body-particles.png

```text
Use case: style-transfer
Asset: transparent PNG sprite atlas, exactly 4 columns by 3 rows, 4:3 canvas, ten original volumetric geometric avatar bodies and two empty cells.
INPUT ROLES: Image 1 is the ONLY geometry, silhouette, pose, scale and layout target. Preserve all ten gray silhouettes, their exact cell centers and sizes and the two empty bottom-right cells from image 1. Image 2 is the user's own old-system MATERIAL REFERENCE ONLY: borrow only the density of sparkling tiny particles and the softly luminous semi-translucent volumetric surface. Completely ignore image 2's body outline, feet, arms, character identity and pink color. Do not transfer any shape or anatomy from image 2.
Edit the ten shapes in image 1 into full thick rounded particle bodies. Row 1 remains circle, irregular smooth pebble, squircle, horizontal capsule. Row 2 remains rounded upright triangle, rounded hexagon, irregular rounded cloud, rounded square. Row 3 remains rounded diamond, rounded pentagon, empty, empty. Strict front orthographic view, generous transparent padding and identical source occupancy within every cell.
MATERIAL: neutral gray-silver fine luminous particles forming a dense continuous plump body volume. Thousands of tiny sparkling pinpoints and subtle silvery micro-motes distributed over and within a softly translucent rounded glowing mass, like the particle density and luminous material of image 2. Dense interior with convex inflated front and thick curved sides, softly visible depth between particle layers, not hollow, not merely an outline, not a flat grain texture. Soft upper-left studio key light, gentle concentrated light-gray front highlight and distinctly darker gray lower-right self-shadow. Body midtones around neutral RGB 140/140/140 for later pink/blue/violet tinting; keep sparse crisp silver-white particle glints. A premium refined luminous three-dimensional tactile effect, no large starburst sparkles or detached particles. The tiny particles hug and fill the exact source bodies; maintain clear rounded silhouettes and real volume at small avatar sizes.
TRANSPARENCY: every gap and all surrounding padding has real alpha transparency; the two empty cells remain completely empty with no visible pixels. Only the bodies have gentle physical translucency. No light fog outside the silhouette, no white edge matte, no outer glow halo, no cast shadow, no floor. Preserve 4:3 canvas, preferably 1264x948. No plant matter, flowers, moss, fur, facets, eyes, mouth, face, nose, limbs, accessories, labels, letters, grid lines, borders or watermarks. No black, white, gray or checkerboard backdrop.
```

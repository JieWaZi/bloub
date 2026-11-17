# 通用头像身体图集

[body-plush.png](body-plush.png) 与 [body-particles.svg](body-particles.svg) 是完整立体身体图集。每张采用 4 列 × 3 行等大方格，按行排列 10 种几何形状，末尾两格不放置身体。每个身体包含凸起前表面、圆润侧缘、左上柔光与右下自身暗部，无面部、肢体或地面投影。毛绒采用清晰的短密卷绒簇与纤维间微阴影，在 40px 缩略图中保留材质层次。

| 文件                                     | 用途                     | 实际尺寸    | 仓库输出路径                                |
| ---------------------------------------- | ------------------------ | ----------- | ------------------------------------------- |
| [body-template.png](body-template.png)   | 原创几何轮廓与布局指导图 | 1264 × 948  | `neuxbot/materials/body-template.png`  |
| [body-plush.png](body-plush.png)         | 中灰短密卷绒身体         | 1448 × 1086 | `neuxbot/materials/body-plush.png`     |
| [body-balloon.svg](body-balloon.svg) | 软胶充气表面的轮廓遮罩 | 1448 × 1086 | `neuxbot/materials/body-balloon.svg` |
| [body-particles.svg](body-particles.svg) | 中性灰银发光粒子身体     | 1448 × 1086 | `neuxbot/materials/body-particles.svg` |

[sprites.json](sprites.json) 记录图集尺寸、行列与形状顺序。10 种形状依次为 `cercle`、`galet`、`squircle`、`capsule`、`triangle`、`hexagone`、`nuage`、`carre`、`losange`、`pentagone`。渲染器按格显示完整身体，保留绒毛和粒子边缘；颜色可以根据身体的中灰明暗映射。

`visualScale` 只补偿显示时的视觉体积，不改变图集或头像布局槽：毛绒为 1，粒子为 1.2。粒子微尘透明度使同样边界的可见面积较小，整体视域放大 20% 后，身体、眼睛和状态动作仍保持相同比例。

粒子材质是由三维球内细光尘投影生成的原生 SVG 图集。核心因前后光点叠加而浓密，边缘自然稀疏；光照按深度和左上方向计算，没有实心表面、珍珠或凸点基底。微点按深度、明暗、透明度和直径合批为路径，经过已有换色与缓存链路只解码一次，不在运行时逐点创建 React 节点。[effects.ts](../src/materials/effects.ts) 只补少量细光点，以调用方已有绘图时钟缓慢漂移和闪烁；128px 头像中的单点直径小于 1px。[drawing.ts](../src/materials/drawing.ts) 保留图集正常透明度和径向形变，最后绘制眼睛，不擦除眼睛周围的细点。毛绒继续使用完整图集；`layout.ts` 按实测主体边界消除图格的不对称留白，三种材质使用独立于素材版本的目标尺寸，眼睛、外层视域与原生动作坐标保持不变。

重新生成与检查：

```sh
node neuxbot/tools/generate-particle-atlas.mjs
node neuxbot/tools/generate-particle-atlas.mjs --check
```

[生成脚本](../tools/generate-particle-atlas.mjs) 直接读取现有 `SHAPES`、固定随机种子和 [sprites.json](sprites.json)，不依赖第三方图像素材或新增运行库。SVG 的物理尺寸为 1448 × 1086，内部坐标为 1264 × 948，与现有图格比例一致；末尾两格不生成任何内容。生成文件不手工编辑。

## 来源与检查

几何指导图使用项目 `BotEngine(100, 'idle', shape.radii, null).sample(1.4).bodyPath` 绘制，形状取 [skins.ts](../src/bot/skins.ts) 的 `SHAPES` 并排除 `goutte`。使用项目已有 esbuild 与 `@napi-rs/canvas`，每格 316 × 316，原点平移到格内 `(158, 158)`，只填充中性灰前凸渐变，不绘制眼睛。

毛绒身体通过 built-in `image_gen` 编辑几何指导图生成，`transparent_background` 为 `true`，PNG 为工具交付原件的逐字节副本，未做像素编辑、裁切或缩放。粒子图集由上述原生脚本生成，没有采用图像生成结果或旧系统专属角色轮廓。

离线静态预览按实际图集、换色和眼睛绘图链路合成，检查橙色、玫粉和紫色在浅／暗背景下的 32、56、128px 表现，以及无眼睛的表面覆盖。该检查不代表运行中应用或真实平台的视觉验收。粒子图集使用真实透明背景，没有底色矩形，未生成形状之外的空格也没有路径。

## 完整生成提示词

### body-plush.png

```text
Use case: style-transfer. Production asset: grayscale plush body sprite atlas for small 3D avatars. Image 1 is the authoritative geometry and sprite layout target to transform. Image 2 is ONLY a tactile material reference: use the fuzzy vivid pink and yellow avatars on the LEFT window as guidance for clearly visible short plush pile, rounded thick inflated volume, and strong soft 3D lighting; ignore the entire interface and all eyes, and ignore the glossy green avatar on the right. Re-render Image 1 as original neutral medium-gray plush bodies. EXACT same 4-column x 3-row equal-square-cell grid on a 4:3 canvas; ten shapes in row-major order: circle, tilted oval pebble, squircle, horizontal capsule; rounded upright triangle, rounded hexagon, cloud, rounded square; rounded diamond, rounded pentagon, EMPTY, EMPTY. Retain each template silhouette, per-cell geometric center and size precisely; do not shift the objects upward. Center the visible body within each cell including its fur. Shapes stay well separated and the final two cells remain completely empty transparent. Front orthographic view of thick plump cushions with domed faces and rolled sides, not flat cutouts. Make the tactile material dramatically clearer than fine wispy hair: dense short curly wool/boucle tufts, compact velvety 3D clusters and small fiber curls, visible micro-shadow crevices between tufts, clean fuzzy edge with short soft fibers. Tufts must remain readable when each character is reduced to 40px, slightly stylized premium plush toy photography. Consistent broad upper-left softbox highlight and distinct lower-right self-shadow giving depth; light-gray highlights around RGB 185-205, mid-gray body around RGB 140, deep gray self-shadow around RGB 65-90. No clipping to white or black. Pure neutral grayscale for recoloring, no colored tint. Full body opaque with real alpha transparency all around; no background of any kind. NO eyes, faces, limbs, text, grids, borders, props, floating dust, ground shadows, halo, white matte, or flat felt sheets. Output one clean transparent RGBA atlas only.
```

## 软胶

`balloon` 使用同一组通用形状生成透明遮罩，`materialTexture` 将遮罩烘焙为完整的彩色亮面身体，采用左上清晰亮芯、柔和底光和右下短辅助反射，保留亮面软胶的光泽与层次，避免矩形高光压在面部中央，也不把地平线或细灯条映成整圈线条；不使用毛绒的灰度换色曲线。着色器与充气高度场的实现位于 [balloon-renderer.js](../src/materials/balloon-renderer.js)，来源与使用条件见 [原许可](../LICENSE.elastic-mesh)。同色图集可供宿主共用，三种材质在库内按同一形状的目标主体尺寸校准，并将可见身体居中于原生坐标，只变换身体，不改变眼睛坐标；所有形状和状态继续沿用已有的 SVG 径向变形，无需每个头像持有图形上下文。

```sh
node neuxbot/tools/generate-balloon-atlas.mjs
node neuxbot/tools/generate-balloon-atlas.mjs --check
```

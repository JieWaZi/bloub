# NeuxBot Bloub

这是 [JieWaZi/bloub](https://github.com/JieWaZi/bloub) 维护的头像库实现，使用根目录 `@neuxbot/bloub` 包公开入口接入。固定上游来源见 [upstream.json](upstream.json)，消费方引用此维护仓库的完整 Git 提交，并以锁文件固定安装结果，不复制源码。不引入 Vue 或 Solid 运行时。

## 职责

- `src/bot`：原生轮廓、时间采样、眼睛和动作；保留原生 16 表情并新增 8 个原创姿态。
- `src/materials`：闭合三维身体、全表面材质、曲面眼睛和框架无关 SVG 绘图树。`solid.ts` 统一静止与转动的实体几何、光照、毛纤维、光尘和遮挡，眼睛绑定相同表面并统一放大 1.3 倍。`layout.ts` 保存各形状共用的几何边界，不按材质改变大小与中心；`depth.ts` 只负责窗口指针归一化与时间平滑。运行时不依赖正面图集、图片解码或临时 GPU 烘焙。
- `tools/generate-particle-atlas.mjs` 与 `balloon-renderer.js`：独立的图集生成工具，不参与当前实体头像的运行时绘制。
- `src/plush`：固定开源来源的换色和状态辅助纯函数；不包含第三方毛绒图片。
- [materials](materials/README.md)：自有毛绒与 particles 完整立体身体、提示词与图格元数据。

NeuxBot 的 React 层负责可见性、暂停、状态编排、指针事件、单击与选择器；外观同步生成，绘图核心不持有业务事实。宿主只将平滑朝向传给 `avatarDrawing` 的 `bodyOrientation`，不再为同一指针修改 `setLook` 或重复扩眼。窗口指针无需悬停即可跟随，头像边缘已产生明显转向，最大左右 50°、上下 35°；失焦或指针离开窗口后平滑回正。除睡眠外的 13 种原生动作由会话状态编排，不作为用户可选的外观项；原始第三方睡眠定义留在核心，产品不自动触发。

## 维护

在本仓库的 `neuxbot/` 目录修改和验证，再提交和推送。消费方更新包依赖的完整 Git 提交和锁文件；源仓库元数据不包含自引用提交号。更新时同步检查前端头像、状态编排、选择器与原生动作测试，保留 [MIT 许可](LICENSE) 和 [表情策略参考许可](LICENSE.dsh-bloub-mood)。

## 许可

Bloub 核心沿用 [MIT 许可](LICENSE)，表情策略参考保留[对应许可](LICENSE.dsh-bloub-mood)。仓库保留的软胶图集烘焙器移植自 NeuxBot 开屏使用的 React Bits Elastic Mesh，适用 [MIT + Commons Clause 原许可](LICENSE.elastic-mesh)，不将其归为 Bloub 的 MIT 部分。消费应用需随包交付三份许可。

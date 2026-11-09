# NeuxBot Bloub

这是 [JieWaZi/bloub](https://github.com/JieWaZi/bloub/tree/codex/neuxbot-materials) 维护的头像库实现，使用根目录 `@neuxbot/bloub` 包公开入口接入。固定上游来源见 [upstream.json](upstream.json)，消费方以 Git 提交和锁文件固定版本，不复制源码。不引入 Vue 或 Solid 运行时。

## 职责

- `src/bot`：原生轮廓、时间采样、眼睛和动作；保留原生 16 表情并新增 8 个原创姿态。
- `src/materials`：原创身体图集目录、完整身体径向变形、少量细光点和框架无关 SVG 绘图树；复用上游脸部向内增长算法统一放大眼睛。
- `tools/generate-particle-atlas.mjs`：根据通用形状三维体积取样，生成细光尘 SVG 图集；运行时沿用单张纹理的准备与换色链。
- `src/plush`：固定开源来源的换色和状态辅助纯函数；不包含第三方毛绒图片。
- [materials](materials/README.md)：自有毛绒与 particles 完整立体身体、提示词与图格元数据。

NeuxBot 的 React 层负责资源就绪后的完整外观交接、可见性、暂停、状态编排、单击与选择器；绘图核心不持有业务事实。除睡眠外的 13 种原生动作由会话状态编排，不作为用户可选的外观项；原始第三方睡眠定义留在核心，产品不自动触发。

## 维护

在本仓库的 `neuxbot/` 目录修改和验证，再提交和推送。消费方更新包依赖的完整 Git 提交和锁文件；源仓库元数据不包含自引用提交号。更新时同步检查前端头像、状态编排、选择器与原生动作测试，保留 [MIT 许可](LICENSE) 和 [表情策略参考许可](LICENSE.dsh-bloub-mood)。

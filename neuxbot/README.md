# NeuxBot Bloub

这是 [JieWaZi/bloub](https://github.com/JieWaZi/bloub/tree/codex/neuxbot-materials) 的 `neuxbot/` 源码快照。固定来源和消费提交见 [upstream.json](upstream.json)。主仓库以源码构建，不引入 Vue 或 Solid 运行时。

## 职责

- `src/bot`：原生轮廓、时间采样、眼睛和动作；保留原生 16 表情并新增 8 个原创姿态。
- `src/materials`：原创身体图集目录、完整身体径向变形、前后分层粒子和框架无关 SVG 绘图树；复用上游脸部向内增长算法统一放大眼睛。
- `src/plush`：固定开源来源的换色和状态辅助纯函数；不包含第三方毛绒图片。
- [materials](materials/README.md)：自有毛绒与 particles 完整立体身体、提示词与图格元数据。

NeuxBot 的 React 层负责可见性、暂停、状态编排、单击与选择器；绘图核心不持有业务事实。除睡眠外的 13 种原生动作由会话状态编排，不作为用户可选的外观项；原始第三方睡眠定义留在核心，产品不自动触发。

## 维护

先在自维护 fork 的 `neuxbot/` 目录修改和验证，再以固定提交更新本目录。消费快照在 `upstream.json` 增加 `commit` 记录对应源提交；源仓库元数据不包含自引用提交号。更新时同步检查前端头像、状态编排、选择器与原生动作测试，保留 [MIT 许可](LICENSE) 和 [表情策略参考许可](LICENSE.dsh-bloub-mood)。

# @neuxbot/bloub

NeuxBot 维护的框架无关头像库。通用形状、24 种表情、状态动画与自有毛绒／粒子材质位于 [neuxbot](neuxbot/README.md)。源自 [jeremy-prt/bloub](https://github.com/jeremy-prt/bloub)，固定上游与参考来源见 [upstream.json](neuxbot/upstream.json)。

## 接入

消费方通过 `git+https://github.com/JieWaZi/bloub.git#main` 安装 `@neuxbot/bloub`，并提交包管理器锁文件。锁文件记录解析后的具体提交，更新库时一并更新锁文件。通过公开入口导入：

```ts
import { BotEngine } from "@neuxbot/bloub/engine";
import { EXPRESSIONS } from "@neuxbot/bloub/expressions";
import { TEXTURES } from "@neuxbot/bloub/materials";
```

公开入口见 [package.json](package.json)。TypeScript 源码和材质由消费方构建器打包，安装包不引入 Vue、视频编码器或运行时第三方框架。原始 `src/`、示例与研究文档保留供溯源，不属于交付包。

## 维护

在本仓库修改 `neuxbot/`，执行 `pnpm install --frozen-lockfile` 、`pnpm test` 与 `pnpm materials:check`；修改生成逻辑后先运行 `pnpm materials:generate`。提交和推送后，在消费方刷新 `main` 依赖及锁文件，并验证头像、状态编排、选择器、材质预载和许可交付。

## 许可

保留 [MIT 许可](neuxbot/LICENSE) 与 [表情策略参考许可](neuxbot/LICENSE.dsh-bloub-mood)。原创材质的用途与生成记录见 [材质说明](neuxbot/materials/README.md)。

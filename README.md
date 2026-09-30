# ShotaPartner-Docs

**伙伴物语（Partner Monogatari）** 的玩法说明页与公开问题反馈区。

- 🌐 线上地址：**https://paltrow-studio.github.io/ShotaPartner-Docs/**
- 🐛 问题反馈：[新建 issue](https://github.com/Paltrow-Studio/ShotaPartner-Docs/issues/new/choose) · [浏览已有 issue](https://github.com/Paltrow-Studio/ShotaPartner-Docs/issues)
- 💬 提问与交流：[Discussions](https://github.com/Paltrow-Studio/ShotaPartner-Docs/discussions)

## 这个仓库是做什么的

本仓库只有两个职责，不存放模组源码：

2. **公开反馈区**：三个模组仓库暂未公开，因此玩家的反馈统一提交到本仓库的 issue 区。页面上的反馈向导会帮你把**问题类型**与**涉及模块**预填进表单标题与标签，提交后直接分流。

页面是**类纸化**设计：米白纸面、宋体正文、虚线规矩线、朱砂印章式点缀，右上角可以切换 **日间 / 夜间**（默认跟随系统，选择记在 localStorage）。

| 模块 | modId | 版本 | 必需前置 |
| --- | --- | --- | --- |
| ShotaPartner-Core | `shota_partner` | 0.3.1 | ShotaPartner-API `[1.0,2)`、GeckoLib `[4.8,5)`、Forge 47.x、MC 1.20.1 |
| ShotaPartner-API | `shota_partner_api` | 1.0.0 | Forge 47.x、MC 1.20.1 |
| ShotaPartner-Extra-School | `shota_partner_extra_school` | 1.0.0 | ShotaPartner-API `[1.0,2)`（**不需要** GeckoLib，也不依赖 Core） |

> 运行环境：Minecraft 1.20.1 + Forge 47.x + **JDK 17**（JDK 21 会导致 Forge 工具链兼容问题）。

## 技术栈与本地开发

Vite + React 19 + TypeScript + Tailwind CSS v4，构建产物是纯静态站点，部署到 GitHub Pages。
页面不请求任何外部 CDN、字体服务或后端接口；纸面颗粒是一段内联的 SVG 噪点。

```bash
npm ci            # 安装依赖（严格按 package-lock.json）
npm run dev       # 本地开发，访问 http://localhost:5173/ShotaPartner-Docs/
npm run build     # 类型检查 + 构建到 dist/
npm run preview   # 预览构建产物
npm run typecheck # 只做类型检查
```

> `vite.config.ts` 里的 `base` 是 `/ShotaPartner-Docs/`（GitHub Pages 项目站点路径）。
> 若将来迁移到自定义域名或用户站点，把它改成 `'/'` 即可。

## 部署

推送 `main` 分支即自动部署，workflow 见 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)：

```
push → main ─→ npm ci ─→ npm run build ─→ 校验 dist/index.html ─→ 上传 Pages 制品 ─→ 部署
```

- 首次部署前需在 **Settings → Pages → Source** 选择 **GitHub Actions**。
- 也可在 Actions 页面手动 `workflow_dispatch` 触发。

## 目录结构

```
src/
├─ App.tsx                 # 页面装配 + FAQ 结构化数据 + 回到顶部
├─ index.css              # 两套主题的语义色板、纸面质感、组件类、无障碍与动效偏好
├─ lib/theme.ts           # 日间/夜间主题状态（首屏防闪由 index.html 内联脚本完成）
├─ components/
│  ├─ Nav / Hero / Contents / Roster / Reference / Install / Faq / Feedback / Footer
│  ├─ Guide.tsx           # 玩法章节渲染器（按 data/guide.ts 的块类型渲染）
│  └─ paper.tsx           # 纸面基础件：行内标记解析、Sheet、章节标题、批注
└─ data/                  # ★ 所有文案与内容都在这里，改内容基本只动这层
   ├─ site.ts             # 站点常量与导航
   ├─ guide.ts            # 玩法章节（11 章，正文主体）
   ├─ roster.ts           # 27 位伙伴的名册与六项初始训练值
   ├─ reference.ts        # 按键、命令、物品、方块、状态效果
   ├─ modules.ts          # 三个 jar 的版本与前置
   ├─ faq.ts              # 常见问题
   ├─ feedback.ts         # 反馈类型、模块选项、issue 表单深链
   └─ types.ts            # 章节数据结构
```

### 内容维护指引

| 要改什么 | 改哪里 |
| --- | --- |
| 玩法说明正文（章节、表格、批注） | `src/data/guide.ts` |
| 伙伴名册与训练值 | `src/data/roster.ts` |
| 按键 / 命令 / 物品 / 状态效果 | `src/data/reference.ts` |
| 版本号与前置依赖 | `src/data/modules.ts` |
| 导航、首屏文案 | `src/data/site.ts` |
| 常见问题 | `src/data/faq.ts` |
| 反馈类型 / 模块选项 / 预填逻辑 | `src/data/feedback.ts` |
| 配色、纸面质感、字体 | `src/index.css`（`:root` 与 `[data-theme='dark']` 两套变量） |

`guide.ts` 里每章由若干内容块组成，可用的 `kind`：
`p`（段落，支持 `` `代码` ``、`**加粗**`、`[文字](链接)`）、`sub`（小标题）、`list`、`steps`、`keys`、`table`、`note`（批注）。

改动后请跑一次 `npm run build`（含类型检查）再提交；CI 会用同样的命令构建。

## 反馈区（issue 区）说明

四个 Issue Form 都在 [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE)：

| 模板 | 适用情况 | 自动标签 |
| --- | --- | --- |
| 🐛 缺陷报告 | 能进游戏，但功能行为不对 | `bug`, `needs-triage` |
| 💥 崩溃与启动失败 | 崩溃、打不开、卡加载屏、JVM 崩溃 | `crash`, `needs-triage` |
| 🧩 兼容性 / 服务端 / 整合包 | 模组冲突、整合包异常、专用服务端、学校缺方块 | `compatibility`, `needs-triage` |
| ✨ 功能建议 | 新增功能、改进现有行为 | `enhancement`, `needs-triage` |

每个模板的第一个字段都是**涉及模块**（Core / API / Extra-School / 不确定），用于分流。

**维护者注意**：模板里的 `labels` 必须已存在于本仓库，否则 GitHub 会静默忽略。当前需要的标签：
`needs-triage`、`bug`、`crash`、`compatibility`、`enhancement`、`question`、`documentation`、`duplicate`、`wontfix`、`good first issue`，
以及模块标签 `module:core`、`module:api`、`module:school`、`module:docs`。

页面上的反馈向导不调用任何后端：它用 GitHub 官方的 issue 表单深链
（`issues/new?template=...&title=...&labels=...`）生成预填链接，玩家在 GitHub 上完成提交，因此**不需要任何 token 或代理服务**。

## 许可

All Rights Reserved. 与主模组 `ShotaPartner` 保持一致。

本项目非 Minecraft 官方产品，未经 Mojang 或 Microsoft 批准或关联。

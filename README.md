# ShotaPartner-Docs

**伙伴物语（Partner Monogatari）** 的对外说明页与公开问题反馈区。

- 🌐 线上地址：**https://paltrow-studio.github.io/ShotaPartner-Docs/**
- 🐛 问题反馈：[新建 issue](https://github.com/Paltrow-Studio/ShotaPartner-Docs/issues/new/choose) · [浏览已有 issue](https://github.com/Paltrow-Studio/ShotaPartner-Docs/issues)
- 💬 提问与交流：[Discussions](https://github.com/Paltrow-Studio/ShotaPartner-Docs/discussions)

## 这个仓库是做什么的

本仓库只有两个职责，不存放模组源码：

1. **说明页**：用现代网页介绍拆分后的三个模块（Core 游戏本体 / API 公共契约 / Extra-School 学校维度追加包）各自负责什么、需要哪些前置、如何安装，以及常见问题。
2. **公开反馈区**：三个模块仓库暂未公开，因此玩家的所有反馈统一提交到本仓库的 issue 区。页面上的「问题反馈」向导会帮你把**问题类型**与**涉及模块**预填进表单标题与标签，提交后可直接分流。

| 模块 | modId | 版本 | 必需前置 |
| --- | --- | --- | --- |
| ShotaPartner-Core | `shota_partner` | 0.3.1 | ShotaPartner-API `[1.0,2)`、GeckoLib `[4.8,5)`、Forge 47.x、MC 1.20.1 |
| ShotaPartner-API | `shota_partner_api` | 1.0.0 | Forge 47.x、MC 1.20.1 |
| ShotaPartner-Extra-School | `shota_partner_extra_school` | 1.0.0 | ShotaPartner-API `[1.0,2)`（**不需要** GeckoLib，也不依赖 Core） |

> 运行环境：Minecraft 1.20.1 + Forge 47.x + **JDK 17**（JDK 21 会导致 Forge 工具链兼容问题）。

## 技术栈与本地开发

Vite + React 19 + TypeScript + Tailwind CSS v4，构建产物是纯静态站点，部署到 GitHub Pages。
页面不请求任何外部 CDN 或字体服务（使用系统字体栈），也不依赖后端接口。

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
├─ index.css              # 设计令牌（配色/动画）、组件类、无障碍与动效偏好
├─ components/            # Nav / Hero / Architecture / Modules / Features / Install / Faq / Feedback / Footer
└─ data/                  # ★ 所有文案与内容都在这里，改内容基本只动这层
   ├─ site.ts             # 站点常量、导航、首屏文案、环境徽章
   ├─ modules.ts          # 三个模块的简介/指标/功能亮点/前置依赖、架构与设计取舍
   ├─ features.ts         # 「功能一览」六大分组
   ├─ faq.ts              # 常见问题（带 安装/模块/兼容/反馈 标签）
   └─ feedback.ts         # 反馈类型、模块选项、issue 表单深链与提交清单
```

### 内容维护指引

| 要改什么 | 改哪里 |
| --- | --- |
| 版本号、前置依赖、功能点 | `src/data/modules.ts` |
| 首屏文案、环境徽章、导航 | `src/data/site.ts` |
| 功能分组（玩法一览） | `src/data/features.ts` |
| 常见问题 | `src/data/faq.ts` |
| 反馈类型 / 模块选项 / 预填逻辑 | `src/data/feedback.ts` |
| 配色、动画、卡片样式 | `src/index.css` 的 `@theme` 与 `@layer components` |

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

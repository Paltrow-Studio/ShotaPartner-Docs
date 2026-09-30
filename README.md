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
├─ lib/                  # 站点运行时逻辑
│  ├─ theme.ts           # 日间/夜间主题状态（首屏防闪由 index.html 内联脚本完成）
│  ├─ reach.ts           # github.com 连通性探测
│  ├─ accelerator.ts     # 加速节点实测与自动选用
│  └─ relay.ts           # 反馈中继客户端（未配置地址时不发请求）
├─ components/
│  ├─ Nav / Hero / Contents / Roster / Reference / Install / Faq / Feedback / Footer
│  ├─ Guide.tsx           # 玩法章节渲染器（按 data/guide.ts 的块类型渲染）
│  └─ paper.tsx           # 纸面基础件：行内标记解析、Sheet、章节标题、批注
└─ data/                  # ★ 所有文案与内容都在这里，改内容基本只动这层
   ├─ site.ts             # 站点常量与导航（含加速节点、中继地址）
   ├─ guide.ts            # 玩法章节（10 章，正文主体）
   ├─ roster.ts           # 26 位可获得伙伴的名册与六项初始训练值
   ├─ reference.ts        # 按键、命令、物品、方块、状态效果
   ├─ modules.ts          # 三个 jar 的版本与前置
   ├─ faq.ts              # 常见问题
   ├─ feedback.ts         # 反馈类型、模块选项、issue 表单深链
   └─ types.ts            # 章节数据结构

relay/
├─ server.mjs             # 反馈中继（Node 18+，零依赖）
├─ worker.js              # 同一接口的 Cloudflare Worker 版
├─ selftest.mjs           # 中继自测（11 项，不需要令牌）
└─ README.md              # 部署、令牌权限、安全与自测说明
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
| 加速节点名单、中继地址 | `src/data/site.ts`（`GITHUB_MIRRORS` / `FEEDBACK_RELAY_URL`） |
| 反馈中继服务 | `relay/`（部署与安全说明见 `relay/README.md`） |
| 配色、纸面质感、字体 | `src/index.css`（`:root` 与 `[data-theme='dark']` 两套变量） |
| 站点图标 / 分享图 | `scripts/make-icons.py` 重新生成，见下节 |
| 内容门禁（禁止收录的角色与内容） | `scripts/check-content.mjs`，见「内容门禁」一节 |

`guide.ts` 里每章由若干内容块组成，可用的 `kind`：
`p`（段落，支持 `` `代码` ``、`**加粗**`、`[文字](链接)`）、`sub`（小标题）、`list`、`steps`、`keys`、`table`、`note`（批注）。

改动后请跑一次 `npm run build`（含类型检查）再提交；CI 会用同样的命令构建。

## 站点图标

图标直接使用组织 logo：`assets/brand/paltrow-studio-org.png`，即组织头像的公开副本。取法：

```bash
curl -L -o assets/brand/paltrow-studio-org.png 'https://github.com/Paltrow-Studio.png?size=512'
```

返回 460×460 透明底 PNG，仓库内保存一份副本以便离线重新生成；头像更新后重新执行该命令并重跑脚本即可。本仓库不引用任何私有仓库的文件。

`public/` 下的图标全部由脚本生成，不要手改：

```bash
python3 scripts/make-icons.py          # 重新生成
python3 scripts/make-icons.py --check  # 只校验尺寸与不透明度
```

脚本做的事：

1. 按 alpha 通道裁掉透明留白，再按尺寸留不同边距居中合成（16px 不放边距，512px 留 10%）。
2. 生成透明底 PNG（favicon-32）、多尺寸 ICO（16/32/48）、纸底不透明贴图（apple-touch 180、192、512）。
3. `favicon.svg` 内嵌 160px 标记，并用 SVG 内的 `prefers-color-scheme` 把底色在纸色
   `#f3eee2` 与墨色 `#241f18` 之间切换——浏览器用深色标签栏时图标不会糊成一片。
   标记只有两色，内嵌图统一用 128 色调色板量化，8.2 KB 而不是 33 KB。
4. `og-image.png`：1200×630 纸面卡片，左侧 logo、右侧「伙伴物语 / Partner Monogatari /
   玩法说明与问题反馈」与版本信息，右下角站点地址。

需要换 logo 时：替换 `assets/brand/` 下的源图，跑一次脚本并 `npm run build` 即可，文件清单无需改动。

## 内容门禁


这条规则由 `scripts/check-content.mjs` 强制执行，并已接入 `npm run build`：

```bash
npm run check:content   # 单独跑；命中即退出码 1
```

- 扫描范围：**`src/`（源文案与数据）与 `dist/`（实际发布产物）两处**。发布产物是最终保证——内容只要进了包就会被拦下。
- 因为挂在 `build` 上，GitHub Pages 的 CI 同样会执行：往页面里加回相关内容会直接构建失败。

本节是本仓库的维护说明，页面本身从不出现这些内容。

## 国内网络下的访问与反馈

GitHub 在国内经常无法直接访问，这一点没有办法靠前端绕过，因此页面做了三件事：

1. **检测与说明**：反馈区进入视口后会用 6 秒超时探测 `github.com`；连不上时明确写出「issue 表单需要在 github.com 登录后填写，资源加速节点无法承载表单与登录页」，而不是让用户点开一个打不开的链接。
2. **资源线路自动测试**：同一时刻逐个实测「直连 + 各加速节点」（下载本仓库的 `public/favicon.svg`，校验正文含 `<svg>` 并计时，单节点 8 秒超时），按可用性与耗时排序后**自动选用最快的一条**来渲染「下载本站源码 zip」与「查看 README」两个资源链接，并在页面上列出每个节点的实测结果。这些节点对 raw 路径返回 `access-control-allow-origin: *`，所以浏览器能读到状态码与正文，测试结果是真下载而不是探测包。
3. **不依赖 GitHub 的反馈内容生成**：反馈区把「标题 + 标签 + 与表单字段一一对应的正文框架」生成好，可一键复制或下载为 `.md` 文件（文件名形如 `伙伴物语-反馈-crash-2026-09-30.md`）。用户可以在任何能访问 GitHub 的环境里粘进表单，也可以直接把文件发给维护者。

### 实测结论（2026-09-30）

| 节点 | 仓库页 / issue 页（HTML） | raw | archive zip |
| --- | --- | --- | --- |
| `github.com` 直连 | 仓库页 200；issue 页 302 跳登录页（正常行为） | — | — |
| gh-proxy.com | 404（节点自带错误页） | 200 | 200 |
| ghfast.top | 403 | 200 | 200 |
| gh.llkk.cc | 403 | 200 | 200 |
| gh.jasonzeng.dev | 200 但是节点自己的页面 | 200 | 200 |
| ghproxy.net | **302 跳转到 survey-smiles.com（垃圾站点）** | 200 | 200 |
| bgithub.xyz / kkgithub.com / hub.whtrys.space / github.moeyy.xyz | 403 或不可达 | — | — |

因此**没有任何国内节点可以承载 issue 表单与登录流程**：它们只转发文件路径，HTML 页面一律 403/404，而 `issues/new` 本身需要 GitHub 会话。`ghproxy.net` 已跳转垃圾站点，已从 `GITHUB_MIRRORS` 中移除。

### 反馈中继（可选，唯一能在国内直接建 issue 的路径）

`relay/` 下是一份最小后端（Node 零依赖版 `server.mjs` + Cloudflare Worker 版 `worker.js`，接口一致）：玩家只把草稿 POST 给它，由它用**服务端保管的细粒度令牌**调用 `api.github.com` 建 issue，令牌不下发到浏览器。部署与安全说明见 [relay/README.md](relay/README.md)，自测（不访问 GitHub、不需要令牌）见 [relay/selftest.mjs](relay/selftest.mjs)：

```bash
node relay/selftest.mjs   # 11 项：校验、标签映射、蜜罐、来源白名单、限流
```

启用方式：部署后把地址填进 `FEEDBACK_RELAY_URL`（或构建期 `VITE_RELAY_URL`），反馈区会出现「经中继直接提交」；**留空则完全不显示该区块**，页面回到纯静态的复制 / 下载草稿模式，不产生任何中继请求。

另一条零后端路线：在 Gitee 建一个反馈仓并把地址填进 `FALLBACK_FEEDBACK_URL`（国内可直达，但反馈落在 Gitee 而非 GitHub issue）。

### 相关配置（`src/data/site.ts`）

| 常量 | 作用 |
| --- | --- |
| `GITHUB_MIRRORS` | 参与自动测试的加速节点（`id` / `label` / `prefix`），可自行增删 |
| `MIRROR_PROBE_RAW` | 测速与校验用的公开文件，换仓库时同步修改 |
| `REPO_ARCHIVE` / `REPO_README_RAW` | 会被套上选定节点的资源链接 |
| `FEEDBACK_RELAY_URL` | 反馈中继地址；**留空则不显示「直接提交」按钮，且不发出任何中继请求** |
| `FALLBACK_FEEDBACK_URL` / `FALLBACK_FEEDBACK_LABEL` | 国内备用反馈渠道（问卷、表单、Gitee 仓等）；**留空则不显示该入口** |
| `SITE_MIRROR_URL` | 本站的国内镜像地址（例如另建的 Gitee Pages / Cloudflare Pages）；留空则不显示 |

填好后跑一次 `npm run build` 即可，无需改动组件代码。

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

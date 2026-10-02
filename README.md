# ShotaPartner-Docs

**伙伴物语（Partner Monogatari）** 的玩法说明页与公开问题反馈区。

- 🌐 线上地址：**https://paltrow-studio.github.io/ShotaPartner-Docs/**
- 🐛 问题反馈：[新建 issue](https://github.com/Paltrow-Studio/ShotaPartner-Docs/issues/new/choose) · [浏览已有 issue](https://github.com/Paltrow-Studio/ShotaPartner-Docs/issues)
- 💬 提问与交流：[Discussions](https://github.com/Paltrow-Studio/ShotaPartner-Docs/discussions)

## 这个仓库是做什么的

本仓库只有两个职责，不存放模组源码：

1. **玩法说明页**：给玩家看的说明。重点是模组本身的玩法 —— 伙伴怎么抓、技能轮盘怎么用、加点与六项训练值、战斗 AI 与行为开关、工作任务、日常相处、墓碑与复活、学校维度、按键与物品、方块与状态效果速查。项目结构（三个 jar 的前置关系）只占首页一小块，够用就行。
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
│  └─ relay.ts           # 反馈中继客户端（未配置地址时不发请求）
├─ components/
│  ├─ Nav / Hero / Contents / Roster / Reference / Install / Faq / Feedback / Footer
│  ├─ IssueBoard.tsx      # 进度区 + 展示区（状态统计、进度条、统一格式的反馈列表）
│  ├─ Guide.tsx           # 玩法章节渲染器（按 data/guide.ts 的块类型渲染）
│  └─ paper.tsx           # 纸面基础件：行内标记解析、Sheet、章节标题、批注
└─ data/                  # ★ 所有文案与内容都在这里，改内容基本只动这层
   ├─ site.ts             # 站点常量与导航（含加速节点、中继地址）
   ├─ guide.ts            # 玩法章节（9 章，正文主体）
   ├─ roster.ts           # 26 位可获得伙伴的名册与六项初始训练值
   ├─ reference.ts        # 按键、物品、方块、状态效果
   ├─ modules.ts          # 三个 jar 的版本与前置
   ├─ faq.ts              # 常见问题
   ├─ feedback.ts         # 反馈表单、版本选项、提交深链、进度状态与统计
   └─ types.ts            # 章节数据结构

relay/
├─ server.mjs             # 反馈中继（Node 18+，零依赖）
├─ worker.js              # 同一接口的 Cloudflare Worker 版
├─ selftest.mjs           # 中继自测（11 项，不需要令牌）
└─ README.md              # 部署、令牌权限、安全与自测说明

scripts/
├─ check-content.mjs      # 内容门禁：扫描 src/ 与 dist/
├─ check-feedback-sync.mjs# 由 data/feedback.ts 生成并校验 feedback.yml
├─ sync-issues.mjs        # 抓取 issue → public/issues.json（进度区数据）
└─ make-icons.py          # 站点图标 / 分享图

public/
└─ issues.json            # 反馈快照（构建时生成，页面同源读取，不请求外部接口）
```

### 内容维护指引

| 要改什么 | 改哪里 |
| --- | --- |
| 玩法说明正文（章节、表格、批注） | `src/data/guide.ts` |
| 伙伴名册与训练值 | `src/data/roster.ts` |
| 按键 / 物品 / 方块 / 状态效果 | `src/data/reference.ts` |
| 版本号与前置依赖 | `src/data/modules.ts` |
| 导航、首屏文案 | `src/data/site.ts` |
| 常见问题 | `src/data/faq.ts` |
| 反馈表单、版本选项、进度状态 | `src/data/feedback.ts`（**唯一来源**，`feedback.yml` 由它生成） |
| GitHub Issue 表单 | `.github/ISSUE_TEMPLATE/feedback.yml`，改站点后跑 `npm run check:feedback -- --write` 重新生成 |
| 反馈快照（进度区数据） | `npm run sync:issues` 抓取；`public/issues.json` 由脚本生成，不要手改 |
| 反馈中继地址、国内备用入口 | `src/data/site.ts`（`FEEDBACK_RELAY_URL` / `FALLBACK_FEEDBACK_URL` / `SITE_MIRROR_URL`） |
| 反馈中继服务 | `relay/`（部署与安全说明见 `relay/README.md`） |
| 配色、纸面质感、字体 | `src/index.css`（`:root` 与 `[data-theme='dark']` 两套变量） |
| 主题默认时段（按国内时间自动切换） | `src/lib/theme.ts` 的 `DAY_START_HOUR` / `DAY_END_HOUR`，与 `index.html` 内联脚本两处同步 |
| 站点图标 / 分享图 | `scripts/make-icons.py` 重新生成，见下节 |
| 内容门禁（收录范围与词表） | `scripts/check-content.mjs`，见「内容门禁」一节；词表以 base64 存放 |
| 进度区的状态与配色 | `src/data/feedback.ts` 的 `issueStatuses`（标签 → 状态的映射在 `scripts/sync-issues.mjs`） |

`guide.ts` 里每章由若干内容块组成，可用的 `kind`：
`p`（段落，支持 `` `代码` ``、`**加粗**`、`[文字](链接)`）、`sub`（小标题）、`list`、`steps`、`keys`、`table`、`note`（批注）。

改动后请跑一次 `npm run build`（含类型检查、内容门禁与表单同步检查）再提交；CI 会用同样的命令构建。
反馈快照不在构建里抓取（离线也能构建）；需要新数据时跑 `npm run sync:issues`，CI 在部署前会自动执行。

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

## 主题（日间 / 夜间）

默认主题按**国内时间**（`Asia/Shanghai`，与访客所在时区无关）判定：

| 国内时间 | 默认主题 |
| --- | --- |
| 06:00 ~ 17:59 | 日间（浅色） |
| 18:00 ~ 05:59 | 夜间（深色） |

- 判定在**首屏绘制之前**完成：`index.html` 的内联脚本把结果写进 `<html data-theme>`，因此不会出现白闪或黑闪。
- 用户点过导航栏的「日」/「夜」之后，选择写入 `localStorage` 的 `sp-theme`，此后**不再随时间自动改变**，重访也保持该选择。
- 没有做过选择时，页面长时间开着会每 10 分钟重算一次，跨过 06:00 或 18:00 自动切换；默认值**不会**被写进 `localStorage`，否则第一次访问就会把默认值变成用户选择。
- 移动端浏览器界面配色（`theme-color`）跟随实际主题，不再跟随系统配色。
- 时段常量在 `src/lib/theme.ts`（`DAY_START_HOUR` / `DAY_END_HOUR`），`index.html` 内联脚本里有一份等价实现（内联脚本无法 `import` 模块），**改时段必须同时改这两处**。

## 内容门禁

**以下内容一律不进入页面。**

1. **默认配置下无法获得的角色**，以及它的专属坐骑与专属机制——名册条目、问答、正文章节、元信息与结构化数据都不收录。
2. **不公开收录的玩法机制**，含其派生的名词与具体获取途径：原文所在章节整章移除，连带相关问答、名册说明、道具条目、兼容对照表行与首屏文案一并删除。
3. **源码与实现细节**：内部字段名、实体 id、存档文件内部类型名、无中文名的内部遗留物、开发版子命令前缀、原版物品标签名，以及「源码 / 配置项 / 契约 / 字段语义 / 跨仓库」这类工程口吻。
4. **命令相关内容**：命令速查、权限等级与正文里的命令示例整体移除。玩家仍需照抄的内容保留原样：**配置键名与配置文件路径、按键、jar 名**。

本节同样不点名：**词表以 base64 存放**在 `scripts/check-content.mjs` 顶部的 `FORBIDDEN`（`code` 字段），仓库里搜不到这些词；命中时只打印文件、行号与规则编号，不打印词本身（CI 日志同样是公开的）。

```bash
npm run check:content                  # 单独跑；命中即退出码 1
npm run check:content -- --code <词>   # 新增受限词：打印 base64，粘进 FORBIDDEN
```

- 扫描范围：**`src/`（源文案与数据）与 `dist/`（实际发布产物）两处**。发布产物是最终保证——内容只要进了包就会被拦下。
- 每条规则带 `scope`：`both` 表示源文件与产物都查，`src` 表示只查源文件（标识符在压缩产物里出现同名子串属正常）。
- `attack` / `defense` / `health` / `entities` / `poi` / `region` 这类既可能出现在正文、也可能出现在站点自身代码里的英文词**不入表**，避免误伤（例如 `health` 是反馈中继的字段名）；第 3 类内容靠本节约定与评审保证。
- 因为挂在 `build` 上，GitHub Pages 的 CI 同样会执行：往页面里加回相关内容会直接构建失败。
- 每一次删除都会让后续章节序号重排（当前玩法章节为 9 章），重排后需同步核对目录与相容性对照表。
- 需要重新收录时：先确认该内容确实应公开，再删除本节的限制与脚本中对应的条目——不要在页面上「例外处理」。

## 国内网络下的访问与反馈

GitHub 在国内经常无法直接访问，这一点没有办法靠前端绕过。反馈区不再做连接探测与线路测速，直接进入问题类型与模块选择；国内提交依赖下面两条可选路径：

1. **中继提交**：部署 `relay/` 并在 `FEEDBACK_RELAY_URL` 填入地址后，反馈区第「三」步会出现「直接提交到 issue 区」——由中继持服务端令牌建 issue，玩家不需要能打开 github.com。地址留空时该区块不出现，页面也不发出任何中继请求。
2. **零后端备选**：在 Gitee 建一个反馈仓并把地址填进 `FALLBACK_FEEDBACK_URL`，入口显示在反馈区右侧「直达链接」卡片；国内可直达，但反馈落在 Gitee 而非 GitHub issue。

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

因此**没有任何国内节点可以承载 issue 表单与登录流程**：它们只转发文件路径，HTML 页面一律 403/404，而 `issues/new` 本身需要 GitHub 会话。`ghproxy.net` 已跳转垃圾站点，不再列入任何名单。

### 反馈中继（可选，唯一能在国内直接建 issue 的路径）

`relay/` 下是一份最小后端（Node 零依赖版 `server.mjs` + Cloudflare Worker 版 `worker.js`，接口一致）：玩家只把草稿 POST 给它，由它用**服务端保管的细粒度令牌**调用 `api.github.com` 建 issue，令牌不下发到浏览器。部署与安全说明见 [relay/README.md](relay/README.md)，自测（不访问 GitHub、不需要令牌）见 [relay/selftest.mjs](relay/selftest.mjs)：

```bash
node relay/selftest.mjs   # 11 项：校验、标签映射、蜜罐、来源白名单、限流
```

启用方式：部署后把地址填进 `FEEDBACK_RELAY_URL`（或构建期 `VITE_RELAY_URL`），反馈区会出现「经中继直接提交」；**留空则完全不显示该区块**，页面回到纯静态的复制 / 下载草稿模式，不产生任何中继请求。

另一条零后端路线：在 Gitee 建一个反馈仓并把地址填进 `FALLBACK_FEEDBACK_URL`（国内可直达，但反馈落在 Gitee 而非 GitHub issue）。

### 相关配置（`src/data/site.ts`）

页面已不再做节点测速：以下常量决定反馈区的入口。

| 常量 | 作用 |
| --- | --- |
| `FEEDBACK_RELAY_URL` | 反馈中继地址；**留空则不显示「直接提交」按钮，且不发出任何中继请求** |
| `FALLBACK_FEEDBACK_URL` / `FALLBACK_FEEDBACK_LABEL` | 国内备用反馈渠道（问卷、表单、Gitee 仓等）；**留空则不显示该入口** |
| `SITE_MIRROR_URL` | 本站的国内镜像地址（例如另建的 Gitee Pages / Cloudflare Pages）；留空则不显示 |

填好后跑一次 `npm run build` 即可，无需改动组件代码。

## 反馈区、进度区与展示区

页面上有三块，都只依赖静态文件和 GitHub 官方表单，不需要自建后端：

| 区块 | 位置 | 作用 |
| --- | --- | --- |
| 反馈提交区 | `#feedback` | 四项输入：标题、版本、内容、截图（可选），生成预填好的 GitHub 表单深链 |
| 进度区 | `#progress` | 各状态的条数、占比与进度条，说明每种状态的含义 |
| 展示区 | `#board` | 按统一格式列出全部反馈，可按状态筛选，带缩略图 |

四套旧模板（缺陷 / 崩溃 / 兼容 / 建议）已合并为**一张** [`.github/ISSUE_TEMPLATE/feedback.yml`](.github/ISSUE_TEMPLATE/feedback.yml)：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| 标题 | 表单标题栏 | 站点深链预填 `[反馈] <标题>` |
| 版本 | `dropdown` | `0.3.1（当前版本）`、整合包内附带的版本、更早的版本、不确定 |
| 内容 | `textarea` | 现象、复现步骤、期望结果 |
| 截图 / 录屏 | `upload` | GitHub 原生上传（图片 10 MB、视频 100 MB 以内） |

问题属于哪一类、涉及哪个模块，**不再要求玩家选择**：由维护者看内容判断并补 `bug` / `crash` / `compatibility` / `enhancement` 与模块标签。表单默认只带 `needs-triage`。

### 表单与站点同步

[`src/data/feedback.ts`](src/data/feedback.ts) 是唯一来源：表单名、说明、标题前缀、标签、版本选项、内容提示、截图说明、提交须知都写在里面。

```bash
npm run check:feedback              # 校验；不一致即退出码 1
npm run check:feedback -- --write   # 改完站点数据后重新生成 feedback.yml
```

校验由 [scripts/check-feedback-sync.mjs](scripts/check-feedback-sync.mjs) 执行，已挂在 `npm run build` 上：文件多出第二张表单、表单与站点数据不一致、或深链漏掉标题 / 版本 / 内容任一预填，构建都会失败。版本选项里的本体版本号取自 [`src/data/modules.ts`](src/data/modules.ts)，改版本号后重新生成即可。

**维护者注意**：表单里的 `labels` 必须已存在于本仓库，否则 GitHub 会静默忽略。表单只带 `needs-triage`，分类标签由维护者按内容补：
`bug`、`crash`、`compatibility`、`enhancement`、`question`、`documentation`、`duplicate`、`wontfix`、`good first issue`，
以及模块标签 `module:core`、`module:api`、`module:school`、`module:docs`。

### 反馈快照

进度区与展示区读的是 `public/issues.json`，由 [scripts/sync-issues.mjs](scripts/sync-issues.mjs) 在部署前抓取：

```bash
npm run sync:issues   # 有 GH_TOKEN / GITHUB_TOKEN 走 REST API，否则用本机 gh CLI
```

- 归一化：旧模板提交的 issue 标题带 `[Bug] [Core]` 前缀、正文是 `### 字段` 分段，脚本会去掉前缀、取出「模组版本」与「实际结果 / 复现步骤」等段落，压成标题 / 版本 / 内容 / 截图 / 状态 / 时间。
- 状态取自 issue 标签：`已修复` / `fixed` → 已修复，`排查中` / `待排查` → 排查中，`已关闭` / `wontfix` → 已关闭，其余为待处理。
- 取不到数据（离线、无凭据）时脚本保留既有快照并正常退出，不会阻塞构建。
- 页面从同源读快照，**运行时不发任何外部请求**，所以国内访问不需要代理。
- 玩家提交的原文会随快照进入 `dist/issues.json`，内容门禁按路径跳过这个文件（见「内容门禁」一节）。

页面上的提交按钮不调用任何后端：它用 GitHub 官方的 issue 表单深链
（`issues/new?template=feedback.yml&title=…&version=…&content=…`）生成预填链接，因此**不需要 token 或代理服务**。
配置 `FEEDBACK_RELAY_URL` 后，`relay/` 会额外提供「无需 GitHub 账号」的直接提交入口（中继服务端只接受标题 / 版本 / 内容，标签固定为 `needs-triage`）。

## 许可

All Rights Reserved. 与主模组 `ShotaPartner` 保持一致。

本项目非 Minecraft 官方产品，未经 Mojang 或 Microsoft 批准或关联。

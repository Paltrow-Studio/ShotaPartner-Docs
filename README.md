# ShotaPartner-Docs

**伙伴物语（Partner Monogatari）** 的玩法说明页与公开问题反馈区。

- 🌐 线上地址：**https://paltrow-studio.github.io/ShotaPartner-Docs/**
- 🐛 问题反馈：[反馈区（提交 / 进度 / 全部记录）](https://paltrow-studio.github.io/ShotaPartner-Docs/feedback.html) · 不需要 GitHub 账号
- 🗂 历史反馈：早先的 23 条 issue 已导入反馈区（保留原讨论链接）；仓库里的 issue 区仅作维护者内部记录
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
页面不请求任何外部 CDN 或字体服务；玩法说明页完全静态，纸面颗粒是一段内联的 SVG 噪点。
反馈页（`feedback.html`）在配置了 `VITE_FEEDBACK_API` 时会向自建反馈服务读写数据，
未配置时只读 `public/records.json` 这份静态副本。

```bash
npm ci            # 安装依赖（严格按 package-lock.json）
npm run dev       # 本地开发，访问 http://localhost:5173/ShotaPartner-Docs/
npm run build     # 类型检查 + 构建到 dist/
npm run preview   # 预览构建产物
npm run typecheck # 只做类型检查

npm run service      # 本地起反馈服务（http://127.0.0.1:8787）
npm run service:test # 反馈服务自测（46 项，不需要网络）
```

联调反馈页：先 `npm run service`，再
`VITE_FEEDBACK_API=http://127.0.0.1:8787 npm run dev`，反馈页即切到在线提交。

> `vite.config.ts` 里的 `base` 是 `/ShotaPartner-Docs/`（GitHub Pages 项目站点路径）。
> 若将来迁移到自定义域名或用户站点，把它改成 `'/'` 即可。

## 部署

推送 `main` 分支即自动部署，workflow 见 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)：

```
push → main ─→ npm ci ─→ npm run build ─→ 校验 dist/index.html ─→ 上传 Pages 制品 ─→ 部署
```

- 首次部署前需在 **Settings → Pages → Source** 选择 **GitHub Actions**。
- 也可在 Actions 页面手动 `workflow_dispatch` 触发。
- 反馈服务地址走仓库变量 `FEEDBACK_API`（**Settings → Secrets and variables → Actions →
  Variables**），构建时注入页面，不必改代码。未设置时反馈页只读，只显示静态副本。
  服务本身的部署见 [service/README.md](service/README.md)（含 Cloudflare Worker + 自定义域名
  这条路的完整命令清单）。

## 目录结构

```
src/
├─ App.tsx                 # 页面装配 + FAQ 结构化数据 + 回到顶部
├─ index.css              # 两套主题的语义色板、纸面质感、组件类、无障碍与动效偏好
├─ feedback/             # 反馈区独立页面（feedback.html 的入口）
│  ├─ main.tsx           # 挂载
│  ├─ FeedbackPage.tsx   # 页面外壳：页头、介绍、三个区块、页脚
│  ├─ SubmitForm.tsx     # 提交表单：拖拽截图、自动压缩、编号回执
│  ├─ ProgressPanel.tsx  # 进度统计与分段进度条
│  └─ RecordList.tsx     # 全部记录，按状态筛选
├─ lib/                  # 站点运行时逻辑
│  ├─ theme.ts           # 日间/夜间主题状态（首屏防闪由 index.html 内联脚本完成）
│  ├─ image.ts           # 上传前压缩：canvas 缩到长边 1600 并转 webp
│  └─ feedbackClient.ts  # 读反馈服务 / 读静态副本、提交、本地校验
├─ components/
│  ├─ Nav / Hero / Contents / Roster / Reference / Install / Faq / Footer
│  ├─ FeedbackTeaser.tsx  # 文档首页上的反馈入口（完整反馈区在 feedback.html）
│  ├─ Guide.tsx           # 玩法章节渲染器（按 data/guide.ts 的块类型渲染）
│  └─ paper.tsx           # 纸面基础件：行内标记解析、Sheet、章节标题、批注
└─ data/                  # ★ 所有文案与内容都在这里，改内容基本只动这层
   ├─ site.ts             # 站点常量与导航（含加速节点、中继地址）
   ├─ guide.ts            # 玩法章节（9 章，正文主体）
   ├─ roster.ts           # 26 位可获得伙伴的名册与六项初始训练值
   ├─ reference.ts        # 按键、物品、方块、状态效果
   ├─ modules.ts          # 三个 jar 的版本与前置
   ├─ faq.ts              # 常见问题
   ├─ feedback.ts         # 反馈契约与文案：上限、状态、版本选项、记录类型
   └─ types.ts            # 章节数据结构

service/                 # 反馈服务（Node 18+，零依赖；玩家提交的数据存这里）
├─ store.mjs              # 共享契约与校验（站点与服务端一致的唯一来源）
├─ server.mjs             # 服务本体：磁盘存储 + 图片落盘 + 改状态
├─ worker.js              # 同契约的 Cloudflare Worker 版（数据放 KV）
├─ admin.mjs              # 维护工具：list / show / status / export
├─ selftest.mjs           # 服务自测（46 项，起真实进程走真实 HTTP）
├─ worker.selftest.mjs    # Worker 自测（假 KV，无需 wrangler）
├─ CONTRACT.md            # HTTP 接口契约
├─ Dockerfile             # 容器镜像
└─ README.md              # 部署（VPS / Docker / Worker / 云函数）与维护


scripts/
├─ check-content.mjs      # 内容门禁：扫描 src/ 与 dist/
├─ check-feedback-contract.mjs  # 比对站点与 service/store.mjs 的字段与上限
├─ import-legacy-issues.mjs     # 一次性补档：早期 issue → public/records.json
└─ make-icons.py          # 站点图标 / 分享图

public/
└─ records.json           # 记录静态副本（历史反馈 + 维护者导出），只读模式与种子用

feedback.html             # 反馈区页面入口（与 index.html 同为 Vite 入口）
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
| 反馈区文案、版本选项、上限、状态 | `src/data/feedback.ts`（页面侧唯一来源） |
| 反馈服务的字段与校验 | `service/store.mjs`（与服务端共享；与站点的一致性由 `npm run check:feedback` 守着） |
| 反馈服务部署与维护 | [service/README.md](service/README.md) |
| 反馈记录（改状态、导出静态副本） | `service/admin.mjs`，见 service/README.md「维护」 |
| 记录静态副本 | `npm run service` 起来后 `node service/admin.mjs export --out public/records.json` |
| 历史反馈补档 | `npm run seed:legacy`（只在补档时用，构建与部署都不访问 GitHub） |
| 备用渠道 / 国内镜像 | `src/data/feedback.ts` 的 `FALLBACK_FEEDBACK_URL`、`site.ts` 的 `SITE_MIRROR_URL` |
| 配色、纸面质感、字体 | `src/index.css`（`:root` 与 `[data-theme='dark']` 两套变量） |
| 主题默认时段（按国内时间自动切换） | `src/lib/theme.ts` 的 `DAY_START_HOUR` / `DAY_END_HOUR`，与 `index.html` 内联脚本两处同步 |
| 站点图标 / 分享图 | `scripts/make-icons.py` 重新生成，见下节 |
| 内容门禁（收录范围与词表） | `scripts/check-content.mjs`，见「内容门禁」一节；词表以 base64 存放 |
| 进度区的状态与配色 | `src/data/feedback.ts` 的 `feedbackStatuses` |

`guide.ts` 里每章由若干内容块组成，可用的 `kind`：
`p`（段落，支持 `` `代码` ``、`**加粗**`、`[文字](链接)`）、`sub`（小标题）、`list`、`steps`、`keys`、`table`、`note`（批注）。

改动后请跑一次 `npm run build`（含类型检查、内容门禁与反馈契约检查）再提交；CI 会用同样的命令构建。
构建不访问网络：历史记录已经在 `public/records.json` 里，反馈服务也单独部署。

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

GitHub 在国内经常无法直接访问，而 GitHub 的 Issue 表单还要求玩家有账号、填一整套环境表——
对普通 MC 玩家来说门槛太高。所以反馈区换了做法：

**页面自己收，反馈服务自己存。** 玩家在 [feedback.html](feedback.html) 上填标题、版本、内容
（可选附截图），不注册、不跳转、不经过任何第三方平台。记录与进度都保存在自建服务里，
进度区按待处理 / 排查中 / 已修复 / 已关闭更新，每条反馈都有编号。

### 实测结论（2026-09-30）

| 节点 | 仓库页 / issue 页（HTML） | raw | archive zip |
| --- | --- | --- | --- |
| `github.com` 直连 | 仓库页 200；issue 页 302 跳登录页（正常行为） | — | — |
| gh-proxy.com | 404（节点自带错误页） | 200 | 200 |
| ghfast.top | 403 | 200 | 200 |
| gh.llkk.cc | 403 | 200 | 200 |
| gh.jasonzeng.dev | 200 但是节点自己的页面 | 200 | 200 |
| ghproxy.net | **302 跳转到 survey-smiles.com（垃圾站点）** | 200 | 200 |
| bgithub.xyz / kkgithub.com / hub.whtrys.space / github.moeey.xyz | 403 或不可达 | — | — |

结论没有变：**没有任何国内节点能承载 HTML 页面与登录流程**，它们只转发文件路径。
这也是反馈区不再依赖 GitHub 的表单与账号的原因——需要跨境的只有「下载模组文件」，
那件事加速节点本来就做得很好。

### 反馈服务的部署

服务是一份零依赖的 Node 程序（另有同契约的 Cloudflare Worker 版），
部署方式（国内 VPS / Docker / Worker + KV / 云函数）、环境变量、维护命令见
[service/README.md](service/README.md)。部署后把地址填进仓库变量 `FEEDBACK_API` 即可。

**没有部署服务时**，反馈页进入只读模式：记录与进度照常显示（读 `public/records.json`），
提交按钮换成「复制内容」与备用渠道提示。想启用备用渠道，把国内可直接访问的表单地址填进
`src/data/feedback.ts` 的 `FALLBACK_FEEDBACK_URL`，页面就会多一个入口。

### 相关配置

| 配置 | 位置 | 作用 |
| --- | --- | --- |
| `VITE_FEEDBACK_API` | 构建期注入 / 仓库变量 `FEEDBACK_API` | 反馈服务地址；留空则反馈页只读 |
| `FALLBACK_FEEDBACK_URL` / `FALLBACK_FEEDBACK_LABEL` | `src/data/feedback.ts` | 国内备用提交渠道；留空则不显示 |
| `SITE_MIRROR_URL` | `src/data/site.ts` | 本站国内镜像地址；留空则不显示 |

## 反馈区与进度区

反馈区是**独立页面** `feedback.html`，不埋在玩法说明的末尾：玩家从游戏里出来时应该一眼看到
「怎么提交、进度在哪」。文档首页只留一个入口卡片（`FeedbackTeaser.tsx`）和一句进度概况。

| 区块 | 锚点 | 作用 |
| --- | --- | --- |
| 提交 | `#submit` | 标题 / 版本 / 内容 / 截图（可选）/ 联系方式（可选，仅维护者可见） |
| 进度 | `#progress` | 各状态条数、占比与分段进度条 |
| 记录 | `#records` | 全部反馈，按状态筛选，带缩略图与编号 |

提交后立即写入反馈服务并显示编号回执，新记录当场出现在下面的记录与进度里。

### 截图是怎么处理的

玩家多半直接截屏后拖进来，原图常常好几 MB。页面先在浏览器里用 canvas 把长边缩到
1600 px、转成 webp（`src/lib/image.ts`）再提交，一次提交通常只有几百 KB。
GIF 不压缩（转码会把动图压成静态图），超限时直接提示。
服务端的上限是单张 3 MB、合计 8 MB、最多 3 张，与页面提示一致。

### 契约与一致性

字段名、长度上限、状态取值分散在「页面」和「服务」两侧，任何漂移的后果都是玩家提交失败却查不出原因。
因此：

- 服务端把契约集中在 [`service/store.mjs`](service/store.mjs)，`server.mjs` 与 `worker.js` 都复用它；
- 站点侧对应 [`src/data/feedback.ts`](src/data/feedback.ts)；
- `npm run check:feedback`（[scripts/check-feedback-contract.mjs](scripts/check-feedback-contract.mjs)）
  解析两侧逐项比对：上限、状态、图片类型、记录字段、静态副本能否通过服务端自己的校验，
  并检查两个实现确实复用了共享层。它还带自测——故意改坏六种，任何一种没被认出来就构建失败。

### 记录与状态

- 记录编号形如 `F-0031`，由服务端分配，不复用。
- 状态：`pending` 待处理 / `investigating` 排查中 / `fixed` 已修复 / `closed` 已关闭。
  维护者用 `node service/admin.mjs status F-0031 fixed` 改，进度区随即更新。
- **联系方式不进公开响应**：只有带对 `X-Admin-Key` 的请求才能拿到，页面永远看不到它。
- 早期的 23 条反馈（原 GitHub issue）已归一化成 `F-0008`~`F-0030`，保留原链接，
  编号接着往下发。

## 许可

All Rights Reserved. 与主模组 `ShotaPartner` 保持一致。

本项目非 Minecraft 官方产品，未经 Mojang 或 Microsoft 批准或关联。

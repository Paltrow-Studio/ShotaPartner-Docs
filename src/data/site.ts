/**
 * 站点级常量。仓库/组织名集中在这里，方便以后改名或迁移。
 */

export const ORG = 'Paltrow-Studio'
export const REPO = 'ShotaPartner-Docs'
export const GITHUB_REPO = `https://github.com/${ORG}/${REPO}`
/** 本仓库的 issue 新建入口（公开反馈区） */
export const ISSUES_NEW = `${GITHUB_REPO}/issues/new`
export const ISSUES = `${GITHUB_REPO}/issues`
export const DISCUSSIONS = `${GITHUB_REPO}/discussions`
export const SITE_URL = 'https://paltrow-studio.github.io/ShotaPartner-Docs/'
export const ORG_URL = `https://github.com/${ORG}`

/**
 * GitHub 文件加速节点。
 *
 * 实测结论（2026-09-30，逐节点发起真实请求）：
 *   - 对 `raw.githubusercontent.com`、`archive/refs/heads/*.zip`、`releases/download`
 *     一类**资源路径**返回 200，且带 `access-control-allow-origin: *`，
 *     因此页面可以在浏览器里校验内容并测速；
 *   - 对 `github.com/...` 的 **HTML 页面**（仓库页、issue 页、discussions）
 *     一律返回 403 / 404 或自己的错误页，无法用于浏览与提交。
 *
 * 列表只保留对资源路径实测可用的节点；ghproxy.net 已跳转到垃圾站点，故移除。
 * 页面会按访客自己的网络实测延迟，自动选择最快的可用节点。
 */
export const GITHUB_MIRRORS: { id: string; label: string; prefix: string }[] = [
  { id: 'gh-proxy', label: 'gh-proxy.com', prefix: 'https://gh-proxy.com/' },
  { id: 'ghfast', label: 'ghfast.top', prefix: 'https://ghfast.top/' },
  { id: 'llkk', label: 'gh.llkk.cc', prefix: 'https://gh.llkk.cc/' },
  { id: 'jasonzeng', label: 'gh.jasonzeng.dev', prefix: 'https://gh.jasonzeng.dev/' },
]

/** 用于测速与校验的公开资源：本仓库自身的 favicon（体积小、内容可判定） */
export const MIRROR_PROBE_RAW =
  `https://raw.githubusercontent.com/${ORG}/${REPO}/main/public/favicon.svg`

/** 可经加速节点获取的资源（本仓库为公开仓库，这两条在国内通常可用） */
export const REPO_ARCHIVE = `${GITHUB_REPO}/archive/refs/heads/main.zip`
export const REPO_README_RAW = `https://raw.githubusercontent.com/${ORG}/${REPO}/main/README.md`

/**
 * 国内备用反馈渠道（问卷、表单等），留空则页面不显示该入口。
 * 想启用时填一个国内可直接访问的提交地址即可，不需要改动其他代码。
 */
export const FALLBACK_FEEDBACK_URL = ''
export const FALLBACK_FEEDBACK_LABEL = '国内反馈表单'

/** 本站的国内镜像地址，留空则不显示。用于 github.io 本身访问受限的情况。 */
export const SITE_MIRROR_URL = ''

export type NavItem = { id: string; label: string }

export const navItems: NavItem[] = [
  { id: 'overview', label: '概述' },
  { id: 'gameplay', label: '玩法' },
  { id: 'roster', label: '名册' },
  { id: 'school', label: '学校' },
  { id: 'reference', label: '速查' },
  { id: 'install', label: '安装' },
  { id: 'faq', label: '问答' },
  { id: 'feedback', label: '反馈' },
]

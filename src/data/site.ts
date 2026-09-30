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
 * GitHub 文件加速镜像。
 * 只对 Releases / Raw / Archive 等文件路径有效，无法代理 issue 表单与登录页，
 * 因此仅作为「下载用」的备选，页面上会明确标注这一点。
 */
export const GITHUB_FILE_MIRRORS: { label: string; prefix: string }[] = [
  { label: 'gh-proxy.com', prefix: 'https://gh-proxy.com/' },
  { label: 'ghfast.top', prefix: 'https://ghfast.top/' },
  { label: 'ghproxy.net', prefix: 'https://ghproxy.net/' },
]

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

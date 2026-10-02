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
 * GitHub 加速节点的实测结论保存在 README「国内网络下的访问与反馈」一节：
 * 这些节点只转发 raw / archive / release，HTML 页面（仓库页、issue 页、登录页）
 * 一律 403 / 404，因此提交只能走下面的中继。页面不再做线路测速。
 */

/**
 * 国内备用反馈渠道（问卷、表单等），留空则页面不显示该入口。
 * 想启用时填一个国内可直接访问的提交地址即可，不需要改动其他代码。
 */
export const FALLBACK_FEEDBACK_URL = ''
export const FALLBACK_FEEDBACK_LABEL = '国内反馈表单'

/**
 * 反馈中继地址（见 relay/README.md）。留空时页面完全不显示「直接提交」按钮，
 * 只保留复制 / 下载草稿与表单深链。
 *
 * 构建期可用 VITE_RELAY_URL 覆盖，便于本地联调：
 *   VITE_RELAY_URL=http://127.0.0.1:8787 npm run build
 */
export const FEEDBACK_RELAY_URL = import.meta.env.VITE_RELAY_URL ?? ''

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
  { id: 'progress', label: '进度' },
]

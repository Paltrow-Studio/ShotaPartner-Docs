/**
 * 站点级常量。仓库/组织名集中在这里，方便以后改名或迁移。
 */

export const ORG = 'Paltrow-Studio'
export const REPO = 'ShotaPartner-Docs'
export const GITHUB_REPO = `https://github.com/${ORG}/${REPO}`
export const SITE_URL = 'https://paltrow-studio.github.io/ShotaPartner-Docs/'
export const ORG_URL = `https://github.com/${ORG}`
/** 独立成页的反馈区（提交、进度、全部记录都在那里） */
export const FEEDBACK_PAGE = `${SITE_URL}feedback.html`
export const DISCUSSIONS = `${GITHUB_REPO}/discussions`

/**
 * GitHub 加速节点的实测结论保存在 README「国内网络下的访问与反馈」一节：
 * 这些节点只转发 raw / archive / release，HTML 页面（仓库页、issue 页、登录页）
 * 一律 403 / 404。反馈区因此不依赖 GitHub：页面自己收、反馈服务自己存。
 */

/**
 * 反馈服务地址走构建期注入的 VITE_FEEDBACK_API（见 src/data/feedback.ts）；
 * 服务本身的部署与维护见 service/README.md。
 */

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

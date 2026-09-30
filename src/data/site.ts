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

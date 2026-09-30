/**
 * 站点级常量与文案。
 * 仓库/组织名集中在这里，方便以后改名或迁移。
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
  { id: 'overview', label: '总览' },
  { id: 'architecture', label: '架构' },
  { id: 'modules', label: '三个模块' },
  { id: 'features', label: '功能一览' },
  { id: 'install', label: '安装与前置' },
  { id: 'faq', label: '常见问题' },
  { id: 'feedback', label: '问题反馈' },
]

export const hero = {
  eyebrow: 'Minecraft 1.20.1 · Forge 伴侣系统模组',
  title: '伙伴物语',
  titleEn: 'Partner Monogatari',
  intro:
    '召唤伙伴、培养成长、并肩作战。27 位伙伴各有一套技能、外观与战斗风格；项目已拆分为三个可以独立安装、独立升级的模块，其中一个专门负责公共契约与扩展支持。',
  primaryCta: { label: '查看三个模块', href: '#modules' },
  secondaryCta: { label: '提交问题反馈', href: '#feedback' },
}

/** 顶部环境徽章（内容以 mods.toml / gradle.properties 为准，改版本时一并更新） */
export const envBadges: { label: string; value: string; hint?: string }[] = [
  { label: 'Minecraft', value: '1.20.1' },
  { label: 'Forge', value: '47.4.23' },
  { label: 'Java', value: '17', hint: '必须使用 JDK 17' },
  { label: 'GeckoLib', value: '4.8.x', hint: '仅游戏本体需要' },
]

export const heroStats: { value: string; label: string }[] = [
  { value: '3', label: '个可独立安装的模块' },
  { value: '27', label: '位伙伴角色' },
  { value: '12', label: '位学校 NPC 居民' },
  { value: '4', label: '类反馈模板' },
]

export const footerNote = {
  license: 'All Rights Reserved',
  text:
    '伙伴物语（Partner Monogatari）由 Paltrow Studio 开发。三个模块仓库暂未公开源码，但本仓库的 issue 区对所有玩家开放，欢迎反馈问题与建议。',
}

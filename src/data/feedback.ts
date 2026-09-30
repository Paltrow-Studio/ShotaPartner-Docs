/**
 * 公开问题反馈区的数据与链接生成。
 *
 * 设计：不引入任何后端。页面用 GitHub 官方的 issue 表单深链
 * （issues/new?template=...&title=...&labels=...）把「问题类型 + 涉及模块」
 * 预填进标题与标签，玩家在 GitHub 上完成提交 —— 无需 token、无需代理。
 */

import { ISSUES_NEW } from './site'
import type { ModuleId } from './modules'

export type IssueTypeId = 'bug' | 'crash' | 'compatibility' | 'feature'

export type IssueType = {
  id: IssueTypeId
  /** .github/ISSUE_TEMPLATE/ 下的文件名 */
  template: string
  name: string
  icon: string
  desc: string
  /** 什么情况该选它 */
  when: string
  titlePrefix: string
  labels: string
  accent: { text: string; border: string; bg: string }
}

export const issueTypes: IssueType[] = [
  {
    id: 'bug',
    template: 'bug_report.yml',
    name: '缺陷报告',
    icon: 'bug',
    desc: '游戏能正常进入，但某个功能行为不对：数值错误、逻辑异常、UI 错位、交互失效等。',
    when: '能玩，但某处不对劲',
    titlePrefix: '[Bug]',
    labels: 'bug,needs-triage',
    accent: {
      text: 'text-rose-300',
      border: 'border-rose-400/30',
      bg: 'bg-rose-500/10',
    },
  },
  {
    id: 'crash',
    template: 'crash_report.yml',
    name: '崩溃与启动失败',
    icon: 'alert',
    desc: '游戏崩溃、打不开、卡在加载屏、一进世界就退出，或出现了 JVM 崩溃日志。',
    when: '进不去 / 直接崩',
    titlePrefix: '[崩溃]',
    labels: 'crash,needs-triage',
    accent: {
      text: 'text-orange-300',
      border: 'border-orange-400/30',
      bg: 'bg-orange-500/10',
    },
  },
  {
    id: 'compatibility',
    template: 'compatibility.yml',
    name: '兼容性 / 服务端 / 整合包',
    icon: 'puzzle',
    desc: '与其它模组冲突、整合包内异常、专用服务端专有问题、学校维度缺方块、第三方联动失效。',
    when: '单装正常，一加东西就不对',
    titlePrefix: '[兼容]',
    labels: 'compatibility,needs-triage',
    accent: {
      text: 'text-sky-300',
      border: 'border-sky-400/30',
      bg: 'bg-sky-500/10',
    },
  },
  {
    id: 'feature',
    template: 'feature_request.yml',
    name: '功能建议',
    icon: 'sparkles',
    desc: '希望新增功能、改进现有行为、调整数值与手感，或者优化界面与提示。',
    when: '想法与改进建议',
    titlePrefix: '[建议]',
    labels: 'enhancement,needs-triage',
    accent: {
      text: 'text-emerald-300',
      border: 'border-emerald-400/30',
      bg: 'bg-emerald-500/10',
    },
  },
]

export type ModuleOption = {
  id: ModuleId | 'unknown'
  /** 出现在 issue 标题里的标签 */
  titleTag: string
  label: string
  /** 表单里「涉及模块」该选哪一项 */
  formOption: string
}

export const moduleOptions: ModuleOption[] = [
  {
    id: 'core',
    titleTag: 'Core',
    label: 'Core',
    formOption: 'ShotaPartner-Core（游戏本体：伙伴/技能/战斗/物品/方块）',
  },
  {
    id: 'api',
    titleTag: 'API',
    label: 'API',
    formOption: 'ShotaPartner-API（公共前置 API）',
  },
  {
    id: 'school',
    titleTag: 'School',
    label: 'Extra-School',
    formOption: 'ShotaPartner-Extra-School（学校维度追加包）',
  },
  {
    id: 'unknown',
    titleTag: '未确定',
    label: '不确定 / 多个模块',
    formOption: '不确定 / 与多个模块都有关',
  },
]

/** 生成带预填的 issue 表单链接 */
export function buildIssueUrl(type: IssueType, moduleId: ModuleId | 'unknown'): string {
  const option = moduleOptions.find((m) => m.id === moduleId) ?? moduleOptions[3]
  const title = `${type.titlePrefix} [${option.titleTag}] `
  const params = new URLSearchParams({
    template: type.template,
    title,
    labels: type.labels,
  })
  return `${ISSUES_NEW}?${params.toString()}`
}

/** 提交前请准备好这些信息 */
export const reportChecklist: { title: string; desc: string; icon: string }[] = [
  {
    title: '完整的模组列表',
    desc: 'mods 目录下所有 jar 的文件名；用整合包的话给出整合包名称与版本。',
    icon: 'package',
  },
  {
    title: '精确的复现步骤',
    desc: '写到「照着做就能重现」的程度；不确定是否必现也要如实说明。',
    icon: 'list',
  },
  {
    title: '日志链接',
    desc: '完整日志上传到 mclo.gs 或 Gist，issue 里只贴与问题相关的几十行。',
    icon: 'scroll',
  },
  {
    title: '截图或录屏',
    desc: 'UI 错位、渲染异常、学校维度缺装饰之类的问题强烈建议附上。',
    icon: 'image',
  },
]

/** 反馈时请不要这样做 */
export const reportAntiPatterns: string[] = [
  '不要把整篇 latest.log 粘贴进 issue —— 请给 mclo.gs / Gist 链接。',
  '不要重复开 issue：先搜索（含已关闭的），已有同类问题请在原帖跟进。',
  '支持类提问（怎么装、怎么玩）请走 Discussions，issue 区只处理可复现的问题与建议。',
  'issue 是公开的，请勿粘贴私人信息或服务器地址等敏感内容。',
]

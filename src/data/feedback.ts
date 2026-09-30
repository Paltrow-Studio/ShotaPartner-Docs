/**
 * 公开问题反馈区的数据与链接生成。
 *
 * 静态站点没有后端，所以走 GitHub 官方的 issue 表单深链：
 * issues/new?template=…&title=…&labels=… 把问题类型和涉及模块预填进去，
 * 玩家在 GitHub 上点提交就行。
 */

import { ISSUES_NEW } from './site'
import type { ModuleId } from './modules'

export type IssueTypeId = 'bug' | 'crash' | 'compatibility' | 'feature'

export type IssueType = {
  id: IssueTypeId
  /** .github/ISSUE_TEMPLATE/ 下的文件名 */
  template: string
  name: string
  desc: string
  when: string
  titlePrefix: string
  labels: string
}

export const issueTypes: IssueType[] = [
  {
    id: 'bug',
    template: 'bug_report.yml',
    name: '缺陷报告',
    desc: '游戏能进，但某个功能不对劲：数值不对、逻辑异常、界面错位、点了没反应。',
    when: '能玩，但某处不对',
    titlePrefix: '[Bug]',
    labels: 'bug,needs-triage',
  },
  {
    id: 'crash',
    template: 'crash_report.yml',
    name: '崩溃与启动失败',
    desc: '崩溃、打不开、卡在加载界面、一进世界就退出。',
    when: '进不去，或者直接崩',
    titlePrefix: '[崩溃]',
    labels: 'crash,needs-triage',
  },
  {
    id: 'compatibility',
    template: 'compatibility.yml',
    name: '兼容性 / 服务端 / 整合包',
    desc: '加上别的模组或放进整合包才出问题、专用服务端上表现不对、学校维度缺方块。',
    when: '单装没事，加了东西就出问题',
    titlePrefix: '[兼容]',
    labels: 'compatibility,needs-triage',
  },
  {
    id: 'feature',
    template: 'feature_request.yml',
    name: '功能建议',
    desc: '想加的功能、想改的手感与数值、想改的界面提示。',
    when: '有想法要提',
    titlePrefix: '[建议]',
    labels: 'enhancement,needs-triage',
  },
]

export type ModuleOption = {
  id: ModuleId | 'unknown'
  titleTag: string
  label: string
  /** 表单里「涉及模块」该选哪一项 */
  formOption: string
}

export const moduleOptions: ModuleOption[] = [
  {
    id: 'core',
    titleTag: 'Core',
    label: '本体',
    formOption: 'ShotaPartner-Core（游戏本体：伙伴/技能/战斗/物品/方块）',
  },
  { id: 'api', titleTag: 'API', label: '前置 API', formOption: 'ShotaPartner-API（公共前置 API）' },
  {
    id: 'school',
    titleTag: 'School',
    label: '学校包',
    formOption: 'ShotaPartner-Extra-School（学校维度追加包）',
  },
  {
    id: 'unknown',
    titleTag: '未确定',
    label: '不确定',
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

export const reportChecklist: { title: string; desc: string }[] = [
  {
    title: '完整的模组列表',
    desc: 'mods 目录里所有 jar 的文件名；用整合包的话写整合包名称与版本。',
  },
  {
    title: '复现步骤',
    desc: '照着做就能重现的步骤。不确定是不是每次都出现，也请写清楚。',
  },
  {
    title: '日志链接',
    desc: '完整日志传到 mclo.gs 或 Gist，issue 里只贴相关的那几十行。',
  },
  {
    title: '截图或录屏',
    desc: '界面错位、渲染异常、学校缺装饰这类问题，附图会快很多。',
  },
]

export const reportAntiPatterns: string[] = [
  '整篇 latest.log 不要往 issue 里贴，给链接就行。',
  '提之前先搜一遍（含已关闭的 issue），同类问题在原帖里跟进。',
  '怎么装、怎么玩这类问题发讨论区，issue 区留给能复现的问题和建议。',
  'issue 是公开的，别贴服务器地址、联系方式这类信息。',
]

/**
 * 公开问题反馈区的数据与链接生成。
 *
 * 静态站点没有后端，所以走 GitHub 官方的 issue 表单深链：
 * issues/new?template=…&title=…&labels=… 把问题类型和涉及模块预填进去，
 * 玩家在 GitHub 上完成提交。
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
    desc: '游戏可以进入，但某项功能表现异常：数值不符、逻辑错误、界面错位、操作无响应。',
    when: '可以游玩，但存在异常',
    titlePrefix: '[Bug]',
    labels: 'bug,needs-triage',
  },
  {
    id: 'crash',
    template: 'crash_report.yml',
    name: '崩溃与启动失败',
    desc: '崩溃、无法启动、卡在加载界面、进入世界后立即退出。',
    when: '无法进入或直接崩溃',
    titlePrefix: '[崩溃]',
    labels: 'crash,needs-triage',
  },
  {
    id: 'compatibility',
    template: 'compatibility.yml',
    name: '兼容性 / 服务端 / 整合包',
    desc: '与其它模组组合或放入整合包后出现问题、专用服务端表现异常、学校维度缺少方块。',
    when: '单独安装正常，加入其它内容后异常',
    titlePrefix: '[兼容]',
    labels: 'compatibility,needs-triage',
  },
  {
    id: 'feature',
    template: 'feature_request.yml',
    name: '功能建议',
    desc: '希望新增的功能、需要调整的手感与数值、需要改进的界面提示。',
    when: '需要提交功能想法',
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
    desc: 'mods 目录下所有 jar 的文件名；使用整合包时写明整合包名称与版本。',
  },
  {
    title: '复现步骤',
    desc: '按步骤可以复现问题。若不确定是否必然出现，请一并说明。',
  },
  {
    title: '日志链接',
    desc: '完整日志上传至 mclo.gs 或 Gist，issue 中仅粘贴相关的数十行。',
  },
  {
    title: '截图或录屏',
    desc: '界面错位、渲染异常、学校缺少装饰这类问题，附图可显著缩短定位时间。',
  },
]

export const reportAntiPatterns: string[] = [
  '整份 latest.log 不要粘贴到 issue 中，提供链接即可。',
  '提交前先搜索已有 issue（含已关闭的），同类问题在原帖下跟进。',
  '如何安装、如何游玩这类问题请发至讨论区，issue 区用于可复现的问题与具体建议。',
  'issue 内容公开，请勿包含服务器地址、联系方式等个人信息。',
]

/**
 * 公开问题反馈区的数据与链接生成。
 *
 * 静态站点没有后端，所以走 GitHub 官方的 issue 表单深链：
 * issues/new?template=…&labels=… 选中模板并带上标签，玩家在 GitHub 上完成提交。
 * 标题不预填，交给模板默认值，使两条入口（本站链接 / GitHub 的 Create new issue）表现一致。
 */

import { ISSUES_NEW } from './site'
import type { ModuleId } from './modules'

export type IssueTypeId = 'bug' | 'crash' | 'compatibility' | 'feature'

export type ReportDraft = {
  title: string
  labels: string
  body: string
}

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
  /** 表单里「涉及模块」下拉的选项原文；站内与表单逐字一致，不做别名 */
  formOption: string
}

export const moduleOptions: ModuleOption[] = [
  { id: 'core', formOption: 'ShotaPartner-Core（游戏本体：伙伴/技能/战斗/物品/方块）' },
  { id: 'api', formOption: 'ShotaPartner-API（公共前置 API）' },
  { id: 'school', formOption: 'ShotaPartner-Extra-School（学校维度追加包）' },
  { id: 'unknown', formOption: '不确定 / 与多个模块都有关' },
]

/**
 * 生成带预填的 issue 表单链接。
 *
 * 只预填模板与标签，**不预填标题、也不带模块**：
 *   - 标题交给模板自己的默认值，因此「从本站点链接进入」与「从 GitHub 的 Create new issue 进入」
 *     得到的标题完全一致；
 *   - 涉及模块由表单的「涉及模块」下拉记录（页面会提示该选哪一项），不再重复写进标题。
 */
export function buildIssueUrl(type: IssueType): string {
  const params = new URLSearchParams({
    template: type.template,
    labels: type.labels,
  })
  return `${ISSUES_NEW}?${params.toString()}`
}

/**
 * 各类问题对应的填写框架。字段与 .github/ISSUE_TEMPLATE/*.yml 中的 label 同名且顺序一致，
 * 因此复制出来的内容既可直接粘进表单，也可作为聊天或邮件里的完整反馈正文。
 *
 * 本文件是反馈表单的唯一来源：Issue 表单、自检条目与不予受理的情况都以这里为准。
 * 改动后运行 `npm run check:feedback`（已挂在 `npm run build` 上）确认两边一致。
 */
const reportScaffold: Record<IssueTypeId, { heading: string; lines: string[] }[]> = {
  bug: [
    {
      heading: '环境',
      lines: [
        '- 模组版本：',
        '- Forge 版本：',
        '- 运行环境：（单人 / 局域网 / 专用服务端）',
        '- Java 版本：',
        '- 是否使用整合包：',
        '- 模组列表：',
      ],
    },
    { heading: '复现步骤', lines: ['1. ', '2. ', '3. '] },
    { heading: '期望结果', lines: [''] },
    { heading: '实际结果', lines: [''] },
    { heading: '复现频率', lines: ['- （每次 / 偶尔 / 仅出现过一次）'] },
    { heading: '最小环境验证', lines: ['- （是否在只有 Forge 加本模组及前置的环境下复现）'] },
    { heading: '完整日志链接', lines: ['- （mclo.gs 或 Gist）'] },
    { heading: '相关日志片段', lines: ['```', '', '```'] },
    { heading: '截图 / 录屏', lines: [''] },
    { heading: '补充说明', lines: [''] },
  ],
  crash: [
    { heading: '崩溃阶段', lines: ['- （启动 / 进入世界 / 游玩中 / 退出）'] },
    { heading: '崩溃报告 / 日志链接', lines: ['- （mclo.gs 或 Gist）'] },
    { heading: '崩溃栈关键片段', lines: ['```', '', '```'] },
    { heading: '报告指出的可疑模组', lines: ['- '] },
    {
      heading: '环境',
      lines: [
        '- 模组版本：',
        '- Forge 版本：',
        '- 运行环境：（单人 / 局域网 / 专用服务端）',
        '- Java 版本：',
        '- 是否使用整合包：',
        '- 模组列表：',
      ],
    },
    { heading: '复现步骤', lines: ['1. ', '2. ', '3. '] },
    { heading: '期望结果', lines: [''] },
    { heading: '实际结果', lines: [''] },
    { heading: '复现频率', lines: ['- （每次 / 偶尔 / 仅出现过一次）'] },
    { heading: '最小环境验证', lines: ['- '] },
    { heading: '补充说明', lines: [''] },
  ],
  compatibility: [
    { heading: '问题类型', lines: ['- （与其它模组冲突 / 整合包异常 / 专用服务端异常 / 学校维度缺方块）'] },
    { heading: '相关模组', lines: ['- '] },
    { heading: '移除该模组后是否恢复', lines: ['- '] },
    { heading: '二分定位到的模组', lines: ['- '] },
    { heading: '前置依赖是否齐全', lines: ['- '] },
    {
      heading: '环境',
      lines: [
        '- 模组版本：',
        '- Forge 版本：',
        '- 运行环境：（单人 / 局域网 / 专用服务端）',
        '- Java 版本：',
        '- 是否使用整合包：',
        '- 模组列表：',
      ],
    },
    { heading: '复现步骤', lines: ['1. ', '2. ', '3. '] },
    { heading: '期望结果', lines: [''] },
    { heading: '实际结果', lines: [''] },
    { heading: '复现频率', lines: ['- '] },
    { heading: '最小环境验证', lines: ['- '] },
    { heading: '完整日志链接', lines: ['- （mclo.gs 或 Gist）'] },
    { heading: '补充说明', lines: [''] },
  ],
  feature: [
    { heading: '想解决的问题', lines: [''] },
    { heading: '期望的方案', lines: [''] },
    { heading: '考虑过的替代方案', lines: [''] },
    { heading: '是否可能影响兼容性', lines: ['- '] },
    { heading: '参考', lines: ['- '] },
    { heading: '补充说明', lines: [''] },
  ],
}

/**
 * 生成与表单字段一致的反馈草稿。
 * 不依赖网络：GitHub 无法访问时，可复制或下载后通过其他渠道提交。
 */
export function buildReportDraft(type: IssueType, moduleId: ModuleId | 'unknown'): ReportDraft {
  const option = moduleOptions.find((m) => m.id === moduleId) ?? moduleOptions[3]
  const body = [
    `**涉及模块**：${option.formOption}`,
    '',
    ...reportScaffold[type.id].map((section) => `### ${section.heading}\n${section.lines.join('\n')}`),
  ].join('\n\n')
  return { title: `${type.titlePrefix} `, labels: type.labels, body }
}

/**
 * GitHub 表单会逐项询问的字段，顺序与 .github/ISSUE_TEMPLATE/*.yml 完全相同。
 * 「环境」在表单里是六个独立字段，这里同样展开，便于与表单逐项对照。
 */
export function formFieldList(type: IssueType): string[] {
  const strip = (line: string) => line.replace(/^-\s*/, '').replace(/：.*$/, '').trim()
  const labels: string[] = ['涉及模块', '提交前自检']
  for (const section of reportScaffold[type.id]) {
    if (section.heading === '环境') labels.push(...section.lines.map(strip).filter(Boolean))
    else labels.push(section.heading)
  }
  return labels
}

/** 生成可复制的纯文本反馈草稿（含标题、标签与提交地址，便于转发）。 */
export function buildReportText(type: IssueType, moduleId: ModuleId | 'unknown'): string {
  const draft = buildReportDraft(type, moduleId)
  return [
    `标题：${draft.title}`,
    `标签：${draft.labels}`,
    `表单：${buildIssueUrl(type)}`,
    '（若无法访问 GitHub，可将以上标题与下列正文一并发送给维护者）',
    '',
    draft.body,
    '',
  ].join('\n')
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

/**
 * 反馈区与进度区的数据与链接生成。
 *
 * 设计目标：玩家只需填「标题 / 版本 / 内容 / 截图」四项，其余判断由维护者做。
 * 静态站点没有后端，所以提交走 GitHub 官方的 issue 表单深链：
 *   issues/new?template=feedback.yml&title=…&version=…&content=…
 * 字段 id 与表单一致，因此链接打开后标题、版本、内容都已填好，
 * 玩家只需把截图拖进上传框并点提交。截图无法通过链接传递，见 mediaNote。
 */

import { ISSUES_NEW } from './site'
import { moduleSummaries } from './modules'

/** 唯一的反馈表单。关于它的一切都以本文件为准，.yml 由本文件生成。 */
export const feedbackForm = {
  /** .github/ISSUE_TEMPLATE/ 下的文件名 */
  template: 'feedback.yml',
  name: '反馈',
  desc: '一个问题、一条建议：填标题、版本、内容，有截图就附上。',
  titlePrefix: '[反馈]',
  labels: 'needs-triage',
}

/** 本体版本号：表单「版本」下拉的第一项，随 modules.ts 自动更新。 */
export const coreVersion = moduleSummaries.find((m) => m.id === 'core')?.version ?? ''

/**
 * 「版本」下拉选项。以本体版本为准——玩家报告的现象几乎都来自本体与整合包；
 * 若库里没有对应选项，玩家会在内容里写明。
 */
export const versionOptions: string[] = [
  `${coreVersion}（当前版本）`,
  '整合包内附带的版本（请在内容里写明）',
  '更早的版本（请在内容里写明）',
  '不确定',
]

/** 「内容」一栏的提示语，也是页面上输入框的占位文案。 */
export const contentHint =
  '发生了什么、怎么重现、你希望是什么结果。例如：伙伴在工作时不会拾取掉落物，站着不动也一直触发工作动画。'

/** 截图说明。链接只能带文字，截图必须在 GitHub 的上传框里拖入。 */
export const mediaNote = '截图或录屏在 GitHub 的表单里拖进上传框即可（图片 10 MB 以内）。'

/** 提交前不必读长篇规则，只保留两条最容易踩的。 */
export const submitTips: string[] = [
  '日志不要整份贴进内容里：先传到 mclo.gs 或 Gist，把链接写在内容里。',
  '同一类问题先看进度区与已有反馈，在原来那条下面补充，比新开一条更容易被处理。',
]

export type FeedbackDraft = {
  title: string
  version: string
  content: string
}

/** 生成带预填的反馈链接；标题、版本、内容三项都会带到表单里。 */
export function buildIssueUrl(draft: FeedbackDraft): string {
  const params = new URLSearchParams({
    template: feedbackForm.template,
    title: draft.title.trim(),
    version: draft.version,
    content: draft.content.trim(),
  })
  return `${ISSUES_NEW}?${params.toString()}`
}

/** 生成可复制的纯文本反馈草稿，便于在无法打开 GitHub 时转发给维护者。 */
export function buildDraftText(draft: FeedbackDraft): string {
  return [
    `标题：${draft.title.trim()}`,
    `版本：${draft.version}`,
    `内容：${draft.content.trim()}`,
    '',
    `提交地址：${buildIssueUrl(draft)}`,
    '（若无法访问 GitHub，可将以上三项发送给维护者）',
    '',
  ].join('\n')
}

/* ---------- 进度区 ---------- */

export type IssueStatusId = 'pending' | 'investigating' | 'fixed' | 'closed'

export type IssueStatus = {
  id: IssueStatusId
  label: string
  /** 进度区里的说明 */
  desc: string
  /** 徽标与进度条的配色 */
  tone: 'seal' | 'indigo' | 'jade' | 'faint'
}

export const issueStatuses: IssueStatus[] = [
  { id: 'pending', label: '待处理', desc: '已收到，等维护者确认', tone: 'seal' },
  { id: 'investigating', label: '排查中', desc: '正在定位原因', tone: 'indigo' },
  { id: 'fixed', label: '已修复', desc: '修复已进入开发版或正式版', tone: 'jade' },
  { id: 'closed', label: '已关闭', desc: '重复、无法复现或不属于受理范围', tone: 'faint' },
]

/** 进度区里展示的一条反馈：字段与提交流程一一对应。 */
export type BoardIssue = {
  number: number
  title: string
  /** 版本，例如 0.3.1；玩家没写就为空 */
  version: string
  /** 内容，已由快照脚本截断 */
  content: string
  /** 截图 / 录屏地址 */
  images: string[]
  status: IssueStatusId
  createdAt: string
  url: string
}

export type IssueSnapshot = {
  /** 生成时间（ISO），页面上据此说明数据新鲜度 */
  generatedAt: string
  issues: BoardIssue[]
}

export const ISSUE_SNAPSHOT_URL = `${import.meta.env.BASE_URL}issues.json`

/** 进度统计，供进度区显示各状态的条数与占比。 */
export function statusCounts(issues: BoardIssue[]): Record<IssueStatusId, number> {
  const counts: Record<IssueStatusId, number> = { pending: 0, investigating: 0, fixed: 0, closed: 0 }
  for (const issue of issues) counts[issue.status] += 1
  return counts
}
/**
 * 反馈区的数据契约与文案。
 *
 * 玩家不再需要 GitHub 账号：页面自己收、反馈服务自己存（见 service/CONTRACT.md）。
 * 这里的常量必须与 service/store.mjs 一致——状态取值、长度上限、图片规格；
 * `npm run check:feedback` 会解析两边逐项比对，漂移会让构建失败。
 */

import { moduleSummaries } from './modules'

/**
 * 反馈服务地址。留空时页面进入只读模式：只显示 public/records.json 里的静态副本，
 * 提交按钮换成「复制内容」与备用渠道。
 *
 * 构建期注入，例如：
 *   VITE_FEEDBACK_API=https://feedback.example.com npm run build
 */
export const FEEDBACK_API = (import.meta.env.VITE_FEEDBACK_API ?? '').replace(/\/+$/, '')

/** 静态副本（历史记录 + 维护者导出的快照），与服务地址无关，始终可读 */
export const RECORDS_SEED_URL = `${import.meta.env.BASE_URL}records.json`

/** 文档首页地址（从反馈页返回） */
export const DOCS_URL = import.meta.env.BASE_URL

/** 字段规格：页面用它做即时提示，服务端用它做最终裁决，两边必须相同 */
export const LIMITS = {
  titleMin: 4,
  titleMax: 120,
  contentMin: 20,
  contentMax: 4000,
  imagesMax: 3,
  imageBytesMax: 3 * 1024 * 1024,
  mediaBytesMax: 8 * 1024 * 1024,
  contactMax: 120,
}

/** 允许的图片类型；页面会把其它格式转成 webp / jpeg 后再提交 */
export const imageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

/** 上传前先把长边缩到这个像素数：截图在这个尺寸下依然看得清，体积却小很多 */
export const imageMaxEdge = 1600

export type FeedbackStatusId = 'pending' | 'investigating' | 'fixed' | 'closed'

export type FeedbackStatus = {
  id: FeedbackStatusId
  label: string
  /** 进度区里的说明 */
  desc: string
  /** 徽标与进度条的配色 */
  tone: 'seal' | 'indigo' | 'jade' | 'faint'
}

export const feedbackStatuses: FeedbackStatus[] = [
  { id: 'pending', label: '待处理', desc: '已收到，等维护者确认', tone: 'seal' },
  { id: 'investigating', label: '排查中', desc: '正在定位原因', tone: 'indigo' },
  { id: 'fixed', label: '已修复', desc: '修复已进入开发版或正式版', tone: 'jade' },
  { id: 'closed', label: '已关闭', desc: '重复、无法复现或不属于受理范围', tone: 'faint' },
]

/** 本体版本号：版本下拉的第一项，随 modules.ts 自动更新 */
export const coreVersion = moduleSummaries.find((module) => module.id === 'core')?.version ?? ''

export const versionOptions: string[] = [
  `${coreVersion}（当前版本）`,
  '整合包内附带的版本（请在内容里写明）',
  '更早的版本（请在内容里写明）',
  '不确定',
]

/** 「内容」的占位提示 */
export const contentHint =
  '发生了什么、怎么重现、你希望是什么结果。例如：伙伴在工作时不会拾取掉落物，站着不动也一直触发工作动画。'

/** 「标题」的占位提示 */
export const titleHint = '伙伴不拾取掉落物'

/** 提交前值得看一眼的两条 */
export const submitTips: string[] = [
  '日志不要整份贴进内容里：先传到 mclo.gs 或 Gist，把链接写在内容里。',
  '提交后会拿到一个编号，凭编号就能在进度区找到自己的反馈。',
]

/** 联系方式说明：只给维护者看，不进公开列表 */
export const contactHint = '邮箱或其它联系方式（可选，只有维护者能看到）'

/** 备用渠道：反馈服务不可用（或未配置）时显示，填一个国内可直接访问的表单地址 */
export const FALLBACK_FEEDBACK_URL = ''
export const FALLBACK_FEEDBACK_LABEL = '国内备用表单'

export type FeedbackRecord = {
  id: string
  title: string
  version: string
  content: string
  images: string[]
  status: FeedbackStatusId
  createdAt: string
  updatedAt: string
  /** 早期记录指向原 issue；新提交没有这个字段 */
  legacyUrl?: string
  /** 同步到 issue 区后指向镜像 issue；未启用同步或还没建时没有这个字段 */
  issueUrl?: string
}

export type RecordsPayload = {
  generatedAt: string
  records: FeedbackRecord[]
}

/** 各状态的条数 */
export function statusCounts(records: FeedbackRecord[]): Record<FeedbackStatusId, number> {
  const counts: Record<FeedbackStatusId, number> = { pending: 0, investigating: 0, fixed: 0, closed: 0 }
  for (const record of records) {
    if (record.status in counts) counts[record.status] += 1
  }
  return counts
}

/** 图片地址：服务返回的是 /media/... 相对路径，历史记录是绝对外链 */
export function resolveImageUrl(src: string, api: string = FEEDBACK_API): string {
  if (/^https?:\/\//.test(src)) return src
  return `${api}${src.startsWith('/') ? '' : '/'}${src}`
}

/** 只读模式（未配置反馈服务）下让玩家能把内容交给维护者：标题 / 版本 / 内容 / 图片文件名 */
export function buildDraftText(input: { title: string; version: string; content: string; images: { name: string }[] }): string {
  const lines = [`标题：${input.title.trim()}`, `版本：${input.version}`, '', input.content.trim()]
  if (input.images.length) {
    lines.push('', `截图（${input.images.length} 张，需要另行发送）：${input.images.map((image) => image.name).join('、')}`)
  }
  return lines.join('\n')
}

/** 提交成功后给玩家一段可复制的回执，凭编号就能找回自己的反馈 */
export function buildReceiptText(record: FeedbackRecord): string {
  return [
    `编号：${record.id}`,
    `标题：${record.title}`,
    `版本：${record.version}`,
    `提交时间：${record.createdAt}`,
    '',
    `内容：${record.content}`,
    '',
    '（凭编号可在进度区找到这条反馈）',
  ].join('\n')
}
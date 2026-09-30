/**
 * 27 位伙伴的名册与初始训练值。
 *
 * 数据来源：ShotaPartner-Core 的 partner/character/CharacterProfiles.java（角色 id 与中文名）
 * 与 PartnerInitialStatsTable.java（六项初始训练值）。显示用的四项基础数值
 * （生命 20 / 攻击 2 / 防御 2 / 速度 0.25）在 27 位角色上完全相同，
 * 真正的差别在下面六项训练值上，所以表里只列这六项。
 */

export type StatKey = 'attack' | 'defense' | 'health' | 'work' | 'haste' | 'proficiency'

export const statLabels: { key: StatKey; label: string; hint: string }[] = [
  { key: 'attack', label: '攻击', hint: 'attackTraining' },
  { key: 'defense', label: '防御', hint: 'defenseTraining' },
  { key: 'health', label: '生命', hint: 'health' },
  { key: 'work', label: '工作', hint: 'workSpeed' },
  { key: 'haste', label: '急速', hint: 'skillHaste' },
  { key: 'proficiency', label: '熟练', hint: 'skillProficiency' },
]

/** 单项取值范围，用于把数字换算成相对高矮 */
export const envelope: Record<StatKey, [number, number]> = {
  attack: [21, 42],
  defense: [26, 36],
  health: [39, 70],
  work: [7, 25],
  haste: [16, 32],
  proficiency: [14, 41],
}

export type Partner = {
  id: string
  name: string
  /** 六项初始训练值，顺序与 statLabels 一致 */
  stats: [number, number, number, number, number, number]
}

export const partners: Partner[] = [
  { id: 'honger', name: '弘儿', stats: [28, 32, 60, 12, 22, 18] },
  { id: 'lengyu', name: '冷雨', stats: [36, 32, 58, 14, 18, 16] },
  { id: 'youzi', name: '柚子', stats: [42, 28, 48, 13, 22, 20] },
  { id: 'anxian', name: '安羡', stats: [26, 30, 50, 8, 28, 26] },
  { id: 'canyang', name: '灿阳', stats: [24, 36, 70, 11, 16, 14] },
  { id: 'duolexuan', name: '多乐轩', stats: [28, 26, 42, 21, 28, 36] },
  { id: 'jimi', name: '集咪', stats: [26, 30, 50, 24, 28, 26] },
  { id: 'lier', name: '哩儿', stats: [28, 26, 45, 16, 25, 36] },
  { id: 'luchen', name: '陆琛', stats: [34, 30, 56, 8, 20, 20] },
  { id: 'pangxie', name: '螃蟹', stats: [35, 30, 52, 10, 22, 21] },
  { id: 'xiangduishenglue', name: '相对省略', stats: [21, 28, 39, 13, 19, 41] },
  { id: 'xiaoxiaocheng', name: '小小橙', stats: [34, 26, 46, 7, 22, 32] },
  { id: 'yake', name: '犽可', stats: [23, 29, 55, 25, 32, 21] },
  { id: 'dlucxoket', name: 'D洛洛', stats: [40, 27, 44, 10, 29, 33] },
  { id: 'xingchen', name: '星尘', stats: [38, 28, 47, 15, 24, 22] },
  { id: 'yezi', name: '叶子', stats: [22, 31, 53, 18, 27, 30] },
  { id: 'dianchimao', name: '电池猫', stats: [33, 31, 54, 16, 23, 24] },
  { id: 'ruirui', name: '睿睿', stats: [32, 29, 49, 22, 21, 25] },
  { id: 'leilei', name: '磊磊', stats: [29, 34, 58, 12, 31, 19] },
  { id: 'ailu', name: '艾鲁', stats: [37, 29, 50, 11, 22, 23] },
  { id: 'ling', name: '零', stats: [36, 28, 48, 13, 25, 27] },
  { id: 'luolan', name: '罗兰', stats: [41, 26, 43, 9, 24, 28] },
  { id: 'guitou', name: '鬼头', stats: [24, 33, 59, 14, 26, 29] },
  { id: 'xiaohei', name: '小黑', stats: [39, 32, 57, 8, 19, 18] },
  { id: 'xiaoluo', name: '小洛', stats: [30, 27, 45, 17, 30, 24] },
  { id: 'songshu', name: '怂鼠', stats: [21, 26, 41, 25, 29, 23] },
]


/** 把某项数值换算成 0~1 的相对高度 */
export function statRatio(key: StatKey, value: number): number {
  const [min, max] = envelope[key]
  return Math.min(1, Math.max(0.06, (value - min) / (max - min)))
}

/** 取该角色相对最突出的两项，用于卡片上的一句定位 */
export function focusOf(partner: Partner): string {
  const scored = statLabels.map((stat, index) => ({
    label: stat.label,
    score: statRatio(stat.key, partner.stats[index]),
  }))
  const top = scored.sort((a, b) => b.score - a.score)
  const picked = top.filter((item) => item.score >= top[0].score - 0.16).slice(0, 2)
  return picked.map((item) => item.label).join(' · ')
}

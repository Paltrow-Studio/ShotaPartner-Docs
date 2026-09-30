/** 玩法章节的数据结构（渲染器在 components/Guide.tsx） */

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'steps'; items: string[] }
  | { kind: 'keys'; items: { key: string; desc: string }[] }
  | { kind: 'table'; head: string[]; rows: string[][]; caption?: string }
  | { kind: 'note'; title?: string; text: string }
  | { kind: 'sub'; text: string }

export type Chapter = {
  id: string
  mark: string
  title: string
  lede: string
  blocks: Block[]
}

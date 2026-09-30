/**
 * 三个 jar 的概要信息。数据来自各仓库的 mods.toml / gradle.properties。
 * 版本或前置变了，改这里；页面上的表格与反馈预填都读这份数据。
 */

export type ModuleId = 'core' | 'api' | 'school'

export type ModuleSummary = {
  id: ModuleId
  modId: string
  version: string
  role: string
  /** 必需前置 */
  needs: string[]
  /** 可选联动 */
  optional: string[]
  note: string
}

export const moduleSummaries: ModuleSummary[] = [
  {
    id: 'api',
    modId: 'shota_partner_api',
    version: '1.0.0',
    role: '前置 API',
    needs: ['Forge 47.4.23', 'Minecraft 1.20.1'],
    optional: [],
    note: '仅包含接口与共用逻辑，不注册任何游戏内容。本体与学校包均需安装，加载顺序在其之前。',
  },
  {
    id: 'core',
    modId: 'shota_partner',
    version: '0.3.1',
    role: '游戏本体',
    needs: ['ShotaPartner-API [1.0,2)', 'GeckoLib [4.8,5)', 'Forge 47.4.23', 'Minecraft 1.20.1'],
    optional: ['TACZ 枪械', 'Patchouli 手册', '机械动力 Create', 'PlayerAnimator'],
    note: '伙伴、技能、战斗、工作、方块与物品均位于该 jar。modId 与拆分前一致，旧存档可继续使用。',
  },
  {
    id: 'school',
    modId: 'shota_partner_extra_school',
    version: '1.0.0',
    role: '学校包（可选）',
    needs: ['ShotaPartner-API [1.0,2)', 'Forge 47.4.23', 'Minecraft 1.20.1'],
    optional: [
      'yuushya',
      'create',
      'doomsday_decoration',
      'refurbished_furniture',
      'arknights_furniture',
      'supplementaries',
      'framedblocks',
      'securitycraft',
      'parcool',
      'superbwarfare',
      'ags_modernmarkings',
      'kaleidoscope_cookery',
      'ywzj_midi',
    ],
    note: '学校维度、建筑模板与十二位学生。仅依赖前置 API，不需要本体，也不需要 GeckoLib。',
  },
]

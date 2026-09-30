/**
 * 三个模块的内容数据。
 * 事实来源：各仓库 README.md / mods.toml / docs 目录。
 * 修改版本号、前置或功能点时，请同步改这里（页面与反馈预填都读这份数据）。
 */

export type ModuleId = 'core' | 'api' | 'school'

export type Highlight = { title: string; desc: string }
export type Metric = { value: string; label: string }

export type ModuleInfo = {
  id: ModuleId
  /** 下拉/反馈里使用的短名 */
  shortName: string
  name: string
  modId: string
  version: string
  /** 一句话定位 */
  role: string
  /** 卡片主描述 */
  summary: string
  side: string
  metrics: Metric[]
  highlights: Highlight[]
  requires: string[]
  optional: string[]
  /** Tailwind 类名（必须写成完整字符串，Tailwind 需要静态扫描到） */
  accent: {
    text: string
    border: string
    bg: string
    gradient: string
    glow: string
    dot: string
  }
  badge: string
}

export const modules: ModuleInfo[] = [
  {
    id: 'core',
    shortName: 'Core',
    name: 'ShotaPartner-Core',
    modId: 'shota_partner',
    version: '0.3.1',
    role: '游戏本体',
    badge: '内容模组 · 必装',
    side: '客户端 + 服务端',
    metrics: [
      { value: '27', label: '位伙伴角色' },
      { value: '95.92%', label: '合并覆盖率' },
      { value: 'v3', label: '附属模组契约' },
      { value: '17', label: '个自定义物品' },
    ],
    highlights: [
      {
        title: '27 位伙伴，两种获取方式',
        desc: '25 位通过召唤获得；小黑与小洛是在世界中通过捕获石捕获的「看守者」。每位角色是独立的技能子包。',
      },
      {
        title: '专属技能与四种释放模式',
        desc: '瞬发 / 吟唱 / 持续 / 被动；长按 F 打开径向技能轮盘，松开释放选中的技能，短按保留原版副手交换。',
      },
      {
        title: '成长与属性分配',
        desc: '升级、属性点分配（攻击 / 防御 / 速度 / 工作）、训练提升、洗点石重置。',
      },
      {
        title: '战斗 AI 与哨卫模式',
        desc: '自动索敌、近战与远程自动切换、盾牌格挡、友军判定；支持留守哨卫。',
      },
      {
        title: '远程武器与投掷物',
        desc: '弓箭 / 弩 / TACZ 枪械的射击动画与后坐力；袜子（中毒）、捕捉球（未命中自动重投）。',
      },
      {
        title: '持续技能框架',
        desc: '跨 tick 的多帧技能（赤潮领域、突斩、坠击、蓄势、水流等），支持锚点追踪与阶段性效果。',
      },
      {
        title: '自定义状态效果',
        desc: '蓄力攻击、治愈增幅、石化、停滞等，配合 AI 冻结与渲染表现。',
      },
      {
        title: '坟墓与复活',
        desc: '伙伴死亡后生成墓碑十字架，可用复活器 UI 复活，也支持强制复活。',
      },
      {
        title: '抚摸与待机卖萌',
        desc: '抚摸伙伴获得战斗加成（力量增益）并有客户端动画反馈；玩家 AFK 一分钟后，白名单伙伴有概率播放卖萌动画。',
      },
      {
        title: '坐骑系统',
      },
      {
        title: '工作系统',
        desc: '农场耕种（打骨粉 / 浇水）、精华生产、巡逻、摇曲柄（机械动力 Create 软兼容）。',
      },
      {
        title: '后勤与自动化',
        desc: '队伍编组与召唤召回、仓库存储、全局跟随距离配置；自动拾取、自动进食、低血量自动喝药、装备同步、快捷整理。',
      },
      {
        title: 'HUD 与界面',
        desc: '队伍状态叠加层、药水效果图标、技能冷却显示，以及设置页、队伍编辑器、孵化器等 GUI。',
      },
      {
        title: '世界与集成',
        desc: '僵尸系实体贴图替换（7 个 Mixin）、帕秋莉手册（Patchouli）指南、TACZ 枪械联动。',
      },
    ],
    requires: ['ShotaPartner-API [1.0,2)', 'Forge 47.4.23', 'Minecraft 1.20.1', 'GeckoLib [4.8,5)'],
    optional: ['TACZ 枪械', 'Patchouli 手册', '机械动力 Create', 'PlayerAnimator（代码检测）'],
    accent: {
      text: 'text-violet-300',
      border: 'border-violet-400/30',
      bg: 'bg-violet-500/10',
      gradient: 'from-violet-500 to-fuchsia-500',
      glow: 'shadow-violet-500/25',
      dot: 'bg-violet-400',
    },
  },
  {
    id: 'api',
    shortName: 'API',
    name: 'ShotaPartner-API',
    modId: 'shota_partner_api',
    version: '1.0.0',
    role: '公共前置 · 契约层',
    badge: '公共前置 · 两个内容模块都依赖',
    summary:
      '只定义契约与共享的纯逻辑框架，不注册任何游戏内容。它是从单体模组中拆出来的「扩展支持入口」：第三方附属模组想要新增角色、技能、数据字段、网络包或动画后端，都通过这里的公开扩展点完成。',
    side: '客户端 + 服务端',
    metrics: [
      { value: '68', label: '个 public 类型' },
      { value: '99.63%', label: '合并覆盖率' },
      { value: 'v2', label: 'API 契约版本' },
      { value: '0', label: '个第三方依赖' },
    ],
    highlights: [
      {
        title: '统一扩展点集合',
        desc: 'PartnerRegistryBundle、PartnerCharacterRegistry、PartnerSkillRegistry、PartnerDataExtensions、PartnerAnimBackends、PartnerCommandApi、PartnerNetwork、PartnerServices、PartnerLifecycle 与 PartnerEvent（召唤 / 收回 / 升级 / 好感变化 / 技能释放）。',
      },
      {
        title: '网络：可协商协议版本',
        desc: '暴露数据包通道、线程安全的 packet id 分配，并用「协议版本集合」协商兼容范围，而不是要求严格相等。',
      },
      {
        title: '注册：按 modId 实例化',
        desc: 'DeferredRegister 在构造时绑定 modid，Forge 会校验命名空间，所以 API 不能替下游注册；注册束改为按 modId 创建。',
      },
      {
        title: '配置命名空间化',
        desc: '配置基类落在 config/<modId>/<file>，多个模组的配置不再互相覆盖。',
      },
      {
        title: '注册表两阶段校验',
        desc: '注册期只查重，等 freeze() 才做全量校验，附属模组因此可以安全扩展角色与技能表。',
      },
      {
        title: '存档扩展挂载点',
        desc: '伙伴 NBT 读取会剥离未知键（写进去的自定义键读档即丢且不报错），因此自定义数据必须走 data/extension 正式挂载点。',
      },
      {
        title: '全 JVM 静态状态清理',
        desc: 'PartnerLifecycle 统一登记与触发，换存档时第三方注册的静态状态也会被清理。',
      },
      {
        title: '共享纯逻辑框架',
        desc: '@MapNBT 反射序列化、PartnerData（57 个字段 + 白名单）、队伍 / 仓库 / 工作队列数据结构、好感度、技能系统与 10 个可复用效果。',
      },
      {
        title: '实体接口收敛',
        desc: 'IPartnerSkillCaster 把约 2800 行的 PartnerEntity 收敛成约 20 个稳定成员，技能实现不再直接依赖实体内部结构。',
      },
      {
        title: '动画后端安全回落',
        desc: '动画后端创建永不抛异常：任何失败都回落到 DisabledAnimBackend —— 这一步在实体反序列化阶段执行，漏出异常会导致无法进入存档。',
      },
      {
        title: '学校扩展点',
        desc: 'DimensionApi、TemplateInstaller、NpcApi 定义学校维度所需的一切契约，让学校包可以完全不依赖游戏本体。',
      },
      {
        title: '给附属模组作者的开发者文档',
        desc: '完整签名见源码 Javadoc；仓库内 docs/SPLIT_PLAN.md 记录拆分映射与迁移清单。',
      },
    ],
    requires: ['Forge 47.4.23', 'Minecraft 1.20.1'],
    optional: [],
    accent: {
      text: 'text-cyan-300',
      border: 'border-cyan-400/30',
      bg: 'bg-cyan-500/10',
      gradient: 'from-cyan-500 to-sky-500',
      glow: 'shadow-cyan-500/25',
      dot: 'bg-cyan-400',
    },
  },
  {
    id: 'school',
    shortName: 'Extra-School',
    name: 'ShotaPartner-Extra-School',
    modId: 'shota_partner_extra_school',
    version: '1.0.0',
    role: '学校维度追加包',
    badge: '可选追加包 · 不依赖游戏本体',
    summary:
      '学校维度、.mca 结构模板、学校居民 NPC，以及方块保护与机关清理。它只依赖公共前置 API，不依赖游戏本体 —— 学校内容可以脱离本体独立安装与升级。',
    side: '客户端 + 服务端',
    metrics: [
      { value: '13', label: '个 .mca 模板' },
      { value: '97.85%', label: '合并覆盖率' },
      { value: '12', label: '位 NPC 变体' },
      { value: '9216', label: '个模板区块' },
    ],
    highlights: [
      {
        title: '学校维度',
        desc: '纯数据驱动：虚空 + 模板区块。由 9 个 region、2 个 poi、2 个 entities 共 13 个 .mca 与 manifest 组成，展开 9 × 32 × 32 = 9216 个区块。',
      },
      {
        title: '学校 NPC 居民',
        desc: '12 位「随机正太」居民（6 校服 + 6 泳装），每种贴图全局唯一；泳装在泳池旁生成、校服在玩家附近生成，右键可交互对话。',
      },
      {
        title: '自动补位与去重',
        desc: '200 tick 巡检、1200 tick 补位冷却；皮肤池按原子方式占用，避免多人同时生成时抢占同一张贴图。',
      },
      {
        title: '方块保护',
      },
      {
        title: '机制清理',
      },
      {
        title: '安全兜底',
        desc: '1 个 Mixin 阻止学校维度内火焰蔓延，配合和平模式处理器与 forceload 守卫。',
      },
      {
        title: '传送门与站门表现',
        desc: '学校传送门方块（刻意不注册 BlockItem，防止被带走）与站门倒计时叠加层。',
      },
      {
        title: '独立的对话界面',
        desc: 'OpenNpcDialogueS2CPacket + NpcDialogueScreen，服务端驱动、客户端呈现。',
      },
      {
        title: '模板缺失兜底',
        desc: '13 个第三方建筑 / 装饰模组全部是软前置；未安装时未注册的方块会被原位替换为空气，玩家只会看到装饰空洞，不会崩溃。',
      },
      {
        title: '不依赖本体也能有动画',
        desc: '按同一份骨骼约束表自建动画控制器与模型叠加层；装了游戏本体时复用其程序化动画引擎（观感与拆分前一致），没装时自动回落为无待机动作。',
      },
      {
        title: '学校专用命令',
      },
      {
        title: '独立配置',
        desc: '使用 API 的命名空间配置基类，配置落在 config/shota_partner_extra_school/，不会与本体配置串扰。',
      },
    ],
    requires: ['ShotaPartner-API [1.0,2)', 'Forge 47.4.23', 'Minecraft 1.20.1'],
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
    accent: {
      text: 'text-amber-300',
      border: 'border-amber-400/30',
      bg: 'bg-amber-500/10',
      gradient: 'from-amber-500 to-orange-500',
      glow: 'shadow-amber-500/25',
      dot: 'bg-amber-400',
    },
  },
]

export const moduleById = (id: ModuleId): ModuleInfo => {
  const found = modules.find((m) => m.id === id)
  if (!found) throw new Error(`未知模块: ${id}`)
  return found
}

/** 依赖关系节点（架构图用） */
export const architectureNodes: {
  id: ModuleId | 'players'
  title: string
  subtitle: string
  detail: string
}[] = [
  {
    id: 'api',
    title: 'ShotaPartner-API',
    subtitle: '公共契约层 · 前置',
    detail: '只定义契约与共享纯逻辑，不注册任何游戏内容；两个内容模块都以 mandatory 依赖它。',
  },
  {
    id: 'core',
    title: 'ShotaPartner-Core',
    subtitle: '游戏本体 · 内容模组',
    detail: '27 位伙伴与全部玩法内容；modId 与拆分前完全一致，是存档与旧附属模组的锚点。',
  },
  {
    id: 'school',
    title: 'ShotaPartner-Extra-School',
    subtitle: '学校追加包 · 可选',
    detail: '只依赖 API。学校需要本体能力时调用 API 的扩展点（如 DimensionApi），而不是新增对 Core 的依赖。',
  },
]

/** 设计要点：为什么这样拆 */
export const designPoints: { title: string; desc: string }[] = [
  {
    title: '存档与附属模组不搬家',
    desc: '游戏本体的 modId 保持 shota_partner 不变；旧存档、旧第三方附属模组的依赖声明全部继续生效。',
  },
  {
    title: '依赖方向反转',
    desc: '以前学校直接调用本体的队伍服务；现在学校调用 API 的 DimensionApi / PartnerServices，由本体注册监听者，依赖箭头反转。',
  },
  {
    title: '一份契约，两个内容包',
    desc: 'API 冻结角色 / 技能 / 数据扩展注册表，且注册必须早于 FMLCommonSetupEvent —— 之后注册会被拒绝，这是有意为之。',
  },
  {
    title: '两层版本号，防止静默崩溃',
    desc: '对下游两个仓库用 API 契约版本（v2）；对已发布的第三方附属模组用附属契约版本（v3）。破坏性变更才 +1，并由测试保证同步。',
  },
]

// ── Internationalization ─────────────────────────────────────────────────────

export type Locale = 'en' | 'zh';

export interface I18nStrings {
  // Menu
  systemOffline: string;
  menuDescription: string;
  initializeCore: string;
  customMode: string;
  tutorial: string;

  // HUD
  wave: string;
  wires: string;
  score: string;
  nextWaveIn: (seconds: number) => string;
  pause: string;
  resume: string;

  // Pick overlay
  waveCleared: (wave: number) => string;
  systemUpgrade: string;
  pickDescription: string;
  /** Extra fixed pick after boss wave (wire / generator / shield) */
  bossBonusPickTitle: string;
  bossBonusPickDescription: string;

  // Paused
  systemPaused: string;
  exitToMenu: string;

  // Game over
  coreBreached: string;
  systemFailure: string;
  finalScore: string;
  survivedWaves: (waves: number) => string;
  rebootSystem: string;

  // Sidebar
  inventory: string;
  hidePanel: string;
  showPanel: string;
  placeMonster: string;
  clickToRotate: string;
  dragToWire: string;
  clickToPlaceMonster: string;
  monsterType: string;
  staticMonster: string;
  staticMonsterHint: string;
  openPick: string;

  // Shop & Gold
  gold: string;
  shop: string;
  refreshShop: string;
  refreshShopDesc: (cost: number) => string;
  repair: string;
  repairDesc: (cost: number) => string;
  towerPack: string;
  towerPackDesc: string;
  infraPack: string;
  infraPackDesc: string;
  advancedPack: string;
  advancedPackDesc: string;
  commandCardPack: string;
  commandCardPackDesc: string;
  baseUpgradePack: string;
  baseUpgradePackDesc: string;
  sell: string;
  notEnoughGold: string;
  shopPickTitle: string;
  shopPickDescription: string;
  commandCardPickTitle: string;
  commandCardPickDescription: string;
  baseUpgradePickTitle: string;
  baseUpgradePickDescription: string;

  // Wave
  startNextWave: string;

  // Toast
  noWires: string;
  autoDeployFailed: string;
  coreCannotMove: string;
  commandCardCannotUse: string;
  commandCardMachineMaxed: string;
  repairCannotUse: string;
  baseUpgradeCannotUse: string;

  // Pick stats bar
  statHp: string;
  statRange: string;
  statAtk: string;
  statPow: string;

  // Tutorial
  tutorialSkip: string;
  tutorialNext: string;
  tutorialDone: string;
  wireTutorialDragPortOnly: string;
  tutorialSteps: {
    title: string;
    text: string;
    action?: string;
  }[];
  postWaveTutorialSteps: {
    title: string;
    text: string;
    action?: string;
  }[];

  // Sidebar tips
  gameTips: Record<string, string>;

  // Tower names
  towerName: Record<string, string>;
  commandCard: string;
  emptyCommandCards: string;
  commandCardName: Record<string, string>;
  commandCardDesc: Record<string, string>;
  baseUpgradeName: Record<string, string>;
  baseUpgradeDesc: Record<string, string>;
  enemyName: Record<string, string>;

  // Tower descriptions (for tooltip & pick cards)
  towerDesc: Record<string, string>;

  /** Sidebar codex button + full machine guide (multi-paragraph, \\n\\n separated) */
  codexButton: string;
  towerCodex: Record<string, string>;

  // Controls guide (top-left overlay)
  controlsGuide: Array<{ keys: string[]; action: string }>;

  // Pick labels (may differ from tower names, e.g. "Blaster x2")
  pickLabel: Record<string, string>;
  // Pick descriptions
  pickDesc: Record<string, string>;
}

const en: I18nStrings = {
  systemOffline: 'SYSTEM OFFLINE',
  menuDescription: 'Place and connect machines to defend the Core. After each wave, choose an upgrade to strengthen your defense. If the Core falls, the system dies.',
  initializeCore: 'INITIALIZE CORE',
  customMode: 'Custom Mode',
  tutorial: 'Tutorial',

  wave: 'Wave',
  wires: 'Wires',
  score: 'Score',
  nextWaveIn: (s) => `Next wave in ${s}s`,
  pause: 'Pause',
  resume: 'Resume',

  waveCleared: (w) => `WAVE ${w} CLEARED`,
  systemUpgrade: 'SYSTEM UPGRADE',
  pickDescription: 'Choose one upgrade for your defense network',
  bossBonusPickTitle: 'BOSS SUPPLY DROP',
  bossBonusPickDescription: 'Boss defeated — choose one: wires, generator, or shield.',

  systemPaused: 'SYSTEM PAUSED',
  exitToMenu: 'EXIT TO MENU',

  coreBreached: 'CORE BREACHED',
  systemFailure: 'SYSTEM FAILURE',
  finalScore: 'Final Score',
  survivedWaves: (w) => `Survived ${w} Waves`,
  rebootSystem: 'REBOOT SYSTEM',

  inventory: 'Inventory',
  hidePanel: 'Hide panel',
  showPanel: 'Show panel',
  placeMonster: 'Place Monster',
  clickToRotate: 'Click machine to rotate',
  dragToWire: 'Drag port to wire',
  clickToPlaceMonster: 'Click map to place a stationary monster',
  monsterType: 'Monster Type',
  staticMonster: 'Stationary',
  staticMonsterHint: 'When off, placed monsters behave normally',
  openPick: 'Open Upgrade Pick',

  gold: 'Gold',
  shop: 'Shop',
  refreshShop: 'Refresh',
  refreshShopDesc: (cost: number) => `Refresh shop offers for ${cost} gold`,
  repair: 'Repair',
  repairDesc: (cost: number) => `Repair a damaged machine or ruin for ${cost} gold`,
  towerPack: 'Turret Pack',
  towerPackDesc: 'Pick 1 of 3 random turrets',
  infraPack: 'Infra Pack',
  infraPackDesc: 'Pick 1 of 3 infra items',
  advancedPack: 'Advanced Pack',
  advancedPackDesc: 'Random advanced machine',
  commandCardPack: 'Command Pack',
  commandCardPackDesc: 'Pick 1 of 3 non-Core command cards',
  baseUpgradePack: 'Base Upgrade Pack',
  baseUpgradePackDesc: 'Pick 1 of 3 Core upgrades',
  sell: 'Sell',
  notEnoughGold: 'Not enough gold!',
  shopPickTitle: 'SHOP PURCHASE',
  shopPickDescription: 'Choose one item from the pack',
  commandCardPickTitle: 'COMMAND PACK',
  commandCardPickDescription: 'Choose one command card',
  baseUpgradePickTitle: 'BASE UPGRADE PACK',
  baseUpgradePickDescription: 'Choose one Core upgrade',

  startNextWave: 'Start Next Wave',
  noWires: 'No wires available!',
  autoDeployFailed: 'No open space near the Core for this tower.',
  coreCannotMove: 'Core cannot be moved or rotated!',
  commandCardCannotUse: 'Cannot use command card',
  commandCardMachineMaxed: 'This machine is already fully upgraded',
  repairCannotUse: 'Choose a damaged machine or ruin',
  baseUpgradeCannotUse: 'Cannot apply base upgrade',
  statHp: 'HP',
  statRange: 'Range',
  statAtk: 'Atk',
  statPow: 'Pow/Shot',

  tutorialSkip: 'Skip',
  tutorialNext: 'Next',
  tutorialDone: 'Start Playing!',
  wireTutorialDragPortOnly: 'Drag a machine port to connect the cable',
  tutorialSteps: [
    { title: 'Your Core', text: 'The Core makes power. Do not let it fall.' },
    { title: 'Plug Turret', text: 'Move the turret until its port touches a Core port.', action: 'Plug turret into Core' },
    { title: 'Plug Generator', text: 'Move the generator until its port touches the turret.', action: 'Plug generator into turret' },
    { title: 'Start the Wave', text: 'Powered turrets glow and fire. Click Start Next Wave to test this defense.', action: 'Click Start Next Wave' },
  ],
  postWaveTutorialSteps: [
    { title: 'Pick One of Three', text: 'After each wave, choose 1 of 3 upgrades. This first reward is a Generator in the middle slot; choose it so the next defenses have more power.', action: 'Pick the Generator' },
    { title: 'Wire Ports', text: 'Drag from the Generator output port to a turret input port to link power across distance.', action: 'Drag from output to input' },
  ],

  gameTips: {
    tipMoveTurret: 'Move turrets closer to where enemies appear for better coverage.',
    tipBalanceEnergy: 'Balance energy generation and consumption to keep all turrets powered.',
    tipHoverIcon: 'Hover over a machine icon to read its description.',
    tipRotateTower: 'Click a placed tower to rotate it, or press Q for quick rotation.',
    tipWireConnect: 'Drag between ports to create wires — towers need power to fire!',
    tipShieldReboot: 'A destroyed shield needs 3 power to reboot. Keep generators connected!',
    tipGeneratorExpand: 'Generators extend your power network — place them between the Core and distant turrets.',
    tipBusMultiplex: 'A Bus merges 3 input wires into 3 outputs, simplifying complex layouts.',
    tipSniperPierce: 'Sniper shots pierce through all enemies in a line — line them up!',
    tipTeslaChain: 'Tesla lightning bounces between nearby enemies — great vs. swarms.',
  },

  towerName: {
    blaster: 'Blaster',
    gatling: 'Gatling',
    sniper: 'Sniper',
    tesla: 'Tesla',
    generator: 'Generator',
    shield: 'Shield',
    battery: 'Battery',
    bus: 'Bus',
    missile: 'Missile',
    big_generator: 'Big Generator',
    repair_drone: 'Repair Drone',
    core: 'Core',
  },

  commandCard: 'Command Cards',
  emptyCommandCards: 'No command cards',
  commandCardName: {
    add_input: 'Add Input',
    add_output: 'Add Output',
    self_power: 'Self Power',
    range_boost: 'Range Boost',
  },
  commandCardDesc: {
    add_input: 'Add one input port to a machine.',
    add_output: 'Add one output port to a machine.',
    self_power: 'Give a machine 1 self-generated power every 2 seconds.',
    range_boost: 'Increase a machine attack range by 20%.',
  },
  baseUpgradeName: {
    core_power_boost: 'Core Power Boost',
    core_turret_unlock: 'Core Turret',
    core_shield_unlock: 'Core Shield',
  },
  baseUpgradeDesc: {
    core_power_boost: 'Core dispatches 1 extra power pulse.',
    core_turret_unlock: 'Core gains a basic turret.',
    core_shield_unlock: 'Core gains a basic shield.',
  },

  enemyName: {
    scout: 'Scout',
    grunt: 'Grunt',
    tank: 'Tank',
    saboteur: 'Saboteur',
    overlord: 'Overlord',
  },

  towerDesc: {
    core: 'The heart of your defense. Generates power.',
    blaster: 'Fires a bullet per 2 power. Reliable turret.',
    gatling: 'Each power becomes 4 bullets. Fires up to 10 shots/sec.',
    sniper: 'High-damage piercing shot. Costs 4 power.',
    tesla: 'Chain lightning bounces between enemies.',
    generator: 'Power source for the network. Dispatches energy.',
    shield: 'Projects a protective shield. Consumes power to recharge.',
    battery: 'Stores 4 units of power and discharges quickly.',
    bus: 'Merges up to 3 input wires into 3 outputs.',
    missile: 'Long-range launcher with four silos. Each missile costs 4 power and lands with splash damage.',
    big_generator: 'Large power source. Produces 4 power every 2 seconds.',
    repair_drone: 'Sends drones carrying power to repair damaged buildings.',
  },

  codexButton: 'Codex',
  towerCodex: {
    blaster:
      'Role: steady single-target damage.\n\nEach shot costs 2 power. Power pulses travel along wires from the Core or Generators; the turret must be connected and receiving energy to fire.\n\nTips: place with a clear line of sight to spawn lanes; click the placed turret to rotate the barrel toward threats. Good as a backbone turret when power is stable.',
    gatling:
      'Role: sustained DPS with capped fire rate.\n\nEach incoming power becomes 4 bullets. The turret fires those bullets at up to 10 shots per second while heat still affects spread and overload risk.\n\nTips: best against waves and clusters; pair with reliable wiring so it keeps a healthy ammo queue during fights.',
    sniper:
      'Role: burst damage on a line.\n\nEach shot costs 4 power and pierces all enemies along its firing line, with a longer cooldown between shots.\n\nTips: align the turret so enemies walk in a straight line through the beam; excellent for choke points. Rotate after placement to maximize pierce value.',
    tesla:
      'Role: area control via chained lightning.\n\nLightning jumps between nearby enemies, strong against tight groups. Higher max power storage than basic turrets—plan wiring accordingly.\n\nTips: pull enemies into clusters before arcs connect; less ideal for very spread-out paths unless you have multiple teslas.',
    generator:
      'Role: extends your power network.\n\nLike the Core, it dispatches energy pulses on an interval. Use it when turrets are far from the Core or when one line cannot supply enough devices.\n\nTips: place between the Core and forward defenses; connect inputs from the network and outputs toward front-line turrets.',
    shield:
      'Role: bubble shield that absorbs damage for buildings inside.\n\nThe shield recharges using power. If broken, it needs enough stored power (e.g. 3 units) to reboot—keep it wired.\n\nTips: center the bubble on the Core or a cluster of key turrets; do not leave it unwired or it will fall quickly under focus fire.',
    battery:
      'Role: short-term energy reservoir.\n\nStores up to 4 power and releases it quickly to nearby consumers, smoothing spikes when many turrets fire at once.\n\nTips: place between your main power path and hungry turrets (Gatling, Sniper, Tesla); wire battery input from generators/core and output toward the front line.',
    bus:
      'Role: wiring hub — simplifies messy layouts.\n\nAccepts up to 3 input wires and can drive up to 3 outputs, merging and redistributing pulses.\n\nTips: use at junctions where many cables would cross; not a power source by itself—still needs energy from Core/Generators upstream.',
  },

  controlsGuide: [
    { keys: ['esc'], action: 'Cancel current action' },
    { keys: ['leftClick'], action: 'Select / Place tower' },
    { keys: ['leftDrag'], action: 'Pan the map' },
    { keys: ['towerClick'], action: 'Rotate tower' },
    { keys: ['q'], action: 'Quick rotate selected tower' },
    { keys: ['rightClick'], action: 'Delete wire / tower' },
    { keys: ['wheel'], action: 'Zoom in / out' },
    { keys: ['portDrag'], action: 'Connect wire' },
  ],

  pickLabel: {
    'blaster_1': 'Blaster',
    'blaster_2': 'Blaster x2',
    'gatling_1': 'Gatling',
    'sniper_1': 'Sniper',
    'tesla_1': 'Tesla',
    'generator_1': 'Generator',
    'shield_1': 'Shield',
    'battery_1': 'Battery',
    'bus_1': 'Bus',
    'missile_1': 'Missile',
    'big_generator_1': 'Big Generator',
    'repair_drone_1': 'Repair Drone',
    'wire_3': 'Wire x3',
    'wire_5': 'Wire x5',
    'add_input_1': 'Add Input',
    'add_output_1': 'Add Output',
    'self_power_1': 'Self Power',
    'range_boost_1': 'Range Boost',
    'core_power_boost_1': 'Core Power Boost',
    'core_turret_unlock_1': 'Core Turret',
    'core_shield_unlock_1': 'Core Shield',
  },

  pickDesc: {
    'blaster_1': 'Fires a bullet per 2 power',
    'blaster_2': 'Two standard turrets',
    'gatling_1': '4 bullets per power, max 10 shots/sec',
    'sniper_1': 'Piercing line shot, long cooldown',
    'tesla_1': 'Chain lightning between enemies',
    'generator_1': 'Power source for the network',
    'shield_1': 'Projects a protective bubble',
    'battery_1': 'Stores power, discharges rapidly',
    'bus_1': 'Merges 3 inputs into 3 outputs',
    'missile_1': 'Four silos, 4 power per arcing missile',
    'big_generator_1': 'Produces 4 power every 2 seconds',
    'repair_drone_1': 'Sends repair drones with stored power',
    'wire_3': 'Power line connectors',
    'wire_5': 'Large bundle of power lines',
    'add_input_1': 'Add one input port',
    'add_output_1': 'Add one output port',
    'self_power_1': 'Generate power on one machine',
    'range_boost_1': 'Increase one machine range',
    'core_power_boost_1': 'Increase Core power output',
    'core_turret_unlock_1': 'Add basic Core firepower',
    'core_shield_unlock_1': 'Add a basic Core shield',
  },
};

const zh: I18nStrings = {
  systemOffline: '系统离线',
  menuDescription: '放置并连接机器来保卫核心。每波结束后选择升级来加强防御。如果核心陷落，系统将崩溃。',
  initializeCore: '启动核心',
  customMode: '自定义模式',
  tutorial: '新手教程',

  wave: '波次',
  wires: '线缆',
  score: '分数',
  nextWaveIn: (s) => `下一波 ${s}秒`,
  pause: '暂停',
  resume: '继续',

  waveCleared: (w) => `第 ${w} 波 已清除`,
  systemUpgrade: '系统升级',
  pickDescription: '为你的防御网络选择一项升级',
  bossBonusPickTitle: 'Boss 额外补给',
  bossBonusPickDescription: '击败 Boss 后的定向三选一：线缆、发电机、护盾塔各一项，请选其一。',

  systemPaused: '系统暂停',
  exitToMenu: '退出到主界面',

  coreBreached: '核心失守',
  systemFailure: '系统崩溃',
  finalScore: '最终分数',
  survivedWaves: (w) => `存活 ${w} 波`,
  rebootSystem: '重启系统',

  inventory: '库存',
  hidePanel: '隐藏面板',
  showPanel: '显示面板',
  placeMonster: '放置怪物',
  clickToRotate: '点击机器旋转',
  dragToWire: '拖拽端口连线',
  clickToPlaceMonster: '点击地图放置一个静止怪物',
  monsterType: '怪物类型',
  staticMonster: '是否静止',
  staticMonsterHint: '关闭后，放置的怪物会按正常逻辑移动和攻击',
  openPick: '开启三选一',

  gold: '金币',
  shop: '商店',
  refreshShop: '刷新',
  refreshShopDesc: (cost: number) => `花费 ${cost} 金币刷新商店商品`,
  repair: '维修',
  repairDesc: (cost: number) => `花费 ${cost} 金币维修受损机器或废墟`,
  towerPack: '炮塔卡包',
  towerPackDesc: '获得一次只含炮塔的三选一',
  infraPack: '基建卡包',
  infraPackDesc: '获得一次只含基建的三选一',
  advancedPack: '高级卡包',
  advancedPackDesc: '随机获得一台高级机器',
  commandCardPack: '指令卡包',
  commandCardPackDesc: '获得一次非基地指令卡三选一',
  baseUpgradePack: '基地升级包',
  baseUpgradePackDesc: '获得一次基地升级三选一',
  sell: '出售',
  notEnoughGold: '金币不足！',
  shopPickTitle: '商店购买',
  shopPickDescription: '从卡包中选择一项',
  commandCardPickTitle: '指令卡包',
  commandCardPickDescription: '选择一张指令卡',
  baseUpgradePickTitle: '基地升级包',
  baseUpgradePickDescription: '选择一项基地升级',

  startNextWave: '开启下一波',
  noWires: '没有可用的线缆！',
  autoDeployFailed: '主基地附近没有可部署这座防御塔的空地。',
  coreCannotMove: '主基地无法拖动和旋转！',
  commandCardCannotUse: '无法使用指令卡',
  commandCardMachineMaxed: '这台机器已经满级',
  repairCannotUse: '请选择受损机器或废墟',
  baseUpgradeCannotUse: '无法应用基地升级',
  statHp: '血量',
  statRange: '射程',
  statAtk: '攻击',
  statPow: '耗电/发',

  tutorialSkip: '跳过',
  tutorialNext: '下一步',
  tutorialDone: '开始游戏！',
  wireTutorialDragPortOnly: '请拖拽机器接口进行电缆连接',
  tutorialSteps: [
    { title: '你的核心', text: '核心产出电力，别让它被摧毁。' },
    { title: '炮台直插', text: '拖动炮台，让端口贴住核心端口。', action: '炮台直插核心' },
    { title: '发电机直插', text: '拖动发电机，让端口贴住炮台端口。', action: '发电机直插炮台' },
    { title: '开启波次', text: '通电的炮塔会发光并自动开火。点击【开启下一波】来测试这条防线。', action: '点击开启下一波' },
  ],
  postWaveTutorialSteps: [
    { title: '三选一奖励', text: '每波结束后会出现 3 个升级选项，只能选择 1 个。本次中间位置固定为发电机，请选择它，为后续防线提供更多电力。', action: '选择发电机' },
    { title: '端口连线', text: '从发电机输出口拖到炮塔输入口，就可以远距离传输电力。', action: '从输出口拖到输入口' },
  ],

  gameTips: {
    tipMoveTurret: '可以移动炮塔到有敌人的位置射击，覆盖更多区域。',
    tipBalanceEnergy: '注意平衡能源的生成与消耗，确保所有炮塔持续供电。',
    tipHoverIcon: '鼠标停在机器图标上可以阅读其简介。',
    tipRotateTower: '点击已放置的设备可以旋转，也可以按 Q 键快速旋转。',
    tipWireConnect: '在端口之间拖拽来创建线缆——设备需要通电才能运作！',
    tipShieldReboot: '护盾塔护罩被击破后需要 3 格电才能重启，记得保持发电机连接！',
    tipGeneratorExpand: '发电机可以扩展电网——放在核心和远处炮塔之间中转电力。',
    tipBusMultiplex: '插线板能将 3 条输入线合并为 3 条输出，简化复杂布局。',
    tipSniperPierce: '狙击塔的子弹可以穿透一条线上的所有敌人——排列好角度！',
    tipTeslaChain: '电磁炮的闪电会在临近敌人之间弹射——对付大群敌人效果拔群。',
  },

  towerName: {
    blaster: '加农炮',
    gatling: '加特林',
    sniper: '狙击塔',
    tesla: '电磁炮',
    generator: '发电机',
    shield: '护盾塔',
    battery: '蓄电池',
    bus: '插线板',
    missile: '导弹',
    big_generator: '大发电机',
    repair_drone: '维修无人机',
    core: '核心',
  },

  commandCard: '指令卡',
  emptyCommandCards: '暂无指令卡',
  commandCardName: {
    add_input: '增加输入口',
    add_output: '增加输出口',
    self_power: '自发电',
    range_boost: '射程增加',
  },
  commandCardDesc: {
    add_input: '为一台机器增加 1 个输入口。',
    add_output: '为一台机器增加 1 个输出口。',
    self_power: '使一台机器每 2 秒自发 1 格电。',
    range_boost: '使一台攻击机器射程提升 20%。',
  },
  baseUpgradeName: {
    core_power_boost: '发电量提升',
    core_turret_unlock: '增加炮台功能',
    core_shield_unlock: '增加护盾功能',
  },
  baseUpgradeDesc: {
    core_power_boost: '主基地每次发电额外发出 1 个脉冲。',
    core_turret_unlock: '为主基地增加基础炮台功能。',
    core_shield_unlock: '为主基地增加基础护盾功能。',
  },

  enemyName: {
    scout: '侦察兵',
    grunt: '步兵',
    tank: '坦克',
    saboteur: '破坏者',
    overlord: '霸主',
  },

  towerDesc: {
    core: '防御核心，生成能量。',
    blaster: '消耗2格电发射子弹，可靠炮塔。',
    gatling: '每格电转化为4发子弹，最多每秒10发。',
    sniper: '高伤穿透射击，消耗4格电。',
    tesla: '闪电在敌人间连锁弹射。',
    generator: '为网络供电，分配能量。',
    shield: '投射防护罩，消耗能量充能。',
    battery: '存储4格电，快速放电。',
    bus: '合并最多3条输入线为3条输出。',
    missile: '四宫格导弹发射井，每枚导弹消耗4格电，弧线追踪并造成范围伤害。',
    big_generator: '大型能源设备，每2秒生产4个电。',
    repair_drone: '派出携带电力的无人机，前往受损建筑附近执行维修。',
  },

  codexButton: '图鉴',
  towerCodex: {
    blaster:
      '定位：加农炮——稳定单体输出，性价比高。\n\n每次开火消耗 2 格电力。能量沿线缆从核心或发电机传来，必须连通电网且正在受电才能射击。\n\n用法建议：放在能俯视刷怪方向的位置；放置后点击旋转炮口。电力稳定时适合作为主力炮塔。',
    gatling:
      '定位：持续火力，稳定限速输出。\n\n每接收 1 格电就转化为 4 发子弹，并以最多每秒 10 发的速度持续射击。热量仍会影响散布，并在过热时暂时停火。\n\n用法建议：适合应对密集波次；务必保证线缆可靠，让它在交战时保持足够弹药储备。',
    sniper:
      '定位：狙击塔——直线高爆发、穿透杀伤。\n\n每发消耗 4 格电，冷却较长，但一发可穿透路径上所有敌人。\n\n用法建议：把敌人走位收成一条线时收益最大，适合隘口；放置后旋转找好穿透角度。',
    tesla:
      '定位：电磁炮——连锁闪电，克制聚堆敌人。\n\n电弧在临近敌人之间跳跃，对成群目标特别有效。储电上限较高，布线时预留容量。\n\n用法建议：引诱或迫使敌人聚拢；若路线过于分散，可多座配合覆盖。',
    generator:
      '定位：扩展电网，远程供电。\n\n与核心类似，按周期向网络派发能量脉冲。当前方炮塔离核心太远或单线负载不足时使用。\n\n用法建议：放在核心与前线之间作“中继”；输入接上游，输出指向下游炮塔。',
    shield:
      '定位：护盾塔——展开范围护罩，吸收伤害保护圈内建筑。\n\n护罩会消耗电力充能；被击破后需要积累一定电力（例如 3 格）才能重启，请保持连接。\n\n用法建议：罩住核心或关键炮塔群；不要长时间断电否则极易被集火打穿。',
    battery:
      '定位：缓冲池，平滑用电尖峰。\n\n最多存 4 格电并快速放出，适合多炮塔同时开火的瞬间。\n\n用法建议：放在主供电路径与耗电大户（加特林、狙击塔、电磁炮等）之间；输入接发电机/核心，输出通往前线。',
    bus:
      '定位：汇流与分线，整理复杂布线。\n\n最多合并 3 条输入线，并分出最多 3 条输出，用于十字路口式走线。\n\n用法建议：线缆容易交叉纠缠时用插线板收束；它本身不产生能量，上游仍需核心或发电机供能。',
  },

  controlsGuide: [
    { keys: ['esc'], action: '取消当前操作' },
    { keys: ['leftClick'], action: '选中 / 放置设备' },
    { keys: ['leftDrag'], action: '平移地图' },
    { keys: ['towerClick'], action: '旋转设备' },
    { keys: ['q'], action: '快速旋转选中设备' },
    { keys: ['rightClick'], action: '删除线缆 / 设备' },
    { keys: ['wheel'], action: '缩放地图' },
    { keys: ['portDrag'], action: '连接线缆' },
  ],

  pickLabel: {
    'blaster_1': '加农炮',
    'blaster_2': '加农炮 x2',
    'gatling_1': '加特林',
    'sniper_1': '狙击塔',
    'tesla_1': '电磁炮',
    'generator_1': '发电机',
    'shield_1': '护盾塔',
    'battery_1': '蓄电池',
    'bus_1': '插线板',
    'missile_1': '导弹',
    'big_generator_1': '大发电机',
    'repair_drone_1': '维修无人机',
    'wire_3': '线缆 x3',
    'wire_5': '线缆 x5',
    'add_input_1': '增加输入口',
    'add_output_1': '增加输出口',
    'self_power_1': '自发电',
    'range_boost_1': '射程增加',
    'core_power_boost_1': '发电量提升',
    'core_turret_unlock_1': '增加炮台功能',
    'core_shield_unlock_1': '增加护盾功能',
  },

  pickDesc: {
    'blaster_1': '每2格电发射一发子弹',
    'blaster_2': '两座标准炮塔',
    'gatling_1': '1电4发，最多每秒10发',
    'sniper_1': '穿透直线射击，长冷却',
    'tesla_1': '闪电在敌人间弹射',
    'generator_1': '为网络提供能量',
    'shield_1': '投射防护罩',
    'battery_1': '存储能量，快速放电',
    'bus_1': '合并3条输入为3条输出',
    'missile_1': '4个发射井，每4格电发射1枚弧线追踪导弹',
    'big_generator_1': '每2秒生产4个电',
    'repair_drone_1': '派出携电无人机维修建筑',
    'wire_3': '电力线缆连接器',
    'wire_5': '大捆电力线缆',
    'add_input_1': '增加一个机器输入口',
    'add_output_1': '增加一个机器输出口',
    'self_power_1': '让一台机器自行发电',
    'range_boost_1': '提升一台机器的射程',
    'core_power_boost_1': '提升主基地发电量',
    'core_turret_unlock_1': '让主基地获得基础炮台',
    'core_shield_unlock_1': '让主基地获得基础护盾',
  },
};

const locales: Record<Locale, I18nStrings> = { en, zh };

let currentLocale: Locale = 'zh';

export const setLocale = (l: Locale) => { currentLocale = l; };
export const getLocale = (): Locale => currentLocale;
export const t = (): I18nStrings => locales[currentLocale];

/** Helper to get pick key from pool entry */
export const pickKey = (kind: string, towerType?: string, count?: number): string => {
  if (kind === 'wire') return `wire_${count}`;
  if (kind === 'command_card') return `${towerType}_${count}`;
  if (kind === 'base_upgrade') return `${towerType}_${count}`;
  return `${towerType}_${count}`;
};

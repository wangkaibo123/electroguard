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
  showPickChoices: string;
  viewBattle: string;
  /** Extra fixed pick after boss wave (wire / generator / shield) */
  bossBonusPickTitle: string;
  bossBonusPickDescription: string;

  // Paused
  systemPaused: string;
  switchToLandscape: string;
  switchToPortrait: string;
  orientationSwitchUnsupported: string;
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
  sponsoredGold: (amount: number) => string;
  sponsoredGoldDesc: (amount: number) => string;
  sponsoredGoldLoading: string;
  sponsoredGoldGranted: (amount: number) => string;
  rewardedAdUnavailable: string;
  rewardedAdIncomplete: string;
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
  shopTutorialStep: {
    title: string;
    text: string;
    action?: string;
  };
  shopMachineControlTutorialStep: {
    title: string;
    text: string;
    action?: string;
  };

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
  showPickChoices: 'Show choices',
  viewBattle: 'View battlefield',
  bossBonusPickTitle: 'BOSS SUPPLY DROP',
  bossBonusPickDescription: 'Boss defeated — choose one: wires, generator, or shield.',

  systemPaused: 'SYSTEM PAUSED',
  switchToLandscape: 'Switch to Landscape',
  switchToPortrait: 'Switch to Portrait',
  orientationSwitchUnsupported: 'Orientation switching is not supported here',
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
  sponsoredGold: (amount: number) => `Get ${amount} Sponsor`,
  sponsoredGoldDesc: (amount: number) => `Watch a rewarded ad to receive ${amount} gold`,
  sponsoredGoldLoading: 'Loading ad...',
  sponsoredGoldGranted: (amount: number) => `Received ${amount} gold!`,
  rewardedAdUnavailable: 'No ad available. Please try again later.',
  rewardedAdIncomplete: 'Watch the full ad to receive the sponsor.',
  towerPack: 'Turret Pack',
  towerPackDesc: 'Pick 1 of 3 random turrets',
  infraPack: 'Infra Pack',
  infraPackDesc: 'Pick 1 of 3 infra items',
  advancedPack: 'Advanced Pack',
  advancedPackDesc: 'Random advanced machine',
  commandCardPack: 'Buff Card Pack',
  commandCardPackDesc: 'Pick 1 of 3 non-Core buff cards',
  baseUpgradePack: 'Base Upgrade Pack',
  baseUpgradePackDesc: 'Pick 1 of 3 Core upgrades',
  sell: 'Sell',
  notEnoughGold: 'Not enough gold!',
  shopPickTitle: 'SHOP PURCHASE',
  shopPickDescription: 'Choose one item from the pack',
  commandCardPickTitle: 'BUFF CARD PACK',
  commandCardPickDescription: 'Choose one buff card',
  baseUpgradePickTitle: 'BASE UPGRADE PACK',
  baseUpgradePickDescription: 'Choose one Core upgrade',

  startNextWave: 'Start Next Wave',
  noWires: 'No wires available!',
  autoDeployFailed: 'No open space near the Core for this tower.',
  coreCannotMove: 'Core cannot be moved or rotated!',
  commandCardCannotUse: 'Cannot use buff card',
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
    { title: 'This Is Your Core', text: 'Do not let it be destroyed!' },
    { title: 'Plug the Turret Into Power', text: 'Move the turret so it connects to the base and receives power.', action: 'Connect the turret to base power' },
    { title: 'Connect the Generator', text: 'Connect this generator to the turret too, so it can supply power.', action: 'Connect the generator to the turret' },
    { title: 'Start the Fight!', text: 'Powered turrets fire automatically. Click Start Next Wave to test this defense.', action: 'Click Start Next Wave' },
  ],
  postWaveTutorialSteps: [
    { title: 'Choose a Reward', text: 'After each wave, you can choose one reward. Pick the Generator this time to provide more power for later defenses.', action: 'Pick the Generator' },
    { title: 'New Feature: Wiring', text: 'Tap the generator output port to place a cable, then drag it to a turret input port to transmit power over distance.', action: 'Drag a cable from output to input' },
  ],
  shopTutorialStep: {
    title: 'New Feature: Shop',
    text: 'Spend gold here to buy machines, packs, and repair services. Click the battlefield or the button to hide this page.',
    action: 'Review the shop',
  },
  shopMachineControlTutorialStep: {
    title: 'Machine Controls',
    text: 'Tap a placed machine to open its controls. From there, you can rotate it or sell it for gold.',
    action: 'Tap a machine',
  },

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

  commandCard: 'Buff Cards',
  emptyCommandCards: 'No buff cards',
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
      'Role: steady single-target damage with strong cost efficiency.\n\nEach shot costs 2 power.\n\nTips: a reliable turret.',
    gatling:
      'Role: the more energy it receives, the faster it fires.\n\nEach incoming power becomes 4 bullets, fired continuously at up to 10 shots per second. It temporarily stops firing when overheated.\n\nTips: good against dense waves. Keep wiring reliable; 5 generators powering it can reach maximum fire rate, and additional current input may cause overheating.',
    sniper:
      'Role: piercing damage in a straight line.\n\nEach shot costs 4 power and has a long cooldown, but one shot can pierce every enemy along its path.\n\nTips: use its long range to guard as much area as possible.',
    tesla:
      'Role: chained lightning that counters clustered enemies.\n\nLightning jumps between nearby enemies and is especially effective against grouped targets. It has a higher power storage limit.\n\nTips: it can store 10 power, so use the downtime between waves to fully charge it.',
    generator:
      'Role: basic power supply unit.\n\nPeriodically dispatches energy pulses into the network.\n\nTips: connect it to turrets by direct plugging or by cables.',
    shield:
      'Role: projects an area shield that absorbs damage for buildings inside.\n\nThe shield consumes power to recharge. After being broken, it needs to accumulate 3 power before it can reboot.\n\nTips: cover key turret clusters.',
    battery:
      'Role: energy storage device.\n\nStores up to 4 power and can quickly release it when turrets need supply.\n\nTips: charge it fully during rest phases, then let it quickly power turrets during battle.',
    bus:
      'Role: power merging and splitting, useful for organizing wiring.\n\nCombines up to 3 input wires and branches into up to 3 outputs.\n\nTips: it does not generate energy, but it can gather power from multiple generators into one place or distribute it to multiple turrets.',
    wire:
      'Role: connects machine ports and transmits power pulses.\n\nEach cable you create consumes 1 cable from your inventory.\n\nTips: conduct power to distant turrets, and try not to waste a single power pulse.',
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
    'gatling_1': 'More input power means faster fire, but beware overheating!',
    'sniper_1': 'Fires a piercing straight-line shot, long range and long cooldown',
    'tesla_1': 'Fires chained lightning that bounces between enemies',
    'generator_1': 'Power source for the network',
    'shield_1': 'Projects a protective bubble',
    'battery_1': 'Stores power, discharges rapidly',
    'bus_1': 'Merges 3 inputs into 3 outputs',
    'missile_1': 'Four silos, 4 power per arcing missile',
    'big_generator_1': 'Produces 4 power every 2 seconds',
    'repair_drone_1': 'Sends drones to repair buildings',
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
  showPickChoices: '显示三选一',
  viewBattle: '查看战场',
  bossBonusPickTitle: 'Boss 额外补给',
  bossBonusPickDescription: '击败 Boss 后的定向三选一：线缆、发电机、护盾塔各一项，请选其一。',

  systemPaused: '系统暂停',
  switchToLandscape: '切换横屏',
  switchToPortrait: '切换竖屏',
  orientationSwitchUnsupported: '当前环境不支持屏幕方向切换',
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
  sponsoredGold: (amount: number) => `获得${amount}资助`,
  sponsoredGoldDesc: (amount: number) => `观看激励广告后获得 ${amount} 金币`,
  sponsoredGoldLoading: '广告加载中...',
  sponsoredGoldGranted: (amount: number) => `获得 ${amount} 金币！`,
  rewardedAdUnavailable: '暂无广告，请稍后再试',
  rewardedAdIncomplete: '完整观看广告后才能获得资助',
  towerPack: '炮塔卡包',
  towerPackDesc: '获得一次只含炮塔的三选一',
  infraPack: '基建卡包',
  infraPackDesc: '获得一次只含基建的三选一',
  advancedPack: '高级卡包',
  advancedPackDesc: '随机获得一台高级机器',
  commandCardPack: '增益卡包',
  commandCardPackDesc: '获得一次非基地增益卡三选一',
  baseUpgradePack: '基地升级包',
  baseUpgradePackDesc: '获得一次基地升级三选一',
  sell: '出售',
  notEnoughGold: '金币不足！',
  shopPickTitle: '商店购买',
  shopPickDescription: '从卡包中选择一项',
  commandCardPickTitle: '增益卡包',
  commandCardPickDescription: '选择一张增益卡',
  baseUpgradePickTitle: '基地升级包',
  baseUpgradePickDescription: '选择一项基地升级',

  startNextWave: '开启下一波',
  noWires: '没有可用的线缆！',
  autoDeployFailed: '主基地附近没有可部署这座防御塔的空地。',
  coreCannotMove: '主基地无法拖动和旋转！',
  commandCardCannotUse: '无法使用增益卡',
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
    { title: '这是你的核心', text: '别让它被摧毁！' },
    { title: '炮台插入电源', text: '拖动炮台使其与基地拼接，让炮台获得电力', action: '连接炮台和基地电源' },
    { title: '连接发电机', text: '将这个发电机也与炮台连接，为其供电。', action: '发电机连接炮台' },
    { title: '开启战斗！', text: '通电的炮塔会自动开火。点击【开启下一波】来测试这条防线。', action: '点击开启下一波' },
  ],
  postWaveTutorialSteps: [
    { title: '选择奖励', text: '每波结束后可以选择一次奖励。本次请选择发电机，为后续防线提供更多电力。', action: '选择发电机' },
    { title: '新功能：连线', text: '点击发电机输出口可以布置线缆，拖到炮台输入口就可以远距离传输电力。', action: '从输出口拉线缆到输入口' },
  ],
  shopTutorialStep: {
    title: '新功能：商店',
    text: '可以在此花费金币购买机器、卡包、维修服务。点击战场或者按钮可以隐藏此此页面',
    action: '查看商店',
  },
  shopMachineControlTutorialStep: {
    title: '机器操作',
    text: '轻点已放置的机器可以唤起操作按钮，在这里可以旋转机器，也可以售卖换回金币。',
    action: '轻点一台机器',
  },

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

  commandCard: '增益卡',
  emptyCommandCards: '暂无增益卡',
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
      '定位：稳定单体输出，性价比高。\n\n每次开火消耗 2 格电力。\n\n用法建议：稳定的炮塔。',
    gatling:
      '定位：输入能源越多射速越快。\n\n每接收 1 格电就转化为 4 发子弹，并以最多每秒 10 发的速度持续射击。过热时会暂时停火。\n\n用法建议：适合应对密集波次；务必保证线缆可靠，5台发电机为其供能时会达到最高射速，再多电流输入会导致过热',
    sniper:
      '定位：直线穿透杀伤。\n\n每发消耗 4 格电，冷却较长，但一发可穿透路径上所有敌人。\n\n用法建议：利用长射程尽可能守卫更大的范围',
    tesla:
      '定位：连锁闪电，克制聚堆敌人。\n\n电弧在临近敌人之间跳跃，对成群目标特别有效。储电上限较高。\n\n用法建议：其可以存储10格电量，利用波次间隙为其充好电。',
    generator:
      '定位：基础供能单元。\n\n按周期向网络派发能量脉冲。\n\n用法建议：通过直插或接线的方式连接炮塔。',
    shield:
      '定位：展开范围护罩，吸收伤害保护圈内建筑。\n\n护罩会消耗电力充能；被击破后需要积累 3 格电力才能重启\n\n用法建议：罩住关键炮塔群',
    battery:
      '定位：储能设备。\n\n最多存 4 格电，炮台需要供电时可以快速放出。\n\n用法建议：休整阶段充满电，战斗时快速给炮塔供能',
    bus:
      '定位：汇流与分线，整理布线。\n\n最多合并 3 条输入线，并分出最多 3 条输出。\n\n用法建议：其本身不产生能量，但可以将多个发电机的电量汇于一处或者分散给多个炮塔。',
    wire:
      '定位：连接设备端口，传递电力脉冲。\n\n每创建 1 条线缆都会消耗库存中的 1 条线缆。\n\n用法建议：将电力传导给远处的炮台，尽量不要浪费任何一个电力脉冲',
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
    'gatling_1': '输入电力越多射速越快，但小心过热！',
    'sniper_1': '发射穿透直线射击，射程远冷却长',
    'tesla_1': '发射连锁闪电在敌人间弹射',
    'generator_1': '为网络提供能量',
    'shield_1': '投射防护罩',
    'battery_1': '存储能量，快速放电',
    'bus_1': '合并3条输入为3条输出',
    'missile_1': '4个发射井，每4格电发射1枚弧线追踪导弹',
    'big_generator_1': '每2秒生产4个电',
    'repair_drone_1': '派出无人机维修建筑',
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

const detectDefaultLocale = (): Locale => {
  if (typeof navigator === 'undefined') return 'en';

  const preferredLanguages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  return preferredLanguages.some(language => language.toLowerCase().startsWith('zh'))
    ? 'zh'
    : 'en';
};

let currentLocale: Locale = detectDefaultLocale();

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

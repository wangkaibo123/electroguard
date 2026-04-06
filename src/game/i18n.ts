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
  clickToRotate: string;
  dragToWire: string;

  // Wave
  startNextWave: string;

  // Toast
  noWires: string;

  // Tutorial
  tutorialSkip: string;
  tutorialNext: string;
  tutorialDone: string;
  tutorialSteps: {
    title: string;
    text: string;
    action?: string;
  }[];

  // Sidebar tips
  gameTips: Record<string, string>;

  // Tower names
  towerName: Record<string, string>;

  // Tower descriptions (for tooltip & pick cards)
  towerDesc: Record<string, string>;

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
  clickToRotate: 'Click machine to rotate',
  dragToWire: 'Drag port to wire',

  startNextWave: 'Start Next Wave',
  noWires: 'No wires available!',

  tutorialSkip: 'Skip',
  tutorialNext: 'Next',
  tutorialDone: 'Start Playing!',
  tutorialSteps: [
    { title: 'Welcome, Commander!', text: 'Welcome to ElectroGuard! Let me guide you through building your defense network.' },
    { title: 'Choose an Upgrade', text: 'Before each wave, pick one upgrade from three options. This adds towers or wires to your inventory. Choose one now!', action: 'Select one of the cards below' },
    { title: 'Your Core', text: 'The glowing structure in the center is your Core. It generates power and has a protective shield. If enemies destroy it, the game is over!' },
    { title: 'Your Inventory', text: 'Your equipment is shown in the right sidebar. Click a tower button to select it for placement on the grid.' },
    { title: 'Place a Tower', text: 'With a tower selected (highlighted in the sidebar), click on an empty area near the Core to place it.', action: 'Select a tower and click on the grid' },
    { title: 'Connect with Wires', text: 'Towers need power! Drag from a port (small circle) on the Core to a port on your tower to create a wire.', action: 'Drag between ports to create a wire' },
    { title: 'Power System', text: 'Energy pulses travel from the Core through wires. Connected towers glow when powered. Use Generators to extend your network!' },
    { title: 'Ready for Battle!', text: 'Enemies attack from the edges. Powered turrets fire automatically. Click towers to rotate them, press Q for quick rotation. After each wave, pick a new upgrade. Good luck!' },
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
    target: 'Target',
    core: 'Core',
  },

  towerDesc: {
    core: 'The heart of your defense. Generates power.',
    blaster: 'Fires a bullet per 2 power. Reliable turret.',
    gatling: 'Heat-based rapid fire. Spins up with power.',
    sniper: 'High-damage piercing shot. Costs 4 power.',
    tesla: 'Chain lightning bounces between enemies.',
    generator: 'Power source for the network. Dispatches energy.',
    shield: 'Projects a protective shield. Consumes power to recharge.',
    battery: 'Stores 4 units of power and discharges quickly.',
    bus: 'Merges up to 3 input wires into 3 outputs.',
    target: 'Practice target. Treated as an enemy by turrets.',
  },

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
    'wire_3': 'Wire x3',
    'wire_5': 'Wire x5',
  },

  pickDesc: {
    'blaster_1': 'Fires a bullet per 2 power',
    'blaster_2': 'Two standard turrets',
    'gatling_1': 'Heat-based rapid fire, spins up',
    'sniper_1': 'Piercing line shot, long cooldown',
    'tesla_1': 'Chain lightning between enemies',
    'generator_1': 'Power source for the network',
    'shield_1': 'Projects a protective bubble',
    'battery_1': 'Stores power, discharges rapidly',
    'bus_1': 'Merges 3 inputs into 3 outputs',
    'wire_3': 'Power line connectors',
    'wire_5': 'Large bundle of power lines',
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
  clickToRotate: '点击机器旋转',
  dragToWire: '拖拽端口连线',

  startNextWave: '提前开始下一波',
  noWires: '没有可用的线缆！',

  tutorialSkip: '跳过',
  tutorialNext: '下一步',
  tutorialDone: '开始游戏！',
  tutorialSteps: [
    { title: '欢迎，指挥官！', text: '欢迎来到 ElectroGuard！让我来引导你了解防御网络的基本构建方法。' },
    { title: '选择升级', text: '每波战斗前，你可以从三个选项中选择一项升级，将设备或线缆加入库存。现在选择一项吧！', action: '选择下方的一张卡片' },
    { title: '你的核心', text: '中央发光的建筑就是你的核心。它能生成电力并拥有防护盾。如果核心被敌人摧毁，游戏就结束了！' },
    { title: '你的库存', text: '你的装备显示在右侧栏中。点击设备按钮即可选中它，准备放置到网格上。' },
    { title: '放置设备', text: '选中设备后（侧栏中高亮显示），点击核心附近的空地来放置它。', action: '从侧栏选择设备并点击网格放置' },
    { title: '连接线缆', text: '设备需要电力！从核心边缘的端口（小圆圈）拖拽到设备端口，创建线缆连接。', action: '在端口之间拖拽以创建线缆' },
    { title: '电力系统', text: '能量脉冲从核心通过线缆传输。已连接的设备会发光表示通电，才能正常运作。使用发电机来扩展电网！' },
    { title: '准备战斗！', text: '敌人会从边缘进攻。通电的炮塔会自动开火。点击设备可以旋转，按 Q 键快速旋转。每波结束后选择新升级。祝你好运！' },
  ],

  gameTips: {
    tipMoveTurret: '可以移动炮塔到有敌人的位置射击，覆盖更多区域。',
    tipBalanceEnergy: '注意平衡能源的生成与消耗，确保所有炮塔持续供电。',
    tipHoverIcon: '鼠标停在机器图标上可以阅读其简介。',
    tipRotateTower: '点击已放置的设备可以旋转，也可以按 Q 键快速旋转。',
    tipWireConnect: '在端口之间拖拽来创建线缆——设备需要通电才能运作！',
    tipShieldReboot: '护盾被摧毁后需要 3 格电才能重启，记得保持发电机连接！',
    tipGeneratorExpand: '发电机可以扩展电网——放在核心和远处炮塔之间中转电力。',
    tipBusMultiplex: '并联器能将 3 条输入线合并为 3 条输出，简化复杂布局。',
    tipSniperPierce: '狙击手的子弹可以穿透一条线上的所有敌人——排列好角度！',
    tipTeslaChain: '特斯拉闪电会在临近敌人之间弹射——对付大群敌人效果拔群。',
  },

  towerName: {
    blaster: '冲击炮',
    gatling: '加特林',
    sniper: '狙击手',
    tesla: '特斯拉',
    generator: '发电机',
    shield: '护盾',
    battery: '蓄电池',
    bus: '并联器',
    target: '靶标',
    core: '核心',
  },

  towerDesc: {
    core: '防御核心，生成能量。',
    blaster: '消耗2格电发射子弹，可靠炮塔。',
    gatling: '热力驱动连射，随能量加速。',
    sniper: '高伤穿透射击，消耗4格电。',
    tesla: '闪电在敌人间连锁弹射。',
    generator: '为网络供电，分配能量。',
    shield: '投射防护罩，消耗能量充能。',
    battery: '存储4格电，快速放电。',
    bus: '合并最多3条输入线为3条输出。',
    target: '练习靶标，被炮塔视为敌人。',
  },

  pickLabel: {
    'blaster_1': '冲击炮',
    'blaster_2': '冲击炮 x2',
    'gatling_1': '加特林',
    'sniper_1': '狙击手',
    'tesla_1': '特斯拉',
    'generator_1': '发电机',
    'shield_1': '护盾',
    'battery_1': '蓄电池',
    'bus_1': '并联器',
    'wire_3': '线缆 x3',
    'wire_5': '线缆 x5',
  },

  pickDesc: {
    'blaster_1': '每2格电发射一发子弹',
    'blaster_2': '两座标准炮塔',
    'gatling_1': '热力连射，持续加速',
    'sniper_1': '穿透直线射击，长冷却',
    'tesla_1': '闪电在敌人间弹射',
    'generator_1': '为网络提供能量',
    'shield_1': '投射防护罩',
    'battery_1': '存储能量，快速放电',
    'bus_1': '合并3条输入为3条输出',
    'wire_3': '电力线缆连接器',
    'wire_5': '大捆电力线缆',
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
  return `${towerType}_${count}`;
};

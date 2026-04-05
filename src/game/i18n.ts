// ── Internationalization ─────────────────────────────────────────────────────

export type Locale = 'en' | 'zh';

export interface I18nStrings {
  // Menu
  systemOffline: string;
  menuDescription: string;
  initializeCore: string;
  customMode: string;

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

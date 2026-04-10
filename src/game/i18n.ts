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
  clickToRotate: string;
  dragToWire: string;

  // Wave
  startNextWave: string;

  // Toast
  noWires: string;
  autoDeployFailed: string;

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

  /** Sidebar codex button + full machine guide (multi-paragraph, \\n\\n separated) */
  codexButton: string;
  towerCodex: Record<string, string>;

  // Controls guide (top-left overlay)
  controlsGuide: string[];

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
  clickToRotate: 'Click machine to rotate',
  dragToWire: 'Drag port to wire',

  startNextWave: 'Start Next Wave',
  noWires: 'No wires available!',
  autoDeployFailed: 'No open space near the Core for this tower.',

  tutorialSkip: 'Skip',
  tutorialNext: 'Next',
  tutorialDone: 'Start Playing!',
  tutorialSteps: [
    { title: 'Welcome, Commander!', text: 'Welcome to ElectroGuard! Let me guide you through building your defense network.' },
    { title: 'Choose an Upgrade', text: 'Before each wave, pick one upgrade from three options. Chosen towers are deployed automatically near the Core, while wires are added to your stock. Choose one now!', action: 'Select one of the cards below' },
    { title: 'Your Core', text: 'The glowing structure in the center is your Core. It generates power and has a protective shield. If enemies destroy it, the game is over!' },
    { title: 'Auto Deployment', text: 'When you pick a tower card, it is placed automatically onto a random open tile near the Core. You can still drag and rotate placed machines afterward.' },
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

  codexButton: 'Codex',
  towerCodex: {
    blaster:
      'Role: steady single-target damage.\n\nEach shot costs 2 power. Power pulses travel along wires from the Core or Generators; the turret must be connected and receiving energy to fire.\n\nTips: place with a clear line of sight to spawn lanes; click the placed turret to rotate the barrel toward threats. Good as a backbone turret when power is stable.',
    gatling:
      'Role: sustained DPS that ramps up over time.\n\nFiring speed increases as the turret stays powered and keeps shooting (heat/spin-up mechanic). Uses more power when firing fast—balance with Generators and Batteries.\n\nTips: best against waves and clusters; pair with reliable wiring so it does not stall mid-fight.',
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
    target:
      'Role: training dummy in Custom Mode.\n\nTurrets treat it as an enemy, so you can test ranges, rotation, and damage without waves.\n\nTips: place in open space, wire your test turrets, and observe firing behavior; remove or reposition as needed.',
  },

  controlsGuide: [
    'ESC — Cancel current action',
    'Left Click — Select / Place tower',
    'Left Drag — Pan the map',
    'Left Click Tower — Rotate tower',
    'Q — Quick rotate selected tower',
    'Right Click — Delete wire / tower',
    'Scroll — Zoom in / out',
    'Drag Port → Port — Connect wire',
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
  clickToRotate: '点击机器旋转',
  dragToWire: '拖拽端口连线',

  startNextWave: '提前开始下一波',
  noWires: '没有可用的线缆！',
  autoDeployFailed: '主基地附近没有可部署这座防御塔的空地。',

  tutorialSkip: '跳过',
  tutorialNext: '下一步',
  tutorialDone: '开始游戏！',
  tutorialSteps: [
    { title: '欢迎，指挥官！', text: '欢迎来到 ElectroGuard！让我来引导你了解防御网络的基本构建方法。' },
    { title: '选择升级', text: '每波战斗前，你可以从三个选项中选择一项升级。选中的防御塔会自动部署到核心附近，线缆则会加入库存。现在选择一项吧！', action: '选择下方的一张卡片' },
    { title: '你的核心', text: '中央发光的建筑就是你的核心。它能生成电力并拥有防护盾。如果核心被敌人摧毁，游戏就结束了！' },
    { title: '自动部署', text: '当你选择防御塔卡片时，它会自动放到核心附近的一块随机空地上。放置后的设备仍然可以拖动和旋转。' },
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

  codexButton: '图鉴',
  towerCodex: {
    blaster:
      '定位：加农炮——稳定单体输出，性价比高。\n\n每次开火消耗 2 格电力。能量沿线缆从核心或发电机传来，必须连通电网且正在受电才能射击。\n\n用法建议：放在能俯视刷怪方向的位置；放置后点击旋转炮口。电力稳定时适合作为主力炮塔。',
    gatling:
      '定位：持续火力，越久射得越快。\n\n通电连射时会“升温”加速，射速提高后耗电也会增加，注意与发电机、蓄电池搭配。\n\n用法建议：适合应对密集波次；务必保证线缆可靠，避免打一半断供。',
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
    target:
      '定位：自定义模式下的练习靶。\n\n炮塔会把它当作敌人攻击，可在没有波次时测试射程、旋转与伤害。\n\n用法建议：空地放置靶标，接好测试炮塔的线缆，观察开火行为；随时可挪位重测。',
  },

  controlsGuide: [
    'ESC — 取消当前操作',
    '左键点击 — 选中 / 放置设备',
    '左键拖拽 — 平移地图',
    '左键点击已放置设备 — 旋转设备',
    'Q — 快速旋转选中设备',
    '右键 — 删除线缆 / 设备',
    '滚轮 — 缩放地图',
    '拖拽端口→端口 — 连接线缆',
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

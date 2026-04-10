import type { TowerType, EnemyType } from './types';

// ═══════════════════════════════════════════════════════════════════════════
//  游戏配置表  —  所有影响游戏平衡的数值集中在此文件
//  修改后刷新浏览器即可生效（Vite HMR）
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. 全局参数 ─────────────────────────────────────────────────────────────

export const GLOBAL_CONFIG = {
  /** 地图宽度（格子数） */
  gridWidth: 100,
  /** 地图高度（格子数） */
  gridHeight: 100,
  /** 每格像素边长（px），地图实际像素 = gridWidth × cellSize */
  cellSize: 20,
  /** 视口初始宽度（CSS px） */
  viewportWidth: 1200,
  /** 视口初始高度（CSS px） */
  viewportHeight: 680,

  /** 导线最大生命值 */
  wireMaxHp: 50,
  /** 导线寻路转弯惩罚（越大越偏好直线，极小值即可） */
  turnCost: 0.001,
  /** 普通建筑随机生成的接口（端口）数量 */
  portCount: 2,

  /** 电力脉冲沿导线传播速度（px/s） */
  pulseSpeed: 400,
  /** Core / 发电机每隔多少秒尝试向外供电一次 */
  powerInterval: 2,
  /** 炮塔炮管旋转速度（rad/s） */
  barrelSpeed: 4,
  /** 镜头最大缩放倍率 */
  maxZoom: 2.0,

  /** 清波后到下一波开始的休整时间（秒） */
  waveDelay: 30,
  /** 同一波内，两个敌人之间的刷出间隔（秒） */
  spawnInterval: 1,
  /** 每隔几波出一个 Boss（Overlord） */
  bossWaveInterval: 5,
  /** 清波奖励得分 = 当前波数 × 此倍率 */
  waveClearScoreMul: 20,

  /** 敌人近战攻击距离（px），进入此范围开始攻击 */
  attackRange: 14,
  /** Boss（Overlord）每隔多少毫秒生成侦察兵小怪 */
  bossSpawnInterval: 15000,
  /** Boss 每次生成侦察兵的数量 */
  bossSpawnCount: 2,
  /** 全敌人基础移速倍率（在随机速度与波次加成之后再乘） */
  enemyBaseSpeedMul: 1.1,
} as const;

// ── 2. 建筑 / 机器数据 ──────────────────────────────────────────────────────
//  每种建筑一行：hp=生命值  width×height=占地格数  maxPower=最大储电
//  maxShieldHp=护盾上限  shieldRadius=护盾覆盖半径(px)  color=渲染颜色

export const TOWER_CONFIG: Record<TowerType, {
  hp: number;
  description: string;
  color: string;
  width: number;
  height: number;
  maxPower: number;
  maxShieldHp: number;
  shieldRadius: number;
}> = {
  /* 核心：玩家基地，被摧毁即失败 */
  core:      { hp: 1000, description: 'The heart of your defense. Generates power.',                color: '#93c5fd', width: 5, height: 5, maxPower: 0, maxShieldHp: 0,   shieldRadius: 0 },
  /* 爆破炮：每次消耗 2 电力发射追踪弹 */
  blaster:   { hp: 100,  description: 'Fires a bullet per 2 power. Reliable turret.',              color: '#f87171', width: 3, height: 3, maxPower: 2, maxShieldHp: 0,   shieldRadius: 0 },
  /* 加特林：热量驱动的连射炮塔，越打越快 */
  gatling:   { hp: 100,  description: 'Heat-based rapid fire. Spins up with power.',               color: '#f59e0b', width: 3, height: 3, maxPower: 5, maxShieldHp: 0,   shieldRadius: 0 },
  /* 狙击塔：高伤害穿透弹，冷却长 */
  sniper:    { hp: 80,   description: 'High-damage piercing shot. Costs 4 power.',                 color: '#a78bfa', width: 3, height: 3, maxPower: 4, maxShieldHp: 0,   shieldRadius: 0 },
  /* 电磁炮（tesla）：链式闪电，在敌人之间弹跳 */
  tesla:     { hp: 100,  description: 'Chain lightning bounces between enemies.',                   color: '#e879f9', width: 3, height: 3, maxPower: 9, maxShieldHp: 0,   shieldRadius: 0 },
  /* 发电机：电网的能量来源 */
  generator: { hp: 100,  description: 'Power source for the network. Dispatches energy.',           color: '#fbbf24', width: 3, height: 3, maxPower: 0, maxShieldHp: 0,   shieldRadius: 0 },
  /* 护盾塔：消耗电力投射防护盾 */
  shield:    { hp: 100,  description: 'Projects a protective shield. Consumes power to recharge.', color: '#22d3ee', width: 2, height: 2, maxPower: 4, maxShieldHp: 300, shieldRadius: 150 },
  /* 电池：储存电力并快速放电 */
  battery:   { hp: 150,  description: 'Stores 4 units of power and discharges quickly.',            color: '#34d399', width: 3, height: 2, maxPower: 4, maxShieldHp: 0,   shieldRadius: 0 },
  /* 汇流器：将 3 条输入线合并为 3 条输出线 */
  bus:       { hp: 120,  description: 'Merges up to 3 input wires into 3 outputs.',                color: '#38bdf8', width: 3, height: 2, maxPower: 0, maxShieldHp: 0,   shieldRadius: 0 },
  /* 练习靶：被炮塔当作敌人射击，用于测试 */
  target:    { hp: 200,  description: 'Practice target. Treated as an enemy by turrets.',          color: '#fb923c', width: 1, height: 1, maxPower: 0, maxShieldHp: 0,   shieldRadius: 0 },
};

// ── 3. 武器参数 ─────────────────────────────────────────────────────────────

export const WEAPON_CONFIG = {
  /** 爆破炮 */
  blaster: {
    /** 开火冷却（ms） */
    cooldown: 1000,
    /** 索敌射程（px） */
    range: 260,
    /** 单发伤害 */
    damage: 50,
    /** 每次开火消耗电力 */
    powerCost: 2,
    /** 子弹飞行速度（px/s） */
    bulletSpeed: 300,
  },
  /** 加特林 */
  gatling: {
    /** 索敌射程（px） */
    range: 195,
    /** 单发伤害 */
    damage: 8,
    /** 子弹最大飞行距离（px），超出后消失 */
    bulletRange: 290,
    /** 最大热量时的射击间隔（ms），即最快射速 */
    minInterval: 200,
    /** 冷却状态的射击间隔（ms），即最慢射速 */
    maxInterval: 500,
    /** 每发子弹增加的热量（0~1） */
    heatPerShot: 0.12,
    /** 热量每秒自然衰减量 */
    heatDecay: 0.15,
    /** 冷却时的最小散射角（rad，约 2°） */
    minSpread: 0.04,
    /** 最大热量时的最大散射角（rad，约 20°） */
    maxSpread: 0.35,
    /** 每次开火消耗电力 */
    powerCost: 1,
    /** 子弹飞行速度（px/s） */
    bulletSpeed: 280,
  },
  /** 狙击塔 */
  sniper: {
    /** 开火冷却（ms） */
    cooldown: 4000,
    /** 索敌射程（px） */
    range: 420,
    /** 单发伤害 */
    damage: 200,
    /** 每次开火消耗电力 */
    powerCost: 4,
    /** 子弹飞行速度（px/s） */
    bulletSpeed: 800,
    /** 子弹最大直线飞行距离（px），穿透后仍沿直线前进 */
    maxRange: 820,
    /** 炮管对准目标后需保持的瞄准时间（ms）才允许开火 */
    minAimMs: 320,
  },
  /** 电磁炮（tesla） */
  tesla: {
    /** 开火冷却（ms） */
    cooldown: 3000,
    /** 首次索敌射程（px） */
    range: 220,
    /** 闪电弹跳搜索范围（px） */
    bounceRange: 180,
    /** 每点储电的伤害量，总伤害 = storedPower × damagePerPower */
    damagePerPower: 25,
  },
} as const;

// ── 4. 敌人数据 ─────────────────────────────────────────────────────────────
//  unlockWave: 该敌人从第几波开始出现在随机池中，-1 表示仅作为 Boss 刷出

export const ENEMY_CONFIG: Record<EnemyType, {
  /** 基础血量（会随波次缩放） */
  baseHp: number;
  /** 最低移动速度（px/s） */
  speedMin: number;
  /** 最高移动速度（px/s），实际速度在 min~max 间随机 */
  speedMax: number;
  /** 基础攻击伤害（会随波次增长） */
  baseDamage: number;
  /** 攻击间隔（ms） */
  cooldown: number;
  /** 碰撞/显示半径（px） */
  radius: number;
  /** 渲染颜色 */
  color: string;
  /** 对导线的伤害倍率（破坏者 = 2 倍） */
  wireDamageMul: number;
  /** 基础护盾值（仅 Overlord 有） */
  baseShield: number;
  /** 解锁波次，-1 = Boss 专属不进随机池 */
  unlockWave: number;
}> = {
  /* 侦察兵：速度快、血薄 */
  scout:    { baseHp: 12,  speedMin: 55, speedMax: 72, baseDamage: 3,  cooldown: 800,  radius: 9,  color: '#4ade80', wireDamageMul: 1, baseShield: 0,  unlockWave: 1 },
  /* 步兵：中等属性 */
  grunt:    { baseHp: 25,  speedMin: 32, speedMax: 44, baseDamage: 6,  cooldown: 1000, radius: 12, color: '#f87171', wireDamageMul: 1, baseShield: 0,  unlockWave: 1 },
  /* 坦克：高血高伤、移速慢 */
  tank:     { baseHp: 60,  speedMin: 17, speedMax: 25, baseDamage: 10, cooldown: 1200, radius: 17, color: '#a78bfa', wireDamageMul: 1, baseShield: 0,  unlockWave: 3 },
  /* 破坏者：优先攻击导线，对线伤害 ×2 */
  saboteur: { baseHp: 18,  speedMin: 39, speedMax: 50, baseDamage: 4,  cooldown: 600,  radius: 10, color: '#fbbf24', wireDamageMul: 2, baseShield: 0,  unlockWave: 5 },
  /* 霸主（Boss）：每 N 波出现，自带护盾，体型大 */
  overlord: { baseHp: 200, speedMin: 14, speedMax: 18, baseDamage: 20, cooldown: 1500, radius: 52, color: '#ef4444', wireDamageMul: 1, baseShield: 50, unlockWave: -1 },
};

/** 敌人属性随波次的缩放系数 */
export const ENEMY_SCALING = {
  /** 每波血量乘数增量：实际血量 = baseHp × (1 + wave × hpPerWave) */
  hpPerWave: 0.15,
  /** 每波速度乘数增量：实际速度 × (1 + wave × speedPerWave) */
  speedPerWave: 0.02,
  /** 每波伤害线性增量：实际伤害 = baseDamage + floor(wave × damagePerWave) */
  damagePerWave: 0.8,
  /** 每波刷怪数公式的常数项：floor(spawnBase + wave×spawnLinear + sqrt(wave)×spawnSqrt) */
  spawnBase: 2,
  /** 每波刷怪数公式的线性系数 */
  spawnLinear: 1.5,
  /** 每波刷怪数公式的平方根系数 */
  spawnSqrt: 0,
} as const;

// ── 5. 护盾与充能参数 ───────────────────────────────────────────────────────

export const SHIELD_CONFIG = {
  /** 核心护盾自动充能冷却（ms），两次充能之间的最短间隔 */
  cooldown: 500,
  /** 护盾塔专用充能冷却（ms），每 15 秒消耗一度电 */
  shieldTowerCooldown: 15000,
  /** 电池 / Core 快速放电间隔（ms） */
  batteryInterval: 100,
  /** 护盾归零后重启所需电力 */
  rebootCost: 3,
  /** 护盾重启后恢复的初始护盾值 */
  rebootHp: 150,
  /** 每次常规充能消耗电力 */
  rechargeCost: 1,
  /** 每次常规充能恢复的护盾值 */
  rechargeAmount: 50,
} as const;

// ── 6. 得分参数 ─────────────────────────────────────────────────────────────

/** 击杀各类敌人获得的分数；default 用于未列出的类型 */
export const SCORE_CONFIG: Record<string, number> & { default: number } = {
  scout: 5,
  grunt: 10,
  tank: 25,
  saboteur: 15,
  overlord: 100,
  default: 10,
};

// ── 7. 初始库存 ─────────────────────────────────────────────────────────────

export const STARTING_INVENTORY = {
  /** 开局拥有的导线数量 */
  wires: 5,
  /** 开局拥有的各类建筑数量 */
  towers: { blaster: 0, gatling: 0, sniper: 0, tesla: 0, generator: 0, shield: 0, battery: 0 } as Record<string, number>,
} as const;

// ── 8. Roguelike 三选一奖励池 ───────────────────────────────────────────────
//  每次清波后从 pool 中随机抽取 pickCount 个选项供玩家选择

export const PICK_POOL_CONFIG = {
  /** 每次展示给玩家的选项数量 */
  pickCount: 3,
  /** 奖励池：kind=类型  towerType=建筑类型  count=获得数量  weight=出现权重（越大越容易被抽中） */
  pool: [
    { kind: 'tower' as const, towerType: 'blaster'   as TowerType, count: 1, weight: 10 },
    { kind: 'tower' as const, towerType: 'blaster'   as TowerType, count: 2, weight: 5 },
    { kind: 'tower' as const, towerType: 'gatling'   as TowerType, count: 1, weight: 8 },
    { kind: 'tower' as const, towerType: 'sniper'    as TowerType, count: 1, weight: 6 },
    { kind: 'tower' as const, towerType: 'tesla'     as TowerType, count: 1, weight: 5 },
    { kind: 'tower' as const, towerType: 'generator' as TowerType, count: 1, weight: 8 },
    { kind: 'tower' as const, towerType: 'shield'    as TowerType, count: 1, weight: 6 },
    { kind: 'tower' as const, towerType: 'battery'   as TowerType, count: 1, weight: 6 },
    { kind: 'tower' as const, towerType: 'bus'       as TowerType, count: 1, weight: 4 },
    { kind: 'wire'  as const,                                       count: 3, weight: 10 },
    { kind: 'wire'  as const,                                       count: 5, weight: 6 },
  ],
};

// ── 9. 敌人 AI 参数 ─────────────────────────────────────────────────────────

// ── 10. 侧边栏提示轮播 ──────────────────────────────────────────────────────
//  tips: 提示词 key 列表，对应 i18n 中的翻译
//  intervalMs: 每条提示停留时间（毫秒）

export const TIPS_CONFIG = {
  intervalMs: 8000,
  tips: [
    'tipMoveTurret',
    'tipBalanceEnergy',
    'tipHoverIcon',
    'tipRotateTower',
    'tipWireConnect',
    'tipShieldReboot',
    'tipGeneratorExpand',
    'tipBusMultiplex',
    'tipSniperPierce',
    'tipTeslaChain',
  ],
} as const;

// ── 11. 敌人 AI 参数 ─────────────────────────────────────────────────────────

export const ENEMY_AI_CONFIG = {
  /** 破坏者寻找塔时的距离加权倍率（>1 表示降低优先级） */
  saboteurTowerDistMul: 1.5,
  /** 破坏者寻找导线时的距离加权倍率（<1 表示提高优先级） */
  saboteurWireDistMul: 0.6,
} as const;

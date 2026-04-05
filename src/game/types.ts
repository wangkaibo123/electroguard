export type Position = { x: number; y: number };
export type TowerType = 'core' | 'blaster' | 'gatling' | 'sniper' | 'tesla' | 'generator' | 'shield' | 'battery' | 'bus' | 'target';
export type GameMode = 'normal' | 'custom';
export type PortDirection = 'top' | 'right' | 'bottom' | 'left';
export type PortType = 'input' | 'output';
export type GameStatus = 'menu' | 'playing' | 'paused' | 'pick' | 'gameover';
export type EnemyType = 'scout' | 'grunt' | 'tank' | 'saboteur' | 'overlord';

export interface Port {
  id: string;
  direction: PortDirection;
  portType: PortType;
  sideOffset?: number; // 0–1 fraction along the side (default 0.5 = center)
}

export interface Wire {
  id: string;
  startTowerId: string;
  startPortId: string;
  endTowerId: string;
  endPortId: string;
  path: Position[];
  hp: number;
  maxHp: number;
}

export interface Pulse {
  id: string;
  path: Position[];
  progress: number;
  targetTowerId: string;
}

export interface Tower {
  id: string;
  type: TowerType;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  powered: boolean;
  storedPower: number;
  maxPower: number;
  incomingPower: number;
  shieldHp: number;
  maxShieldHp: number;
  shieldRadius: number;
  lastActionTime: number;
  ports: Port[];
  rotation: number;
  barrelAngle: number;
  heat: number;           // gatling heat 0–1
}

export interface Enemy {
  id: string;
  enemyType: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  lastAttackTime: number;
  targetId: string | null;
  heading: number;
  radius: number;
  color: string;
  wireDamageMul: number;   // saboteur does 2x wire damage
  shieldAbsorb: number;    // overlord shield HP
  maxShieldAbsorb: number;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  targetId: string;
  speed: number;
  damage: number;
  isTargetTower?: boolean;
  angle?: number;          // fixed direction for non-homing (gatling)
  traveled?: number;       // distance traveled so far
  maxRange?: number;       // max range before despawn
  piercing?: boolean;      // passes through enemies (sniper)
  piercedIds?: string[];   // enemies already hit by piercing
  color?: string;          // custom projectile color
  size?: number;           // custom projectile size
}

export interface ChainLightning {
  segments: { x1: number; y1: number; x2: number; y2: number }[];
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface HitEffect {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  radius: number;
}

export interface ShieldBreakEffect {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  fragments: { angle: number; dist: number; size: number; speed: number }[];
}

export interface PickOption {
  id: string;
  kind: 'tower' | 'wire';
  towerType?: TowerType;
  count: number;
  label: string;
  description: string;
}

export interface GameState {
  status: GameStatus;
  gameMode: GameMode;
  wave: number;
  powerTimer: number;
  wireInventory: number;
  towerInventory: Record<string, number>;
  pickOptions: PickOption[];
  needsPick: boolean;
  towers: Tower[];
  wires: Wire[];
  pulses: Pulse[];
  enemies: Enemy[];
  projectiles: Projectile[];
  chainLightnings: ChainLightning[];
  particles: Particle[];
  hitEffects: HitEffect[];
  shieldBreakEffects: ShieldBreakEffect[];
  waveTimer: number;
  enemiesToSpawn: number;
  spawnTimer: number;
  score: number;
  towerMap: Map<string, Tower>;
}

export interface TowerStats {
  hp: number;
  description: string;
  color: string;
  width: number;
  height: number;
  maxPower: number;
  maxShieldHp: number;
  shieldRadius: number;
}

export const TOWER_STATS: Record<TowerType, TowerStats> = {
  core:      { hp: 1000, description: 'The heart of your defense. Generates power.',             color: '#93c5fd', width: 3, height: 3, maxPower: 9, maxShieldHp: 500, shieldRadius: 160 },
  blaster:   { hp: 100,  description: 'Fires a bullet per 2 power. Reliable turret.',           color: '#f87171', width: 2, height: 2, maxPower: 2, maxShieldHp: 0,   shieldRadius: 0 },
  gatling:   { hp: 100,  description: 'Heat-based rapid fire. Spins up with power.',              color: '#f59e0b', width: 2, height: 2, maxPower: 5, maxShieldHp: 0,   shieldRadius: 0 },
  sniper:    { hp: 80,   description: 'High-damage piercing shot. Costs 4 power.',              color: '#a78bfa', width: 2, height: 2, maxPower: 4, maxShieldHp: 0,   shieldRadius: 0 },
  tesla:     { hp: 100,  description: 'Chain lightning bounces between enemies.',                color: '#e879f9', width: 2, height: 2, maxPower: 9, maxShieldHp: 0,   shieldRadius: 0 },
  generator: { hp: 100,  description: 'Power source for the network. Dispatches energy.',        color: '#fbbf24', width: 2, height: 2, maxPower: 0, maxShieldHp: 0,   shieldRadius: 0 },

  shield:    { hp: 100,  description: 'Projects a protective shield. Consumes power to recharge.', color: '#22d3ee', width: 1, height: 1, maxPower: 4, maxShieldHp: 300, shieldRadius: 60 },
  battery:   { hp: 150,  description: 'Stores 4 units of power and discharges quickly.',         color: '#34d399', width: 2, height: 1, maxPower: 4, maxShieldHp: 0,   shieldRadius: 0 },
  bus:       { hp: 120,  description: 'Merges up to 3 input wires into 3 outputs.',             color: '#38bdf8', width: 1, height: 3, maxPower: 0, maxShieldHp: 0,   shieldRadius: 0 },
  target:    { hp: 200,  description: 'Practice target. Treated as an enemy by turrets.',       color: '#fb923c', width: 1, height: 1, maxPower: 0, maxShieldHp: 0,   shieldRadius: 0 },
};

export const WIRE_MAX_HP = 50;
export const GRID_WIDTH = 90;
export const GRID_HEIGHT = 51;
export const CELL_SIZE = 20;
export const CANVAS_WIDTH = GRID_WIDTH * CELL_SIZE;   // world width in pixels (1800)
export const CANVAS_HEIGHT = GRID_HEIGHT * CELL_SIZE;  // world height in pixels (1020)
export const HALF_CELL = CELL_SIZE / 2;
export const VIEWPORT_WIDTH = 1200;
export const VIEWPORT_HEIGHT = 680;

export interface Camera {
  x: number;    // world X of viewport top-left
  y: number;    // world Y of viewport top-left
  zoom: number;
}

export const TURRET_RANGE: Partial<Record<TowerType, number>> = {
  blaster: 150,
  gatling: 130,
  sniper: 300,
  tesla: 180,
};

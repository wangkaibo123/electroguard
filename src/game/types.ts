import { GLOBAL_CONFIG, TOWER_CONFIG, WEAPON_CONFIG } from './config';

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

export const TOWER_STATS: Record<TowerType, TowerStats> = TOWER_CONFIG;

export const WIRE_MAX_HP = GLOBAL_CONFIG.wireMaxHp;
export const GRID_WIDTH = GLOBAL_CONFIG.gridWidth;
export const GRID_HEIGHT = GLOBAL_CONFIG.gridHeight;
export const CELL_SIZE = GLOBAL_CONFIG.cellSize;
export const CANVAS_WIDTH = GRID_WIDTH * CELL_SIZE;
export const CANVAS_HEIGHT = GRID_HEIGHT * CELL_SIZE;
export const HALF_CELL = CELL_SIZE / 2;
export const VIEWPORT_WIDTH = GLOBAL_CONFIG.viewportWidth;
export const VIEWPORT_HEIGHT = GLOBAL_CONFIG.viewportHeight;

export interface Camera {
  x: number;    // world X of viewport top-left
  y: number;    // world Y of viewport top-left
  zoom: number;
}

export const TURRET_RANGE: Partial<Record<TowerType, number>> = {
  blaster: WEAPON_CONFIG.blaster.range,
  gatling: WEAPON_CONFIG.gatling.range,
  sniper: WEAPON_CONFIG.sniper.range,
  tesla: WEAPON_CONFIG.tesla.range,
};

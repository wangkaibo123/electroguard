export type Position = { x: number; y: number };
export type TowerType = 'core' | 'blaster' | 'generator' | 'wall' | 'shield' | 'battery' | 'target';
export type GameMode = 'normal' | 'custom';
export type PortDirection = 'top' | 'right' | 'bottom' | 'left';
export type PortType = 'input' | 'output';
export type GameStatus = 'menu' | 'playing' | 'paused' | 'pick' | 'gameover';

export interface Port {
  id: string;
  direction: PortDirection;
  portType: PortType;
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
}

export interface Enemy {
  id: string;
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
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  targetId: string;
  speed: number;
  damage: number;
  isTargetTower?: boolean;
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
  particles: Particle[];
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
  core:      { hp: 1000, description: 'The heart of your defense. Generates power.',             color: '#93c5fd', width: 3, height: 3, maxPower: 9, maxShieldHp: 500, shieldRadius: 100 },
  blaster:   { hp: 100,  description: 'Auto-fires at nearby enemies. 50 dmg, needs 4 power.',   color: '#f87171', width: 2, height: 2, maxPower: 4, maxShieldHp: 0,   shieldRadius: 0 },
  generator: { hp: 100,  description: 'Power source for the network. Dispatches energy.',        color: '#fbbf24', width: 2, height: 2, maxPower: 0, maxShieldHp: 0,   shieldRadius: 0 },
  wall:      { hp: 500,  description: 'High durability. Blocks enemies.',                        color: '#6b7280', width: 1, height: 1, maxPower: 0, maxShieldHp: 0,   shieldRadius: 0 },
  shield:    { hp: 100,  description: 'Projects a protective shield. Consumes power to recharge.', color: '#22d3ee', width: 1, height: 1, maxPower: 4, maxShieldHp: 300, shieldRadius: 60 },
  battery:   { hp: 150,  description: 'Stores 4 units of power and discharges quickly.',         color: '#34d399', width: 2, height: 1, maxPower: 4, maxShieldHp: 0,   shieldRadius: 0 },
  target:    { hp: 200,  description: 'Practice target. Treated as an enemy by turrets.',       color: '#fb923c', width: 1, height: 1, maxPower: 0, maxShieldHp: 0,   shieldRadius: 0 },
};

export const WIRE_MAX_HP = 50;
export const GRID_WIDTH = 60;
export const GRID_HEIGHT = 34;
export const CELL_SIZE = 20;
export const CANVAS_WIDTH = GRID_WIDTH * CELL_SIZE;
export const CANVAS_HEIGHT = GRID_HEIGHT * CELL_SIZE;
export const HALF_CELL = CELL_SIZE / 2;

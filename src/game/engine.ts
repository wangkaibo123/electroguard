import {
  GameState, Tower, TowerType, Position, Port, PortDirection, PortType, Wire, PickOption, EnemyType,
  PickUiPhase,
  GRID_WIDTH, GRID_HEIGHT, CELL_SIZE, HALF_CELL, TOWER_STATS, CANVAS_WIDTH, CANVAS_HEIGHT, WIRE_MAX_HP,
} from './types';
import { t, pickKey } from './i18n';
import { GLOBAL_CONFIG, ENEMY_CONFIG, ENEMY_SCALING, STARTING_INVENTORY, PICK_POOL_CONFIG, WEAPON_CONFIG } from './config';

const ENEMY_SPEED_MUL = GLOBAL_CONFIG.enemyBaseSpeedMul;

// ── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
export const genId = () => (++_idCounter).toString(36);

const PORT_DIRS: PortDirection[] = ['top', 'right', 'bottom', 'left'];
const NEIGHBOR_OFFSETS = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const;
const GATLING_RANGE = WEAPON_CONFIG.gatling.range;

const gatlingNeedsPower = (state: GameState, tower: Tower) => {
  const baseX = (tower.x + tower.width / 2) * CELL_SIZE;
  const baseY = (tower.y + tower.height / 2) * CELL_SIZE;

  for (const enemy of state.enemies) {
    if (Math.hypot(enemy.x - baseX, enemy.y - baseY) < GATLING_RANGE) {
      return true;
    }
  }

  return false;
};

// ── Rotation helpers ─────────────────────────────────────────────────────────

export const rotatePortDir = (dir: PortDirection, steps: number): PortDirection =>
  PORT_DIRS[((PORT_DIRS.indexOf(dir) + steps) % 4 + 4) % 4];

export const snapRotation = (angle: number): number => {
  const TWO_PI = Math.PI * 2;
  const a = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
  return Math.round(a / (Math.PI / 2)) * (Math.PI / 2) % TWO_PI;
};

const rotationSteps = (from: number, to: number): number => {
  const TWO_PI = Math.PI * 2;
  const f = Math.round((((from % TWO_PI) + TWO_PI) % TWO_PI) / (Math.PI / 2));
  const t = Math.round((((to % TWO_PI) + TWO_PI) % TWO_PI) / (Math.PI / 2));
  return ((t - f) % 4 + 4) % 4;
};

// ── Port position helpers ────────────────────────────────────────────────────

export const getPortPos = (t: Tower, p: Port): Position => {
  const px = t.x * CELL_SIZE, py = t.y * CELL_SIZE;
  const tw = t.width * CELL_SIZE, th = t.height * CELL_SIZE;
  const off = p.sideOffset ?? 0.5;
  if (t.type === 'battery' || t.type === 'bus') {
    const landscape = tw >= th;
    const yIn = landscape ? Math.max((th - tw / 2) / 2, 0) : 0;
    const xIn = !landscape ? Math.max((tw - th / 2) / 2, 0) : 0;
    switch (p.direction) {
      case 'top':    return { x: px + tw * off, y: py + yIn };
      case 'bottom': return { x: px + tw * off, y: py + th - yIn };
      case 'right':  return { x: px + tw - xIn, y: py + th * off };
      case 'left':   return { x: px + xIn,      y: py + th * off };
    }
  }
  switch (p.direction) {
    case 'top':    return { x: px + tw * off, y: py };
    case 'right':  return { x: px + tw,       y: py + th * off };
    case 'bottom': return { x: px + tw * off, y: py + th };
    case 'left':   return { x: px,            y: py + th * off };
  }
};

export const getPortCell = (t: Tower, p: Port): Position => {
  const off = p.sideOffset ?? 0.5;
  switch (p.direction) {
    case 'top':    return { x: t.x + Math.floor(t.width * off),  y: t.y - 1 };
    case 'bottom': return { x: t.x + Math.floor(t.width * off),  y: t.y + t.height };
    case 'left':   return { x: t.x - 1,                          y: t.y + Math.floor(t.height * off) };
    case 'right':  return { x: t.x + t.width,                    y: t.y + Math.floor(t.height * off) };
  }
};

// ── Collision helpers ────────────────────────────────────────────────────────

export const collidesWithTowers = (
  x: number, y: number, w: number, h: number,
  towers: Tower[], excludeId?: string, clearance = 0
): boolean => {
  for (const t of towers) {
    if (t.id === excludeId) continue;
    if (
      x < t.x + t.width + clearance &&
      x + w > t.x - clearance &&
      y < t.y + t.height + clearance &&
      y + h > t.y - clearance
    ) return true;
  }
  return false;
};

export const collidesWithWires = (
  x: number, y: number, w: number, h: number,
  wires: Wire[], excludeTowerId?: string, clearance = 0
): boolean => {
  for (const wire of wires) {
    if (excludeTowerId && (wire.startTowerId === excludeTowerId || wire.endTowerId === excludeTowerId)) continue;
    for (const p of wire.path) {
      if (
        p.x >= x - clearance &&
        p.x < x + w + clearance &&
        p.y >= y - clearance &&
        p.y < y + h + clearance
      ) return true;
    }
  }
  return false;
};

/** Placement validity check — uses towerInventory (unlimited in custom mode) */
export const canPlace = (
  x: number, y: number, type: TowerType, state: GameState
): boolean => {
  const s = TOWER_STATS[type];
  if (state.gameMode !== 'custom' && (state.towerInventory[type] ?? 0) <= 0) return false;
  if (x < 0 || y < 0 || x + s.width > GRID_WIDTH || y + s.height > GRID_HEIGHT) return false;
  return !collidesWithTowers(x, y, s.width, s.height, state.towers)
      && !collidesWithWires(x, y, s.width, s.height, state.wires);
};

// ── A* wire pathfinding ──────────────────────────────────────────────────────

export const findWirePath = (
  start: Position, end: Position, state: GameState, ignoreWireId?: string
): Position[] | null => {
  if (start.x < 0 || start.x >= GRID_WIDTH || start.y < 0 || start.y >= GRID_HEIGHT) return null;
  if (end.x < 0 || end.x >= GRID_WIDTH || end.y < 0 || end.y >= GRID_HEIGHT) return null;

  const blocked = new Set<number>();
  const key = (x: number, y: number) => y * GRID_WIDTH + x;

  for (const t of state.towers) {
    for (let gx = t.x; gx < t.x + t.width; gx++)
      for (let gy = t.y; gy < t.y + t.height; gy++)
        blocked.add(key(gx, gy));
  }
  for (const w of state.wires) {
    if (w.id === ignoreWireId) continue;
    for (const p of w.path) blocked.add(key(p.x, p.y));
  }

  const sk = key(start.x, start.y), ek = key(end.x, end.y);
  if (sk !== ek && (blocked.has(sk) || blocked.has(ek))) return null;
  if (sk === ek) return [{ ...start }];

  const gScore = new Map<number, number>([[sk, 0]]);
  const parent = new Map<number, number>();
  const parentDir = new Map<number, number>(); // track incoming direction index
  const h = (x: number, y: number) => Math.abs(x - end.x) + Math.abs(y - end.y);
  const TURN_COST = GLOBAL_CONFIG.turnCost;

  const open: { k: number; x: number; y: number; f: number }[] =
    [{ k: sk, x: start.x, y: start.y, f: h(start.x, start.y) }];

  while (open.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[minIdx].f) minIdx = i;
    }
    const cur = open[minIdx];
    open[minIdx] = open[open.length - 1];
    open.pop();

    if (cur.x === end.x && cur.y === end.y) {
      const path: Position[] = [];
      let pk: number | undefined = cur.k;
      while (pk !== undefined) {
        path.push({ x: pk % GRID_WIDTH, y: (pk / GRID_WIDTH) | 0 });
        pk = parent.get(pk);
      }
      path.reverse();
      return path;
    }

    const curG = gScore.get(cur.k)!;
    const curDir = parentDir.get(cur.k);
    for (let di = 0; di < 4; di++) {
      const [dx, dy] = NEIGHBOR_OFFSETS[di];
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue;
      const nk = key(nx, ny);
      if (blocked.has(nk)) continue;
      const turn = (curDir !== undefined && curDir !== di) ? TURN_COST : 0;
      const ng = curG + 1 + turn;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        parent.set(nk, cur.k);
        parentDir.set(nk, di);
        open.push({ k: nk, x: nx, y: ny, f: ng + h(nx, ny) });
      }
    }
  }
  return null;
};

// ── Port generation ─────────────────────────────────────────────────────────

export const generatePorts = (portType: PortType, count = GLOBAL_CONFIG.portCount): Port[] => {
  const dirs = [...PORT_DIRS];
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
  }
  return dirs.slice(0, count).map(d => ({ id: genId(), direction: d, portType }));
};

// ── Tower map rebuild helper ─────────────────────────────────────────────────

export const rebuildTowerMap = (state: GameState) => {
  state.towerMap.clear();
  for (const t of state.towers) state.towerMap.set(t.id, t);
};

// ── Roguelike pick system ────────────────────────────────────────────────────

export const generatePickOptions = (): PickOption[] => {
  const loc = t();
  const remaining = PICK_POOL_CONFIG.pool.map((o, i) => ({ ...o, idx: i }));
  const picked: typeof remaining = [];

  for (let n = 0; n < PICK_POOL_CONFIG.pickCount && remaining.length > 0; n++) {
    const totalWeight = remaining.reduce((s, o) => s + o.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosenIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
      roll -= remaining[i].weight;
      if (roll <= 0) { chosenIdx = i; break; }
    }
    picked.push(remaining[chosenIdx]);
    remaining.splice(chosenIdx, 1);
  }

  return picked.map(o => {
    const k = pickKey(o.kind, o.towerType, o.count);
    return {
      kind: o.kind, towerType: o.towerType, count: o.count,
      id: genId(),
      label: loc.pickLabel[k] ?? k,
      description: loc.pickDesc[k] ?? '',
    };
  });
};

/** Fixed bonus 3-choice after clearing a boss wave: wire → generator → shield (display order). */
export const generateBossBonusPickOptions = (): PickOption[] => {
  const loc = t();
  const defs: { kind: 'tower' | 'wire'; towerType?: TowerType; count: number }[] = [
    { kind: 'wire', count: 5 },
    { kind: 'tower', towerType: 'generator', count: 1 },
    { kind: 'tower', towerType: 'shield', count: 1 },
  ];
  return defs.map(o => {
    const k = pickKey(o.kind, o.towerType, o.count);
    return {
      kind: o.kind,
      towerType: o.towerType,
      count: o.count,
      id: genId(),
      label: loc.pickLabel[k] ?? k,
      description: loc.pickDesc[k] ?? '',
    };
  });
};

// ── Initial state ────────────────────────────────────────────────────────────

export const createInitialState = (): GameState => {
  const cw = TOWER_STATS.core.width;
  const ch = TOWER_STATS.core.height;
  const core: Tower = {
    id: genId(), type: 'core',
    x: (GRID_WIDTH >> 1) - Math.floor(cw / 2),
    y: (GRID_HEIGHT >> 1) - Math.floor(ch / 2),
    width: cw, height: ch,
    hp: TOWER_STATS.core.hp, maxHp: TOWER_STATS.core.hp,
    powered: true, storedPower: 0, maxPower: TOWER_STATS.core.maxPower, incomingPower: 0,
    shieldHp: TOWER_STATS.core.maxShieldHp, maxShieldHp: TOWER_STATS.core.maxShieldHp,
    shieldRadius: TOWER_STATS.core.shieldRadius,
    lastActionTime: 0,
    ports: PORT_DIRS.map(d => ({ id: genId(), direction: d, portType: 'output' as PortType })),
    rotation: 0,
    barrelAngle: 0,
    heat: 0,
  };
  const towerMap = new Map<string, Tower>([[core.id, core]]);
  return {
    status: 'menu',
    gameMode: 'normal',
    wave: 0,
    powerTimer: 0,
    wireInventory: STARTING_INVENTORY.wires,
    towerInventory: { ...STARTING_INVENTORY.towers },
    pickOptions: [],
    bossBonusPickQueued: false,
    pendingBossBonusPick: false,
    pickUiPhase: 'standard' satisfies PickUiPhase,
    needsPick: true,
    towers: [core], wires: [], pulses: [], enemies: [], projectiles: [], chainLightnings: [], particles: [], hitEffects: [], shieldBreakEffects: [], incomingDrops: [],
    waveTimer: 0, enemiesToSpawn: 0, spawnTimer: 0, score: 0, towerMap,
  };
};

// ── Power grid BFS ───────────────────────────────────────────────────────────

export const updatePowerGrid = (state: GameState) => {
  for (const t of state.towers) t.powered = false;

  const queue: string[] = [];
  for (const t of state.towers) {
    if (t.type === 'core' || t.type === 'generator') {
      t.powered = true;
      queue.push(t.id);
    }
  }
  const visited = new Set(queue);

  while (queue.length > 0) {
    const cid = queue.shift()!;
    for (const w of state.wires) {
      const nextId = w.startTowerId === cid ? w.endTowerId
                   : w.endTowerId === cid ? w.startTowerId : null;
      if (!nextId || visited.has(nextId)) continue;
      visited.add(nextId);
      queue.push(nextId);
      const t = state.towerMap.get(nextId);
      if (t) t.powered = true;
    }
  }
};

// ── Pulse dispatch ───────────────────────────────────────────────────────────

export const dispatchPulse = (state: GameState, src: Tower, isBattery = false): boolean => {
  const queue = [{ tower: src, path: [] as Wire[] }];
  const visited = new Set([src.id]);

  while (queue.length > 0) {
    const { tower, path } = queue.shift()!;

    const canReceivePulse = tower.id !== src.id && (
      tower.type === 'gatling'
        ? tower.incomingPower < 1 && gatlingNeedsPower(state, tower)
        : (tower.storedPower + tower.incomingPower) < tower.maxPower
    );

    if (canReceivePulse) {
      if (!isBattery || tower.type !== 'battery') {
        const pixels: Position[] = [{ x: (src.x + src.width / 2) * CELL_SIZE, y: (src.y + src.height / 2) * CELL_SIZE }];
        let curId = src.id;
        for (const w of path) {
          const fwd = w.startTowerId === curId;
          const t1 = state.towerMap.get(curId)!;
          const p1 = t1.ports.find(p => p.id === (fwd ? w.startPortId : w.endPortId))!;
          pixels.push(getPortPos(t1, p1));
          const cells = fwd ? w.path : [...w.path].reverse();
          for (const c of cells) pixels.push({ x: c.x * CELL_SIZE + HALF_CELL, y: c.y * CELL_SIZE + HALF_CELL });
          const nid = fwd ? w.endTowerId : w.startTowerId;
          const t2 = state.towerMap.get(nid)!;
          const p2 = t2.ports.find(p => p.id === (fwd ? w.endPortId : w.startPortId))!;
          pixels.push(getPortPos(t2, p2));
          curId = nid;
        }
        pixels.push({ x: (tower.x + tower.width / 2) * CELL_SIZE, y: (tower.y + tower.height / 2) * CELL_SIZE });

        tower.incomingPower++;
        state.pulses.push({ id: genId(), path: pixels, progress: 0, targetTowerId: tower.id });
        return true;
      }
    }

    for (const w of state.wires) {
      let nextId: string | null = null;
      if (w.startTowerId === tower.id) {
        if (tower.ports.find(p => p.id === w.startPortId)?.portType === 'output') nextId = w.endTowerId;
      } else if (w.endTowerId === tower.id) {
        if (tower.ports.find(p => p.id === w.endPortId)?.portType === 'output') nextId = w.startTowerId;
      }
      if (!nextId || visited.has(nextId)) continue;
      visited.add(nextId);
      const next = state.towerMap.get(nextId);
      if (next) queue.push({ tower: next, path: [...path, w] });
    }
  }
  return false;
};

// ── Re-path wires connected to a tower ───────────────────────────────────────

export const repathConnectedWires = (state: GameState, towerId: string) => {
  let changed = false;
  for (let i = state.wires.length - 1; i >= 0; i--) {
    const w = state.wires[i];
    if (w.startTowerId !== towerId && w.endTowerId !== towerId) continue;
    const st = state.towerMap.get(w.startTowerId);
    const et = state.towerMap.get(w.endTowerId);
    if (!st || !et) {
      state.wires.splice(i, 1);
      if (state.gameMode !== 'custom') state.wireInventory++;
      changed = true; continue;
    }
    const sp = st.ports.find(p => p.id === w.startPortId);
    const ep = et.ports.find(p => p.id === w.endPortId);
    if (!sp || !ep) {
      state.wires.splice(i, 1);
      if (state.gameMode !== 'custom') state.wireInventory++;
      changed = true; continue;
    }
    const np = findWirePath(getPortCell(st, sp), getPortCell(et, ep), state, w.id);
    if (np) { w.path = np; } else {
      state.wires.splice(i, 1);
      if (state.gameMode !== 'custom') state.wireInventory++;
      changed = true;
    }
  }
  if (changed) updatePowerGrid(state);
};

// ── Tower rotation ───────────────────────────────────────────────────────────

export const applyTowerRotation = (
  tower: Tower, newAngle: number, oldAngle: number, state: GameState
): boolean => {
  const steps = rotationSteps(oldAngle, newAngle);
  if (steps === 0) { tower.rotation = 0; return true; }

  const needsSwap = (steps === 1 || steps === 3) && tower.width !== tower.height;
  const nw = needsSwap ? tower.height : tower.width;
  const nh = needsSwap ? tower.width : tower.height;

  if (tower.x < 0 || tower.y < 0 || tower.x + nw > GRID_WIDTH || tower.y + nh > GRID_HEIGHT) return false;
  if (collidesWithTowers(tower.x, tower.y, nw, nh, state.towers, tower.id)) return false;
  if (collidesWithWires(tower.x, tower.y, nw, nh, state.wires, tower.id)) return false;

  tower.rotation = 0;
  tower.width = nw;
  tower.height = nh;
  for (const port of tower.ports) port.direction = rotatePortDir(port.direction, steps);

  repathConnectedWires(state, tower.id);
  updatePowerGrid(state);
  return true;
};

// ── Enemy spawning ───────────────────────────────────────────────────────────

/** Pick a random enemy type valid for the given wave */
const pickEnemyType = (wave: number): EnemyType => {
  const pool: EnemyType[] = [];
  for (const [type, def] of Object.entries(ENEMY_CONFIG) as [EnemyType, typeof ENEMY_CONFIG[EnemyType]][]) {
    if (def.unlockWave >= 0 && wave >= def.unlockWave) pool.push(type);
  }
  return pool[(Math.random() * pool.length) | 0];
};

const spawnPos = (): { x: number; y: number } => {
  const side = (Math.random() * 4) | 0;
  let x = 0, y = 0;
  if (side === 0)      { x = Math.random() * CANVAS_WIDTH;  y = -CELL_SIZE; }
  else if (side === 1) { x = CANVAS_WIDTH + CELL_SIZE;      y = Math.random() * CANVAS_HEIGHT; }
  else if (side === 2) { x = Math.random() * CANVAS_WIDTH;  y = CANVAS_HEIGHT + CELL_SIZE; }
  else                 { x = -CELL_SIZE;                     y = Math.random() * CANVAS_HEIGHT; }
  return { x, y };
};

const pushEnemy = (state: GameState, type: EnemyType, wave: number) => {
  const def = ENEMY_CONFIG[type];
  const sc = ENEMY_SCALING;
  const hpMul = 1 + wave * sc.hpPerWave;
  const hp = def.baseHp * hpMul;
  const { x, y } = spawnPos();
  const shieldHp = def.baseShield * hpMul;
  const speedBonus = 1 + wave * sc.speedPerWave;
  state.enemies.push({
    id: genId(), enemyType: type, x, y,
    hp, maxHp: hp,
    speed: (def.speedMin + Math.random() * (def.speedMax - def.speedMin)) * speedBonus * ENEMY_SPEED_MUL,
    damage: def.baseDamage + Math.floor(wave * sc.damagePerWave),
    attackCooldown: def.cooldown, lastAttackTime: 0, targetId: null, heading: 0,
    radius: def.radius, color: def.color, wireDamageMul: def.wireDamageMul,
    shieldAbsorb: shieldHp, maxShieldAbsorb: shieldHp,
    lastSpawnTime: 0,
  });
};

export const spawnEnemy = (state: GameState, wave: number) => {
  pushEnemy(state, pickEnemyType(wave), wave);
};

export const spawnBoss = (state: GameState, wave: number) => {
  pushEnemy(state, 'overlord', wave);
};

export const spawnEnemyAt = (
  state: GameState,
  type: EnemyType,
  wave: number,
  x: number,
  y: number,
  options?: { isStatic?: boolean },
) => {
  const def = ENEMY_CONFIG[type];
  const sc = ENEMY_SCALING;
  const hpMul = 1 + wave * sc.hpPerWave;
  const hp = def.baseHp * hpMul;
  const shieldHp = def.baseShield * hpMul;
  const speedBonus = 1 + wave * sc.speedPerWave;
  state.enemies.push({
    id: genId(), enemyType: type, isStatic: options?.isStatic, x, y,
    hp, maxHp: hp,
    speed: options?.isStatic
      ? 0
      : (def.speedMin + Math.random() * (def.speedMax - def.speedMin)) * speedBonus * ENEMY_SPEED_MUL,
    damage: def.baseDamage + Math.floor(wave * sc.damagePerWave),
    attackCooldown: def.cooldown, lastAttackTime: 0, targetId: null, heading: 0,
    radius: def.radius, color: def.color, wireDamageMul: def.wireDamageMul,
    shieldAbsorb: shieldHp, maxShieldAbsorb: shieldHp,
    lastSpawnTime: 0,
  });
};

// ── Particle effects ─────────────────────────────────────────────────────────

export const createExplosion = (state: GameState, x: number, y: number, color: string, count = 10) => {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = Math.random() * 100 + 50;
    state.particles.push({
      x, y,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: 0, maxLife: 0.2 + Math.random() * 0.3,
      color, size: 2 + Math.random() * 3,
    });
  }
};

import {
  GameState, Tower, TowerType, Position, Port, PortDirection, PortType, Wire, PickOption,
  GRID_WIDTH, GRID_HEIGHT, CELL_SIZE, HALF_CELL, TOWER_STATS, CANVAS_WIDTH, CANVAS_HEIGHT, WIRE_MAX_HP,
} from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
export const genId = () => (++_idCounter).toString(36);

const PORT_DIRS: PortDirection[] = ['top', 'right', 'bottom', 'left'];
const NEIGHBOR_OFFSETS = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const;

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
  switch (p.direction) {
    case 'top':    return { x: px + tw / 2, y: py };
    case 'right':  return { x: px + tw,     y: py + th / 2 };
    case 'bottom': return { x: px + tw / 2, y: py + th };
    case 'left':   return { x: px,          y: py + th / 2 };
  }
};

export const getPortCell = (t: Tower, p: Port): Position => {
  const cx = t.x + (t.width >> 1), cy = t.y + (t.height >> 1);
  switch (p.direction) {
    case 'top':    return { x: cx, y: t.y - 1 };
    case 'bottom': return { x: cx, y: t.y + t.height };
    case 'left':   return { x: t.x - 1, y: cy };
    case 'right':  return { x: t.x + t.width, y: cy };
  }
};

// ── Collision helpers ────────────────────────────────────────────────────────

export const collidesWithTowers = (
  x: number, y: number, w: number, h: number,
  towers: Tower[], excludeId?: string
): boolean => {
  for (const t of towers) {
    if (t.id === excludeId) continue;
    if (x < t.x + t.width && x + w > t.x && y < t.y + t.height && y + h > t.y) return true;
  }
  return false;
};

export const collidesWithWires = (
  x: number, y: number, w: number, h: number,
  wires: Wire[], excludeTowerId?: string
): boolean => {
  for (const wire of wires) {
    if (excludeTowerId && (wire.startTowerId === excludeTowerId || wire.endTowerId === excludeTowerId)) continue;
    for (const p of wire.path) {
      if (p.x >= x && p.x < x + w && p.y >= y && p.y < y + h) return true;
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
  const TURN_COST = 0.001; // small penalty for direction changes → prefers straight paths

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

// ── Port generation (always 2 random-direction ports) ────────────────────────

export const generatePorts = (portType: PortType): Port[] => {
  const dirs = [...PORT_DIRS];
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
  }
  return dirs.slice(0, 2).map(d => ({ id: genId(), direction: d, portType }));
};

// ── Tower map rebuild helper ─────────────────────────────────────────────────

export const rebuildTowerMap = (state: GameState) => {
  state.towerMap.clear();
  for (const t of state.towers) state.towerMap.set(t.id, t);
};

// ── Roguelike pick system ────────────────────────────────────────────────────

const PICK_POOL: Omit<PickOption, 'id'>[] = [
  { kind: 'tower', towerType: 'blaster',   count: 1, label: 'Blaster',     description: 'Auto-fires at enemies (50 dmg)' },
  { kind: 'tower', towerType: 'blaster',   count: 2, label: 'Blaster x2',  description: 'Two auto-firing turrets' },
  { kind: 'tower', towerType: 'generator', count: 1, label: 'Generator',   description: 'Power source for the network' },
  { kind: 'tower', towerType: 'wall',      count: 3, label: 'Wall x3',     description: 'High-durability enemy blockers' },
  { kind: 'tower', towerType: 'wall',      count: 5, label: 'Wall x5',     description: 'Fortify your defense perimeter' },
  { kind: 'tower', towerType: 'shield',    count: 1, label: 'Shield',      description: 'Projects a protective bubble' },
  { kind: 'tower', towerType: 'battery',   count: 1, label: 'Battery',     description: 'Stores power, discharges rapidly' },
  { kind: 'wire',                          count: 3, label: 'Wire x3',     description: 'Power line connectors' },
  { kind: 'wire',                          count: 5, label: 'Wire x5',     description: 'Large bundle of power lines' },
];

export const generatePickOptions = (): PickOption[] => {
  const shuffled = [...PICK_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map(o => ({ ...o, id: genId() }));
};

// ── Initial state ────────────────────────────────────────────────────────────

export const createInitialState = (): GameState => {
  const core: Tower = {
    id: genId(), type: 'core',
    x: (GRID_WIDTH >> 1) - 1, y: (GRID_HEIGHT >> 1) - 1,
    width: 3, height: 3,
    hp: TOWER_STATS.core.hp, maxHp: TOWER_STATS.core.hp,
    powered: true, storedPower: 0, maxPower: TOWER_STATS.core.maxPower, incomingPower: 0,
    shieldHp: TOWER_STATS.core.maxShieldHp, maxShieldHp: TOWER_STATS.core.maxShieldHp,
    shieldRadius: TOWER_STATS.core.shieldRadius,
    lastActionTime: 0,
    ports: PORT_DIRS.map(d => ({ id: genId(), direction: d, portType: 'output' as PortType })),
    rotation: 0,
  };
  const towerMap = new Map<string, Tower>([[core.id, core]]);
  return {
    status: 'menu',
    gameMode: 'normal',
    wave: 0,
    powerTimer: 0,
    wireInventory: 5,
    towerInventory: { blaster: 1, generator: 1, wall: 0, shield: 0, battery: 0 },
    pickOptions: [],
    needsPick: true,
    towers: [core], wires: [], pulses: [], enemies: [], projectiles: [], particles: [],
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

    if (tower.id !== src.id && (tower.storedPower + tower.incomingPower) < tower.maxPower) {
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
    if (!st || !et) { state.wires.splice(i, 1); changed = true; continue; }
    const sp = st.ports.find(p => p.id === w.startPortId);
    const ep = et.ports.find(p => p.id === w.endPortId);
    if (!sp || !ep) { state.wires.splice(i, 1); changed = true; continue; }
    const np = findWirePath(getPortCell(st, sp), getPortCell(et, ep), state, w.id);
    if (np) { w.path = np; } else { state.wires.splice(i, 1); changed = true; }
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

export const spawnEnemy = (state: GameState, wave: number) => {
  const side = (Math.random() * 4) | 0;
  let x = 0, y = 0;
  if (side === 0)      { x = Math.random() * CANVAS_WIDTH;  y = -CELL_SIZE; }
  else if (side === 1) { x = CANVAS_WIDTH + CELL_SIZE;      y = Math.random() * CANVAS_HEIGHT; }
  else if (side === 2) { x = Math.random() * CANVAS_WIDTH;  y = CANVAS_HEIGHT + CELL_SIZE; }
  else                 { x = -CELL_SIZE;                     y = Math.random() * CANVAS_HEIGHT; }

  const hpMul = 1 + wave * 0.2;
  state.enemies.push({
    id: genId(), x, y,
    hp: 20 * hpMul, maxHp: 20 * hpMul,
    speed: 30 + Math.random() * 20, damage: 5 + wave,
    attackCooldown: 1000, lastAttackTime: 0, targetId: null, heading: 0,
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

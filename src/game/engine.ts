import {
  GameState, Tower, TowerType, CommandCardType, BaseUpgradeType, Position, Port, PortDirection, PortType, Wire, PickOption, EnemyType, ShopItemType,
  PickUiPhase,
  GRID_WIDTH, GRID_HEIGHT, CELL_SIZE, HALF_CELL, TOWER_STATS, CANVAS_WIDTH, CANVAS_HEIGHT, WIRE_MAX_HP,
} from './types';
import { t, pickKey } from './i18n';
import { GLOBAL_CONFIG, ENEMY_CONFIG, STARTING_INVENTORY, PICK_POOL_CONFIG, WEAPON_CONFIG, COMMAND_CARD_CONFIG, BASE_UPGRADE_CONFIG, SHOP_CONFIG, SHOP_ITEM_CONFIG, SHOP_OFFER_BUCKETS } from './config';
import { makeTowerCollider, makeEnemyCollider } from './collider';
import { getLinearTowerBodyAspectRatio, getLinearTowerBodyRect } from './linearTowerGeometry';
import { footprintsOverlap, getTowerCells, getTowerFootprintCells } from './footprint';

const ENEMY_SPEED_MUL = GLOBAL_CONFIG.enemyBaseSpeedMul;
// ── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
export const genId = () => (++_idCounter).toString(36);

const PORT_DIRS: PortDirection[] = ['top', 'right', 'bottom', 'left'];
const NEIGHBOR_OFFSETS = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const;
const GATLING_RANGE = WEAPON_CONFIG.gatling.range;
const DIRECT_PORT_OVERLAP_EPS = 0.75;

const gatlingNeedsPower = (state: GameState, tower: Tower) => {
  if (tower.overloaded) return false;

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

export const isLinearTowerLandscape = (
  t: Pick<Tower, 'type' | 'width' | 'height' | 'ports'>,
): boolean => {
  if (t.type !== 'battery' && t.type !== 'bus') return t.width >= t.height;
  if (t.width !== t.height) return t.width > t.height;

  const sidePorts = t.ports.filter(port => port.direction === 'left' || port.direction === 'right').length;
  const edgePorts = t.ports.filter(port => port.direction === 'top' || port.direction === 'bottom').length;
  return t.type === 'battery' ? sidePorts >= edgePorts : edgePorts >= sidePorts;
};

// ── Port position helpers ────────────────────────────────────────────────────

export const getPortPos = (t: Tower, p: Port): Position => {
  const px = t.x * CELL_SIZE, py = t.y * CELL_SIZE;
  const tw = t.width * CELL_SIZE, th = t.height * CELL_SIZE;
  const off = p.sideOffset ?? 0.5;
  if (t.type === 'battery') {
    const landscape = isLinearTowerLandscape(t);
    const body = getLinearTowerBodyRect(px, py, tw, th, landscape, getLinearTowerBodyAspectRatio(t.type));
    switch (p.direction) {
      case 'top':    return { x: px + tw * off, y: body.y };
      case 'bottom': return { x: px + tw * off, y: body.y + body.height };
      case 'right':  return { x: body.x + body.width, y: py + th * off };
      case 'left':   return { x: body.x,              y: py + th * off };
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

const portsOverlap = (towerA: Tower, portA: Port, towerB: Tower, portB: Port): boolean => {
  const posA = getPortPos(towerA, portA);
  const posB = getPortPos(towerB, portB);
  return Math.hypot(posA.x - posB.x, posA.y - posB.y) <= DIRECT_PORT_OVERLAP_EPS;
};

const isPortLinked = (state: GameState, portId: string, ignoreWireId?: string): boolean =>
  state.wires.some(wire => wire.id !== ignoreWireId && (wire.startPortId === portId || wire.endPortId === portId));

export const canDirectLinkPorts = (
  state: GameState,
  towerA: Tower,
  portA: Port,
  towerB: Tower,
  portB: Port,
  ignoreWireId?: string,
): boolean =>
  towerA.id !== towerB.id &&
  portA.portType !== portB.portType &&
  !isPortLinked(state, portA.id, ignoreWireId) &&
  !isPortLinked(state, portB.id, ignoreWireId) &&
  portsOverlap(towerA, portA, towerB, portB);

const hasDirectLinkCandidate = (
  state: GameState,
  tower: Tower,
  port: Port,
  ignoreWireId?: string,
): boolean => {
  if (isPortLinked(state, port.id, ignoreWireId)) return false;

  for (const otherTower of state.towers) {
    if (otherTower.id === tower.id) continue;
    for (const otherPort of otherTower.ports) {
      if (canDirectLinkPorts(state, tower, port, otherTower, otherPort, ignoreWireId)) {
        return true;
      }
    }
  }

  return false;
};

export const isPortAccessible = (
  state: GameState,
  tower: Tower,
  port: Port,
  ignoreWireId?: string,
): boolean => {
  const cell = getPortCell(tower, port);
  if (cell.x < 0 || cell.x >= GRID_WIDTH || cell.y < 0 || cell.y >= GRID_HEIGHT) return false;

  for (const other of state.towers) {
    if (getTowerCells(other).some(otherCell => otherCell.x === cell.x && otherCell.y === cell.y)) {
      return hasDirectLinkCandidate(state, tower, port, ignoreWireId);
    }
  }

  for (const wire of state.wires) {
    if (wire.id === ignoreWireId) continue;
    if (wire.path.some((point) => point.x === cell.x && point.y === cell.y)) {
      return false;
    }
  }

  return true;
};

// ── Collision helpers ────────────────────────────────────────────────────────

const getDirectLinkEndpoint = (towerA: Tower, portA: Port, towerB: Tower, portB: Port) => {
  if (portA.portType === portB.portType) return null;
  return portA.portType === 'output'
    ? { startTower: towerA, startPort: portA, endTower: towerB, endPort: portB }
    : { startTower: towerB, startPort: portB, endTower: towerA, endPort: portA };
};

const createDirectConnectSpark = (state: GameState, x: number, y: number) => {
  state.hitEffects.push({
    x,
    y,
    life: 0,
    maxLife: 0.22,
    color: '#60a5fa',
    radius: 16,
  });

  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    const speed = 110 + Math.random() * 140;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.14 + Math.random() * 0.14,
      color: Math.random() < 0.3 ? '#dbeafe' : '#60a5fa',
      size: 1.2 + Math.random() * 1.2,
      kind: 'spark',
    });
  }
};

const isDirectPortLinkStillValid = (state: GameState, wire: Wire): boolean => {
  const startTower = state.towerMap.get(wire.startTowerId);
  const endTower = state.towerMap.get(wire.endTowerId);
  const startPort = startTower?.ports.find(port => port.id === wire.startPortId);
  const endPort = endTower?.ports.find(port => port.id === wire.endPortId);
  if (!startTower || !endTower || !startPort || !endPort) return false;
  if (startPort.portType !== 'output' || endPort.portType !== 'input') return false;
  return portsOverlap(startTower, startPort, endTower, endPort);
};

export const syncDirectPortLinks = (
  state: GameState,
  options: { towerId?: string; createSpark?: boolean } = {},
): boolean => {
  let changed = false;

  for (let i = state.wires.length - 1; i >= 0; i--) {
    const wire = state.wires[i];
    if (!wire.direct) continue;
    if (options.towerId && wire.startTowerId !== options.towerId && wire.endTowerId !== options.towerId) continue;
    if (isDirectPortLinkStillValid(state, wire)) continue;
    state.wires.splice(i, 1);
    changed = true;
  }

  for (let i = 0; i < state.towers.length; i++) {
    const towerA = state.towers[i];
    for (let j = i + 1; j < state.towers.length; j++) {
      const towerB = state.towers[j];
      if (options.towerId && towerA.id !== options.towerId && towerB.id !== options.towerId) continue;

      for (const portA of towerA.ports) {
        if (isPortLinked(state, portA.id)) continue;

        for (const portB of towerB.ports) {
          if (portA.portType === portB.portType) continue;
          if (isPortLinked(state, portB.id)) continue;
          if (!portsOverlap(towerA, portA, towerB, portB)) continue;

          const endpoint = getDirectLinkEndpoint(towerA, portA, towerB, portB);
          if (!endpoint) continue;

          state.wires.push({
            id: genId(),
            startTowerId: endpoint.startTower.id,
            startPortId: endpoint.startPort.id,
            endTowerId: endpoint.endTower.id,
            endPortId: endpoint.endPort.id,
            path: [],
            hp: WIRE_MAX_HP,
            maxHp: WIRE_MAX_HP,
            direct: true,
            createdAt: performance.now(),
          });

          if (options.createSpark) {
            const sparkPos = getPortPos(endpoint.startTower, endpoint.startPort);
            createDirectConnectSpark(state, sparkPos.x, sparkPos.y);
          }
          changed = true;
          break;
        }
      }
    }
  }

  if (changed) updatePowerGrid(state);
  return changed;
};

export const collidesWithTowers = (
  x: number, y: number, w: number, h: number,
  towers: Tower[], excludeId?: string, clearance = 0, type: TowerType = 'core'
): boolean => {
  for (const t of towers) {
    if (t.id === excludeId) continue;
    if (footprintsOverlap(
      { x, y, width: w, height: h, type },
      { x: t.x, y: t.y, width: t.width, height: t.height, type: t.type },
      clearance,
    )) return true;
  }
  return false;
};

export const collidesWithWires = (
  x: number, y: number, w: number, h: number,
  wires: Wire[], excludeTowerId?: string, clearance = 0, type: TowerType = 'core'
): boolean => {
  const cells = getTowerFootprintCells(x, y, w, h, type);
  for (const wire of wires) {
    if (excludeTowerId && (wire.startTowerId === excludeTowerId || wire.endTowerId === excludeTowerId)) continue;
    for (const p of wire.path) {
      if (cells.some(cell => Math.abs(cell.x - p.x) <= clearance && Math.abs(cell.y - p.y) <= clearance)) {
        return true;
      }
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
  return !collidesWithTowers(x, y, s.width, s.height, state.towers, undefined, 0, type)
      && !collidesWithWires(x, y, s.width, s.height, state.wires, undefined, 0, type);
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
    for (const cell of getTowerCells(t)) blocked.add(key(cell.x, cell.y));
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

export const generatePorts = (portType: PortType, count: number = GLOBAL_CONFIG.portCount): Port[] => {
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

const TURRET_TYPES = new Set<string>(['blaster', 'gatling', 'sniper', 'tesla']);
const ADVANCED_TYPES: TowerType[] = ['missile', 'big_generator', 'repair_drone'];

export const generateTowerOnlyPickOptions = (): PickOption[] => {
  const loc = t();
  const remaining = PICK_POOL_CONFIG.pool
    .filter(o => o.kind === 'tower' && TURRET_TYPES.has(o.towerType ?? ''))
    .map((o, i) => ({ ...o, idx: i }));
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

export const generateInfraOnlyPickOptions = (): PickOption[] => {
  const loc = t();
  const remaining = PICK_POOL_CONFIG.pool
    .filter(o => o.kind === 'wire' || (o.kind === 'tower' && !TURRET_TYPES.has(o.towerType ?? '')))
    .map((o, i) => ({ ...o, idx: i }));
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

export const generateAdvancedPickOptions = (): PickOption[] => {
  const loc = t();
  const towerType = ADVANCED_TYPES[(Math.random() * ADVANCED_TYPES.length) | 0];
  const k = pickKey('tower', towerType, 1);
  return [{
    kind: 'tower',
    towerType,
    count: 1,
    id: genId(),
    label: loc.pickLabel[k] ?? loc.towerName[towerType] ?? towerType,
    description: loc.pickDesc[k] ?? loc.towerDesc[towerType] ?? '',
  }];
};

export const generateCommandCardPickOptions = (): PickOption[] => {
  const loc = t();
  const remaining = Object.keys(COMMAND_CARD_CONFIG) as CommandCardType[];
  const picked: CommandCardType[] = [];

  for (let n = 0; n < PICK_POOL_CONFIG.pickCount && remaining.length > 0; n++) {
    const idx = (Math.random() * remaining.length) | 0;
    picked.push(remaining[idx]);
    remaining.splice(idx, 1);
  }

  return picked.map(commandCardType => {
    const k = pickKey('command_card', commandCardType, 1);
    return {
      kind: 'command_card',
      commandCardType,
      count: 1,
      id: genId(),
      label: loc.pickLabel[k] ?? loc.commandCardName[commandCardType] ?? commandCardType,
      description: loc.pickDesc[k] ?? loc.commandCardDesc[commandCardType] ?? '',
    };
  });
};

export const generateBaseUpgradePickOptions = (): PickOption[] => {
  const loc = t();
  const upgradeTypes = Object.keys(BASE_UPGRADE_CONFIG) as BaseUpgradeType[];

  return upgradeTypes.map(baseUpgradeType => {
    const k = pickKey('base_upgrade', baseUpgradeType, 1);
    return {
      kind: 'base_upgrade',
      baseUpgradeType,
      count: 1,
      id: genId(),
      label: loc.pickLabel[k] ?? loc.baseUpgradeName[baseUpgradeType] ?? baseUpgradeType,
      description: loc.pickDesc[k] ?? loc.baseUpgradeDesc[baseUpgradeType] ?? '',
    };
  });
};

export const generateShopOffers = (count = 3): ShopItemType[] => {
  const remaining = SHOP_OFFER_BUCKETS
    .filter(bucket => bucket.weight > 0 && bucket.items.some(item => item.weight > 0))
    .map(bucket => ({ weight: bucket.weight, items: [...bucket.items] as { item: ShopItemType; weight: number }[] }));
  const offers: ShopItemType[] = [];

  while (offers.length < count && remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, bucket) => sum + bucket.weight, 0);
    let roll = Math.random() * totalWeight;
    let idx = 0;
    for (let i = 0; i < remaining.length; i++) {
      roll -= remaining[i].weight;
      if (roll <= 0) {
        idx = i;
        break;
      }
    }
    const bucket = remaining[idx];
    const itemPool = bucket.items.filter(item => item.weight > 0);
    const totalItemWeight = itemPool.reduce((sum, item) => sum + item.weight, 0);
    let itemRoll = Math.random() * totalItemWeight;
    let itemIdx = 0;
    for (let i = 0; i < itemPool.length; i++) {
      itemRoll -= itemPool[i].weight;
      if (itemRoll <= 0) {
        itemIdx = i;
        break;
      }
    }
    offers.push(itemPool[itemIdx].item);
    remaining.splice(idx, 1);
  }

  return offers;
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
    lastDamagedAt: 0,
    ports: PORT_DIRS.map(d => ({ id: genId(), direction: d, portType: 'output' as PortType })),
    rotation: 0,
    barrelAngle: 0,
    heat: 0,
    overloaded: false,
    gatlingAmmo: 0,
    collider: makeTowerCollider('core', cw, ch),
  };
  const towerMap = new Map<string, Tower>([[core.id, core]]);
  return {
    status: 'menu',
    gameMode: 'normal',
    wave: 0,
    powerTimer: 0,
    wireInventory: STARTING_INVENTORY.wires,
    gold: SHOP_CONFIG.startingGold,
    shopOffers: generateShopOffers(),
    shopRefreshCost: SHOP_CONFIG.initialRefreshCost,
    towerInventory: { ...STARTING_INVENTORY.towers },
    commandCardInventory: {},
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
    if (t.type === 'core' || t.type === 'generator' || t.type === 'big_generator') {
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

  for (const t of state.towers) {
    if ((t.selfPowerLevel ?? 0) > 0) t.powered = true;
  }
};

// ── Pulse dispatch ───────────────────────────────────────────────────────────

export const dispatchPulse = (state: GameState, src: Tower, isBattery = false): boolean => {
  const queue = [{ tower: src, path: [] as Wire[] }];
  const visited = new Set([src.id]);
  const launchDuration = src.type === 'generator' || src.type === 'big_generator' ? 0.28 : 0;

  while (queue.length > 0) {
    const { tower, path } = queue.shift()!;

    const canReceivePulse = tower.id !== src.id && (
      tower.type === 'gatling'
        ? gatlingNeedsPower(state, tower)
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
        state.pulses.push({
          id: genId(),
          path: pixels,
          progress: 0,
          targetTowerId: tower.id,
          sourceTowerId: src.id,
          launchDelay: launchDuration,
          launchDuration,
        });
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
    if (w.direct) {
      if (!isDirectPortLinkStillValid(state, w)) {
        state.wires.splice(i, 1);
        changed = true;
      }
      continue;
    }
    const st = state.towerMap.get(w.startTowerId);
    const et = state.towerMap.get(w.endTowerId);
    if (!st || !et) {
      state.wires.splice(i, 1);
      if (!w.direct && state.gameMode !== 'custom') state.wireInventory++;
      changed = true; continue;
    }
    const sp = st.ports.find(p => p.id === w.startPortId);
    const ep = et.ports.find(p => p.id === w.endPortId);
    if (!sp || !ep) {
      state.wires.splice(i, 1);
      if (!w.direct && state.gameMode !== 'custom') state.wireInventory++;
      changed = true; continue;
    }
    const np = findWirePath(getPortCell(st, sp), getPortCell(et, ep), state, w.id);
    if (np) { w.path = np; } else {
      state.wires.splice(i, 1);
      if (!w.direct && state.gameMode !== 'custom') state.wireInventory++;
      changed = true;
    }
  }
  const directChanged = syncDirectPortLinks(state, { towerId, createSpark: true });
  if (changed && !directChanged) updatePowerGrid(state);
};

// ── Tower rotation ───────────────────────────────────────────────────────────

export const applyTowerRotation = (
  tower: Tower, newAngle: number, oldAngle: number, state: GameState
): boolean => {
  const steps = rotationSteps(oldAngle, newAngle);
  if (steps === 0) { tower.rotation = snapRotation(newAngle); return true; }

  const needsSwap = (steps === 1 || steps === 3) && tower.width !== tower.height;
  const nw = needsSwap ? tower.height : tower.width;
  const nh = needsSwap ? tower.width : tower.height;

  if (tower.x < 0 || tower.y < 0 || tower.x + nw > GRID_WIDTH || tower.y + nh > GRID_HEIGHT) return false;
  if (collidesWithTowers(tower.x, tower.y, nw, nh, state.towers, tower.id, 0, tower.type)) return false;
  if (collidesWithWires(tower.x, tower.y, nw, nh, state.wires, tower.id, 0, tower.type)) return false;

  tower.rotation = snapRotation(newAngle);
  tower.barrelAngle += steps * (Math.PI / 2);
  tower.width = nw;
  tower.height = nh;
  for (const port of tower.ports) port.direction = rotatePortDir(port.direction, steps);
  tower.collider = makeTowerCollider(tower.type, nw, nh, isLinearTowerLandscape(tower));

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

const pushEnemy = (state: GameState, type: EnemyType, _wave: number) => {
  const def = ENEMY_CONFIG[type];
  const hp = def.baseHp;
  const { x, y } = spawnPos();
  const shieldHp = def.baseShield;
  state.enemies.push({
    id: genId(), enemyType: type, x, y,
    hp, maxHp: hp,
    speed: (def.speedMin + Math.random() * (def.speedMax - def.speedMin)) * ENEMY_SPEED_MUL,
    damage: def.baseDamage,
    goldReward: SHOP_CONFIG.goldPerEnemyKill,
    attackCooldown: def.cooldown, lastAttackTime: 0, targetId: null, heading: 0,
    radius: def.radius, color: def.color, wireDamageMul: def.wireDamageMul,
    shieldAbsorb: shieldHp, maxShieldAbsorb: shieldHp,
    lastSpawnTime: 0,
    collider: makeEnemyCollider(def.radius),
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
  _wave: number,
  x: number,
  y: number,
  options?: { isStatic?: boolean; goldReward?: number },
) => {
  const def = ENEMY_CONFIG[type];
  const hp = def.baseHp;
  const shieldHp = def.baseShield;
  state.enemies.push({
    id: genId(), enemyType: type, isStatic: options?.isStatic, x, y,
    hp, maxHp: hp,
    speed: options?.isStatic
      ? 0
      : (def.speedMin + Math.random() * (def.speedMax - def.speedMin)) * ENEMY_SPEED_MUL,
    damage: def.baseDamage,
    goldReward: options?.goldReward ?? SHOP_CONFIG.goldPerEnemyKill,
    attackCooldown: def.cooldown, lastAttackTime: 0, targetId: null, heading: 0,
    radius: def.radius, color: def.color, wireDamageMul: def.wireDamageMul,
    shieldAbsorb: shieldHp, maxShieldAbsorb: shieldHp,
    lastSpawnTime: 0,
    collider: makeEnemyCollider(def.radius),
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

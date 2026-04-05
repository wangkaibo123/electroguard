import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameState, TowerType, Port, PortDirection, Wire, CELL_SIZE, GRID_WIDTH, GRID_HEIGHT,
  TOWER_STATS, CANVAS_WIDTH, CANVAS_HEIGHT, WIRE_MAX_HP, ChainLightning,
  Camera, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, HitEffect, ShieldBreakEffect,
} from './types';
import {
  createInitialState, updatePowerGrid, spawnEnemy, spawnBoss, createExplosion,
  getPortPos, generatePorts, getPortCell, findWirePath, dispatchPulse,
  snapRotation, applyTowerRotation, canPlace, collidesWithTowers,
  collidesWithWires, repathConnectedWires, genId, rebuildTowerMap,
  generatePickOptions,
} from './engine';
import { renderGame } from './renderer';

// ── Constants ────────────────────────────────────────────────────────────────
const TWO_PI = Math.PI * 2;
const PULSE_SPEED = 400;
const POWER_INTERVAL = 2;
const SHIELD_COOLDOWN = 500;
const BATTERY_INTERVAL = 100;
const BLASTER_COOLDOWN = 1000;
const BLASTER_RANGE = 150;
const BLASTER_DAMAGE = 50;
const BLASTER_POWER_COST = 2;

const GATLING_RANGE = 130;
const GATLING_DAMAGE = 8;
const GATLING_BULLET_RANGE = 200;
const GATLING_MIN_INTERVAL = 200;  // ms at max heat (5 shots/sec)
const GATLING_MAX_INTERVAL = 500;  // ms when cold
const GATLING_HEAT_PER_SHOT = 0.12;
const GATLING_HEAT_DECAY = 0.15;   // per second
const GATLING_MIN_SPREAD = 0.04;   // ~2 degrees when cold
const GATLING_MAX_SPREAD = 0.35;   // ~20 degrees at max heat

const SNIPER_COOLDOWN = 4000;
const SNIPER_RANGE = 300;
const SNIPER_DAMAGE = 200;
const SNIPER_POWER_COST = 4;
const SNIPER_SPEED = 800;
const SNIPER_MAX_RANGE = 600; // straight-line max travel

const TESLA_COOLDOWN = 3000;
const TESLA_RANGE = 180;
const TESLA_BOUNCE_RANGE = 120;
const TESLA_DAMAGE_PER_POWER = 25;
const WAVE_DELAY = 5;
const ATTACK_RANGE = 10;

const ENEMY_SCORE: Record<string, number> = {
  scout: 5, grunt: 10, tank: 25, saboteur: 15, overlord: 100,
};

export const useGameLoop = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const [gameState, setGameState] = useState<GameState>(stateRef.current);

  const selectedTowerRef = useRef<TowerType | null>(null);
  const [selectedTower, _setSelectedTower] = useState<TowerType | null>(null);
  const setSelectedTower = (v: TowerType | null) => { selectedTowerRef.current = v; _setSelectedTower(v); };

  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const dragTowerRef = useRef<string | null>(null);
  const dragWireStartRef = useRef<{ towerId: string; portId: string } | null>(null);
  const dragWirePathRef = useRef<{ x: number; y: number }[] | null>(null);
  const mousePxRef = useRef<{ x: number; y: number } | null>(null);
  const rotatingRef = useRef<string | null>(null);
  const isRotKnobRef = useRef(false);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const rotStartAngleRef = useRef(0);
  const lastTimeRef = useRef(0);

  // Camera
  const MIN_ZOOM = Math.min(VIEWPORT_WIDTH / CANVAS_WIDTH, VIEWPORT_HEIGHT / CANVAS_HEIGHT);
  const MAX_ZOOM = 2.0;
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: MIN_ZOOM });

  // Pan state
  const isPanningRef = useRef(false);
  const panLastRef = useRef<{ x: number; y: number } | null>(null);

  // Drag cancel state
  const dragOrigPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragOrigWiresRef = useRef<Wire[] | null>(null);
  const dragOrigInventoryRef = useRef<number>(0);

  const sync = () => setGameState({ ...stateRef.current });

  const [rotatingTowerId, setRotatingTowerId] = useState<string | null>(null);
  const updateRotating = (id: string | null) => { rotatingRef.current = id; setRotatingTowerId(id); };

  // ── Actions ─────────────────────────────────────────────────────────────
  const startGame = () => {
    const s = createInitialState();
    s.status = 'pick';
    s.gameMode = 'normal';
    s.pickOptions = generatePickOptions();
    stateRef.current = s;
    sync();
  };

  const startCustomGame = () => {
    const s = createInitialState();
    s.status = 'playing';
    s.gameMode = 'custom';
    s.wireInventory = Infinity;
    s.needsPick = false;
    stateRef.current = s;
    sync();
  };

  const togglePause = () => {
    const s = stateRef.current;
    if (s.status === 'playing') s.status = 'paused';
    else if (s.status === 'paused') s.status = 'playing';
    sync();
  };

  const handlePick = (optionId: string) => {
    const state = stateRef.current;
    const option = state.pickOptions.find(o => o.id === optionId);
    if (!option) return;

    if (option.kind === 'tower' && option.towerType) {
      state.towerInventory[option.towerType] = (state.towerInventory[option.towerType] ?? 0) + option.count;
    } else if (option.kind === 'wire') {
      state.wireInventory += option.count;
    }

    state.pickOptions = [];
    state.needsPick = false;
    state.status = 'playing';
    state.waveTimer = 0;
    sync();
  };

  // ── Canvas mouse helpers ────────────────────────────────────────────────
  const canvasScreenXY = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return r ? { sx: e.clientX - r.left, sy: e.clientY - r.top } : null;
  };

  const toWorld = (sx: number, sy: number) => {
    const cam = cameraRef.current;
    return { wx: sx / cam.zoom + cam.x, wy: sy / cam.zoom + cam.y };
  };

  const clampCamera = (cam: Camera) => {
    const viewW = VIEWPORT_WIDTH / cam.zoom;
    const viewH = VIEWPORT_HEIGHT / cam.zoom;
    cam.x = Math.max(0, Math.min(cam.x, CANVAS_WIDTH - viewW));
    cam.y = Math.max(0, Math.min(cam.y, CANVAS_HEIGHT - viewH));
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const spos = canvasScreenXY(e);
    if (!spos) return;
    const { sx, sy } = spos;
    const state = stateRef.current;

    // Right-click: start pan
    if (e.button === 2) {
      isPanningRef.current = true;
      panLastRef.current = { x: sx, y: sy };
      return;
    }

    if (state.status !== 'playing') return;
    const { wx, wy } = toWorld(sx, sy);
    mouseDownPosRef.current = { x: wx, y: wy };

    // Rotation knob check
    if (rotatingRef.current) {
      const tower = state.towerMap.get(rotatingRef.current);
      if (tower) {
        const cx = (tower.x + tower.width / 2) * CELL_SIZE;
        const cy = (tower.y + tower.height / 2) * CELL_SIZE;
        const kd = Math.max(tower.width, tower.height) * CELL_SIZE / 2 + 20;
        const kx = cx + Math.cos(tower.rotation - Math.PI / 2) * kd;
        const ky = cy + Math.sin(tower.rotation - Math.PI / 2) * kd;
        if (Math.hypot(wx - kx, wy - ky) < 14) {
          rotStartAngleRef.current = 0;
          isRotKnobRef.current = true;
          return;
        }
      }
    }

    // Port check
    for (const tower of state.towers) {
      for (const port of tower.ports) {
        const pp = getPortPos(tower, port);
        if (Math.hypot(pp.x - wx, pp.y - wy) >= 7) continue;
        const existIdx = state.wires.findIndex(w => w.startPortId === port.id || w.endPortId === port.id);
        if (existIdx !== -1) {
          state.wires.splice(existIdx, 1);
          if (state.gameMode !== 'custom') state.wireInventory++;
          updatePowerGrid(state);
          sync();
        } else if (state.gameMode !== 'custom' && state.wireInventory <= 0) {
          return;
        }
        dragWireStartRef.current = { towerId: tower.id, portId: port.id };
        return;
      }
    }

    // Tower drag check (core cannot be dragged, but still clickable for selection)
    for (const tower of state.towers) {
      if (wx >= tower.x * CELL_SIZE && wx <= (tower.x + tower.width) * CELL_SIZE &&
          wy >= tower.y * CELL_SIZE && wy <= (tower.y + tower.height) * CELL_SIZE) {
        if (tower.type === 'core') {
          // Core: toggle rotation selection on click, no drag
          updateRotating(rotatingRef.current === tower.id ? null : tower.id);
          return;
        }
        dragTowerRef.current = tower.id;
        dragOrigPosRef.current = { x: tower.x, y: tower.y };
        // Save connected wires for ESC restore
        const connWires = state.wires.filter(w => w.startTowerId === tower.id || w.endTowerId === tower.id);
        dragOrigWiresRef.current = connWires.map(w => ({ ...w, path: w.path.map(p => ({ ...p })) }));
        dragOrigInventoryRef.current = state.wireInventory;
        return;
      }
    }

    // Place tower from inventory
    const gx = (wx / CELL_SIZE) | 0, gy = (wy / CELL_SIZE) | 0;
    const sel = selectedTowerRef.current;
    if (sel && canPlace(gx, gy, sel, state)) {
      const stats = TOWER_STATS[sel];
      if (state.gameMode !== 'custom') state.towerInventory[sel]--;

      let ports: Port[];
      if (sel === 'battery') {
        ports = [
          { id: genId(), direction: 'left', portType: 'input' },
          { id: genId(), direction: 'right', portType: 'output' },
        ];
      } else if (sel === 'generator') {
        ports = generatePorts('output');
      } else if (sel === 'shield') {
        // Shield: single input port in a random direction
        const dirs: PortDirection[] = ['top', 'right', 'bottom', 'left'];
        ports = [{ id: genId(), direction: dirs[(Math.random() * 4) | 0], portType: 'input' }];
      } else if (sel === 'bus') {
        // Bus: 3 input ports on left, 3 output ports on right
        ports = [
          { id: genId(), direction: 'left',  portType: 'input',  sideOffset: 1 / 6 },
          { id: genId(), direction: 'left',  portType: 'input',  sideOffset: 3 / 6 },
          { id: genId(), direction: 'left',  portType: 'input',  sideOffset: 5 / 6 },
          { id: genId(), direction: 'right', portType: 'output', sideOffset: 1 / 6 },
          { id: genId(), direction: 'right', portType: 'output', sideOffset: 3 / 6 },
          { id: genId(), direction: 'right', portType: 'output', sideOffset: 5 / 6 },
        ];
      } else if (sel === 'blaster' || sel === 'gatling' || sel === 'sniper' || sel === 'tesla') {
        ports = generatePorts('input');
      } else {
        ports = []; // target
      }

      const t = {
        id: genId(), type: sel, x: gx, y: gy,
        width: stats.width, height: stats.height,
        hp: stats.hp, maxHp: stats.hp,
        powered: false, storedPower: 0, maxPower: stats.maxPower, incomingPower: 0,
        shieldHp: stats.maxShieldHp, maxShieldHp: stats.maxShieldHp, shieldRadius: stats.shieldRadius,
        lastActionTime: 0, ports, rotation: 0, barrelAngle: 0, heat: 0,
      };
      state.towers.push(t);
      state.towerMap.set(t.id, t);
      updatePowerGrid(state);
      sync();
      if (state.gameMode !== 'custom' && (state.towerInventory[sel] ?? 0) <= 0) setSelectedTower(null);
      return;
    }

    // Left-click on empty space: start pan
    isPanningRef.current = true;
    panLastRef.current = { x: sx, y: sy };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const spos = canvasScreenXY(e);
    if (!spos) return;
    const { sx, sy } = spos;

    // Panning
    if (isPanningRef.current && panLastRef.current) {
      const cam = cameraRef.current;
      cam.x -= (sx - panLastRef.current.x) / cam.zoom;
      cam.y -= (sy - panLastRef.current.y) / cam.zoom;
      clampCamera(cam);
      panLastRef.current = { x: sx, y: sy };
      return;
    }

    const state = stateRef.current;
    if (state.status !== 'playing') return;
    const { wx, wy } = toWorld(sx, sy);
    mousePxRef.current = { x: wx, y: wy };

    if (isRotKnobRef.current && rotatingRef.current) {
      const tower = state.towerMap.get(rotatingRef.current);
      if (tower) {
        const cx = (tower.x + tower.width / 2) * CELL_SIZE;
        const cy = (tower.y + tower.height / 2) * CELL_SIZE;
        tower.rotation = Math.atan2(wy - cy, wx - cx) + Math.PI / 2;
        sync();
      }
      return;
    }

    const gx = (wx / CELL_SIZE) | 0, gy = (wy / CELL_SIZE) | 0;
    hoverRef.current = (gx >= 0 && gx < GRID_WIDTH && gy >= 0 && gy < GRID_HEIGHT)
      ? { x: gx, y: gy } : null;

    if (dragWireStartRef.current) {
      const dw = dragWireStartRef.current;
      const st = state.towerMap.get(dw.towerId);
      const sp = st?.ports.find(p => p.id === dw.portId);
      if (st && sp) {
        const sc = getPortCell(st, sp);
        let endCell = { x: gx, y: gy };
        for (const tower of state.towers) {
          for (const port of tower.ports) {
            const pp = getPortPos(tower, port);
            if (Math.hypot(pp.x - wx, pp.y - wy) < 15 && tower.id !== st.id) {
              endCell = getPortCell(tower, port);
              break;
            }
          }
        }
        dragWirePathRef.current = findWirePath(sc, endCell, state);
      }
    }

    if (dragTowerRef.current) {
      const tower = state.towerMap.get(dragTowerRef.current);
      if (!tower) return;
      const nx = (wx / CELL_SIZE | 0) - (tower.width >> 1);
      const ny = (wy / CELL_SIZE | 0) - (tower.height >> 1);
      if (nx < 0 || ny < 0 || nx + tower.width > GRID_WIDTH || ny + tower.height > GRID_HEIGHT) return;
      if (collidesWithTowers(nx, ny, tower.width, tower.height, state.towers, tower.id)) return;
      if (collidesWithWires(nx, ny, tower.width, tower.height, state.wires, tower.id)) return;
      if (tower.x === nx && tower.y === ny) return;

      tower.x = nx;
      tower.y = ny;
      repathConnectedWires(state, tower.id);
      sync();
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // End pan
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panLastRef.current = null;
      return;
    }

    const spos = canvasScreenXY(e);
    if (!spos) return;
    const { wx, wy } = toWorld(spos.sx, spos.sy);
    const state = stateRef.current;

    if (isRotKnobRef.current) {
      isRotKnobRef.current = false;
      mouseDownPosRef.current = null;
      if (rotatingRef.current) {
        const tower = state.towerMap.get(rotatingRef.current);
        if (tower) {
          if (!applyTowerRotation(tower, snapRotation(tower.rotation), snapRotation(rotStartAngleRef.current), state)) {
            tower.rotation = 0;
          }
          sync();
        }
      }
      return;
    }

    if (dragTowerRef.current) {
      const dp = mouseDownPosRef.current;
      if (dp && Math.hypot(wx - dp.x, wy - dp.y) < 5) {
        updateRotating(rotatingRef.current === dragTowerRef.current ? null : dragTowerRef.current);
      }
      dragTowerRef.current = null;
      dragOrigPosRef.current = null;
      dragOrigWiresRef.current = null;
    } else if (!dragWireStartRef.current) {
      let hit = false;
      for (const t of state.towers) {
        if (wx >= t.x * CELL_SIZE && wx <= (t.x + t.width) * CELL_SIZE &&
            wy >= t.y * CELL_SIZE && wy <= (t.y + t.height) * CELL_SIZE) { hit = true; break; }
      }
      if (!hit) updateRotating(null);
    }

    if (dragWireStartRef.current && mousePxRef.current) {
      const dw = dragWireStartRef.current;
      const mx = mousePxRef.current;
      let dropPort: Port | null = null, dropTowerId: string | null = null;

      for (const tower of state.towers) {
        for (const port of tower.ports) {
          const pp = getPortPos(tower, port);
          if (Math.hypot(pp.x - mx.x, pp.y - mx.y) < 15) {
            dropPort = port; dropTowerId = tower.id; break;
          }
        }
        if (dropPort) break;
      }

      if (dropPort && dropTowerId && dropTowerId !== dw.towerId) {
        const isUsed = state.wires.some(w => w.startPortId === dropPort!.id || w.endPortId === dropPort!.id);
        if (!isUsed) {
          const srcT = state.towerMap.get(dw.towerId);
          const srcP = srcT?.ports.find(p => p.id === dw.portId);
          if (srcT && srcP) {
            let sT = srcT, sP = srcP, dT = state.towerMap.get(dropTowerId)!, dP = dropPort;

            if (srcP.portType === 'input' && dropPort.portType === 'output') {
              [sT, sP, dT, dP] = [dT, dP, sT, sP];
            } else if (srcP.portType === dropPort.portType) {
              dragWireStartRef.current = null;
              dragWirePathRef.current = null;
              return;
            }

            const path = findWirePath(getPortCell(sT, sP), getPortCell(dT, dP), state);
            if (path) {
              if (state.gameMode !== 'custom') state.wireInventory--;
              state.wires.push({
                id: genId(), startTowerId: sT.id, startPortId: sP.id,
                endTowerId: dT.id, endPortId: dP.id, path, hp: WIRE_MAX_HP, maxHp: WIRE_MAX_HP,
              });
              updatePowerGrid(state);
              sync();
            }
          }
        }
      }
      dragWireStartRef.current = null;
      dragWirePathRef.current = null;
    }
  };

  const handleCanvasMouseLeave = () => {
    hoverRef.current = null;
    // Restore tower + wires if dragging
    if (dragTowerRef.current && dragOrigPosRef.current) {
      const state = stateRef.current;
      const tower = state.towerMap.get(dragTowerRef.current);
      if (tower) {
        tower.x = dragOrigPosRef.current.x;
        tower.y = dragOrigPosRef.current.y;
        if (dragOrigWiresRef.current) {
          state.wires = state.wires.filter(w => w.startTowerId !== tower.id && w.endTowerId !== tower.id);
          state.wires.push(...dragOrigWiresRef.current);
          state.wireInventory = dragOrigInventoryRef.current;
          updatePowerGrid(state);
        }
        sync();
      }
    }
    dragWireStartRef.current = null;
    dragTowerRef.current = null;
    dragOrigPosRef.current = null;
    dragOrigWiresRef.current = null;
    dragWirePathRef.current = null;
    isRotKnobRef.current = false;
    isPanningRef.current = false;
    panLastRef.current = null;
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const spos = canvasScreenXY(e as unknown as React.MouseEvent<HTMLCanvasElement>);
    if (!spos) return;
    const { sx, sy } = spos;
    const cam = cameraRef.current;

    // World point under cursor before zoom
    const wx = sx / cam.zoom + cam.x;
    const wy = sy / cam.zoom + cam.y;

    // Adjust zoom
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    cam.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor));

    // Keep world point under cursor after zoom
    cam.x = wx - sx / cam.zoom;
    cam.y = wy - sy / cam.zoom;
    clampCamera(cam);
  };

  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  };

  // ── Game loop ──────────────────────────────────────────────────────────
  const gameLoop = useCallback((time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const dt = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;
    const state = stateRef.current;

    if (state.status === 'playing') {
      const now = Date.now();
      let changed = false;

      // ── Power dispatch (no resource generation) ─────────────────────────
      state.powerTimer += dt;
      if (state.powerTimer >= POWER_INTERVAL) {
        state.powerTimer -= POWER_INTERVAL;
        for (const t of state.towers) {
          if (t.type === 'core' || (t.type === 'generator' && t.powered)) {
            if (!dispatchPulse(state, t) && t.storedPower < t.maxPower) t.storedPower++;
            changed = true;
          }
        }
      }

      // ── Shield recharge ─────────────────────────────────────────────────
      for (const t of state.towers) {
        if (t.maxShieldHp <= 0 || t.shieldHp >= t.maxShieldHp) continue;
        if ((t.type !== 'core' && t.type !== 'shield') || !t.powered) continue;
        if (now - t.lastActionTime <= SHIELD_COOLDOWN) continue;
        if (t.shieldHp <= 0) {
          if (t.storedPower >= 3) { t.storedPower -= 3; t.shieldHp = 150; t.lastActionTime = now; changed = true; }
        } else {
          if (t.storedPower >= 1) { t.storedPower -= 1; t.shieldHp = Math.min(t.maxShieldHp, t.shieldHp + 50); t.lastActionTime = now; changed = true; }
        }
      }

      // ── Battery & Core rapid discharge ────────────────────────────────
      for (const t of state.towers) {
        if (t.type === 'battery') {
          if (!t.powered || t.storedPower <= 0) continue;
          if (now - t.lastActionTime <= BATTERY_INTERVAL) continue;
          if (dispatchPulse(state, t, true)) { t.storedPower--; t.lastActionTime = now; changed = true; }
        } else if (t.type === 'core') {
          if (t.storedPower <= 0) continue;
          if (now - t.lastActionTime <= BATTERY_INTERVAL) continue;
          if (dispatchPulse(state, t)) { t.storedPower--; t.lastActionTime = now; changed = true; }
        }
      }

      // ── Pulse movement ──────────────────────────────────────────────────
      for (let i = state.pulses.length - 1; i >= 0; i--) {
        const p = state.pulses[i];
        p.progress += PULSE_SPEED * dt;
        let rem = p.progress, reached = false;
        for (let j = 0; j < p.path.length - 1; j++) {
          const dx = p.path[j + 1].x - p.path[j].x, dy = p.path[j + 1].y - p.path[j].y;
          const seg = Math.sqrt(dx * dx + dy * dy);
          if (rem <= seg) break;
          rem -= seg;
          if (j === p.path.length - 2) reached = true;
        }
        if (reached) {
          const tgt = state.towerMap.get(p.targetTowerId);
          if (tgt) { tgt.incomingPower = Math.max(0, tgt.incomingPower - 1); tgt.storedPower = Math.min(tgt.maxPower, tgt.storedPower + 1); }
          state.pulses.splice(i, 1);
        }
        changed = true;
      }

      // ── Gatling heat decay ──────────────────────────────────────────
      for (const t of state.towers) {
        if (t.type === 'gatling' && t.heat > 0) {
          t.heat = Math.max(0, t.heat - GATLING_HEAT_DECAY * dt);
          changed = true;
        }
      }

      // ── Turret barrel tracking + shooting (blaster, gatling, sniper) ───
      const BARREL_SPEED = 4; // radians per second for smooth tracking
      const TURRET_TYPES = new Set(['blaster', 'gatling', 'sniper']);
      for (const t of state.towers) {
        if (!TURRET_TYPES.has(t.type)) continue;
        const bx = (t.x + t.width / 2) * CELL_SIZE, by = (t.y + t.height / 2) * CELL_SIZE;
        const range = t.type === 'sniper' ? SNIPER_RANGE : t.type === 'gatling' ? GATLING_RANGE : BLASTER_RANGE;

        // Find nearest target for barrel aiming
        let bestD = range;
        let tgtX = 0, tgtY = 0, hasTarget = false;
        let bestEnemy: typeof state.enemies[0] | null = null;
        let bestTarget: typeof state.towers[0] | null = null;

        for (const e of state.enemies) {
          const d = Math.hypot(e.x - bx, e.y - by);
          if (d < bestD) { bestD = d; tgtX = e.x; tgtY = e.y; hasTarget = true; bestEnemy = e; bestTarget = null; }
        }
        for (const tgt of state.towers) {
          if (tgt.type !== 'target') continue;
          const tx = (tgt.x + tgt.width / 2) * CELL_SIZE, ty = (tgt.y + tgt.height / 2) * CELL_SIZE;
          const d = Math.hypot(tx - bx, ty - by);
          if (d < bestD) { bestD = d; tgtX = tx; tgtY = ty; hasTarget = true; bestTarget = tgt; bestEnemy = null; }
        }

        // Smooth barrel rotation toward target
        if (hasTarget) {
          const desired = Math.atan2(tgtY - by, tgtX - bx);
          let diff = desired - t.barrelAngle;
          while (diff > Math.PI) diff -= TWO_PI;
          while (diff < -Math.PI) diff += TWO_PI;
          const maxRot = BARREL_SPEED * dt;
          t.barrelAngle += Math.abs(diff) < maxRot ? diff : Math.sign(diff) * maxRot;
          changed = true;
        }

        if (!t.powered || !hasTarget) continue;

        const barrelLen = Math.min(t.width, t.height) * CELL_SIZE / 2 - 4 + 6;
        const mx = bx + Math.cos(t.barrelAngle) * barrelLen;
        const my = by + Math.sin(t.barrelAngle) * barrelLen;

        // ── Blaster: 1 bullet per 2 power ──
        if (t.type === 'blaster') {
          if (t.storedPower < BLASTER_POWER_COST || now - t.lastActionTime <= BLASTER_COOLDOWN) continue;
          if (bestEnemy) {
            t.storedPower -= BLASTER_POWER_COST;
            state.projectiles.push({ id: genId(), x: mx, y: my, targetId: bestEnemy.id, speed: 300, damage: BLASTER_DAMAGE });
            t.lastActionTime = now; changed = true;
          } else if (bestTarget) {
            t.storedPower -= BLASTER_POWER_COST;
            state.projectiles.push({ id: genId(), x: mx, y: my, targetId: bestTarget.id, speed: 300, damage: BLASTER_DAMAGE, isTargetTower: true });
            t.lastActionTime = now; changed = true;
          }
        }

        // ── Gatling: heat-based rapid fire, single bullet ──
        if (t.type === 'gatling') {
          const heat = t.heat;
          const interval = GATLING_MAX_INTERVAL - (GATLING_MAX_INTERVAL - GATLING_MIN_INTERVAL) * heat;
          if (t.storedPower < 1 || now - t.lastActionTime <= interval) continue;
          t.storedPower -= 1;
          t.heat = Math.min(1, heat + GATLING_HEAT_PER_SHOT);
          const spread = GATLING_MIN_SPREAD + (GATLING_MAX_SPREAD - GATLING_MIN_SPREAD) * t.heat;
          const spreadAngle = t.barrelAngle + (Math.random() - 0.5) * spread * 2;
          const targetId = bestEnemy?.id ?? bestTarget?.id ?? '';
          state.projectiles.push({
            id: genId(), x: mx, y: my, targetId,
            speed: 280, damage: GATLING_DAMAGE,
            isTargetTower: !!bestTarget && !bestEnemy,
            angle: spreadAngle, traveled: 0, maxRange: GATLING_BULLET_RANGE,
            color: '#f59e0b', size: 2,
          });
          t.lastActionTime = now; changed = true;
        }

        // ── Sniper: straight-line piercing shot, long CD ──
        if (t.type === 'sniper') {
          if (t.storedPower < SNIPER_POWER_COST || now - t.lastActionTime <= SNIPER_COOLDOWN) continue;
          t.storedPower -= SNIPER_POWER_COST;
          const fireAngle = t.barrelAngle;
          state.projectiles.push({
            id: genId(), x: mx, y: my, targetId: bestEnemy?.id ?? bestTarget?.id ?? '',
            speed: SNIPER_SPEED, damage: SNIPER_DAMAGE,
            angle: fireAngle, traveled: 0, maxRange: SNIPER_MAX_RANGE,
            piercing: true, piercedIds: [],
            color: '#a78bfa', size: 4,
          });
          t.lastActionTime = now; changed = true;
        }
      }

      // ── Tesla: chain lightning ───────────────────────────────────────
      for (const t of state.towers) {
        if (t.type !== 'tesla' || !t.powered || t.storedPower <= 0) continue;
        if (now - t.lastActionTime <= TESLA_COOLDOWN) continue;
        const bx = (t.x + t.width / 2) * CELL_SIZE, by = (t.y + t.height / 2) * CELL_SIZE;

        // Find first enemy in range
        let firstEnemy: typeof state.enemies[0] | null = null;
        let firstD = TESLA_RANGE;
        for (const e of state.enemies) {
          const d = Math.hypot(e.x - bx, e.y - by);
          if (d < firstD) { firstD = d; firstEnemy = e; }
        }
        if (!firstEnemy) continue;

        const power = t.storedPower;
        t.storedPower = 0;
        const totalDmg = power * TESLA_DAMAGE_PER_POWER;
        const bounces = power;

        // Chain lightning: hit first, then bounce
        const clSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];
        const hitIds = new Set<string>();
        let cx = bx, cy = by;
        let curEnemy: typeof state.enemies[0] | null = firstEnemy;

        for (let b = 0; b < bounces && curEnemy; b++) {
          clSegments.push({ x1: cx, y1: cy, x2: curEnemy.x, y2: curEnemy.y });
          let dmg = totalDmg / bounces;
          if (curEnemy.shieldAbsorb > 0) {
            const absorbed = Math.min(curEnemy.shieldAbsorb, dmg);
            curEnemy.shieldAbsorb -= absorbed;
            dmg -= absorbed;
          }
          curEnemy.hp -= dmg;
          if (curEnemy.hp <= 0) {
            createExplosion(state, curEnemy.x, curEnemy.y, curEnemy.color, 12);
            state.score += (ENEMY_SCORE[curEnemy.enemyType] ?? 10);
            state.enemies = state.enemies.filter(e => e.id !== curEnemy!.id);
          }
          hitIds.add(curEnemy.id);
          cx = curEnemy.x; cy = curEnemy.y;

          // Find next bounce target
          let nextEnemy: typeof state.enemies[0] | null = null;
          let nextD = TESLA_BOUNCE_RANGE;
          for (const e of state.enemies) {
            if (hitIds.has(e.id)) continue;
            const d = Math.hypot(e.x - cx, e.y - cy);
            if (d < nextD) { nextD = d; nextEnemy = e; }
          }
          curEnemy = nextEnemy;
        }

        if (clSegments.length > 0) {
          state.chainLightnings.push({ segments: clSegments, life: 0, maxLife: 0.4 });
        }
        t.lastActionTime = now; changed = true;
      }

      // ── Wave management with roguelike pick (skipped in custom mode) ────
      if (state.gameMode !== 'custom') {
        if (state.enemies.length === 0 && state.enemiesToSpawn === 0) {
          if (state.needsPick) {
            // Wave cleared — enter pick phase
            if (state.wave > 0) state.score += state.wave * 20; // wave clear bonus
            state.pickOptions = generatePickOptions();
            state.status = 'pick';
            changed = true;
          } else {
            // Countdown to next wave
            state.waveTimer += dt;
            if (state.waveTimer > WAVE_DELAY) {
              state.wave++;
              state.enemiesToSpawn = Math.floor(2 + state.wave * 0.8 + Math.sqrt(state.wave) * 0.5);
              state.waveTimer = 0;
              state.needsPick = true; // will trigger pick after this wave clears
              // Spawn boss every 5 waves
              if (state.wave % 5 === 0) spawnBoss(state, state.wave);
              changed = true;
            }
          }
        }
        if (state.enemiesToSpawn > 0) {
          state.spawnTimer += dt;
          if (state.spawnTimer > 1) {
            spawnEnemy(state, state.wave);
            state.enemiesToSpawn--;
            state.spawnTimer = 0;
            changed = true;
          }
        }
      }

      // ── Enemy AI ────────────────────────────────────────────────────────
      for (const enemy of state.enemies) {
        let minD = Infinity, tgtPos = { x: 0, y: 0 }, isShield = false;
        let tgtTower: typeof state.towers[0] | null = null;
        let tgtWire: typeof state.wires[0] | null = null;

        // Saboteurs prioritize wires — check wires first with a distance bonus
        const isSaboteur = enemy.enemyType === 'saboteur';

        for (const t of state.towers) {
          if (t.type !== 'core' && !t.powered) continue;
          const tx = Math.max(t.x * CELL_SIZE, Math.min(enemy.x, (t.x + t.width) * CELL_SIZE));
          const ty = Math.max(t.y * CELL_SIZE, Math.min(enemy.y, (t.y + t.height) * CELL_SIZE));
          const d = Math.hypot(tx - enemy.x, ty - enemy.y);
          // Saboteurs deprioritize towers (1.5x effective distance)
          const ed = isSaboteur ? d * 1.5 : d;
          if (ed < minD) { minD = ed; tgtTower = t; tgtWire = null; isShield = false; tgtPos = { x: tx, y: ty }; }
          if (t.shieldHp > 0 && t.shieldRadius > 0) {
            const scx = (t.x + t.width / 2) * CELL_SIZE, scy = (t.y + t.height / 2) * CELL_SIZE;
            const sd = Math.max(0, Math.hypot(scx - enemy.x, scy - enemy.y) - t.shieldRadius);
            const esd = isSaboteur ? sd * 1.5 : sd;
            if (esd < minD) {
              minD = esd; tgtTower = t; tgtWire = null; isShield = true;
              const a = Math.atan2(enemy.y - scy, enemy.x - scx);
              tgtPos = { x: scx + Math.cos(a) * t.shieldRadius, y: scy + Math.sin(a) * t.shieldRadius };
            }
          }
        }
        for (const w of state.wires) {
          for (const p of w.path) {
            const wx = p.x * CELL_SIZE + CELL_SIZE / 2, wy = p.y * CELL_SIZE + CELL_SIZE / 2;
            const d = Math.hypot(wx - enemy.x, wy - enemy.y);
            // Saboteurs get a distance bonus toward wires (0.6x effective distance)
            const ed = isSaboteur ? d * 0.6 : d;
            if (ed < minD) { minD = ed; tgtTower = null; tgtWire = w; isShield = false; tgtPos = { x: wx, y: wy }; }
          }
        }

        if (!tgtTower && !tgtWire) continue;
        // Use actual distance for movement/attack range (not weighted)
        const actualDist = Math.hypot(tgtPos.x - enemy.x, tgtPos.y - enemy.y);
        if (actualDist > ATTACK_RANGE) {
          const a = Math.atan2(tgtPos.y - enemy.y, tgtPos.x - enemy.x);
          enemy.x += Math.cos(a) * enemy.speed * dt;
          enemy.y += Math.sin(a) * enemy.speed * dt;
          enemy.heading = a;
          changed = true;
        } else if (now - enemy.lastAttackTime > enemy.attackCooldown) {
          if (tgtWire) {
            tgtWire.hp -= enemy.damage * enemy.wireDamageMul;
            // Hit VFX on wire
            state.hitEffects.push({ x: tgtPos.x, y: tgtPos.y, life: 0, maxLife: 0.3, color: '#ef4444', radius: 12 });
            createExplosion(state, tgtPos.x, tgtPos.y, '#ef4444', 3);
            if (tgtWire.hp <= 0) { state.wires = state.wires.filter(w => w.id !== tgtWire!.id); updatePowerGrid(state); }
          } else if (tgtTower) {
            if (isShield) {
              const prevHp = tgtTower.shieldHp;
              tgtTower.shieldHp = Math.max(0, tgtTower.shieldHp - enemy.damage);
              // Hit VFX on shield
              state.hitEffects.push({ x: tgtPos.x, y: tgtPos.y, life: 0, maxLife: 0.35, color: '#22d3ee', radius: 18 });
              createExplosion(state, tgtPos.x, tgtPos.y, '#22d3ee', 4);
              // Shield break effect
              if (prevHp > 0 && tgtTower.shieldHp <= 0) {
                const scx = (tgtTower.x + tgtTower.width / 2) * CELL_SIZE;
                const scy = (tgtTower.y + tgtTower.height / 2) * CELL_SIZE;
                const frags: ShieldBreakEffect['fragments'] = [];
                for (let f = 0; f < 16; f++) {
                  frags.push({ angle: (f / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.2, dist: 0, size: 3 + Math.random() * 4, speed: 60 + Math.random() * 80 });
                }
                state.shieldBreakEffects.push({ x: scx, y: scy, radius: tgtTower.shieldRadius, life: 0, maxLife: 0.6, fragments: frags });
                createExplosion(state, scx, scy, '#22d3ee', 20);
              }
            } else {
              tgtTower.hp -= enemy.damage;
              // Hit VFX on tower
              state.hitEffects.push({ x: tgtPos.x, y: tgtPos.y, life: 0, maxLife: 0.3, color: '#ef4444', radius: 14 });
              createExplosion(state, tgtPos.x, tgtPos.y, '#f87171', 4);
              if (tgtTower.hp <= 0) {
                if (tgtTower.type === 'core') state.status = 'gameover';
                state.towers = state.towers.filter(t => t.id !== tgtTower!.id);
                state.wires = state.wires.filter(w => w.startTowerId !== tgtTower!.id && w.endTowerId !== tgtTower!.id);
                rebuildTowerMap(state);
                updatePowerGrid(state);
              }
            }
          }
          enemy.lastAttackTime = now;
          changed = true;
        }
      }

      // ── Projectile movement ─────────────────────────────────────────────
      for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const p = state.projectiles[i];

        // Non-homing projectiles (gatling, sniper line-shot)
        if (p.angle !== undefined) {
          const step = p.speed * dt;
          p.x += Math.cos(p.angle) * step;
          p.y += Math.sin(p.angle) * step;
          p.traveled = (p.traveled ?? 0) + step;
          if (p.maxRange && p.traveled > p.maxRange) { state.projectiles.splice(i, 1); changed = true; continue; }

          // Check collision with all enemies
          let hit = false;
          for (const e of state.enemies) {
            if (p.piercedIds?.includes(e.id)) continue;
            if (Math.hypot(e.x - p.x, e.y - p.y) < e.radius + 4) {
              // Apply damage through shield absorb first
              let dmg = p.damage;
              if (e.shieldAbsorb > 0) {
                const absorbed = Math.min(e.shieldAbsorb, dmg);
                e.shieldAbsorb -= absorbed;
                dmg -= absorbed;
              }
              e.hp -= dmg;
              createExplosion(state, e.x, e.y, p.color ?? '#fbbf24', 3);
              if (e.hp <= 0) { state.enemies = state.enemies.filter(en => en.id !== e.id); state.score += (ENEMY_SCORE[e.enemyType] ?? 10); createExplosion(state, e.x, e.y, e.color, 10); }
              if (!p.piercing) { state.projectiles.splice(i, 1); hit = true; }
              else { p.piercedIds = p.piercedIds ?? []; p.piercedIds.push(e.id); }
              changed = true;
              break;
            }
          }
          if (hit) continue;
          changed = true;
          continue;
        }

        // Homing projectiles (blaster, sniper)
        let tgtX: number, tgtY: number;
        let tgtFound = false;

        if (p.isTargetTower) {
          const tgt = state.towerMap.get(p.targetId);
          if (!tgt || tgt.type !== 'target') { state.projectiles.splice(i, 1); changed = true; continue; }
          tgtX = (tgt.x + tgt.width / 2) * CELL_SIZE;
          tgtY = (tgt.y + tgt.height / 2) * CELL_SIZE;
          tgtFound = true;
          const d = Math.hypot(tgtX - p.x, tgtY - p.y);
          if (d < 10) {
            tgt.hp -= p.damage;
            createExplosion(state, tgtX, tgtY, p.color ?? '#fbbf24', 5);
            if (p.piercing) {
              p.piercedIds = p.piercedIds ?? []; p.piercedIds.push(p.targetId);
              // Find next target tower (unlikely but handle it)
              state.projectiles.splice(i, 1);
            } else {
              state.projectiles.splice(i, 1);
            }
            if (tgt.hp <= 0) {
              state.towers = state.towers.filter(t => t.id !== tgt.id);
              state.wires = state.wires.filter(w => w.startTowerId !== tgt.id && w.endTowerId !== tgt.id);
              rebuildTowerMap(state);
              createExplosion(state, tgtX, tgtY, '#f97316', 15);
            }
            changed = true;
            continue;
          }
        } else {
          const tgt = state.enemies.find(e => e.id === p.targetId);
          if (!tgt) {
            // For piercing, find next enemy instead of removing
            if (p.piercing) {
              let bestD = 300, bestE: typeof state.enemies[0] | null = null;
              for (const e of state.enemies) {
                if (p.piercedIds?.includes(e.id)) continue;
                const d = Math.hypot(e.x - p.x, e.y - p.y);
                if (d < bestD) { bestD = d; bestE = e; }
              }
              if (bestE) { p.targetId = bestE.id; } else { state.projectiles.splice(i, 1); changed = true; continue; }
              const et = state.enemies.find(e => e.id === p.targetId)!;
              tgtX = et.x; tgtY = et.y; tgtFound = true;
            } else {
              state.projectiles.splice(i, 1); changed = true; continue;
            }
          } else {
            tgtX = tgt.x;
            tgtY = tgt.y;
            tgtFound = true;
            const d = Math.hypot(tgtX - p.x, tgtY - p.y);
            if (d < tgt.radius + 4) {
              // Apply damage through shield absorb first
              let dmg = p.damage;
              if (tgt.shieldAbsorb > 0) {
                const absorbed = Math.min(tgt.shieldAbsorb, dmg);
                tgt.shieldAbsorb -= absorbed;
                dmg -= absorbed;
              }
              tgt.hp -= dmg;
              createExplosion(state, tgt.x, tgt.y, p.color ?? '#fbbf24', 5);
              if (tgt.hp <= 0) {
                state.enemies = state.enemies.filter(e => e.id !== tgt.id);
                state.score += (ENEMY_SCORE[tgt.enemyType] ?? 10);
                createExplosion(state, tgt.x, tgt.y, tgt.color, 15);
              }
              if (p.piercing) {
                p.piercedIds = p.piercedIds ?? []; p.piercedIds.push(tgt.id);
                // Re-target next enemy
                let bestD = 300, bestE: typeof state.enemies[0] | null = null;
                for (const e of state.enemies) {
                  if (p.piercedIds.includes(e.id)) continue;
                  const d2 = Math.hypot(e.x - p.x, e.y - p.y);
                  if (d2 < bestD) { bestD = d2; bestE = e; }
                }
                if (bestE) { p.targetId = bestE.id; } else { state.projectiles.splice(i, 1); changed = true; continue; }
              } else {
                state.projectiles.splice(i, 1);
              }
              changed = true;
              continue;
            }
          }
        }

        if (tgtFound) {
          const a = Math.atan2(tgtY! - p.y, tgtX! - p.x);
          p.x += Math.cos(a) * p.speed * dt;
          p.y += Math.sin(a) * p.speed * dt;
          changed = true;
        }
      }

      // ── Chain lightning update ─────────────────────────────────────────
      for (let i = state.chainLightnings.length - 1; i >= 0; i--) {
        state.chainLightnings[i].life += dt;
        if (state.chainLightnings[i].life >= state.chainLightnings[i].maxLife) {
          state.chainLightnings.splice(i, 1);
        }
        changed = true;
      }

      // ── Particles ───────────────────────────────────────────────────────
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) { state.particles.splice(i, 1); }
        else { p.x += p.vx * dt; p.y += p.vy * dt; }
        changed = true;
      }

      // ── Hit effects ──────────────────────────────────────────────────────
      for (let i = state.hitEffects.length - 1; i >= 0; i--) {
        state.hitEffects[i].life += dt;
        if (state.hitEffects[i].life >= state.hitEffects[i].maxLife) state.hitEffects.splice(i, 1);
        changed = true;
      }

      // ── Shield break effects ─────────────────────────────────────────────
      for (let i = state.shieldBreakEffects.length - 1; i >= 0; i--) {
        const sb = state.shieldBreakEffects[i];
        sb.life += dt;
        for (const f of sb.fragments) f.dist += f.speed * dt;
        if (sb.life >= sb.maxLife) state.shieldBreakEffects.splice(i, 1);
        changed = true;
      }

      if (changed) sync();
    }

    // ── Render ────────────────────────────────────────────────────────────
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      const hover = hoverRef.current;
      const sel = selectedTowerRef.current;
      renderGame(
        ctx, state, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, cameraRef.current,
        hover, sel,
        hover && sel ? canPlace(hover.x, hover.y, sel, state) : false,
        dragWireStartRef.current,
        mousePxRef.current,
        dragWirePathRef.current,
        rotatingRef.current,
      );
    }

    requestAnimationFrame(gameLoop);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(id);
  }, [gameLoop]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (state.status !== 'playing') return;

      if (e.key === 'Escape') {
        // Cancel tower drag — restore original position and wires
        if (dragTowerRef.current && dragOrigPosRef.current) {
          const tower = state.towerMap.get(dragTowerRef.current);
          if (tower) {
            tower.x = dragOrigPosRef.current.x;
            tower.y = dragOrigPosRef.current.y;
            // Restore saved wires
            if (dragOrigWiresRef.current) {
              state.wires = state.wires.filter(w => w.startTowerId !== tower.id && w.endTowerId !== tower.id);
              state.wires.push(...dragOrigWiresRef.current);
              state.wireInventory = dragOrigInventoryRef.current;
              updatePowerGrid(state);
            }
          }
          dragTowerRef.current = null;
          dragOrigPosRef.current = null;
          dragOrigWiresRef.current = null;
          sync();
          return;
        }
        // Cancel wire drag
        if (dragWireStartRef.current) {
          dragWireStartRef.current = null;
          dragWirePathRef.current = null;
          return;
        }
        // Cancel rotation knob
        if (isRotKnobRef.current) {
          isRotKnobRef.current = false;
          if (rotatingRef.current) {
            const tower = state.towerMap.get(rotatingRef.current);
            if (tower) tower.rotation = 0;
          }
          sync();
          return;
        }
        // Deselect tower placement
        if (selectedTowerRef.current) {
          setSelectedTower(null);
          return;
        }
        // Deselect rotating tower
        if (rotatingRef.current) {
          updateRotating(null);
          return;
        }
      }

      if (e.key === 'q' || e.key === 'Q') {
        // Quick rotate the currently selected (rotating) tower 90° right
        if (rotatingRef.current) {
          const tower = state.towerMap.get(rotatingRef.current);
          if (tower) {
            const newAngle = snapRotation(tower.rotation) + Math.PI / 2;
            if (!applyTowerRotation(tower, snapRotation(newAngle), snapRotation(tower.rotation), state)) {
              // Rotation failed (collision), do nothing
            }
            sync();
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return {
    canvasRef, gameState, startGame, startCustomGame, togglePause, handlePick,
    selectedTower, setSelectedTower,
    handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasMouseLeave,
    handleCanvasWheel, handleCanvasContextMenu,
  };
};

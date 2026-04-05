import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameState, TowerType, Port, CELL_SIZE, GRID_WIDTH, GRID_HEIGHT,
  TOWER_STATS, CANVAS_WIDTH, CANVAS_HEIGHT, WIRE_MAX_HP,
} from './types';
import {
  createInitialState, updatePowerGrid, spawnEnemy, createExplosion,
  getPortPos, generatePorts, getPortCell, findWirePath, dispatchPulse,
  snapRotation, applyTowerRotation, canPlace, collidesWithTowers,
  collidesWithWires, repathConnectedWires, genId, rebuildTowerMap,
  generatePickOptions,
} from './engine';
import { renderGame } from './renderer';

// ── Constants ────────────────────────────────────────────────────────────────
const PULSE_SPEED = 400;
const POWER_INTERVAL = 2;
const SHIELD_COOLDOWN = 500;
const BATTERY_INTERVAL = 100;
const BLASTER_COOLDOWN = 1000;
const BLASTER_RANGE = 150;
const BLASTER_DAMAGE = 50; // doubled from original 25
const WAVE_DELAY = 5;
const ATTACK_RANGE = 10;

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

  const sync = () => setGameState({ ...stateRef.current });

  const [rotatingTowerId, setRotatingTowerId] = useState<string | null>(null);
  const updateRotating = (id: string | null) => { rotatingRef.current = id; setRotatingTowerId(id); };

  // ── Actions ─────────────────────────────────────────────────────────────
  const startGame = () => {
    const s = createInitialState();
    s.status = 'pick';
    s.pickOptions = generatePickOptions();
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
  const canvasXY = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return r ? { px: e.clientX - r.left, py: e.clientY - r.top } : null;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = canvasXY(e);
    if (!pos) return;
    const { px, py } = pos;
    const state = stateRef.current;
    if (state.status !== 'playing') return;
    mouseDownPosRef.current = { x: px, y: py };

    // Rotation knob check
    if (rotatingRef.current) {
      const tower = state.towerMap.get(rotatingRef.current);
      if (tower) {
        const cx = (tower.x + tower.width / 2) * CELL_SIZE;
        const cy = (tower.y + tower.height / 2) * CELL_SIZE;
        const kd = Math.max(tower.width, tower.height) * CELL_SIZE / 2 + 20;
        const kx = cx + Math.cos(tower.rotation - Math.PI / 2) * kd;
        const ky = cy + Math.sin(tower.rotation - Math.PI / 2) * kd;
        if (Math.hypot(px - kx, py - ky) < 14) {
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
        if (Math.hypot(pp.x - px, pp.y - py) >= 7) continue;
        const existIdx = state.wires.findIndex(w => w.startPortId === port.id || w.endPortId === port.id);
        if (existIdx !== -1) {
          state.wires.splice(existIdx, 1);
          state.wireInventory++;
          updatePowerGrid(state);
          sync();
        } else if (state.wireInventory <= 0) {
          return;
        }
        dragWireStartRef.current = { towerId: tower.id, portId: port.id };
        return;
      }
    }

    // Tower drag check
    for (const tower of state.towers) {
      if (px >= tower.x * CELL_SIZE && px <= (tower.x + tower.width) * CELL_SIZE &&
          py >= tower.y * CELL_SIZE && py <= (tower.y + tower.height) * CELL_SIZE) {
        dragTowerRef.current = tower.id;
        return;
      }
    }

    // Place tower from inventory
    const gx = (px / CELL_SIZE) | 0, gy = (py / CELL_SIZE) | 0;
    const sel = selectedTowerRef.current;
    if (sel && canPlace(gx, gy, sel, state)) {
      const stats = TOWER_STATS[sel];
      state.towerInventory[sel]--;

      let ports: Port[];
      if (sel === 'battery') {
        ports = [
          { id: genId(), direction: 'left', portType: 'input' },
          { id: genId(), direction: 'right', portType: 'output' },
        ];
      } else if (sel === 'generator') {
        ports = generatePorts('output');
      } else if (sel === 'blaster' || sel === 'shield') {
        ports = generatePorts('input');
      } else {
        ports = []; // wall
      }

      const t = {
        id: genId(), type: sel, x: gx, y: gy,
        width: stats.width, height: stats.height,
        hp: stats.hp, maxHp: stats.hp,
        powered: false, storedPower: 0, maxPower: stats.maxPower, incomingPower: 0,
        shieldHp: stats.maxShieldHp, maxShieldHp: stats.maxShieldHp, shieldRadius: stats.shieldRadius,
        lastActionTime: 0, ports, rotation: 0,
      };
      state.towers.push(t);
      state.towerMap.set(t.id, t);
      updatePowerGrid(state);
      sync();
      if ((state.towerInventory[sel] ?? 0) <= 0) setSelectedTower(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = canvasXY(e);
    if (!pos) return;
    const { px, py } = pos;
    const state = stateRef.current;
    if (state.status !== 'playing') return;
    mousePxRef.current = { x: px, y: py };

    if (isRotKnobRef.current && rotatingRef.current) {
      const tower = state.towerMap.get(rotatingRef.current);
      if (tower) {
        const cx = (tower.x + tower.width / 2) * CELL_SIZE;
        const cy = (tower.y + tower.height / 2) * CELL_SIZE;
        tower.rotation = Math.atan2(py - cy, px - cx) + Math.PI / 2;
        sync();
      }
      return;
    }

    const gx = (px / CELL_SIZE) | 0, gy = (py / CELL_SIZE) | 0;
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
            if (Math.hypot(pp.x - px, pp.y - py) < 15 && tower.id !== st.id) {
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
      const nx = (px / CELL_SIZE | 0) - (tower.width >> 1);
      const ny = (py / CELL_SIZE | 0) - (tower.height >> 1);
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
    const pos = canvasXY(e);
    const px = pos?.px ?? 0, py = pos?.py ?? 0;
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
      if (dp && Math.hypot(px - dp.x, py - dp.y) < 5) {
        updateRotating(rotatingRef.current === dragTowerRef.current ? null : dragTowerRef.current);
      }
      dragTowerRef.current = null;
    } else if (!dragWireStartRef.current) {
      let hit = false;
      for (const t of state.towers) {
        if (px >= t.x * CELL_SIZE && px <= (t.x + t.width) * CELL_SIZE &&
            py >= t.y * CELL_SIZE && py <= (t.y + t.height) * CELL_SIZE) { hit = true; break; }
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
              state.wireInventory--;
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
    dragWireStartRef.current = null;
    dragTowerRef.current = null;
    dragWirePathRef.current = null;
    isRotKnobRef.current = false;
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

      // ── Battery discharge ───────────────────────────────────────────────
      for (const t of state.towers) {
        if (t.type !== 'battery' || !t.powered || t.storedPower <= 0) continue;
        if (now - t.lastActionTime <= BATTERY_INTERVAL) continue;
        if (dispatchPulse(state, t, true)) { t.storedPower--; t.lastActionTime = now; changed = true; }
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

      // ── Blaster shooting (damage = 50) ──────────────────────────────────
      for (const t of state.towers) {
        if (t.type !== 'blaster' || !t.powered || t.storedPower < 4 || now - t.lastActionTime <= BLASTER_COOLDOWN) continue;
        const bx = (t.x + t.width / 2) * CELL_SIZE, by = (t.y + t.height / 2) * CELL_SIZE;
        let best: typeof state.enemies[0] | null = null, bestD = BLASTER_RANGE;
        for (const e of state.enemies) {
          const d = Math.hypot(e.x - bx, e.y - by);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (best) {
          t.storedPower -= 4;
          state.projectiles.push({ id: genId(), x: bx, y: by, targetId: best.id, speed: 300, damage: BLASTER_DAMAGE });
          t.lastActionTime = now;
          changed = true;
        }
      }

      // ── Wave management with roguelike pick ─────────────────────────────
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
            state.enemiesToSpawn = 2 + state.wave;
            state.waveTimer = 0;
            state.needsPick = true; // will trigger pick after this wave clears
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

      // ── Enemy AI ────────────────────────────────────────────────────────
      for (const enemy of state.enemies) {
        let minD = Infinity, tgtPos = { x: 0, y: 0 }, isShield = false;
        let tgtTower: typeof state.towers[0] | null = null;
        let tgtWire: typeof state.wires[0] | null = null;

        for (const t of state.towers) {
          if (t.type !== 'core' && !t.powered) continue;
          const tx = Math.max(t.x * CELL_SIZE, Math.min(enemy.x, (t.x + t.width) * CELL_SIZE));
          const ty = Math.max(t.y * CELL_SIZE, Math.min(enemy.y, (t.y + t.height) * CELL_SIZE));
          const d = Math.hypot(tx - enemy.x, ty - enemy.y);
          if (d < minD) { minD = d; tgtTower = t; tgtWire = null; isShield = false; tgtPos = { x: tx, y: ty }; }
          if (t.shieldHp > 0 && t.shieldRadius > 0) {
            const scx = (t.x + t.width / 2) * CELL_SIZE, scy = (t.y + t.height / 2) * CELL_SIZE;
            const sd = Math.max(0, Math.hypot(scx - enemy.x, scy - enemy.y) - t.shieldRadius);
            if (sd < minD) {
              minD = sd; tgtTower = t; tgtWire = null; isShield = true;
              const a = Math.atan2(enemy.y - scy, enemy.x - scx);
              tgtPos = { x: scx + Math.cos(a) * t.shieldRadius, y: scy + Math.sin(a) * t.shieldRadius };
            }
          }
        }
        for (const w of state.wires) {
          for (const p of w.path) {
            const wx = p.x * CELL_SIZE + CELL_SIZE / 2, wy = p.y * CELL_SIZE + CELL_SIZE / 2;
            const d = Math.hypot(wx - enemy.x, wy - enemy.y);
            if (d < minD) { minD = d; tgtTower = null; tgtWire = w; isShield = false; tgtPos = { x: wx, y: wy }; }
          }
        }

        if (!tgtTower && !tgtWire) continue;
        if (minD > ATTACK_RANGE) {
          const a = Math.atan2(tgtPos.y - enemy.y, tgtPos.x - enemy.x);
          enemy.x += Math.cos(a) * enemy.speed * dt;
          enemy.y += Math.sin(a) * enemy.speed * dt;
          changed = true;
        } else if (now - enemy.lastAttackTime > enemy.attackCooldown) {
          if (tgtWire) {
            tgtWire.hp -= enemy.damage;
            if (tgtWire.hp <= 0) { state.wires = state.wires.filter(w => w.id !== tgtWire!.id); updatePowerGrid(state); }
          } else if (tgtTower) {
            if (isShield) {
              tgtTower.shieldHp = Math.max(0, tgtTower.shieldHp - enemy.damage);
            } else {
              tgtTower.hp -= enemy.damage;
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
        const tgt = state.enemies.find(e => e.id === p.targetId);
        if (!tgt) { state.projectiles.splice(i, 1); changed = true; continue; }
        const d = Math.hypot(tgt.x - p.x, tgt.y - p.y);
        if (d < 10) {
          tgt.hp -= p.damage;
          createExplosion(state, tgt.x, tgt.y, '#fbbf24', 5);
          state.projectiles.splice(i, 1);
          if (tgt.hp <= 0) {
            state.enemies = state.enemies.filter(e => e.id !== tgt.id);
            state.score += 10;
            createExplosion(state, tgt.x, tgt.y, '#a855f7', 15);
          }
          changed = true;
        } else {
          const a = Math.atan2(tgt.y - p.y, tgt.x - p.x);
          p.x += Math.cos(a) * p.speed * dt;
          p.y += Math.sin(a) * p.speed * dt;
          changed = true;
        }
      }

      // ── Particles ───────────────────────────────────────────────────────
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) { state.particles.splice(i, 1); }
        else { p.x += p.vx * dt; p.y += p.vy * dt; }
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
        ctx, state, CANVAS_WIDTH, CANVAS_HEIGHT,
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

  return {
    canvasRef, gameState, startGame, togglePause, handlePick,
    selectedTower, setSelectedTower,
    handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasMouseLeave,
  };
};

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameState, TowerType, Port, Wire, CELL_SIZE, GRID_WIDTH, GRID_HEIGHT,
  TOWER_STATS, CANVAS_WIDTH, CANVAS_HEIGHT, WIRE_MAX_HP,
  Camera, VIEWPORT_WIDTH, VIEWPORT_HEIGHT,
} from './types';
import {
  createInitialState, updatePowerGrid, getPortPos, getPortCell, findWirePath,
  snapRotation, applyTowerRotation, canPlace, collidesWithTowers,
  collidesWithWires, repathConnectedWires, genId, generatePickOptions,
} from './engine';
import { renderGame } from './renderer';
import { GLOBAL_CONFIG } from './config';
import { t } from './i18n';
import { addTowerToState, createTowerAt } from './towerFactory';
import { findAutoPlacementNearCore } from './placement';
import { updateGameState } from './updateGameState';

const { maxZoom: MAX_ZOOM, waveDelay: WAVE_DELAY } = GLOBAL_CONFIG;

export const useGameLoop = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const [gameState, setGameState] = useState<GameState>(stateRef.current);
  const viewportRef = useRef<{ width: number; height: number }>({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  });

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
  const INITIAL_MIN_ZOOM = Math.max(VIEWPORT_WIDTH / CANVAS_WIDTH, VIEWPORT_HEIGHT / CANVAS_HEIGHT);
  const initialViewW = VIEWPORT_WIDTH / INITIAL_MIN_ZOOM;
  const initialViewH = VIEWPORT_HEIGHT / INITIAL_MIN_ZOOM;
  const cameraRef = useRef<Camera>({
    x: Math.max(0, (CANVAS_WIDTH - initialViewW) / 2),
    y: Math.max(0, (CANVAS_HEIGHT - initialViewH) / 2),
    zoom: INITIAL_MIN_ZOOM,
  });

  // Pan state
  const isPanningRef = useRef(false);
  const panLastRef = useRef<{ x: number; y: number } | null>(null);

  // Drag cancel state
  const dragOrigPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragOrigWiresRef = useRef<Wire[] | null>(null);
  const dragOrigInventoryRef = useRef<number>(0);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string, durationMs = 2000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), durationMs);
  };

  const sync = () => setGameState({ ...stateRef.current });

  const getMinZoom = () => {
    const vp = viewportRef.current;
    // Keep viewport fully inside world bounds on both axes.
    return Math.max(vp.width / CANVAS_WIDTH, vp.height / CANVAS_HEIGHT);
  };

  const cancelTowerDrag = () => {
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
    dragTowerRef.current = null;
    dragOrigPosRef.current = null;
    dragOrigWiresRef.current = null;
  };

  const [rotatingTowerId, setRotatingTowerId] = useState<string | null>(null);
  const updateRotating = (id: string | null) => { rotatingRef.current = id; setRotatingTowerId(id); };

  // ── Actions ─────────────────────────────────────────────────────────────

  /** Center camera on the core tower using the actual viewport size */
  const centerOnCore = (state: GameState) => {
    const core = state.towers.find(tw => tw.type === 'core');
    if (!core) return;
    const vp = viewportRef.current;
    const cam = cameraRef.current;
    // Core center in world pixels
    const cx = (core.x + core.width / 2) * CELL_SIZE;
    const cy = (core.y + core.height / 2) * CELL_SIZE;
    // Recalculate zoom from actual viewport
    const minZoom = getMinZoom();
    cam.zoom = Math.max(minZoom, Math.min(MAX_ZOOM, 1.0));
    // Position camera so core is centered
    cam.x = cx - (vp.width / cam.zoom) / 2;
    cam.y = cy - (vp.height / cam.zoom) / 2;
    clampCamera(cam);
  };

  const queueTowerDropNearCore = (
    state: GameState,
    type: TowerType,
    sourceClientPos?: { x: number; y: number },
  ) => {
    const placement = findAutoPlacementNearCore(state, type);
    if (!placement) return false;

    const stats = TOWER_STATS[type];
    const sourceWorld = sourceClientPos ? clientToWorld(sourceClientPos.x, sourceClientPos.y) : null;
    state.incomingDrops.push({
      id: genId(),
      towerType: type,
      startX: sourceWorld?.wx ?? (placement.x + stats.width / 2) * CELL_SIZE,
      startY: sourceWorld?.wy ?? -CELL_SIZE * 4,
      targetGridX: placement.x,
      targetGridY: placement.y,
      targetX: (placement.x + stats.width / 2) * CELL_SIZE,
      targetY: (placement.y + stats.height / 2) * CELL_SIZE,
      life: 0,
      duration: 0.55,
    });
    return true;
  };

  const deployStartingLoadout = (state: GameState) => {
    const starterTowers: TowerType[] = ['generator', 'blaster'];

    for (const type of starterTowers) {
      const placement = findAutoPlacementNearCore(state, type);
      if (!placement) continue;
      addTowerToState(state, createTowerAt(type, placement.x, placement.y));
    }
  };

  const startGame = () => {
    const s = createInitialState();
    deployStartingLoadout(s);
    s.status = 'pick';
    s.gameMode = 'normal';
    s.pickOptions = generatePickOptions();
    stateRef.current = s;
    centerOnCore(s);
    sync();
  };

  const startCustomGame = () => {
    const s = createInitialState();
    deployStartingLoadout(s);
    s.status = 'playing';
    s.gameMode = 'custom';
    s.wireInventory = Infinity;
    s.needsPick = false;
    stateRef.current = s;
    centerOnCore(s);
    sync();
  };

  const togglePause = () => {
    const s = stateRef.current;
    if (s.status === 'playing') s.status = 'paused';
    else if (s.status === 'paused') s.status = 'playing';
    sync();
  };

  const returnToMenu = () => {
    const s = createInitialState();
    s.status = 'menu';
    stateRef.current = s;
    setSelectedTower(null);
    centerOnCore(s);
    sync();
  };

  const handlePick = (optionId: string, sourceClientPos?: { x: number; y: number }) => {
    const state = stateRef.current;
    const option = state.pickOptions.find(o => o.id === optionId);
    if (!option) return;

    if (option.kind === 'tower' && option.towerType) {
      for (let n = 0; n < option.count; n++) {
        if (!queueTowerDropNearCore(state, option.towerType, sourceClientPos)) {
          showToast(t().autoDeployFailed);
          break;
        }
      }
    } else if (option.kind === 'wire') {
      state.wireInventory += option.count;
    }

    state.pickOptions = [];
    state.needsPick = false;
    state.status = 'playing';
    if (state.bossBonusPickQueued) {
      state.bossBonusPickQueued = false;
      state.pendingBossBonusPick = true;
      state.pickUiPhase = 'standard';
    } else {
      state.pickUiPhase = 'standard';
      state.waveTimer = 0;
    }
    sync();
  };

  const skipToNextWave = () => {
    const state = stateRef.current;
    if (state.status !== 'playing' || state.gameMode === 'custom') return;
    if (state.enemies.length > 0 || state.enemiesToSpawn > 0) return;
    if (state.needsPick) return;
    state.waveTimer = WAVE_DELAY + 1;
    sync();
  };

  const placeTowerFromSelection = (state: GameState, towerType: TowerType, x: number, y: number) => {
    if (!canPlace(x, y, towerType, state)) return false;

    if (state.gameMode !== 'custom') {
      state.towerInventory[towerType]--;
    }

    addTowerToState(state, createTowerAt(towerType, x, y));
    sync();

    if (state.gameMode !== 'custom' && (state.towerInventory[towerType] ?? 0) <= 0) {
      setSelectedTower(null);
    }

    return true;
  };

  const clearTowerDragState = () => {
    dragTowerRef.current = null;
    dragOrigPosRef.current = null;
    dragOrigWiresRef.current = null;
  };

  const clearWireDragState = () => {
    dragWireStartRef.current = null;
    dragWirePathRef.current = null;
  };

  const commitWireDrag = (state: GameState, pointer: { x: number; y: number }, hitRadius: number) => {
    const dragStart = dragWireStartRef.current;
    if (!dragStart) return;

    let dropPort: Port | null = null;
    let dropTowerId: string | null = null;

    for (const tower of state.towers) {
      for (const port of tower.ports) {
        const portPos = getPortPos(tower, port);
        if (Math.hypot(portPos.x - pointer.x, portPos.y - pointer.y) < hitRadius) {
          dropPort = port;
          dropTowerId = tower.id;
          break;
        }
      }
      if (dropPort) break;
    }

    if (dropPort && dropTowerId && dropTowerId !== dragStart.towerId) {
      const isUsed = state.wires.some((wire) => wire.startPortId === dropPort!.id || wire.endPortId === dropPort!.id);
      if (!isUsed) {
        const sourceTower = state.towerMap.get(dragStart.towerId);
        const sourcePort = sourceTower?.ports.find((port) => port.id === dragStart.portId);
        if (sourceTower && sourcePort) {
          let startTower = sourceTower;
          let startPort = sourcePort;
          let endTower = state.towerMap.get(dropTowerId)!;
          let endPort = dropPort;

          if (sourcePort.portType === 'input' && dropPort.portType === 'output') {
            [startTower, startPort, endTower, endPort] = [endTower, endPort, startTower, startPort];
          } else if (sourcePort.portType === dropPort.portType) {
            clearWireDragState();
            return;
          }

          const path = findWirePath(getPortCell(startTower, startPort), getPortCell(endTower, endPort), state);
          if (path) {
            if (state.gameMode !== 'custom') state.wireInventory--;
            state.wires.push({
              id: genId(),
              startTowerId: startTower.id,
              startPortId: startPort.id,
              endTowerId: endTower.id,
              endPortId: endPort.id,
              path,
              hp: WIRE_MAX_HP,
              maxHp: WIRE_MAX_HP,
            });
            updatePowerGrid(state);
            sync();
          }
        }
      }
    }

    clearWireDragState();
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

  const clientToWorld = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return toWorld(clientX - rect.left, clientY - rect.top);
  };

  const clampCamera = (cam: Camera) => {
    const vp = viewportRef.current;
    const viewW = vp.width / cam.zoom;
    const viewH = vp.height / cam.zoom;
    const maxX = Math.max(0, CANVAS_WIDTH - viewW);
    const maxY = Math.max(0, CANVAS_HEIGHT - viewH);
    cam.x = Math.max(0, Math.min(cam.x, maxX));
    cam.y = Math.max(0, Math.min(cam.y, maxY));
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
        if (Math.hypot(pp.x - wx, pp.y - wy) >= 11) continue;
        const existIdx = state.wires.findIndex(w => w.startPortId === port.id || w.endPortId === port.id);
        if (existIdx !== -1) {
          state.wires.splice(existIdx, 1);
          if (state.gameMode !== 'custom') state.wireInventory++;
          updatePowerGrid(state);
          sync();
        } else if (state.gameMode !== 'custom' && state.wireInventory <= 0) {
          showToast(t().noWires);
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
    if (sel && placeTowerFromSelection(state, sel, gx, gy)) {
      return;
    }

    // Left-click on empty space: deselect tower & start pan
    setSelectedTower(null);
    updateRotating(null);
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
      commitWireDrag(state, mousePxRef.current, 15);
    }
  };

  const handleCanvasMouseLeave = () => {
    hoverRef.current = null;
    // Restore tower + wires if dragging
    cancelTowerDrag();
    clearWireDragState();
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
    const minZoom = getMinZoom();
    cam.zoom = Math.max(minZoom, Math.min(MAX_ZOOM, cam.zoom * factor));

    // Keep world point under cursor after zoom
    cam.x = wx - sx / cam.zoom;
    cam.y = wy - sy / cam.zoom;
    clampCamera(cam);
  };

  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  };

  // ── Touch support ────────────────────────────────────────────────────────
  const lastPinchDistRef = useRef<number | null>(null);

  const touchScreenXY = (touch: React.Touch) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return r ? { sx: touch.clientX - r.left, sy: touch.clientY - r.top } : null;
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      // Start pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistRef.current = Math.hypot(dx, dy);
      isPanningRef.current = false;
      return;
    }
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const spos = touchScreenXY(touch);
    if (!spos) return;
    const { sx, sy } = spos;
    const state = stateRef.current;

    if (state.status !== 'playing') {
      // Just start panning outside of playing state
      isPanningRef.current = true;
      panLastRef.current = { x: sx, y: sy };
      return;
    }
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
        if (Math.hypot(wx - kx, wy - ky) < 20) {
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
        if (Math.hypot(pp.x - wx, pp.y - wy) >= 18) continue;
        const existIdx = state.wires.findIndex(w => w.startPortId === port.id || w.endPortId === port.id);
        if (existIdx !== -1) {
          state.wires.splice(existIdx, 1);
          if (state.gameMode !== 'custom') state.wireInventory++;
          updatePowerGrid(state);
          sync();
        } else if (state.gameMode !== 'custom' && state.wireInventory <= 0) {
          showToast(t().noWires);
          return;
        }
        dragWireStartRef.current = { towerId: tower.id, portId: port.id };
        return;
      }
    }

    // Tower drag check
    for (const tower of state.towers) {
      if (wx >= tower.x * CELL_SIZE && wx <= (tower.x + tower.width) * CELL_SIZE &&
          wy >= tower.y * CELL_SIZE && wy <= (tower.y + tower.height) * CELL_SIZE) {
        if (tower.type === 'core') {
          updateRotating(rotatingRef.current === tower.id ? null : tower.id);
          return;
        }
        dragTowerRef.current = tower.id;
        dragOrigPosRef.current = { x: tower.x, y: tower.y };
        const connWires = state.wires.filter(w => w.startTowerId === tower.id || w.endTowerId === tower.id);
        dragOrigWiresRef.current = connWires.map(w => ({ ...w, path: w.path.map(p => ({ ...p })) }));
        dragOrigInventoryRef.current = state.wireInventory;
        return;
      }
    }

    // Place tower from inventory
    const gx = (wx / CELL_SIZE) | 0, gy = (wy / CELL_SIZE) | 0;
    const sel = selectedTowerRef.current;
    if (sel && placeTowerFromSelection(state, sel, gx, gy)) {
      return;
    }

    // Empty space: start pan
    setSelectedTower(null);
    updateRotating(null);
    isPanningRef.current = true;
    panLastRef.current = { x: sx, y: sy };
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    // Pinch zoom
    if (e.touches.length === 2 && lastPinchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const cam = cameraRef.current;
      // Midpoint in screen space
      const r = canvasRef.current?.getBoundingClientRect();
      if (r) {
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
        const wx = mx / cam.zoom + cam.x;
        const wy = my / cam.zoom + cam.y;
        const factor = dist / lastPinchDistRef.current;
        const minZoom = getMinZoom();
        cam.zoom = Math.max(minZoom, Math.min(MAX_ZOOM, cam.zoom * factor));
        cam.x = wx - mx / cam.zoom;
        cam.y = wy - my / cam.zoom;
        clampCamera(cam);
      }
      lastPinchDistRef.current = dist;
      return;
    }
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const spos = touchScreenXY(touch);
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
            if (Math.hypot(pp.x - wx, pp.y - wy) < 20 && tower.id !== st.id) {
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

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    // End pinch
    if (lastPinchDistRef.current !== null && e.touches.length < 2) {
      lastPinchDistRef.current = null;
      return;
    }

    // End pan
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panLastRef.current = null;
      return;
    }

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
      const dragStart = mouseDownPosRef.current;
      const pointer = mousePxRef.current;
      if (dragStart && pointer && Math.hypot(pointer.x - dragStart.x, pointer.y - dragStart.y) < 5) {
        updateRotating(rotatingRef.current === dragTowerRef.current ? null : dragTowerRef.current);
      }
      clearTowerDragState();
    }

    if (dragWireStartRef.current && mousePxRef.current) {
      commitWireDrag(state, mousePxRef.current, 20);
    }
  };

  // ── Game loop ──────────────────────────────────────────────────────────
  const gameLoop = useCallback((time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const dt = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;
    const state = stateRef.current;

    if (state.status === 'playing' && updateGameState(state, dt)) {
      sync();
    }

    // ── Render ────────────────────────────────────────────────────────────
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const vp = viewportRef.current;
      const hover = hoverRef.current;
      const sel = selectedTowerRef.current;
      renderGame(
        ctx, state, vp.width, vp.height, cameraRef.current,
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

  // ── Adaptive canvas resolution (CSS size + DPR backing store) ─────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const dpr = window.devicePixelRatio || 1;
      const pixelW = Math.max(1, Math.round(width * dpr));
      const pixelH = Math.max(1, Math.round(height * dpr));

      if (canvas.width !== pixelW) canvas.width = pixelW;
      if (canvas.height !== pixelH) canvas.height = pixelH;

      viewportRef.current = { width, height };
      const cam = cameraRef.current;
      const minZoom = getMinZoom();
      if (cam.zoom < minZoom) cam.zoom = minZoom;
      clampCamera(cam);
    };

    updateCanvasSize();
    // Center on core after first measurement so all devices start with the same view
    centerOnCore(stateRef.current);
    const ro = new ResizeObserver(updateCanvasSize);
    ro.observe(canvas);
    window.addEventListener('resize', updateCanvasSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (state.status !== 'playing') return;

      if (e.key === 'Escape') {
        // Cancel tower drag — restore original position and wires
        if (dragTowerRef.current && dragOrigPosRef.current) {
          cancelTowerDrag();
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
    canvasRef, cameraRef, gameState, startGame, startCustomGame, togglePause, returnToMenu, handlePick,
    selectedTower, setSelectedTower, skipToNextWave, toastMessage,
    handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasMouseLeave,
    handleCanvasWheel, handleCanvasContextMenu,
    handleCanvasTouchStart, handleCanvasTouchMove, handleCanvasTouchEnd,
  };
};

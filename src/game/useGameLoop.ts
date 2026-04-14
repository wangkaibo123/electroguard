import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameState, TowerType, CommandCardType, BaseUpgradeType, ShopItemType, ShopPackType, Port, Wire, CELL_SIZE, GRID_WIDTH, GRID_HEIGHT, EnemyType, PortDirection,
  TOWER_STATS, CANVAS_WIDTH, CANVAS_HEIGHT, WIRE_MAX_HP,
  Camera, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, getTowerRange,
} from './types';
import {
  createInitialState, updatePowerGrid, getPortPos, getPortCell, findWirePath,
  snapRotation, applyTowerRotation, canPlace, collidesWithTowers,
  collidesWithWires, repathConnectedWires, genId, generatePickOptions, spawnEnemyAt,
  canDirectLinkPorts, isPortAccessible,
  generateTowerOnlyPickOptions, generateInfraOnlyPickOptions, rebuildTowerMap,
  generateAdvancedPickOptions, generateCommandCardPickOptions, generateBaseUpgradePickOptions, generateShopOffers, syncDirectPortLinks,
  createExplosion,
} from './engine';
import { renderGame } from './renderer';
import { BASE_UPGRADE_CONFIG, COMMAND_CARD_CONFIG, GLOBAL_CONFIG, SCORE_CONFIG, SHOP_CONFIG, SHOP_ITEM_CONFIG } from './config';
import { t } from './i18n';
import { addTowerToState, createTowerAt } from './towerFactory';
import { findAutoPlacementNearCore } from './placement';
import { updateGameState } from './updateGameState';
import { getDeleteButtonLayout, getRotationKnobLayout } from './render/towers';
import { isWorldPointInTowerFootprint } from './footprint';

const { maxZoom: MAX_ZOOM, waveDelay: WAVE_DELAY } = GLOBAL_CONFIG;
const MAX_MACHINE_COMMAND_UPGRADES = 3;
const PORT_DIRECTIONS: PortDirection[] = ['top', 'right', 'bottom', 'left'];
const COMMAND_CARD_TYPES = Object.keys(COMMAND_CARD_CONFIG) as CommandCardType[];

export const useGameLoop = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const [gameState, setGameState] = useState<GameState>(stateRef.current);
  const viewportRef = useRef<{ width: number; height: number }>({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  });
  const pendingCanvasSizeRef = useRef<{ w: number; h: number; pw: number; ph: number } | null>(null);

  const selectedTowerRef = useRef<TowerType | null>(null);
  const [selectedTower, _setSelectedTower] = useState<TowerType | null>(null);
  const setSelectedTower = (v: TowerType | null) => { selectedTowerRef.current = v; _setSelectedTower(v); };
  const placeMonsterModeRef = useRef(false);
  const [placeMonsterMode, _setPlaceMonsterMode] = useState(false);
  const setPlaceMonsterMode = (v: boolean) => { placeMonsterModeRef.current = v; _setPlaceMonsterMode(v); };
  const selectedMonsterTypeRef = useRef<EnemyType>('grunt');
  const [selectedMonsterType, _setSelectedMonsterType] = useState<EnemyType>('grunt');
  const setSelectedMonsterType = (v: EnemyType) => { selectedMonsterTypeRef.current = v; _setSelectedMonsterType(v); };
  const staticMonsterRef = useRef(true);
  const [staticMonster, _setStaticMonster] = useState(true);
  const setStaticMonster = (v: boolean) => { staticMonsterRef.current = v; _setStaticMonster(v); };

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
  const [commandCardDragLine, setCommandCardDragLine] = useState<{
    cardType: CommandCardType;
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null>(null);

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

  // 鈹€鈹€ Actions 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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
    const placement = findAutoPlacementNearCore(state, type, 2, 1);
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
      const placement = findAutoPlacementNearCore(state, type, 2, 1);
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
    setPlaceMonsterMode(false);
    setSelectedMonsterType('grunt');
    setStaticMonster(true);
    centerOnCore(s);
    sync();
  };

  const startCustomGame = () => {
    const s = createInitialState();
    deployStartingLoadout(s);
    s.status = 'playing';
    s.gameMode = 'custom';
    s.wireInventory = Infinity;
    s.gold = Infinity;
    s.commandCardInventory = Object.fromEntries(COMMAND_CARD_TYPES.map(type => [type, 1]));
    s.needsPick = false;
    stateRef.current = s;
    setPlaceMonsterMode(false);
    setSelectedMonsterType('grunt');
    setStaticMonster(true);
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
    setPlaceMonsterMode(false);
    setSelectedMonsterType('grunt');
    setStaticMonster(true);
    centerOnCore(s);
    sync();
  };

  const spawnStaticMonsterAt = (state: GameState, x: number, y: number) => {
    if (x < 0 || y < 0 || x > CANVAS_WIDTH || y > CANVAS_HEIGHT) return false;
    spawnEnemyAt(state, selectedMonsterTypeRef.current, Math.max(1, state.wave || 1), x, y, {
      isStatic: staticMonsterRef.current,
    });
    sync();
    return true;
  };

  const applyBaseUpgradeToCore = (state: GameState, upgradeType: BaseUpgradeType) => {
    const core = state.towers.find(tower => tower.type === 'core');
    if (!core) return false;

    if (upgradeType === 'core_power_boost') {
      core.corePowerBonus = (core.corePowerBonus ?? 0) + (BASE_UPGRADE_CONFIG.core_power_boost.corePowerBonus ?? 1);
      return true;
    }
    if (upgradeType === 'core_turret_unlock') {
      if (core.coreTurretUnlocked) return false;
      core.coreTurretUnlocked = true;
      core.coreTurretLastShot = 0;
      return true;
    }
    if (upgradeType === 'core_shield_unlock') {
      if (core.maxShieldHp > 0) return false;
      core.maxShieldHp = BASE_UPGRADE_CONFIG.core_shield_unlock.coreShieldHp ?? 200;
      core.shieldHp = core.maxShieldHp;
      core.shieldRadius = BASE_UPGRADE_CONFIG.core_shield_unlock.coreShieldRadius ?? 160;
      return true;
    }

    return false;
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
    } else if (option.kind === 'command_card' && option.commandCardType) {
      state.commandCardInventory[option.commandCardType] =
        (state.commandCardInventory[option.commandCardType] ?? 0) + option.count;
    } else if (option.kind === 'base_upgrade' && option.baseUpgradeType) {
      if (!applyBaseUpgradeToCore(state, option.baseUpgradeType)) {
        showToast(t().baseUpgradeCannotUse);
        return;
      }
    }

    const isShopPick = state.pickUiPhase === 'shop_tower' || state.pickUiPhase === 'shop_infra' || state.pickUiPhase === 'shop_command' || state.pickUiPhase === 'shop_base_upgrade';

    state.pickOptions = [];
    state.status = 'playing';

    if (isShopPick) {
      state.pickUiPhase = 'standard';
    } else {
      state.needsPick = false;
      if (state.bossBonusPickQueued) {
        state.bossBonusPickQueued = false;
        state.pendingBossBonusPick = true;
        state.pickUiPhase = 'standard';
      } else {
        state.pickUiPhase = 'standard';
        state.waveTimer = 0;
      }
    }
    sync();
  };

  const openCustomPick = () => {
    const state = stateRef.current;
    if (state.gameMode !== 'custom') return;
    if (state.status !== 'playing' && state.status !== 'paused') return;

    state.pickOptions = generatePickOptions();
    state.pickUiPhase = 'standard';
    state.pendingBossBonusPick = false;
    state.bossBonusPickQueued = false;
    state.status = 'pick';
    sync();
  };

  const buyShopPack = (shopItemType: ShopItemType) => {
    const state = stateRef.current;
    if (state.status !== 'playing') return;
    if (!state.shopOffers?.includes(shopItemType)) return;
    const shopItem = SHOP_ITEM_CONFIG[shopItemType];
    const price = shopItem.price;
    if (state.gold < price) {
      showToast(t().notEnoughGold);
      return;
    }
    state.gold -= price;
    if (shopItem.kind === 'machine') {
      const towerType = shopItem.towerType;
      if (!towerType || !queueTowerDropNearCore(state, towerType)) {
        state.gold += price;
        showToast(t().autoDeployFailed);
        sync();
        return;
      }
      sync();
      return;
    }
    const packType = shopItemType as ShopPackType;
    if (packType === 'advanced') {
      const opt = generateAdvancedPickOptions()[0];
      if (opt.towerType) {
        for (let n = 0; n < opt.count; n++) {
          if (!queueTowerDropNearCore(state, opt.towerType)) {
            showToast(t().autoDeployFailed);
            break;
          }
        }
      }
      sync();
      return;
    }
    state.pickOptions =
      packType === 'tower' ? generateTowerOnlyPickOptions() :
      packType === 'command' ? generateCommandCardPickOptions() :
      packType === 'base_upgrade' ? generateBaseUpgradePickOptions() :
      generateInfraOnlyPickOptions();
    state.pickUiPhase =
      packType === 'tower' ? 'shop_tower' :
      packType === 'command' ? 'shop_command' :
      packType === 'base_upgrade' ? 'shop_base_upgrade' :
      'shop_infra';
    state.pendingBossBonusPick = false;
    state.bossBonusPickQueued = false;
    state.status = 'pick';
    sync();
  };

  const refreshShopOffers = () => {
    const state = stateRef.current;
    if (state.status !== 'playing') return;
    const refreshCost = state.shopRefreshCost ?? SHOP_CONFIG.initialRefreshCost;
    if (state.gold < refreshCost) {
      showToast(t().notEnoughGold);
      return;
    }
    state.gold -= refreshCost;
    state.shopRefreshCost = refreshCost + SHOP_CONFIG.refreshCostIncrease;
    state.shopOffers = generateShopOffers();
    sync();
  };

  const sellTower = (towerId: string) => {
    const state = stateRef.current;
    if (state.status !== 'playing') return;
    const tower = state.towerMap.get(towerId);
    if (!tower || tower.type === 'core') return;
    state.towers = state.towers.filter(t => t.id !== towerId);
    state.wires = state.wires.filter(w => w.startTowerId !== towerId && w.endTowerId !== towerId);
    state.towerMap.delete(towerId);
    rebuildTowerMap(state);
    updatePowerGrid(state);
    state.gold += SHOP_CONFIG.sellPrice;
    updateRotating(null);
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
      const targetTower = state.towerMap.get(dropTowerId)!;
      if (!isUsed && isPortAccessible(state, targetTower, dropPort)) {
        const sourceTower = state.towerMap.get(dragStart.towerId);
        const sourcePort = sourceTower?.ports.find((port) => port.id === dragStart.portId);
        if (sourceTower && sourcePort && isPortAccessible(state, sourceTower, sourcePort)) {
          let startTower = sourceTower;
          let startPort = sourcePort;
          let endTower = targetTower;
          let endPort = dropPort;

          if (sourcePort.portType === 'input' && dropPort.portType === 'output') {
            [startTower, startPort, endTower, endPort] = [endTower, endPort, startTower, startPort];
          } else if (sourcePort.portType === dropPort.portType) {
            clearWireDragState();
            return;
          }

          if (canDirectLinkPorts(state, startTower, startPort, endTower, endPort)) {
            state.wires.push({
              id: genId(),
              startTowerId: startTower.id,
              startPortId: startPort.id,
              endTowerId: endTower.id,
              endPortId: endPort.id,
              path: [],
              hp: WIRE_MAX_HP,
              maxHp: WIRE_MAX_HP,
              direct: true,
              createdAt: performance.now(),
            });
            updatePowerGrid(state);
            sync();
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

  // 鈹€鈹€ Canvas mouse helpers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

  const getCanvasClientPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    return { sx: clientX - rect.left, sy: clientY - rect.top };
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

  const findTowerAtWorldPoint = (state: GameState, wx: number, wy: number) => {
    for (const tower of state.towers) {
      if (isWorldPointInTowerFootprint(tower, wx, wy)) return tower;
    }
    return null;
  };

  const addMachinePort = (state: GameState, tower: GameState['towers'][number], portType: 'input' | 'output') => {
    if (tower.type === 'core') return false;
    const getSideLength = (direction: PortDirection) =>
      direction === 'top' || direction === 'bottom' ? tower.width : tower.height;
    const getSideCellIndex = (direction: PortDirection, sideOffset = 0.5) =>
      Math.min(getSideLength(direction) - 1, Math.max(0, Math.floor(getSideLength(direction) * sideOffset)));
    const getCandidateCellIndexes = (sideLength: number) => {
      const center = Math.floor(sideLength / 2);
      const seen = new Set<number>();
      const ordered = [center, center - 1, center + 1, 0, sideLength - 1];
      return ordered.filter((index) => {
        if (index < 0 || index >= sideLength || seen.has(index)) return false;
        seen.add(index);
        return true;
      });
    };

    for (const phaseIndex of [0, 1, 2]) {
      for (const direction of PORT_DIRECTIONS) {
        const sideLength = getSideLength(direction);
        const candidates = getCandidateCellIndexes(sideLength);
        const phaseCandidates = phaseIndex === 0
          ? candidates.slice(0, 1)
          : phaseIndex === 1
            ? candidates.slice(1, 3)
            : candidates.slice(3);

        for (const cellIndex of phaseCandidates) {
          const hasSameSpot = tower.ports.some(port =>
            port.direction === direction &&
            getSideCellIndex(direction, port.sideOffset) === cellIndex,
          );
          if (hasSameSpot) continue;
          const sideOffset = (cellIndex + 0.5) / sideLength;
          const port = { id: genId(), direction, portType, sideOffset };
          if (!isPortAccessible(state, tower, port)) continue;
          tower.ports.push(port);
          if (!syncDirectPortLinks(state, { towerId: tower.id, createSpark: true })) {
            updatePowerGrid(state);
          }
          return true;
        }
      }
    }
    return false;
  };

  const damageEnemyFromCommand = (state: GameState, enemy: GameState['enemies'][number], damage: number) => {
    let remainingDamage = damage;
    if (enemy.shieldAbsorb > 0) {
      const absorbed = Math.min(enemy.shieldAbsorb, remainingDamage);
      enemy.shieldAbsorb -= absorbed;
      remainingDamage -= absorbed;
    }
    enemy.hp -= remainingDamage;
    createExplosion(state, enemy.x, enemy.y, enemy.color, enemy.hp <= 0 ? 12 : 5);
    if (enemy.hp > 0) return;
    state.score += SCORE_CONFIG[enemy.enemyType] ?? SCORE_CONFIG.default;
  };

  const applyCommandCardAtWorld = (cardType: CommandCardType, wx: number, wy: number) => {
    const state = stateRef.current;
    if (state.status !== 'playing') return false;
    if ((state.commandCardInventory[cardType] ?? 0) <= 0) return false;
    if (wx < 0 || wy < 0 || wx > CANVAS_WIDTH || wy > CANVAS_HEIGHT) return false;

    const targetTower = findTowerAtWorldPoint(state, wx, wy);
    let used = false;

    if (cardType === 'airstrike') {
      const cfg = COMMAND_CARD_CONFIG.airstrike;
      const radius = cfg.airstrikeRadius ?? 90;
      const damage = cfg.airstrikeDamage ?? 160;
      for (const enemy of state.enemies) {
        if (Math.hypot(enemy.x - wx, enemy.y - wy) <= radius + enemy.radius) {
          damageEnemyFromCommand(state, enemy, damage);
          used = true;
        }
      }
      createExplosion(state, wx, wy, cfg.color, 24);
      state.enemies = state.enemies.filter(enemy => enemy.hp > 0);
      used = true;
    } else if (cardType === 'add_input' || cardType === 'add_output') {
      if (!targetTower || targetTower.type === 'core') return false;
      used = addMachinePort(state, targetTower, cardType === 'add_input' ? 'input' : 'output');
    } else if (cardType === 'self_power') {
      if (!targetTower || targetTower.type === 'core') return false;
      if ((targetTower.commandUpgradeCount ?? 0) >= MAX_MACHINE_COMMAND_UPGRADES) return false;
      targetTower.selfPowerLevel = (targetTower.selfPowerLevel ?? 0) + 1;
      targetTower.selfPowerTimer = 0;
      updatePowerGrid(state);
      used = true;
    } else if (cardType === 'range_boost') {
      if (!targetTower || targetTower.type === 'core' || getTowerRange(targetTower) == null) return false;
      if ((targetTower.commandUpgradeCount ?? 0) >= MAX_MACHINE_COMMAND_UPGRADES) return false;
      targetTower.rangeMultiplier = (targetTower.rangeMultiplier ?? 1) + (COMMAND_CARD_CONFIG.range_boost.rangeBoostMultiplier ?? 0.2);
      used = true;
    }

    if (!used) return false;
    if (targetTower && targetTower.type !== 'core' && cardType !== 'airstrike' && cardType !== 'add_input' && cardType !== 'add_output') {
      targetTower.commandUpgradeCount = (targetTower.commandUpgradeCount ?? 0) + 1;
    }
    if (state.gameMode !== 'custom') {
      state.commandCardInventory[cardType] = Math.max(0, (state.commandCardInventory[cardType] ?? 0) - 1);
    }
    sync();
    return true;
  };

  const commitCommandCardDrag = (cardType: CommandCardType, clientX: number, clientY: number) => {
    const point = getCanvasClientPoint(clientX, clientY);
    if (!point) {
      showToast(t().commandCardCannotUse);
      return;
    }
    const { wx, wy } = toWorld(point.sx, point.sy);
    if (!applyCommandCardAtWorld(cardType, wx, wy)) {
      showToast(t().commandCardCannotUse);
    }
  };

  const startCommandCardDrag = (cardType: CommandCardType, sourceClientPos: { x: number; y: number }) => {
    if (stateRef.current.status !== 'playing' || (stateRef.current.commandCardInventory[cardType] ?? 0) <= 0) return;
    setCommandCardDragLine({ cardType, start: sourceClientPos, end: sourceClientPos });
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

    if (state.status !== 'playing') {
      if (state.status === 'pick') {
        isPanningRef.current = true;
        panLastRef.current = { x: sx, y: sy };
      }
      return;
    }
    const { wx, wy } = toWorld(sx, sy);
    mouseDownPosRef.current = { x: wx, y: wy };

    if (placeMonsterModeRef.current) {
      if (spawnStaticMonsterAt(state, wx, wy)) {
        updateRotating(null);
        setSelectedTower(null);
      }
      return;
    }

    if (rotatingRef.current && state.gameMode !== 'custom') {
      const tower = state.towerMap.get(rotatingRef.current);
      if (tower && tower.type !== 'core') {
        const { buttonX, buttonY, buttonWidth, buttonHeight } = getDeleteButtonLayout(tower);
        if (wx >= buttonX && wx <= buttonX + buttonWidth && wy >= buttonY && wy <= buttonY + buttonHeight) {
          sellTower(tower.id);
          return;
        }
      }
    }

    // Rotation knob check — click to rotate 90°
    if (rotatingRef.current) {
      const tower = state.towerMap.get(rotatingRef.current);
      if (tower) {
        const { buttonX, buttonY, buttonWidth, buttonHeight } = getRotationKnobLayout(tower);
        if (wx >= buttonX && wx <= buttonX + buttonWidth && wy >= buttonY && wy <= buttonY + buttonHeight) {
          const oldAngle = snapRotation(tower.rotation);
          const newAngle = snapRotation(oldAngle + Math.PI / 2);
          applyTowerRotation(tower, newAngle, oldAngle, state);
          isRotKnobRef.current = true;
          sync();
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
          if (state.wires[existIdx].direct) return;
          state.wires.splice(existIdx, 1);
          if (state.gameMode !== 'custom') state.wireInventory++;
          updatePowerGrid(state);
          sync();
        } else if (state.gameMode !== 'custom' && state.wireInventory <= 0) {
          showToast(t().noWires);
          return;
        } else if (!isPortAccessible(state, tower, port)) {
          return;
        }
        dragWireStartRef.current = { towerId: tower.id, portId: port.id };
        return;
      }
    }

    // Tower drag check (core cannot be dragged or rotated)
    for (const tower of state.towers) {
      if (isWorldPointInTowerFootprint(tower, wx, wy)) {
        if (tower.type === 'core') {
          showToast(t().coreCannotMove);
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
        let directPath = false;
        for (const tower of state.towers) {
          for (const port of tower.ports) {
            const pp = getPortPos(tower, port);
            if (Math.hypot(pp.x - wx, pp.y - wy) < 15 && tower.id !== st.id) {
              if (canDirectLinkPorts(state, st, sp, tower, port)) {
                directPath = true;
                break;
              } else if (isPortAccessible(state, tower, port)) {
                endCell = getPortCell(tower, port);
                break;
              }
            }
          }
          if (directPath) break;
        }
        dragWirePathRef.current = directPath ? [] : findWirePath(sc, endCell, state);
      }
    }

    if (dragTowerRef.current) {
      const tower = state.towerMap.get(dragTowerRef.current);
      if (!tower) return;
      const nx = (wx / CELL_SIZE | 0) - (tower.width >> 1);
      const ny = (wy / CELL_SIZE | 0) - (tower.height >> 1);
      if (nx < 0 || ny < 0 || nx + tower.width > GRID_WIDTH || ny + tower.height > GRID_HEIGHT) return;
      if (collidesWithTowers(nx, ny, tower.width, tower.height, state.towers, tower.id, 0, tower.type)) return;
      if (collidesWithWires(nx, ny, tower.width, tower.height, state.wires, tower.id, 0, tower.type)) return;
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
        if (isWorldPointInTowerFootprint(t, wx, wy)) { hit = true; break; }
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

  // 鈹€鈹€ Touch support 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

    if (placeMonsterModeRef.current) {
      if (spawnStaticMonsterAt(state, wx, wy)) {
        updateRotating(null);
        setSelectedTower(null);
      }
      return;
    }

    if (rotatingRef.current && state.gameMode !== 'custom') {
      const tower = state.towerMap.get(rotatingRef.current);
      if (tower && tower.type !== 'core') {
        const { buttonX, buttonY, buttonWidth, buttonHeight } = getDeleteButtonLayout(tower);
        const touchPadding = 8;
        if (
          wx >= buttonX - touchPadding &&
          wx <= buttonX + buttonWidth + touchPadding &&
          wy >= buttonY - touchPadding &&
          wy <= buttonY + buttonHeight + touchPadding
        ) {
          sellTower(tower.id);
          return;
        }
      }
    }

    // Rotation knob check — tap to rotate 90°
    if (rotatingRef.current) {
      const tower = state.towerMap.get(rotatingRef.current);
      if (tower) {
        const { buttonX, buttonY, buttonWidth, buttonHeight } = getRotationKnobLayout(tower);
        const touchPadding = 8;
        if (
          wx >= buttonX - touchPadding &&
          wx <= buttonX + buttonWidth + touchPadding &&
          wy >= buttonY - touchPadding &&
          wy <= buttonY + buttonHeight + touchPadding
        ) {
          const oldAngle = snapRotation(tower.rotation);
          const newAngle = snapRotation(oldAngle + Math.PI / 2);
          applyTowerRotation(tower, newAngle, oldAngle, state);
          isRotKnobRef.current = true;
          sync();
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
          if (state.wires[existIdx].direct) return;
          state.wires.splice(existIdx, 1);
          if (state.gameMode !== 'custom') state.wireInventory++;
          updatePowerGrid(state);
          sync();
        } else if (state.gameMode !== 'custom' && state.wireInventory <= 0) {
          showToast(t().noWires);
          return;
        } else if (!isPortAccessible(state, tower, port)) {
          return;
        }
        dragWireStartRef.current = { towerId: tower.id, portId: port.id };
        return;
      }
    }

    // Tower drag check (core cannot be dragged or rotated)
    for (const tower of state.towers) {
      if (isWorldPointInTowerFootprint(tower, wx, wy)) {
        if (tower.type === 'core') {
          showToast(t().coreCannotMove);
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
        let directPath = false;
        for (const tower of state.towers) {
          for (const port of tower.ports) {
            const pp = getPortPos(tower, port);
            if (Math.hypot(pp.x - wx, pp.y - wy) < 20 && tower.id !== st.id) {
              if (canDirectLinkPorts(state, st, sp, tower, port)) {
                directPath = true;
                break;
              } else if (isPortAccessible(state, tower, port)) {
                endCell = getPortCell(tower, port);
                break;
              }
            }
          }
          if (directPath) break;
        }
        dragWirePathRef.current = directPath ? [] : findWirePath(sc, endCell, state);
      }
    }

    if (dragTowerRef.current) {
      const tower = state.towerMap.get(dragTowerRef.current);
      if (!tower) return;
      const nx = (wx / CELL_SIZE | 0) - (tower.width >> 1);
      const ny = (wy / CELL_SIZE | 0) - (tower.height >> 1);
      if (nx < 0 || ny < 0 || nx + tower.width > GRID_WIDTH || ny + tower.height > GRID_HEIGHT) return;
      if (collidesWithTowers(nx, ny, tower.width, tower.height, state.towers, tower.id, 0, tower.type)) return;
      if (collidesWithWires(nx, ny, tower.width, tower.height, state.wires, tower.id, 0, tower.type)) return;
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

  // 鈹€鈹€ Game loop 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  const gameLoop = useCallback((time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const dt = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;
    const state = stateRef.current;

    if (state.status === 'playing' && updateGameState(state, dt)) {
      sync();
    }

    // 鈹€鈹€ Render 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
    const pending = pendingCanvasSizeRef.current;
    if (pending && canvasRef.current) {
      const c = canvasRef.current;
      if (c.width !== pending.pw) c.width = pending.pw;
      if (c.height !== pending.ph) c.height = pending.ph;
      viewportRef.current = { width: pending.w, height: pending.h };
      const cam = cameraRef.current;
      const minZoom = getMinZoom();
      if (cam.zoom < minZoom) cam.zoom = minZoom;
      clampCamera(cam);
      pendingCanvasSizeRef.current = null;
    }
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
        dragTowerRef.current,
        rotatingRef.current,
        placeMonsterModeRef.current && mousePxRef.current
          ? {
              x: mousePxRef.current.x,
              y: mousePxRef.current.y,
              enemyType: selectedMonsterTypeRef.current,
              isStatic: staticMonsterRef.current,
            }
          : null,
      );
    }

    requestAnimationFrame(gameLoop);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(id);
  }, [gameLoop]);

  // 鈹€鈹€ Adaptive canvas resolution (CSS size + DPR backing store) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const applyCanvasSize = (width: number, height: number, pixelW: number, pixelH: number) => {
      if (canvas.width !== pixelW) canvas.width = pixelW;
      if (canvas.height !== pixelH) canvas.height = pixelH;
      viewportRef.current = { width, height };
      const cam = cameraRef.current;
      const minZoom = getMinZoom();
      if (cam.zoom < minZoom) cam.zoom = minZoom;
      clampCamera(cam);
    };

    const updateCanvasSize = (immediate?: boolean) => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const dpr = window.devicePixelRatio || 1;
      const pixelW = Math.max(1, Math.round(width * dpr));
      const pixelH = Math.max(1, Math.round(height * dpr));

      if (immediate) {
        applyCanvasSize(width, height, pixelW, pixelH);
      } else {
        pendingCanvasSizeRef.current = { w: width, h: height, pw: pixelW, ph: pixelH };
      }
    };

    updateCanvasSize(true);
    // Center on core after first measurement so all devices start with the same view
    centerOnCore(stateRef.current);
    const deferredResize = () => updateCanvasSize();
    const ro = new ResizeObserver(deferredResize);
    ro.observe(canvas);
    window.addEventListener('resize', deferredResize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', deferredResize);
    };
  }, []);

  // 鈹€鈹€ Keyboard shortcuts 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (state.status !== 'playing') return;

      if (e.key === 'Escape') {
        // Cancel tower drag 鈥?restore original position and wires
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
          sync();
          return;
        }
        // Deselect tower placement
        if (selectedTowerRef.current) {
          setSelectedTower(null);
          return;
        }
        if (placeMonsterModeRef.current) {
          setPlaceMonsterMode(false);
          return;
        }
        // Deselect rotating tower
        if (rotatingRef.current) {
          updateRotating(null);
          return;
        }
      }

      if (e.key === 'q' || e.key === 'Q') {
        // Quick rotate the currently selected (rotating) tower 90掳 right
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

  useEffect(() => {
    if (!commandCardDragLine) return;

    const onPointerMove = (event: PointerEvent) => {
      setCommandCardDragLine(current => current
        ? { ...current, end: { x: event.clientX, y: event.clientY } }
        : current,
      );
    };
    const onPointerUp = (event: PointerEvent) => {
      const cardType = commandCardDragLine.cardType;
      setCommandCardDragLine(null);
      commitCommandCardDrag(cardType, event.clientX, event.clientY);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCommandCardDragLine(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [commandCardDragLine]);

  return {
    canvasRef, cameraRef, gameState, startGame, startCustomGame, togglePause, returnToMenu, handlePick,
    openCustomPick, buyShopPack, refreshShopOffers, sellTower, rotatingTowerId, startCommandCardDrag, commandCardDragLine,
    selectedTower, setSelectedTower, placeMonsterMode, setPlaceMonsterMode, skipToNextWave, toastMessage,
    selectedMonsterType, setSelectedMonsterType, staticMonster, setStaticMonster,
    handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasMouseLeave,
    handleCanvasWheel, handleCanvasContextMenu,
    handleCanvasTouchStart, handleCanvasTouchMove, handleCanvasTouchEnd,
  };
};

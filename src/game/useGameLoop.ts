import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameState, TowerType, CommandCardType, ShopItemType, ShopPackType, Port, Wire, EnemyType,
  WIRE_MAX_HP,
  VIEWPORT_WIDTH, VIEWPORT_HEIGHT,
  getCanvasHeight, getCanvasWidth,
} from './types';
import {
  createInitialState, updatePowerGrid, getPortPos, getPortCell, findWirePath,
  snapRotation, applyTowerRotation, canPlace, genId, generatePickOptions, spawnEnemyAt,
  canDirectLinkPorts, isPortAccessible,
  generateTowerOnlyPickOptions, generateInfraOnlyPickOptions, rebuildTowerMap,
  generateAdvancedPickOptions, generateCommandCardPickOptions, generateBaseUpgradePickOptions, generateShopOffers,
  generateTutorialGeneratorPickOptions, syncDirectPortLinks,
} from './engine';
import { renderGame } from './renderer';
import { COMMAND_CARD_CONFIG, GLOBAL_CONFIG, SHOP_CONFIG, SHOP_ITEM_CONFIG, getTowerSellPrice } from './config';
import { t } from './i18n';
import { addTowerToState, createTowerAt } from './towerFactory';
import { startNextWave, updateGameState } from './updateGameState';
import { isMachineCommandCard } from './commandCards';
import { centerCameraOnCore, clampCamera, createInitialCamera, getMinZoom, screenToWorld } from './camera';
import {
  applyBaseUpgradeToCore,
  applyMachineCommandCard,
  canApplyMachineCommandCard,
  clearPurchasedShopOffer,
  deployStartingLoadout,
  findTowerAtWorldPoint,
  queueTowerDropNearCore,
} from './gameActions';
import {
  getGridCell,
  getHoverCell,
  hitRotatingControl,
  moveDraggedTower,
  previewWirePath,
  rotateTowerQuarterTurn,
  startTowerDragAt,
  startWireDragAt,
} from './pointerActions';

const { maxZoom: MAX_ZOOM } = GLOBAL_CONFIG;
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
  const markRepairTargetBarsForFade = () => {
    const now = performance.now();
    for (const tower of stateRef.current.towers) {
      if (tower.type !== 'core' && (tower.isRuined || tower.hp < tower.maxHp)) {
        tower.lastDamagedAt = now;
      }
    }
  };

  const selectedTowerRef = useRef<TowerType | null>(null);
  const [selectedTower, _setSelectedTower] = useState<TowerType | null>(null);
  const setSelectedTower = (v: TowerType | null) => {
    if (v) {
      if (activeRepairRef.current) markRepairTargetBarsForFade();
      activeRepairRef.current = false;
      setActiveRepairState(false);
    }
    selectedTowerRef.current = v;
    _setSelectedTower(v);
  };
  const placeMonsterModeRef = useRef(false);
  const [placeMonsterMode, _setPlaceMonsterMode] = useState(false);
  const setPlaceMonsterMode = (v: boolean) => {
    if (v) {
      if (activeRepairRef.current) markRepairTargetBarsForFade();
      activeRepairRef.current = false;
      setActiveRepairState(false);
    }
    placeMonsterModeRef.current = v;
    _setPlaceMonsterMode(v);
  };
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
  const renderRequestRef = useRef<number | null>(null);

  const cameraRef = useRef(createInitialCamera());
  const cameraTransitionRef = useRef<{
    startX: number;
    startY: number;
    startZoom: number;
    targetX: number;
    targetY: number;
    targetZoom: number;
    startTime: number;
    durationMs: number;
  } | null>(null);
  const isCameraTransitioningRef = useRef(false);
  const [isCameraTransitioning, setIsCameraTransitioning] = useState(false);
  const lastMapSizeRef = useRef({
    width: stateRef.current.mapWidth,
    height: stateRef.current.mapHeight,
  });

  // Pan state
  const isPanningRef = useRef(false);
  const panLastRef = useRef<{ x: number; y: number } | null>(null);
  const activePointersRef = useRef(new Map<number, { sx: number; sy: number; clientX: number; clientY: number; pointerType: string }>());
  const lastPointerPinchDistRef = useRef<number | null>(null);
  const lastPointerEventAtRef = useRef(0);

  // Drag cancel state
  const dragOrigPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragOrigWiresRef = useRef<Wire[] | null>(null);
  const dragOrigInventoryRef = useRef<number>(0);
  const [isTowerDragging, setIsTowerDragging] = useState(false);
  const activeCommandCardRef = useRef<CommandCardType | null>(null);
  const activeRepairRef = useRef(false);
  const activeShopCommandPurchaseRef = useRef<{
    shopItemType: ShopItemType;
    price: number;
  } | null>(null);
  const [activeCommandCard, setActiveCommandCardState] = useState<CommandCardType | null>(null);
  const [activeRepair, setActiveRepairState] = useState(false);
  const setActiveCommandCard = (cardType: CommandCardType | null) => {
    activeCommandCardRef.current = cardType;
    if (!cardType) activeShopCommandPurchaseRef.current = null;
    if (cardType) {
      if (activeRepairRef.current) markRepairTargetBarsForFade();
      activeRepairRef.current = false;
      setActiveRepairState(false);
    }
    setActiveCommandCardState(cardType);
  };
  const setActiveRepair = (active: boolean) => {
    if (activeRepairRef.current && !active) markRepairTargetBarsForFade();
    activeRepairRef.current = active;
    if (active) setActiveCommandCard(null);
    setActiveRepairState(active);
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commandCardFailureHandledRef = useRef(false);
  const showToast = (msg: string, durationMs = 2000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), durationMs);
  };

  const renderScene = () => {
    const pending = pendingCanvasSizeRef.current;
    if (pending && canvasRef.current) {
      const c = canvasRef.current;
      if (c.width !== pending.pw) c.width = pending.pw;
      if (c.height !== pending.ph) c.height = pending.ph;
      viewportRef.current = { width: pending.w, height: pending.h };
      const cam = cameraRef.current;
      const minZoom = getMinZoom(viewportRef.current, stateRef.current);
      if (cam.zoom < minZoom) cam.zoom = minZoom;
      clampCamera(cam, viewportRef.current, stateRef.current);
      pendingCanvasSizeRef.current = null;
    }
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const state = stateRef.current;
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
      activeCommandCardRef.current,
      activeRepairRef.current,
    );
  };

  const requestRender = () => {
    if (renderRequestRef.current !== null) return;
    renderRequestRef.current = requestAnimationFrame(() => {
      renderRequestRef.current = null;
      renderScene();
    });
  };

  const sync = () => {
    setGameState({ ...stateRef.current });
    requestRender();
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
    setIsTowerDragging(false);
  };

  const [rotatingTowerId, setRotatingTowerId] = useState<string | null>(null);
  const updateRotating = (id: string | null) => { rotatingRef.current = id; setRotatingTowerId(id); };

  // 鈹€鈹€ Actions 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  const startGame = () => {
    const s = createInitialState();
    deployStartingLoadout(s);
    s.status = 'playing';
    s.gameMode = 'normal';
    s.needsPick = false;
    s.pickOptions = [];
    stateRef.current = s;
    lastMapSizeRef.current = { width: s.mapWidth, height: s.mapHeight };
    setPlaceMonsterMode(false);
    setSelectedMonsterType('grunt');
    setStaticMonster(true);
    centerCameraOnCore(s, cameraRef.current, viewportRef.current);
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
    lastMapSizeRef.current = { width: s.mapWidth, height: s.mapHeight };
    setPlaceMonsterMode(false);
    setSelectedMonsterType('grunt');
    setStaticMonster(true);
    centerCameraOnCore(s, cameraRef.current, viewportRef.current);
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
    lastMapSizeRef.current = { width: s.mapWidth, height: s.mapHeight };
    setSelectedTower(null);
    setPlaceMonsterMode(false);
    setSelectedMonsterType('grunt');
    setStaticMonster(true);
    centerCameraOnCore(s, cameraRef.current, viewportRef.current);
    sync();
  };

  const spawnStaticMonsterAt = (state: GameState, x: number, y: number) => {
    if (x < 0 || y < 0 || x > getCanvasWidth(state) || y > getCanvasHeight(state)) return false;
    spawnEnemyAt(state, selectedMonsterTypeRef.current, Math.max(1, state.wave || 1), x, y, {
      isStatic: staticMonsterRef.current,
    });
    sync();
    return true;
  };

  const handlePick = (optionId: string, sourceClientPos?: { x: number; y: number }) => {
    const state = stateRef.current;
    const option = state.pickOptions.find(o => o.id === optionId);
    if (!option) return;

    if (option.kind === 'tower' && option.towerType) {
      const sourceWorld = sourceClientPos ? clientToWorld(sourceClientPos.x, sourceClientPos.y) : null;
      for (let n = 0; n < option.count; n++) {
        if (!queueTowerDropNearCore(state, option.towerType, sourceWorld)) {
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
        state.shopRefreshCost = SHOP_CONFIG.initialRefreshCost;
      }
    }
    sync();
  };

  const forceTutorialGeneratorPick = () => {
    const state = stateRef.current;
    if (
      state.gameMode !== 'normal' ||
      state.status !== 'pick' ||
      state.pickUiPhase !== 'standard' ||
      state.wave !== 1
    ) {
      return;
    }

    const middle = state.pickOptions[1];
    if (middle?.kind === 'tower' && middle.towerType === 'generator') return;

    state.pickOptions = generateTutorialGeneratorPickOptions(state.pickOptions);
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

    if (shopItem.kind === 'command_card') {
      const commandCardType = shopItem.commandCardType;
      if (!commandCardType) return;
      setSelectedTower(null);
      updateRotating(null);
      cancelTowerDrag();
      clearWireDragState();
      setActiveRepair(false);
      activeShopCommandPurchaseRef.current = { shopItemType, price };
      activeCommandCardRef.current = commandCardType;
      setActiveCommandCardState(commandCardType);
      sync();
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
      clearPurchasedShopOffer(state, shopItemType);
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
      clearPurchasedShopOffer(state, shopItemType);
      sync();
      return;
    }
    clearPurchasedShopOffer(state, shopItemType);
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
    state.shopRefreshCost = refreshCost + SHOP_CONFIG.refreshCost;
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
    state.gold += getTowerSellPrice(tower);
    updateRotating(null);
    sync();
  };

  const canRepairTower = (tower: GameState['towers'][number] | null) =>
    Boolean(tower && tower.type !== 'core' && (tower.isRuined || tower.hp < tower.maxHp));

  const repairTowerAtWorld = (wx: number, wy: number) => {
    const state = stateRef.current;
    if (state.status !== 'playing') return false;
    if (wx < 0 || wy < 0 || wx > getCanvasWidth(state) || wy > getCanvasHeight(state)) {
      showToast(t().repairCannotUse);
      setActiveRepair(false);
      sync();
      return false;
    }

    const tower = findTowerAtWorldPoint(state, wx, wy);
    if (!canRepairTower(tower)) {
      showToast(t().repairCannotUse);
      setActiveRepair(false);
      sync();
      return false;
    }

    const cost = SHOP_CONFIG.repairCost;
    if (state.gameMode !== 'custom' && state.gold < cost) {
      showToast(t().notEnoughGold);
      setActiveRepair(false);
      sync();
      return false;
    }

    if (state.gameMode !== 'custom') state.gold -= cost;
    tower!.isRuined = false;
    tower!.hp = tower!.maxHp;
    tower!.shieldHp = tower!.maxShieldHp;
    tower!.lastDamagedAt = performance.now();
    if (!syncDirectPortLinks(state, { towerId: tower!.id, createSpark: true })) {
      updatePowerGrid(state);
    }
    updateRotating(null);
    setActiveRepair(false);
    sync();
    return true;
  };

  const skipToNextWave = () => {
    const state = stateRef.current;
    if (startNextWave(state)) sync();
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
    setIsTowerDragging(false);
    requestRender();
  };

  const clearWireDragState = () => {
    dragWireStartRef.current = null;
    dragWirePathRef.current = null;
    requestRender();
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
  const markPointerInput = () => {
    lastPointerEventAtRef.current = performance.now();
  };

  const shouldIgnoreLegacyInput = () => performance.now() - lastPointerEventAtRef.current < 800;

  const pointerScreenXY = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return r ? { sx: e.clientX - r.left, sy: e.clientY - r.top } : null;
  };

  const getPointerHitOptions = (pointerType: string) => ({
    wireHitRadius: pointerType === 'mouse' ? 11 : 18,
    touchPadding: pointerType === 'mouse' ? undefined : 8,
    panWhenNotPlaying: pointerType === 'mouse' ? 'pick' as const : 'always' as const,
  });

  const getPointerPinch = () => {
    const points = Array.from(activePointersRef.current.values());
    if (points.length < 2) return null;
    const [a, b] = points;
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return {
      dist: Math.hypot(dx, dy),
      sx: (a.sx + b.sx) / 2,
      sy: (a.sy + b.sy) / 2,
    };
  };

  const toWorld = (sx: number, sy: number) => {
    return screenToWorld(cameraRef.current, sx, sy);
  };

  const clientToWorld = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return toWorld(clientX - rect.left, clientY - rect.top);
  };

  const applyCommandCardAtWorld = (
    cardType: CommandCardType,
    wx: number,
    wy: number,
    options: { requireInventory?: boolean; consumeInventory?: boolean } = {},
  ) => {
    const requireInventory = options.requireInventory ?? true;
    const consumeInventory = options.consumeInventory ?? true;
    const state = stateRef.current;
    if (state.status !== 'playing') return false;
    if (requireInventory && (state.commandCardInventory[cardType] ?? 0) <= 0) return false;
    if (wx < 0 || wy < 0 || wx > getCanvasWidth(state) || wy > getCanvasHeight(state)) return false;

    const targetTower = findTowerAtWorldPoint(state, wx, wy);
    if (!canApplyMachineCommandCard(state, cardType, targetTower)) {
      commandCardFailureHandledRef.current = true;
      showToast(t().commandCardMachineMaxed);
      return false;
    }

    const used = applyMachineCommandCard(state, cardType, targetTower);
    if (!used) return false;
    if (targetTower && targetTower.type !== 'core' && isMachineCommandCard(cardType)) {
      targetTower.commandUpgradeCount = (targetTower.commandUpgradeCount ?? 0) + 1;
    }
    if (consumeInventory && state.gameMode !== 'custom') {
      state.commandCardInventory[cardType] = Math.max(0, (state.commandCardInventory[cardType] ?? 0) - 1);
    }
    sync();
    return true;
  };

  const startCommandCardUse = (cardType: CommandCardType) => {
    if (stateRef.current.status !== 'playing' || (stateRef.current.commandCardInventory[cardType] ?? 0) <= 0) return;
    setSelectedTower(null);
    updateRotating(null);
    cancelTowerDrag();
    clearWireDragState();
    setActiveCommandCard(activeCommandCardRef.current === cardType ? null : cardType);
  };

  const startRepair = () => {
    const state = stateRef.current;
    if (state.status !== 'playing') return;
    if (state.gameMode !== 'custom' && state.gold < SHOP_CONFIG.repairCost) {
      showToast(t().notEnoughGold);
      return;
    }
    setSelectedTower(null);
    updateRotating(null);
    cancelTowerDrag();
    clearWireDragState();
    setActiveRepair(!activeRepairRef.current);
  };

  const commitActiveCommandCardAtWorld = (wx: number, wy: number) => {
    const cardType = activeCommandCardRef.current;
    if (!cardType) return false;
    const pendingShopPurchase = activeShopCommandPurchaseRef.current;
    const state = stateRef.current;

    if (pendingShopPurchase && state.gold < pendingShopPurchase.price) {
      showToast(t().notEnoughGold);
      setActiveCommandCard(null);
      sync();
      return true;
    }

    commandCardFailureHandledRef.current = false;
    if (applyCommandCardAtWorld(cardType, wx, wy, {
      requireInventory: !pendingShopPurchase,
      consumeInventory: !pendingShopPurchase,
    })) {
      if (pendingShopPurchase) {
        state.gold -= pendingShopPurchase.price;
        clearPurchasedShopOffer(state, pendingShopPurchase.shopItemType);
      }
      setActiveCommandCard(null);
      sync();
      return true;
    }

    if (!commandCardFailureHandledRef.current) showToast(t().commandCardCannotUse);
    setActiveCommandCard(null);
    sync();
    return true;
  };

  const startPanning = (sx: number, sy: number) => {
    isPanningRef.current = true;
    panLastRef.current = { x: sx, y: sy };
    requestRender();
  };

  const handlePrimaryPointerDown = (
    sx: number,
    sy: number,
    options: { wireHitRadius: number; touchPadding?: number; panWhenNotPlaying: 'pick' | 'always' },
  ) => {
    if (isCameraTransitioningRef.current) return;
    const state = stateRef.current;

    if (state.status !== 'playing') {
      if (options.panWhenNotPlaying === 'always' || state.status === 'pick') startPanning(sx, sy);
      return;
    }

    const { wx, wy } = toWorld(sx, sy);
    mouseDownPosRef.current = { x: wx, y: wy };
    mousePxRef.current = { x: wx, y: wy };

    if (activeCommandCardRef.current) {
      commitActiveCommandCardAtWorld(wx, wy);
      return;
    }

    if (activeRepairRef.current) {
      repairTowerAtWorld(wx, wy);
      return;
    }

    if (placeMonsterModeRef.current) {
      if (spawnStaticMonsterAt(state, wx, wy)) {
        updateRotating(null);
        setSelectedTower(null);
      }
      return;
    }

    const rotatingControl = hitRotatingControl(state, rotatingRef.current, wx, wy, options.touchPadding ?? 0);
    if (rotatingControl === 'delete' && rotatingRef.current) {
      sellTower(rotatingRef.current);
      return;
    }
    if (rotatingControl === 'rotate' && rotatingRef.current) {
      rotateTowerQuarterTurn(state, rotatingRef.current);
      isRotKnobRef.current = true;
      sync();
      return;
    }

    const wireDrag = startWireDragAt(state, wx, wy, options.wireHitRadius);
    if (wireDrag.kind === 'direct_wire') return;
    if (wireDrag.kind === 'no_wires') {
      showToast(t().noWires);
      return;
    }
    if (wireDrag.kind === 'inaccessible') return;
    if (wireDrag.kind === 'started') {
      dragWireStartRef.current = wireDrag.dragStart;
      if (wireDrag.removedWire) sync();
      return;
    }

    const towerDrag = startTowerDragAt(state, wx, wy);
    if (towerDrag.kind === 'core') {
      showToast(t().coreCannotMove);
      return;
    }
    if (towerDrag.kind === 'tower') {
      dragTowerRef.current = towerDrag.towerId;
      dragOrigPosRef.current = towerDrag.originalPos;
      dragOrigWiresRef.current = towerDrag.connectedWires;
      dragOrigInventoryRef.current = towerDrag.wireInventory;
      setIsTowerDragging(true);
      return;
    }

    const { x: gx, y: gy } = getGridCell(wx, wy);
    const selectedType = selectedTowerRef.current;
    if (selectedType && placeTowerFromSelection(state, selectedType, gx, gy)) return;

    setSelectedTower(null);
    updateRotating(null);
    startPanning(sx, sy);
  };

  const finishPrimaryPointer = (
    pointer: { x: number; y: number } | null,
    wireHitRadius: number,
    clearRotatingOnEmpty: boolean,
  ) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panLastRef.current = null;
      requestRender();
      return;
    }

    if (isRotKnobRef.current) {
      isRotKnobRef.current = false;
      mouseDownPosRef.current = null;
      return;
    }

    const state = stateRef.current;

    if (dragTowerRef.current) {
      const dragStart = mouseDownPosRef.current;
      if (dragStart && pointer && Math.hypot(pointer.x - dragStart.x, pointer.y - dragStart.y) < 5) {
        updateRotating(rotatingRef.current === dragTowerRef.current ? null : dragTowerRef.current);
      }
      clearTowerDragState();
    } else if (clearRotatingOnEmpty && pointer && !dragWireStartRef.current) {
      if (!findTowerAtWorldPoint(state, pointer.x, pointer.y)) updateRotating(null);
    }

    if (dragWireStartRef.current && mousePxRef.current) {
      commitWireDrag(state, mousePxRef.current, wireHitRadius);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (shouldIgnoreLegacyInput()) return;
    if (isCameraTransitioningRef.current) return;
    const spos = canvasScreenXY(e);
    if (!spos) return;
    const { sx, sy } = spos;

    if (e.button === 2) {
      startPanning(sx, sy);
      return;
    }

    handlePrimaryPointerDown(sx, sy, { wireHitRadius: 11, panWhenNotPlaying: 'pick' });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (shouldIgnoreLegacyInput()) return;
    if (isCameraTransitioningRef.current) return;
    const spos = canvasScreenXY(e);
    if (!spos) return;
    const { sx, sy } = spos;

    // Panning
    if (isPanningRef.current && panLastRef.current) {
      const cam = cameraRef.current;
      cam.x -= (sx - panLastRef.current.x) / cam.zoom;
      cam.y -= (sy - panLastRef.current.y) / cam.zoom;
      clampCamera(cam, viewportRef.current, stateRef.current);
      panLastRef.current = { x: sx, y: sy };
      requestRender();
      return;
    }

    const state = stateRef.current;
    if (state.status !== 'playing') return;
    const { wx, wy } = toWorld(sx, sy);
    mousePxRef.current = { x: wx, y: wy };

    hoverRef.current = getHoverCell(state, wx, wy);

    if (dragWireStartRef.current) {
      dragWirePathRef.current = previewWirePath(state, dragWireStartRef.current, wx, wy, 15);
    }
    requestRender();

    if (dragTowerRef.current && moveDraggedTower(state, dragTowerRef.current, wx, wy)) {
      sync();
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (shouldIgnoreLegacyInput()) return;
    if (isCameraTransitioningRef.current) return;
    const spos = canvasScreenXY(e);
    const world = spos ? toWorld(spos.sx, spos.sy) : null;
    finishPrimaryPointer(world ? { x: world.wx, y: world.wy } : null, 15, true);
  };

  const handleCanvasMouseLeave = () => {
    hoverRef.current = null;
    // Restore tower + wires if dragging
    cancelTowerDrag();
    clearWireDragState();
    isRotKnobRef.current = false;
    isPanningRef.current = false;
    panLastRef.current = null;
    activePointersRef.current.clear();
    lastPointerPinchDistRef.current = null;
    requestRender();
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    markPointerInput();
    e.preventDefault();
    if (isCameraTransitioningRef.current) return;
    const spos = pointerScreenXY(e);
    if (!spos) return;

    e.currentTarget.setPointerCapture?.(e.pointerId);
    activePointersRef.current.set(e.pointerId, {
      ...spos,
      clientX: e.clientX,
      clientY: e.clientY,
      pointerType: e.pointerType,
    });

    if (activePointersRef.current.size >= 2) {
      cancelTowerDrag();
      clearWireDragState();
      isRotKnobRef.current = false;
      isPanningRef.current = false;
      panLastRef.current = null;
      mouseDownPosRef.current = null;
      const pinch = getPointerPinch();
      lastPointerPinchDistRef.current = pinch?.dist ?? null;
      return;
    }

    if (e.button === 2) {
      startPanning(spos.sx, spos.sy);
      return;
    }

    handlePrimaryPointerDown(spos.sx, spos.sy, getPointerHitOptions(e.pointerType));
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    markPointerInput();
    e.preventDefault();
    if (isCameraTransitioningRef.current) return;
    const spos = pointerScreenXY(e);
    if (!spos) return;

    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, {
        ...spos,
        clientX: e.clientX,
        clientY: e.clientY,
        pointerType: e.pointerType,
      });
    }

    const pinch = getPointerPinch();
    if (pinch) {
      const cam = cameraRef.current;
      const previousDist = lastPointerPinchDistRef.current ?? pinch.dist;
      const wx = pinch.sx / cam.zoom + cam.x;
      const wy = pinch.sy / cam.zoom + cam.y;
      const factor = previousDist > 0 ? pinch.dist / previousDist : 1;
      const minZoom = getMinZoom(viewportRef.current, stateRef.current);
      cam.zoom = Math.max(minZoom, Math.min(MAX_ZOOM, cam.zoom * factor));
      cam.x = wx - pinch.sx / cam.zoom;
      cam.y = wy - pinch.sy / cam.zoom;
      clampCamera(cam, viewportRef.current, stateRef.current);
      lastPointerPinchDistRef.current = pinch.dist;
      requestRender();
      return;
    }

    lastPointerPinchDistRef.current = null;

    if (isPanningRef.current && panLastRef.current) {
      const cam = cameraRef.current;
      cam.x -= (spos.sx - panLastRef.current.x) / cam.zoom;
      cam.y -= (spos.sy - panLastRef.current.y) / cam.zoom;
      clampCamera(cam, viewportRef.current, stateRef.current);
      panLastRef.current = { x: spos.sx, y: spos.sy };
      requestRender();
      return;
    }

    const state = stateRef.current;
    if (state.status !== 'playing') return;
    const { wx, wy } = toWorld(spos.sx, spos.sy);
    mousePxRef.current = { x: wx, y: wy };

    hoverRef.current = getHoverCell(state, wx, wy);

    if (dragWireStartRef.current) {
      dragWirePathRef.current = previewWirePath(state, dragWireStartRef.current, wx, wy, e.pointerType === 'mouse' ? 15 : 20);
    }
    requestRender();

    if (dragTowerRef.current && moveDraggedTower(state, dragTowerRef.current, wx, wy)) {
      sync();
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    markPointerInput();
    e.preventDefault();
    if (isCameraTransitioningRef.current) return;

    const wasPinching = lastPointerPinchDistRef.current !== null || activePointersRef.current.size > 1;
    activePointersRef.current.delete(e.pointerId);
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    if (wasPinching) {
      if (activePointersRef.current.size < 2) lastPointerPinchDistRef.current = null;
      return;
    }

    const spos = pointerScreenXY(e);
    const world = spos ? toWorld(spos.sx, spos.sy) : null;
    finishPrimaryPointer(
      world ? { x: world.wx, y: world.wy } : mousePxRef.current,
      e.pointerType === 'mouse' ? 15 : 20,
      e.pointerType === 'mouse',
    );
  };

  const handleCanvasPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    markPointerInput();
    e.preventDefault();
    activePointersRef.current.delete(e.pointerId);
    lastPointerPinchDistRef.current = null;
    handleCanvasMouseLeave();
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (isCameraTransitioningRef.current) return;
    const spos = canvasScreenXY(e as unknown as React.MouseEvent<HTMLCanvasElement>);
    if (!spos) return;
    const { sx, sy } = spos;
    const cam = cameraRef.current;

    // World point under cursor before zoom
    const wx = sx / cam.zoom + cam.x;
    const wy = sy / cam.zoom + cam.y;

    // Adjust zoom
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const minZoom = getMinZoom(viewportRef.current, stateRef.current);
    cam.zoom = Math.max(minZoom, Math.min(MAX_ZOOM, cam.zoom * factor));

    // Keep world point under cursor after zoom
    cam.x = wx - sx / cam.zoom;
    cam.y = wy - sy / cam.zoom;
    clampCamera(cam, viewportRef.current, stateRef.current);
    requestRender();
  };

  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  };

  // 鈹€鈹€ Touch support 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  const lastPinchDistRef = useRef<number | null>(null);

  const clearInteractionStateForCameraMove = () => {
    hoverRef.current = null;
    cancelTowerDrag();
    clearWireDragState();
    isRotKnobRef.current = false;
    isPanningRef.current = false;
    panLastRef.current = null;
    lastPinchDistRef.current = null;
    activePointersRef.current.clear();
    lastPointerPinchDistRef.current = null;
    requestRender();
  };

  const focusCameraOnWorld = useCallback((
    target: { x: number; y: number; zoom?: number },
    durationMs = 650,
    anchor: { x: number; y: number } = { x: 0.5, y: 0.5 },
  ) => {
    const cam = cameraRef.current;
    const state = stateRef.current;
    const viewport = viewportRef.current;
    const minZoom = getMinZoom(viewport, state);
    const targetZoom = Math.max(minZoom, Math.min(MAX_ZOOM, target.zoom ?? Math.max(minZoom, Math.min(MAX_ZOOM, 1))));
    const next = {
      x: target.x - (viewport.width / targetZoom) * anchor.x,
      y: target.y - (viewport.height / targetZoom) * anchor.y,
      zoom: targetZoom,
    };
    clampCamera(next, viewport, state);

    if (
      Math.hypot(cam.x - next.x, cam.y - next.y) < 1 &&
      Math.abs(cam.zoom - next.zoom) < 0.005
    ) {
      requestRender();
      return;
    }

    clearInteractionStateForCameraMove();
    cameraTransitionRef.current = {
      startX: cam.x,
      startY: cam.y,
      startZoom: cam.zoom,
      targetX: next.x,
      targetY: next.y,
      targetZoom: next.zoom,
      startTime: performance.now(),
      durationMs,
    };
    isCameraTransitioningRef.current = true;
    setIsCameraTransitioning(true);
    requestRender();
  }, []);

  const touchScreenXY = (touch: React.Touch) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return r ? { sx: touch.clientX - r.left, sy: touch.clientY - r.top } : null;
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (shouldIgnoreLegacyInput()) return;
    e.preventDefault();
    if (isCameraTransitioningRef.current) return;
    if (e.touches.length === 2) {
      // Start pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistRef.current = Math.hypot(dx, dy);
      isPanningRef.current = false;
      requestRender();
      return;
    }
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const spos = touchScreenXY(touch);
    if (!spos) return;
    handlePrimaryPointerDown(spos.sx, spos.sy, {
      wireHitRadius: 18,
      touchPadding: 8,
      panWhenNotPlaying: 'always',
    });
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (shouldIgnoreLegacyInput()) return;
    e.preventDefault();
    if (isCameraTransitioningRef.current) return;
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
        const minZoom = getMinZoom(viewportRef.current, stateRef.current);
        cam.zoom = Math.max(minZoom, Math.min(MAX_ZOOM, cam.zoom * factor));
        cam.x = wx - mx / cam.zoom;
        cam.y = wy - my / cam.zoom;
        clampCamera(cam, viewportRef.current, stateRef.current);
      }
      lastPinchDistRef.current = dist;
      requestRender();
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
      clampCamera(cam, viewportRef.current, stateRef.current);
      panLastRef.current = { x: sx, y: sy };
      requestRender();
      return;
    }

    const state = stateRef.current;
    if (state.status !== 'playing') return;
    const { wx, wy } = toWorld(sx, sy);
    mousePxRef.current = { x: wx, y: wy };

    hoverRef.current = getHoverCell(state, wx, wy);

    if (dragWireStartRef.current) {
      dragWirePathRef.current = previewWirePath(state, dragWireStartRef.current, wx, wy, 20);
    }
    requestRender();

    if (dragTowerRef.current && moveDraggedTower(state, dragTowerRef.current, wx, wy)) {
      sync();
    }
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (shouldIgnoreLegacyInput()) return;
    e.preventDefault();
    if (isCameraTransitioningRef.current) return;
    // End pinch
    if (lastPinchDistRef.current !== null && e.touches.length < 2) {
      lastPinchDistRef.current = null;
      return;
    }

    const touch = e.changedTouches[0];
    const spos = touch ? touchScreenXY(touch) : null;
    const world = spos ? toWorld(spos.sx, spos.sy) : null;
    finishPrimaryPointer(world ? { x: world.wx, y: world.wy } : mousePxRef.current, 20, false);
  };

  // 鈹€鈹€ Game loop 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  const gameLoop = useCallback((time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const dt = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;
    const state = stateRef.current;

    const cameraTransition = cameraTransitionRef.current;
    if (cameraTransition) {
      const t = Math.min(1, (time - cameraTransition.startTime) / cameraTransition.durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const cam = cameraRef.current;
      cam.x = cameraTransition.startX + (cameraTransition.targetX - cameraTransition.startX) * eased;
      cam.y = cameraTransition.startY + (cameraTransition.targetY - cameraTransition.startY) * eased;
      cam.zoom = cameraTransition.startZoom + (cameraTransition.targetZoom - cameraTransition.startZoom) * eased;
      clampCamera(cam, viewportRef.current, state);
      if (t >= 1) {
        cam.x = cameraTransition.targetX;
        cam.y = cameraTransition.targetY;
        cam.zoom = cameraTransition.targetZoom;
        clampCamera(cam, viewportRef.current, state);
        cameraTransitionRef.current = null;
        isCameraTransitioningRef.current = false;
        setIsCameraTransitioning(false);
      }
    }

    if (state.status === 'playing' && updateGameState(state, dt)) {
      sync();
    }

    const previousMapSize = lastMapSizeRef.current;
    if (state.mapWidth !== previousMapSize.width || state.mapHeight !== previousMapSize.height) {
      cameraRef.current.x += ((state.mapWidth - previousMapSize.width) * GLOBAL_CONFIG.cellSize) / 2;
      cameraRef.current.y += ((state.mapHeight - previousMapSize.height) * GLOBAL_CONFIG.cellSize) / 2;
      lastMapSizeRef.current = { width: state.mapWidth, height: state.mapHeight };
      const minZoom = getMinZoom(viewportRef.current, state);
      if (cameraRef.current.zoom < minZoom) cameraRef.current.zoom = minZoom;
      clampCamera(cameraRef.current, viewportRef.current, state);
    }

    // 鈹€鈹€ Render 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
    renderScene();

    requestAnimationFrame(gameLoop);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(id);
      if (renderRequestRef.current !== null) cancelAnimationFrame(renderRequestRef.current);
    };
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
      const minZoom = getMinZoom(viewportRef.current, stateRef.current);
      if (cam.zoom < minZoom) cam.zoom = minZoom;
      clampCamera(cam, viewportRef.current, stateRef.current);
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
    centerCameraOnCore(stateRef.current, cameraRef.current, viewportRef.current);
    const deferredResize = () => updateCanvasSize();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(deferredResize);
    ro?.observe(canvas);
    window.addEventListener('resize', deferredResize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', deferredResize);
    };
  }, []);

  // 鈹€鈹€ Keyboard shortcuts 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isCameraTransitioningRef.current) return;
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
          if (tower && !tower.isRuined) {
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveCommandCard(null);
        setActiveRepair(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return {
    canvasRef, cameraRef, gameState, startGame, startCustomGame, togglePause, returnToMenu, handlePick,
    forceTutorialGeneratorPick,
    focusCameraOnWorld, isCameraTransitioning,
    openCustomPick, buyShopPack, refreshShopOffers, sellTower, rotatingTowerId,
    startCommandCardUse, activeCommandCard, startRepair, activeRepair,
    selectedTower, setSelectedTower, placeMonsterMode, setPlaceMonsterMode, skipToNextWave, toastMessage,
    selectedMonsterType, setSelectedMonsterType, staticMonster, setStaticMonster,
    isTowerDragging,
    handleCanvasPointerDown, handleCanvasPointerMove, handleCanvasPointerUp, handleCanvasPointerCancel,
    handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasMouseLeave,
    handleCanvasWheel, handleCanvasContextMenu,
    handleCanvasTouchStart, handleCanvasTouchMove, handleCanvasTouchEnd,
  };
};

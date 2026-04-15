import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameState, TowerType, CommandCardType, ShopItemType, ShopPackType, Port, Wire, CELL_SIZE, EnemyType,
  TOWER_STATS, CANVAS_WIDTH, CANVAS_HEIGHT, WIRE_MAX_HP,
  VIEWPORT_WIDTH, VIEWPORT_HEIGHT,
} from './types';
import {
  createInitialState, updatePowerGrid, getPortPos, getPortCell, findWirePath,
  snapRotation, applyTowerRotation, canPlace, genId, generatePickOptions, spawnEnemyAt,
  canDirectLinkPorts, isPortAccessible,
  generateTowerOnlyPickOptions, generateInfraOnlyPickOptions, rebuildTowerMap,
  generateAdvancedPickOptions, generateCommandCardPickOptions, generateBaseUpgradePickOptions, generateShopOffers,
} from './engine';
import { renderGame } from './renderer';
import { COMMAND_CARD_CONFIG, GLOBAL_CONFIG, SHOP_CONFIG, SHOP_ITEM_CONFIG } from './config';
import { t } from './i18n';
import { addTowerToState, createTowerAt } from './towerFactory';
import { findAutoPlacementNearCore } from './placement';
import { startNextWave, updateGameState } from './updateGameState';
import { getDeleteButtonLayout, getRotationKnobLayout } from './render/towers';
import { isWorldPointInTowerFootprint } from './footprint';
import { isMachineCommandCard } from './commandCards';
import { centerCameraOnCore, clampCamera, createInitialCamera, getMinZoom, screenToWorld } from './camera';
import {
  applyBaseUpgradeToCore,
  applyMachineCommandCard,
  canApplyMachineCommandCard,
  clearPurchasedShopOffer,
  deployStartingLoadout,
  findTowerAtWorldPoint,
} from './gameActions';
import { getGridCell, getHoverCell, moveDraggedTower, previewWirePath } from './pointerActions';

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

  const cameraRef = useRef(createInitialCamera());

  // Pan state
  const isPanningRef = useRef(false);
  const panLastRef = useRef<{ x: number; y: number } | null>(null);

  // Drag cancel state
  const dragOrigPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragOrigWiresRef = useRef<Wire[] | null>(null);
  const dragOrigInventoryRef = useRef<number>(0);
  const activeCommandCardRef = useRef<CommandCardType | null>(null);
  const activeShopCommandPurchaseRef = useRef<{
    shopItemType: ShopItemType;
    price: number;
  } | null>(null);
  const [activeCommandCard, setActiveCommandCardState] = useState<CommandCardType | null>(null);
  const setActiveCommandCard = (cardType: CommandCardType | null) => {
    activeCommandCardRef.current = cardType;
    if (!cardType) activeShopCommandPurchaseRef.current = null;
    setActiveCommandCardState(cardType);
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commandCardFailureHandledRef = useRef(false);
  const showToast = (msg: string, durationMs = 2000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), durationMs);
  };

  const sync = () => setGameState({ ...stateRef.current });

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
    setSelectedTower(null);
    setPlaceMonsterMode(false);
    setSelectedMonsterType('grunt');
    setStaticMonster(true);
    centerCameraOnCore(s, cameraRef.current, viewportRef.current);
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
        state.shopRefreshCost = SHOP_CONFIG.initialRefreshCost;
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

    if (shopItem.kind === 'command_card') {
      const commandCardType = shopItem.commandCardType;
      if (!commandCardType) return;
      setSelectedTower(null);
      updateRotating(null);
      cancelTowerDrag();
      clearWireDragState();
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
    state.shopRefreshCost = SHOP_CONFIG.refreshCost;
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
    if (wx < 0 || wy < 0 || wx > CANVAS_WIDTH || wy > CANVAS_HEIGHT) return false;

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
    return true;
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

    if (activeCommandCardRef.current) {
      commitActiveCommandCardAtWorld(wx, wy);
      return;
    }

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
    const { x: gx, y: gy } = getGridCell(wx, wy);
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
      clampCamera(cam, viewportRef.current);
      panLastRef.current = { x: sx, y: sy };
      return;
    }

    const state = stateRef.current;
    if (state.status !== 'playing') return;
    const { wx, wy } = toWorld(sx, sy);
    mousePxRef.current = { x: wx, y: wy };

    hoverRef.current = getHoverCell(wx, wy);

    if (dragWireStartRef.current) {
      dragWirePathRef.current = previewWirePath(state, dragWireStartRef.current, wx, wy, 15);
    }

    if (dragTowerRef.current && moveDraggedTower(state, dragTowerRef.current, wx, wy)) {
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
    const minZoom = getMinZoom(viewportRef.current);
    cam.zoom = Math.max(minZoom, Math.min(MAX_ZOOM, cam.zoom * factor));

    // Keep world point under cursor after zoom
    cam.x = wx - sx / cam.zoom;
    cam.y = wy - sy / cam.zoom;
    clampCamera(cam, viewportRef.current);
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

    if (activeCommandCardRef.current) {
      commitActiveCommandCardAtWorld(wx, wy);
      return;
    }

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
    const { x: gx, y: gy } = getGridCell(wx, wy);
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
        const minZoom = getMinZoom(viewportRef.current);
        cam.zoom = Math.max(minZoom, Math.min(MAX_ZOOM, cam.zoom * factor));
        cam.x = wx - mx / cam.zoom;
        cam.y = wy - my / cam.zoom;
        clampCamera(cam, viewportRef.current);
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
      clampCamera(cam, viewportRef.current);
      panLastRef.current = { x: sx, y: sy };
      return;
    }

    const state = stateRef.current;
    if (state.status !== 'playing') return;
    const { wx, wy } = toWorld(sx, sy);
    mousePxRef.current = { x: wx, y: wy };

    hoverRef.current = getHoverCell(wx, wy);

    if (dragWireStartRef.current) {
      dragWirePathRef.current = previewWirePath(state, dragWireStartRef.current, wx, wy, 20);
    }

    if (dragTowerRef.current && moveDraggedTower(state, dragTowerRef.current, wx, wy)) {
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
      const minZoom = getMinZoom(viewportRef.current);
      if (cam.zoom < minZoom) cam.zoom = minZoom;
      clampCamera(cam, viewportRef.current);
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
        activeCommandCardRef.current,
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
      const minZoom = getMinZoom(viewportRef.current);
      if (cam.zoom < minZoom) cam.zoom = minZoom;
      clampCamera(cam, viewportRef.current);
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveCommandCard(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return {
    canvasRef, cameraRef, gameState, startGame, startCustomGame, togglePause, returnToMenu, handlePick,
    openCustomPick, buyShopPack, refreshShopOffers, sellTower, rotatingTowerId,
    startCommandCardUse, activeCommandCard,
    selectedTower, setSelectedTower, placeMonsterMode, setPlaceMonsterMode, skipToNextWave, toastMessage,
    selectedMonsterType, setSelectedMonsterType, staticMonster, setStaticMonster,
    handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasMouseLeave,
    handleCanvasWheel, handleCanvasContextMenu,
    handleCanvasTouchStart, handleCanvasTouchMove, handleCanvasTouchEnd,
  };
};

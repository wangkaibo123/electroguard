import { addTowerToState, createTowerAt } from './towerFactory';
import { BASE_UPGRADE_CONFIG, COMMAND_CARD_CONFIG } from './config';
import { findAutoPlacementNearCore } from './placement';
import { isWorldPointInTowerFootprint } from './footprint';
import { MAX_MACHINE_COMMAND_UPGRADES, isMachineCommandCard } from './commandCards';
import {
  genId,
  isPortAccessible,
  syncDirectPortLinks,
  updatePowerGrid,
} from './engine';
import type { BaseUpgradeType, CommandCardType, GameState, PortDirection, ShopItemType, TowerType } from './types';
import { CELL_SIZE, TOWER_STATS, getTowerRange } from './types';

const PORT_DIRECTIONS: PortDirection[] = ['top', 'right', 'bottom', 'left'];

export const deployStartingLoadout = (state: GameState) => {
  const starterTowers: TowerType[] = ['generator', 'blaster'];

  for (const type of starterTowers) {
    const placement = findAutoPlacementNearCore(state, type, 2, 1);
    if (!placement) continue;
    addTowerToState(state, createTowerAt(type, placement.x, placement.y));
  }
};

export const queueTowerDropNearCore = (
  state: GameState,
  type: TowerType,
  sourceWorld?: { wx: number; wy: number } | null,
) => {
  const placement = findAutoPlacementNearCore(state, type, 2, 1);
  if (!placement) return false;

  const stats = TOWER_STATS[type];
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

export const applyBaseUpgradeToCore = (state: GameState, upgradeType: BaseUpgradeType) => {
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

export const clearPurchasedShopOffer = (state: GameState, shopItemType: ShopItemType) => {
  const offers = state.shopOffers ?? [];
  const purchasedIndex = offers.indexOf(shopItemType);
  if (purchasedIndex < 0) return;

  const nextOffers = [...offers];
  nextOffers[purchasedIndex] = null;
  state.shopOffers = nextOffers;
};

export const findTowerAtWorldPoint = (state: GameState, wx: number, wy: number) => {
  for (const tower of state.towers) {
    if (isWorldPointInTowerFootprint(tower, wx, wy)) return tower;
  }
  return null;
};

export const addMachinePort = (state: GameState, tower: GameState['towers'][number], portType: 'input' | 'output') => {
  if (tower.type === 'core' || tower.isRuined) return false;
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

export const canApplyMachineCommandCard = (
  state: GameState,
  cardType: CommandCardType,
  targetTower: GameState['towers'][number] | null,
) =>
  !(
    isMachineCommandCard(cardType) &&
    targetTower &&
    targetTower.type !== 'core' &&
    !targetTower.isRuined &&
    (targetTower.commandUpgradeCount ?? 0) >= MAX_MACHINE_COMMAND_UPGRADES
  );

export const applyMachineCommandCard = (
  state: GameState,
  cardType: CommandCardType,
  targetTower: GameState['towers'][number] | null,
) => {
  if (cardType === 'add_input' || cardType === 'add_output') {
    if (!targetTower || targetTower.type === 'core' || targetTower.isRuined) return false;
    return addMachinePort(state, targetTower, cardType === 'add_input' ? 'input' : 'output');
  }
  if (cardType === 'self_power') {
    if (!targetTower || targetTower.type === 'core' || targetTower.isRuined) return false;
    targetTower.selfPowerLevel = (targetTower.selfPowerLevel ?? 0) + 1;
    targetTower.selfPowerTimer = 0;
    updatePowerGrid(state);
    return true;
  }
  if (cardType === 'range_boost') {
    if (!targetTower || targetTower.type === 'core' || targetTower.isRuined || getTowerRange(targetTower) == null) return false;
    targetTower.rangeMultiplier = (targetTower.rangeMultiplier ?? 1) + (COMMAND_CARD_CONFIG.range_boost.rangeBoostMultiplier ?? 0.2);
    return true;
  }

  return false;
};

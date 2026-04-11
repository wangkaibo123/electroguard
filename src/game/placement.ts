import { GameState, GRID_HEIGHT, GRID_WIDTH, TOWER_STATS, TowerType } from './types';
import { collidesWithTowers, collidesWithWires } from './engine';
import { footprintsOverlap } from './footprint';

export const canPlaceTowerAt = (
  state: GameState,
  type: TowerType,
  x: number,
  y: number,
  ignoreDropId?: string,
  clearance = 0,
) => {
  const stats = TOWER_STATS[type];

  if (x < 0 || y < 0 || x + stats.width > GRID_WIDTH || y + stats.height > GRID_HEIGHT) {
    return false;
  }

  for (const drop of state.incomingDrops) {
    if (drop.id === ignoreDropId) continue;
    const dropStats = TOWER_STATS[drop.towerType];
    if (footprintsOverlap(
      { x, y, width: stats.width, height: stats.height, type },
      { x: drop.targetGridX, y: drop.targetGridY, width: dropStats.width, height: dropStats.height, type: drop.towerType },
      clearance,
    )) {
      return false;
    }
  }

  return (
    !collidesWithTowers(x, y, stats.width, stats.height, state.towers, undefined, clearance, type) &&
    !collidesWithWires(x, y, stats.width, stats.height, state.wires, undefined, clearance, type)
  );
};

const getTowerGapFromCore = (
  core: GameState['towers'][number],
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const gapX = Math.max(core.x - (x + width), x - (core.x + core.width), 0);
  const gapY = Math.max(core.y - (y + height), y - (core.y + core.height), 0);
  return Math.max(gapX, gapY);
};

export const findAutoPlacementNearCore = (
  state: GameState,
  type: TowerType,
  minGapFromCore = 0,
  clearance = 0,
) => {
  const core = state.towers.find((tower) => tower.type === 'core');
  if (!core) return null;

  const stats = TOWER_STATS[type];
  const coreCx = core.x + core.width / 2;
  const coreCy = core.y + core.height / 2;
  const candidates: { x: number; y: number; distance: number }[] = [];

  for (let y = 0; y <= GRID_HEIGHT - stats.height; y++) {
    for (let x = 0; x <= GRID_WIDTH - stats.width; x++) {
      if (!canPlaceTowerAt(state, type, x, y, undefined, clearance)) continue;
      if (getTowerGapFromCore(core, x, y, stats.width, stats.height) < minGapFromCore) continue;
      const towerCx = x + stats.width / 2;
      const towerCy = y + stats.height / 2;
      candidates.push({
        x,
        y,
        distance: Math.hypot(towerCx - coreCx, towerCy - coreCy),
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.distance - b.distance);
  const nearCount = Math.min(12, candidates.length);
  return candidates[(Math.random() * nearCount) | 0];
};

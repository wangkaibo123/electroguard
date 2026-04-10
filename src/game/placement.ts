import { GameState, GRID_HEIGHT, GRID_WIDTH, TOWER_STATS, TowerType } from './types';
import { collidesWithTowers, collidesWithWires } from './engine';

export const canPlaceTowerAt = (
  state: GameState,
  type: TowerType,
  x: number,
  y: number,
  ignoreDropId?: string,
) => {
  const stats = TOWER_STATS[type];

  if (x < 0 || y < 0 || x + stats.width > GRID_WIDTH || y + stats.height > GRID_HEIGHT) {
    return false;
  }

  for (const drop of state.incomingDrops) {
    if (drop.id === ignoreDropId) continue;
    const dropStats = TOWER_STATS[drop.towerType];
    if (
      x < drop.targetGridX + dropStats.width &&
      x + stats.width > drop.targetGridX &&
      y < drop.targetGridY + dropStats.height &&
      y + stats.height > drop.targetGridY
    ) {
      return false;
    }
  }

  return (
    !collidesWithTowers(x, y, stats.width, stats.height, state.towers) &&
    !collidesWithWires(x, y, stats.width, stats.height, state.wires)
  );
};

export const findAutoPlacementNearCore = (state: GameState, type: TowerType) => {
  const core = state.towers.find((tower) => tower.type === 'core');
  if (!core) return null;

  const stats = TOWER_STATS[type];
  const coreCx = core.x + core.width / 2;
  const coreCy = core.y + core.height / 2;
  const candidates: { x: number; y: number; distance: number }[] = [];

  for (let y = 0; y <= GRID_HEIGHT - stats.height; y++) {
    for (let x = 0; x <= GRID_WIDTH - stats.width; x++) {
      if (!canPlaceTowerAt(state, type, x, y)) continue;
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

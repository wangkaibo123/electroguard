import { GameState } from '../types';
import { createExplosion } from '../engine';
import { SCORE_CONFIG, SHOP_CONFIG } from '../config';

export const applyDamageToEnemy = (
  state: GameState,
  enemy: GameState['enemies'][number],
  damage: number,
  color: string,
  bigExplosion = false,
): boolean => {
  let remainingDamage = damage;
  if (enemy.shieldAbsorb > 0) {
    const absorbed = Math.min(enemy.shieldAbsorb, remainingDamage);
    enemy.shieldAbsorb -= absorbed;
    remainingDamage -= absorbed;
  }

  enemy.hp -= remainingDamage;
  createExplosion(state, enemy.x, enemy.y, color, bigExplosion ? 10 : 3);

  if (enemy.hp > 0) return false;

  const enemyIndex = state.enemies.indexOf(enemy);
  if (enemyIndex >= 0) {
    state.enemies.splice(enemyIndex, 1);
  } else {
    const fallbackIndex = state.enemies.findIndex((item) => item.id === enemy.id);
    if (fallbackIndex >= 0) state.enemies.splice(fallbackIndex, 1);
  }
  state.score += SCORE_CONFIG[enemy.enemyType] ?? SCORE_CONFIG.default;
  state.gold += enemy.goldReward ?? SHOP_CONFIG.goldPerEnemyKill;
  createExplosion(state, enemy.x, enemy.y, enemy.color, bigExplosion ? 15 : 10);
  return true;
};

export const findNearestEnemy = (
  enemies: GameState['enemies'],
  x: number,
  y: number,
  range: number,
  excludeIds?: Set<string> | string[],
) => {
  let best: GameState['enemies'][number] | null = null;
  let bestDistanceSq = range * range;

  for (const enemy of enemies) {
    if (excludeIds && (excludeIds instanceof Set ? excludeIds.has(enemy.id) : excludeIds.includes(enemy.id))) {
      continue;
    }

    const dx = enemy.x - x;
    const dy = enemy.y - y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      best = enemy;
    }
  }

  return best;
};


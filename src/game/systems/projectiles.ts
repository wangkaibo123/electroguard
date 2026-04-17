import { GameState } from '../types';
import { GLOBAL_CONFIG } from '../config';
import { applyDamageToEnemy, findNearestEnemy } from './combatUtils';

const MISSILE_RETARGET_RANGE = GLOBAL_CONFIG.cellSize * 10;
const findEnemyById = (state: GameState, id: string) => state.enemies.find((enemy) => enemy.id === id);

const applySplashDamage = (
  state: GameState,
  x: number,
  y: number,
  damage: number,
  radius: number,
  color: string,
  primaryId?: string,
) => {
  const enemies = [...state.enemies];
  for (const enemy of enemies) {
    const distance = Math.hypot(enemy.x - x, enemy.y - y);
    if (distance > radius) continue;
    const falloff = enemy.id === primaryId ? 1 : Math.max(0.35, 1 - distance / radius);
    applyDamageToEnemy(state, enemy, damage * falloff, color, true);
  }
  state.hitEffects.push({ x, y, life: 0, maxLife: 0.35, color, radius });
};

export const updateProjectiles = (state: GameState, dt: number) => {
  let changed = false;

  for (let index = state.projectiles.length - 1; index >= 0; index--) {
    const projectile = state.projectiles[index];

    if (projectile.arcHeight !== undefined) {
      let target = findEnemyById(state, projectile.targetId);
      if (!target) {
        target = findNearestEnemy(state.enemies, projectile.x, projectile.y, MISSILE_RETARGET_RANGE);
        if (target) {
          projectile.targetId = target.id;
        } else {
          applySplashDamage(
            state,
            projectile.x,
            projectile.y,
            projectile.damage,
            projectile.splashRadius ?? 0,
            projectile.color ?? '#fbbf24',
          );
          state.projectiles.splice(index, 1);
          changed = true;
          continue;
        }
      }

      if (projectile.acceleration && projectile.maxSpeed) {
        if (projectile.accelerationGrowth) {
          projectile.acceleration += projectile.accelerationGrowth * dt;
        }
        projectile.speed = Math.min(projectile.maxSpeed, projectile.speed + projectile.acceleration * dt);
      }
      const step = projectile.speed * dt;
      if (target) {
        const desired = Math.atan2(target.y - projectile.y, target.x - projectile.x);
        projectile.angle = desired;
      }

      const angle = projectile.angle ?? 0;
      projectile.x += Math.cos(angle) * step;
      projectile.y += Math.sin(angle) * step;
      projectile.traveled = (projectile.traveled ?? 0) + step;

      if (target && Math.hypot(target.x - projectile.x, target.y - projectile.y) < target.radius + 5) {
        applySplashDamage(
          state,
          target.x,
          target.y,
          projectile.damage,
          projectile.splashRadius ?? 0,
          projectile.color ?? '#fbbf24',
          target.id,
        );
        state.projectiles.splice(index, 1);
        changed = true;
        continue;
      }

      if (projectile.maxRange && (projectile.traveled ?? 0) > projectile.maxRange) {
        if (projectile.splashRadius && target) {
          applySplashDamage(
            state,
            projectile.x,
            projectile.y,
            projectile.damage * 0.65,
            projectile.splashRadius,
            projectile.color ?? '#fbbf24',
            target.id,
          );
        }
        state.projectiles.splice(index, 1);
        changed = true;
        continue;
      }

      changed = true;
      continue;
    }

    if (projectile.angle !== undefined) {
      const step = projectile.speed * dt;
      projectile.x += Math.cos(projectile.angle) * step;
      projectile.y += Math.sin(projectile.angle) * step;
      projectile.traveled = (projectile.traveled ?? 0) + step;

      if (projectile.maxRange && projectile.traveled > projectile.maxRange) {
        state.projectiles.splice(index, 1);
        changed = true;
        continue;
      }

      let hit = false;
      for (const enemy of state.enemies) {
        if (projectile.piercedIds?.includes(enemy.id)) continue;
        if (Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) >= enemy.radius + 4) continue;

        applyDamageToEnemy(state, enemy, projectile.damage, projectile.color ?? '#fbbf24');
        if (!projectile.piercing) {
          state.projectiles.splice(index, 1);
          hit = true;
        } else {
          projectile.piercedIds = projectile.piercedIds ?? [];
          projectile.piercedIds.push(enemy.id);
        }
        changed = true;
        break;
      }

      if (!hit) changed = true;
      continue;
    }

    let targetX = 0;
    let targetY = 0;
    let targetFound = false;
    const target = findEnemyById(state, projectile.targetId);
    if (!target) {
      if (!projectile.piercing) {
        state.projectiles.splice(index, 1);
        changed = true;
        continue;
      }

      const nextEnemy = findNearestEnemy(state.enemies, projectile.x, projectile.y, 300, projectile.piercedIds);
      if (!nextEnemy) {
        state.projectiles.splice(index, 1);
        changed = true;
        continue;
      }

      projectile.targetId = nextEnemy.id;
      targetX = nextEnemy.x;
      targetY = nextEnemy.y;
      targetFound = true;
    } else {
      targetX = target.x;
      targetY = target.y;
      targetFound = true;

      const distance = Math.hypot(targetX - projectile.x, targetY - projectile.y);
      if (distance < target.radius + 4) {
        if (projectile.splashRadius) {
          applySplashDamage(
            state,
            target.x,
            target.y,
            projectile.damage,
            projectile.splashRadius,
            projectile.color ?? '#fbbf24',
            target.id,
          );
        } else {
          applyDamageToEnemy(state, target, projectile.damage, projectile.color ?? '#fbbf24', true);
        }
        if (projectile.piercing) {
          projectile.piercedIds = projectile.piercedIds ?? [];
          projectile.piercedIds.push(target.id);
          const nextEnemy = findNearestEnemy(state.enemies, projectile.x, projectile.y, 300, projectile.piercedIds);
          if (nextEnemy) {
            projectile.targetId = nextEnemy.id;
          } else {
            state.projectiles.splice(index, 1);
          }
        } else {
          state.projectiles.splice(index, 1);
        }
        changed = true;
        continue;
      }
    }

    if (!targetFound) continue;

    const angle = Math.atan2(targetY - projectile.y, targetX - projectile.x);
    projectile.x += Math.cos(angle) * projectile.speed * dt;
    projectile.y += Math.sin(angle) * projectile.speed * dt;
    changed = true;
  }

  return changed;
};


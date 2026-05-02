import { GameState } from '../types';
import { GLOBAL_CONFIG, WEAPON_CONFIG } from '../config';
import { genId } from '../engine';

const TWO_PI = Math.PI * 2;
const {
  attackBulletSpeed: REPAIR_DRONE_ATTACK_BULLET_SPEED,
  attackCooldown: REPAIR_DRONE_ATTACK_COOLDOWN,
  attackDamage: REPAIR_DRONE_ATTACK_DAMAGE,
  attackRange: REPAIR_DRONE_ATTACK_RANGE,
  repairCooldown: REPAIR_DRONE_REPAIR_COOLDOWN,
} = WEAPON_CONFIG.repairDrone;

const moveToward = (
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  distance: number,
) => {
  const dx = targetX - currentX;
  const dy = targetY - currentY;
  const length = Math.hypot(dx, dy);
  if (length <= distance || length <= 0.001) {
    return { x: targetX, y: targetY, reached: true };
  }

  const t = distance / length;
  return { x: currentX + dx * t, y: currentY + dy * t, reached: false };
};

export const updateRepairDrones = (state: GameState, dt: number, now: number) => {
  let changed = false;

  for (let index = state.repairDrones.length - 1; index >= 0; index--) {
    const drone = state.repairDrones[index];
    const targetKind = drone.targetKind ?? 'tower';
    const sourceTower = state.towerMap.get(drone.sourceTowerId);
    if (sourceTower && !sourceTower.isRuined) {
      drone.homeX = (sourceTower.x + sourceTower.width / 2) * GLOBAL_CONFIG.cellSize;
      drone.homeY = (sourceTower.y + sourceTower.height / 2) * GLOBAL_CONFIG.cellSize;
    }

    if (targetKind === 'enemy') {
      const range = drone.sourceRange ?? REPAIR_DRONE_ATTACK_RANGE;
      const rangeSq = range * range;
      let target = state.enemies.find((enemy) => enemy.id === drone.targetId) ?? null;
      if (!sourceTower || sourceTower.isRuined) {
        target = null;
      } else if (target) {
        const dx = target.x - drone.homeX;
        const dy = target.y - drone.homeY;
        if (dx * dx + dy * dy > rangeSq) target = null;
      }

      if (!target && sourceTower && !sourceTower.isRuined) {
        let bestDistanceSq = rangeSq;
        for (const enemy of state.enemies) {
          const dx = enemy.x - drone.homeX;
          const dy = enemy.y - drone.homeY;
          const distanceSq = dx * dx + dy * dy;
          if (distanceSq < bestDistanceSq) {
            bestDistanceSq = distanceSq;
            target = enemy;
          }
        }
        if (target) drone.targetId = target.id;
      }

      if ((drone.phase === 'outbound' || drone.phase === 'attacking') && target) {
        drone.targetX = target.x;
        drone.targetY = target.y;
      } else if (drone.phase !== 'returning') {
        drone.phase = 'returning';
        changed = true;
      }

      if (drone.phase === 'attacking') {
        if (!target || drone.energy <= 0) {
          drone.phase = 'returning';
          changed = true;
        } else {
          const hoverAngle = now / 360 + drone.id.length;
          const hoverRadius = Math.max(26, target.radius + 22);
          const hoverX = target.x + Math.cos(hoverAngle) * hoverRadius;
          const hoverY = target.y + Math.sin(hoverAngle) * hoverRadius * 0.72;
          const moved = moveToward(drone.x, drone.y, hoverX, hoverY, drone.speed * dt);
          drone.x = moved.x;
          drone.y = moved.y;

          drone.attackTimer = (drone.attackTimer ?? 0) + dt * 1000;
          const cooldown = drone.attackCooldown ?? REPAIR_DRONE_ATTACK_COOLDOWN;
          while (drone.attackTimer >= cooldown && drone.energy > 0 && target) {
            drone.attackTimer -= cooldown;
            drone.energy--;
            state.projectiles.push({
              id: genId(),
              x: drone.x,
              y: drone.y,
              targetId: target.id,
              speed: REPAIR_DRONE_ATTACK_BULLET_SPEED,
              damage: drone.damage ?? REPAIR_DRONE_ATTACK_DAMAGE,
              sourceTowerId: drone.sourceTowerId,
              color: '#fb7185',
              size: 2.5,
            });
            state.hitEffects.push({
              x: drone.x,
              y: drone.y,
              life: 0,
              maxLife: 0.18,
              color: '#fb7185',
              radius: 10,
            });
          }

          if (drone.energy <= 0) {
            drone.phase = 'returning';
          }

          changed = true;
          continue;
        }
      }
    }

    const target = targetKind === 'tower' ? state.towerMap.get(drone.targetId) : undefined;
    if (targetKind === 'tower') {
      if ((drone.phase === 'outbound' || drone.phase === 'repairing') && target && !target.isRuined) {
        drone.targetX = (target.x + target.width / 2) * GLOBAL_CONFIG.cellSize;
        drone.targetY = (target.y + target.height / 2) * GLOBAL_CONFIG.cellSize;
      } else if (drone.phase !== 'returning') {
        drone.phase = 'returning';
        changed = true;
      }
    }

    if (targetKind === 'tower' && drone.phase === 'repairing') {
      if (!target || target.isRuined || target.hp >= target.maxHp || drone.energy <= 0) {
        drone.phase = 'returning';
        changed = true;
      } else {
        const hoverAngle = now / 500 + drone.id.length;
        const hoverRadius = Math.max(18, Math.min(target.width, target.height) * GLOBAL_CONFIG.cellSize * 0.42);
        const hoverX = drone.targetX + Math.cos(hoverAngle) * hoverRadius;
        const hoverY = drone.targetY + Math.sin(hoverAngle) * hoverRadius * 0.55;
        const moved = moveToward(drone.x, drone.y, hoverX, hoverY, drone.speed * dt);
        drone.x = moved.x;
        drone.y = moved.y;

        drone.repairTimer += dt * 1000;
        while (drone.repairTimer >= REPAIR_DRONE_REPAIR_COOLDOWN && drone.energy > 0 && target.hp < target.maxHp) {
          drone.repairTimer -= REPAIR_DRONE_REPAIR_COOLDOWN;
          drone.energy--;
          target.hp = Math.min(target.maxHp, target.hp + drone.amount);
          target.lastDamagedAt = now;
          state.hitEffects.push({
            x: drone.targetX,
            y: drone.targetY,
            life: 0,
            maxLife: 0.32,
            color: '#2dd4bf',
            radius: 16,
          });
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * TWO_PI;
            state.particles.push({
              x: drone.x,
              y: drone.y,
              vx: Math.cos(angle) * 35,
              vy: Math.sin(angle) * 35,
              life: 0,
              maxLife: 0.35,
              color: '#5eead4',
              size: 2,
            });
          }
        }

        if (drone.energy <= 0 || target.hp >= target.maxHp) {
          drone.phase = 'returning';
        }

        changed = true;
        continue;
      }
    }

    const destinationX = drone.phase === 'outbound' ? drone.targetX : drone.homeX;
    const destinationY = drone.phase === 'outbound' ? drone.targetY : drone.homeY;
    const moved = moveToward(drone.x, drone.y, destinationX, destinationY, drone.speed * dt);
    drone.x = moved.x;
    drone.y = moved.y;

    if (moved.reached) {
      if (drone.phase === 'outbound') {
        if (targetKind === 'enemy') {
          const targetEnemy = state.enemies.find((enemy) => enemy.id === drone.targetId);
          drone.phase = targetEnemy && drone.energy > 0 ? 'attacking' : 'returning';
        } else {
          drone.phase = target && !target.isRuined && target.hp < target.maxHp ? 'repairing' : 'returning';
        }
      } else {
        if (targetKind === 'tower' && sourceTower && !sourceTower.isRuined && sourceTower.type === 'repair_drone') {
          sourceTower.storedPower = Math.min(sourceTower.maxPower, drone.energy);
        }
        state.repairDrones.splice(index, 1);
      }
    }

    changed = true;
  }

  return changed;
};



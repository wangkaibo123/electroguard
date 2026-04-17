import { GameState } from '../types';
import { GLOBAL_CONFIG, WEAPON_CONFIG } from '../config';

const TWO_PI = Math.PI * 2;
const { repairCooldown: REPAIR_DRONE_REPAIR_COOLDOWN } = WEAPON_CONFIG.repairDrone;

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
    const sourceTower = state.towerMap.get(drone.sourceTowerId);
    if (sourceTower && !sourceTower.isRuined) {
      drone.homeX = (sourceTower.x + sourceTower.width / 2) * GLOBAL_CONFIG.cellSize;
      drone.homeY = (sourceTower.y + sourceTower.height / 2) * GLOBAL_CONFIG.cellSize;
    }

    const target = state.towerMap.get(drone.targetId);
    if ((drone.phase === 'outbound' || drone.phase === 'repairing') && target && !target.isRuined) {
      drone.targetX = (target.x + target.width / 2) * GLOBAL_CONFIG.cellSize;
      drone.targetY = (target.y + target.height / 2) * GLOBAL_CONFIG.cellSize;
    } else if (drone.phase !== 'returning') {
      drone.phase = 'returning';
      changed = true;
    }

    if (drone.phase === 'repairing') {
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
        drone.phase = target && !target.isRuined && target.hp < target.maxHp ? 'repairing' : 'returning';
      } else {
        if (sourceTower && !sourceTower.isRuined && sourceTower.type === 'repair_drone') {
          sourceTower.storedPower = Math.min(sourceTower.maxPower, drone.energy);
        }
        state.repairDrones.splice(index, 1);
      }
    }

    changed = true;
  }

  return changed;
};



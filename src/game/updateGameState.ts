import {
  GameState,
  ShieldBreakEffect,
  Tower,
  getTowerRange,
} from './types';
import {
  createExplosion,
  dispatchPulse,
  genId,
  rebuildTowerMap,
  spawnEnemyAt,
  updatePowerGrid,
} from './engine';
import { closestPointOnTower } from './collider';
import {
  ENEMY_AI_CONFIG,
  BASE_UPGRADE_CONFIG,
  COMMAND_CARD_CONFIG,
  GLOBAL_CONFIG,
  SHIELD_CONFIG,
  WEAPON_CONFIG,
} from './config';
import { applyDamageToEnemy, findNearestEnemy } from './systems/combatUtils';
import { updateIncomingDrops } from './systems/incomingDrops';
import { updateProjectiles } from './systems/projectiles';
import { updateRepairDrones } from './systems/repairDrones';
import { updateTransientEffects } from './systems/transientEffects';
import { startNextWave, updateWaveState } from './systems/waves';

export { startNextWave } from './systems/waves';

const TWO_PI = Math.PI * 2;
const {
  attackRange: ATTACK_RANGE,
  barrelSpeed: BARREL_SPEED,
  bossSpawnCount: BOSS_SPAWN_COUNT,
  bossSpawnInterval: BOSS_SPAWN_INTERVAL,
  bossWaveInterval: BOSS_WAVE_INTERVAL,
  pulseSpeed: PULSE_SPEED,
  powerInterval: POWER_INTERVAL,
  spawnInterval: SPAWN_INTERVAL,
  waveClearScoreMul: WAVE_CLEAR_SCORE_MUL,
} = GLOBAL_CONFIG;
const {
  batteryInterval: BATTERY_INTERVAL,
  cooldown: SHIELD_COOLDOWN,
  shieldTowerCooldown: SHIELD_TOWER_COOLDOWN,
} = SHIELD_CONFIG;
const {
  bulletSpeed: BLASTER_BULLET_SPEED,
  cooldown: BLASTER_COOLDOWN,
  damage: BLASTER_DAMAGE,
  powerCost: BLASTER_POWER_COST,
  range: BLASTER_RANGE,
} = WEAPON_CONFIG.blaster;
const {
  bulletsPerPower: GATLING_BULLETS_PER_POWER,
  bulletRange: GATLING_BULLET_RANGE,
  bulletSpeed: GATLING_BULLET_SPEED,
  damage: GATLING_DAMAGE,
  maxSpread: GATLING_MAX_SPREAD,
  minSpread: GATLING_MIN_SPREAD,
  range: GATLING_RANGE,
  heatDecayPct: GATLING_HEAT_DECAY_PCT,
  heatPerPulse: GATLING_HEAT_PER_PULSE,
  shotsPerSecond: GATLING_SHOTS_PER_SECOND,
} = WEAPON_CONFIG.gatling;
const {
  bounceRange: TESLA_BOUNCE_RANGE,
  cooldown: TESLA_COOLDOWN,
  damagePerPower: TESLA_DAMAGE_PER_POWER,
  range: TESLA_RANGE,
} = WEAPON_CONFIG.tesla;
const {
  bulletSpeed: SNIPER_SPEED,
  cooldown: SNIPER_COOLDOWN,
  damage: SNIPER_DAMAGE,
  maxRange: SNIPER_MAX_RANGE,
  minAimMs: SNIPER_MIN_AIM_MS,
  powerCost: SNIPER_POWER_COST,
  range: SNIPER_RANGE,
} = WEAPON_CONFIG.sniper;
const {
  bulletSpeed: MISSILE_SPEED,
  cooldown: MISSILE_COOLDOWN,
  damage: MISSILE_DAMAGE,
  powerCost: MISSILE_POWER_COST,
  range: MISSILE_RANGE,
  splashRadius: MISSILE_SPLASH_RADIUS,
} = WEAPON_CONFIG.missile;
const {
  attackCooldown: REPAIR_DRONE_ATTACK_COOLDOWN,
  attackCost: REPAIR_DRONE_ATTACK_COST,
  attackDamage: REPAIR_DRONE_ATTACK_DAMAGE,
  attackRange: REPAIR_DRONE_ATTACK_RANGE,
  attackShots: REPAIR_DRONE_ATTACK_SHOTS,
  repairAmount: REPAIR_DRONE_REPAIR_AMOUNT,
  repairCooldown: REPAIR_DRONE_REPAIR_COOLDOWN,
  repairCost: REPAIR_DRONE_REPAIR_COST,
  repairRange: REPAIR_DRONE_REPAIR_RANGE,
} = WEAPON_CONFIG.repairDrone;
const SNIPER_AIM_THRESHOLD = 0.05;
const BLASTER_AIM_THRESHOLD = SNIPER_AIM_THRESHOLD;
const SELF_POWER_INTERVAL = COMMAND_CARD_CONFIG.self_power.selfPowerInterval ?? 2;
const SELF_POWER_AMOUNT = COMMAND_CARD_CONFIG.self_power.selfPowerAmount ?? 1;
const CORE_TURRET_RANGE = BASE_UPGRADE_CONFIG.core_turret_unlock.coreTurretRange ?? 220;
const CORE_TURRET_DAMAGE = BASE_UPGRADE_CONFIG.core_turret_unlock.coreTurretDamage ?? 30;
const CORE_TURRET_COOLDOWN = BASE_UPGRADE_CONFIG.core_turret_unlock.coreTurretCooldown ?? 1200;
const MISSILE_SILO_COUNT = 4;
const MISSILE_MAX_SPEED = MISSILE_SPEED * 2;
const MISSILE_INITIAL_SPEED = MISSILE_MAX_SPEED * 0.19;
const MISSILE_ACCELERATION = 260;
const MISSILE_ACCELERATION_GROWTH = 720;
const TURRET_TYPES = new Set<Tower['type']>(['blaster', 'gatling', 'sniper', 'missile', 'repair_drone']);

const normalizeAngleDiff = (angle: number) => {
  while (angle > Math.PI) angle -= TWO_PI;
  while (angle < -Math.PI) angle += TWO_PI;
  return angle;
};

const getMissileSiloOffset = (index: number, span: number) => {
  const gap = span * 0.18;
  return {
    x: (index % 2 === 0 ? -1 : 1) * gap,
    y: (index < 2 ? -1 : 1) * gap,
  };
};

const getMissileSiloWorldPosition = (tower: Tower, index: number) => {
  const centerX = (tower.x + tower.width / 2) * GLOBAL_CONFIG.cellSize;
  const centerY = (tower.y + tower.height / 2) * GLOBAL_CONFIG.cellSize;
  const offset = getMissileSiloOffset(index, Math.min(tower.width, tower.height) * GLOBAL_CONFIG.cellSize);
  const cos = Math.cos(tower.rotation);
  const sin = Math.sin(tower.rotation);
  return {
    x: centerX + offset.x * cos - offset.y * sin,
    y: centerY + offset.x * sin + offset.y * cos,
  };
};

const GATLING_SHOT_INTERVAL = 1000 / GATLING_SHOTS_PER_SECOND;
const TOWER_RETARGET_MS = 150;
const TOWER_RETARGET_JITTER_MS = 70;

const getStableRetargetDelay = (id: string, baseMs: number, jitterMs: number) => {
  let hash = 0;
  for (let index = 0; index < id.length; index++) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return baseMs + Math.abs(hash % jitterMs);
};

const getTowerRetargetDelay = (towerId: string) =>
  getStableRetargetDelay(towerId, TOWER_RETARGET_MS, TOWER_RETARGET_JITTER_MS);

const fireGatlingShot = (
  state: GameState,
  tower: Tower,
  originX: number,
  originY: number,
  target: GameState['enemies'][number],
) => {
  const baseAngle = Math.atan2(target.y - originY, target.x - originX);
  const spread = GATLING_MIN_SPREAD + (GATLING_MAX_SPREAD - GATLING_MIN_SPREAD) * tower.heat;
  const spreadAngle = baseAngle + (Math.random() - 0.5) * spread * 2;
  state.projectiles.push({
    id: genId(),
    x: originX,
    y: originY,
    targetId: target.id,
    speed: GATLING_BULLET_SPEED,
    damage: GATLING_DAMAGE,
    angle: spreadAngle,
    traveled: 0,
    maxRange: GATLING_BULLET_RANGE * (tower.rangeMultiplier ?? 1),
    color: '#f59e0b',
    size: 2,
  });
};

const destroyTower = (state: GameState, towerId: string) => {
  state.towers = state.towers.filter((tower) => tower.id !== towerId);
  state.wires = state.wires.filter((wire) => wire.startTowerId !== towerId && wire.endTowerId !== towerId);
  rebuildTowerMap(state);
  updatePowerGrid(state);
};

const ruinTower = (state: GameState, tower: Tower) => {
  tower.isRuined = true;
  tower.hp = 0;
  tower.powered = false;
  tower.storedPower = 0;
  tower.incomingPower = 0;
  tower.shieldHp = 0;
  tower.lastActionTime = 0;
  tower.heat = 0;
  tower.overloaded = false;
  tower.gatlingAmmo = 0;
  tower.sniperAimSince = undefined;
  tower.missileSiloCursor = tower.type === 'missile' ? 0 : tower.missileSiloCursor;
  state.wires = state.wires.filter((wire) => wire.startTowerId !== tower.id && wire.endTowerId !== tower.id);
  state.pulses = state.pulses.filter((pulse) => pulse.sourceTowerId !== tower.id && pulse.targetTowerId !== tower.id);
  updatePowerGrid(state);
};

const launchRepairDrone = (
  state: GameState,
  tower: Tower,
  targetId: string,
  targetX: number,
  targetY: number,
  amount: number,
) => {
  const homeX = (tower.x + tower.width / 2) * GLOBAL_CONFIG.cellSize;
  const homeY = (tower.y + tower.height / 2) * GLOBAL_CONFIG.cellSize;

  state.repairDrones.push({
    id: genId(),
    sourceTowerId: tower.id,
    targetId,
    targetKind: 'tower',
    phase: 'outbound',
    x: homeX,
    y: homeY,
    homeX,
    homeY,
    targetX,
    targetY,
    speed: 360,
    amount,
    energy: REPAIR_DRONE_REPAIR_COST,
    repairTimer: 0,
  });
};

const launchAttackDrone = (
  state: GameState,
  tower: Tower,
  target: GameState['enemies'][number],
  range: number,
) => {
  const homeX = (tower.x + tower.width / 2) * GLOBAL_CONFIG.cellSize;
  const homeY = (tower.y + tower.height / 2) * GLOBAL_CONFIG.cellSize;

  state.repairDrones.push({
    id: genId(),
    sourceTowerId: tower.id,
    targetId: target.id,
    targetKind: 'enemy',
    phase: 'outbound',
    x: homeX,
    y: homeY,
    homeX,
    homeY,
    targetX: target.x,
    targetY: target.y,
    speed: 420,
    amount: 0,
    energy: REPAIR_DRONE_ATTACK_SHOTS,
    repairTimer: 0,
    attackTimer: REPAIR_DRONE_ATTACK_COOLDOWN,
    attackCooldown: REPAIR_DRONE_ATTACK_COOLDOWN,
    damage: REPAIR_DRONE_ATTACK_DAMAGE,
    sourceRange: range,
  });
};

const updatePowerSystems = (state: GameState, dt: number, now: number) => {
  let changed = false;

  state.powerTimer += dt;
  if (state.powerTimer >= POWER_INTERVAL) {
    state.powerTimer -= POWER_INTERVAL;
    for (const tower of state.towers) {
      if (tower.isRuined) continue;

      if (tower.type === 'core') {
        const pulseCount = 1 + (tower.corePowerBonus ?? 0);
        for (let pulse = 0; pulse < pulseCount; pulse++) dispatchPulse(state, tower);
        changed = true;
      } else if (tower.type === 'generator' && tower.powered) {
        dispatchPulse(state, tower);
        changed = true;
      } else if (tower.type === 'big_generator' && tower.powered) {
        for (let pulse = 0; pulse < 4; pulse++) dispatchPulse(state, tower);
        changed = true;
      }
    }
  }

  for (const tower of state.towers) {
    if (tower.isRuined) continue;

    const selfPowerLevel = tower.selfPowerLevel ?? 0;
    if (selfPowerLevel <= 0) continue;

    tower.selfPowerTimer = (tower.selfPowerTimer ?? 0) + dt;
    if (tower.selfPowerTimer < SELF_POWER_INTERVAL) {
      continue;
    }

    tower.selfPowerTimer -= SELF_POWER_INTERVAL;
    const amount = SELF_POWER_AMOUNT * selfPowerLevel;
    if (tower.type === 'gatling') {
      if (!tower.overloaded) {
        tower.gatlingAmmo += GATLING_BULLETS_PER_POWER * amount;
        tower.heat = Math.min(1, tower.heat + GATLING_HEAT_PER_PULSE * amount);
        if (tower.heat >= 1) tower.overloaded = true;
      }
    } else if (tower.maxPower > 0) {
      tower.storedPower = Math.min(tower.maxPower, tower.storedPower + amount);
    }
    changed = true;
  }

  for (const tower of state.towers) {
    if (tower.isRuined) continue;

    if (tower.maxShieldHp <= 0 || tower.shieldHp >= tower.maxShieldHp) continue;
    if ((tower.type !== 'core' && tower.type !== 'shield') || !tower.powered) continue;

    const shieldCooldown = tower.type === 'shield' ? SHIELD_TOWER_COOLDOWN : SHIELD_COOLDOWN;
    if (tower.type === 'shield' && tower.lastActionTime === 0) {
      tower.lastActionTime = now;
      changed = true;
      continue;
    }

    if (now - tower.lastActionTime <= shieldCooldown) continue;

    if (tower.shieldHp <= 0) {
      if (tower.storedPower >= SHIELD_CONFIG.rebootCost) {
        tower.storedPower -= SHIELD_CONFIG.rebootCost;
        tower.shieldHp = SHIELD_CONFIG.rebootHp;
        tower.lastActionTime = now;
        changed = true;
      }
      continue;
    }

    if (tower.storedPower >= SHIELD_CONFIG.rechargeCost) {
      tower.storedPower -= SHIELD_CONFIG.rechargeCost;
      tower.shieldHp = Math.min(tower.maxShieldHp, tower.shieldHp + SHIELD_CONFIG.rechargeAmount);
      tower.lastActionTime = now;
      changed = true;
    }
  }

  for (const tower of state.towers) {
    if (tower.isRuined) continue;

    if (tower.type !== 'battery' || !tower.powered || tower.storedPower <= 0) continue;
    if (now - tower.lastActionTime <= BATTERY_INTERVAL) continue;

    if (dispatchPulse(state, tower, true)) {
      tower.storedPower--;
      tower.lastActionTime = now;
      changed = true;
    }
  }

  return changed;
};

const updatePulses = (state: GameState, dt: number, now: number) => {
  let changed = false;

  for (let index = state.pulses.length - 1; index >= 0; index--) {
    const pulse = state.pulses[index];
    if (pulse.launchDelay > 0) {
      pulse.launchDelay = Math.max(0, pulse.launchDelay - dt);
      changed = true;
      continue;
    }
    pulse.progress += PULSE_SPEED * dt;

    let remaining = pulse.progress;
    let reached = false;

    for (let segmentIndex = 0; segmentIndex < pulse.path.length - 1; segmentIndex++) {
      const dx = pulse.path[segmentIndex + 1].x - pulse.path[segmentIndex].x;
      const dy = pulse.path[segmentIndex + 1].y - pulse.path[segmentIndex].y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      if (remaining <= segmentLength) break;
      remaining -= segmentLength;
      if (segmentIndex === pulse.path.length - 2) reached = true;
    }

    if (reached) {
      const target = state.towerMap.get(pulse.targetTowerId);
      if (target && !target.isRuined) {
        target.incomingPower = Math.max(0, target.incomingPower - 1);
        if (target.type === 'gatling') {
          if (target.powered && !target.overloaded) {
            target.gatlingAmmo += GATLING_BULLETS_PER_POWER;
            target.heat = Math.min(1, target.heat + GATLING_HEAT_PER_PULSE);
            if (target.heat >= 1) target.overloaded = true;
          }
        } else {
          target.storedPower = Math.min(target.maxPower, target.storedPower + 1);
        }
      }
      state.pulses.splice(index, 1);
    }

    changed = true;
  }

  return changed;
};

const updateCombatTowers = (state: GameState, dt: number, now: number) => {
  let changed = false;
  const enemyMap = state.enemies.length > 0
    ? new Map(state.enemies.map((enemy) => [enemy.id, enemy]))
    : null;

  const resolveTowerTarget = (tower: Tower, baseX: number, baseY: number, range: number) => {
    if (!tower.aiTargetId || !enemyMap) return null;
    const target = enemyMap.get(tower.aiTargetId);
    if (!target || target.hp <= 0) return null;

    const dx = target.x - baseX;
    const dy = target.y - baseY;
    if (dx * dx + dy * dy > range * range) return null;
    return target;
  };

  const acquireTowerTarget = (tower: Tower, baseX: number, baseY: number, range: number) => {
    let bestDistanceSq = range * range;
    let bestEnemy: GameState['enemies'][number] | null = null;

    for (const enemy of state.enemies) {
      const dx = enemy.x - baseX;
      const dy = enemy.y - baseY;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestEnemy = enemy;
      }
    }

    tower.aiTargetId = bestEnemy?.id;
    tower.aiRetargetAt = now + getTowerRetargetDelay(tower.id);
    return bestEnemy;
  };

  for (const tower of state.towers) {
    if (tower.isRuined) continue;

    if (tower.type === 'gatling' && tower.heat > 0) {
      tower.heat = Math.max(0, tower.heat * Math.pow(1 - GATLING_HEAT_DECAY_PCT, dt));
      if (tower.overloaded && tower.heat <= 0.001) {
        tower.heat = 0;
        tower.overloaded = false;
      }
      changed = true;
    }
  }

  for (const tower of state.towers) {
    if (tower.isRuined) continue;

    if (!TURRET_TYPES.has(tower.type)) continue;
    if (!tower.powered) {
      if (tower.type === 'sniper') tower.sniperAimSince = undefined;
      continue;
    }

    const baseX = (tower.x + tower.width / 2) * GLOBAL_CONFIG.cellSize;
    const baseY = (tower.y + tower.height / 2) * GLOBAL_CONFIG.cellSize;

    if (tower.type === 'repair_drone') {
      if (state.repairDrones.some((drone) => drone.sourceTowerId === tower.id)) continue;
      const fullyCharged = tower.maxPower > 0 && tower.storedPower >= tower.maxPower;

      let repairTarget: Tower | null = null;
      let repairTargetHpRatio = Infinity;
      const repairRangeSq = REPAIR_DRONE_REPAIR_RANGE * REPAIR_DRONE_REPAIR_RANGE;
      for (const other of state.towers) {
        if (other.isRuined || other.id === tower.id || other.hp >= other.maxHp) continue;
        const dx = (other.x + other.width / 2) * GLOBAL_CONFIG.cellSize - baseX;
        const dy = (other.y + other.height / 2) * GLOBAL_CONFIG.cellSize - baseY;
        if (dx * dx + dy * dy > repairRangeSq) continue;
        const hpRatio = other.hp / other.maxHp;
        if (hpRatio < repairTargetHpRatio) {
          repairTargetHpRatio = hpRatio;
          repairTarget = other;
        }
      }

      if (repairTarget) {
        if (fullyCharged && now - tower.lastActionTime >= REPAIR_DRONE_REPAIR_COOLDOWN) {
          const targetX = (repairTarget.x + repairTarget.width / 2) * GLOBAL_CONFIG.cellSize;
          const targetY = (repairTarget.y + repairTarget.height / 2) * GLOBAL_CONFIG.cellSize;
          tower.storedPower -= REPAIR_DRONE_REPAIR_COST;
          launchRepairDrone(state, tower, repairTarget.id, targetX, targetY, REPAIR_DRONE_REPAIR_AMOUNT);
          tower.lastActionTime = now;
          changed = true;
        }
      } else {
        const attackRange = getTowerRange(tower) ?? REPAIR_DRONE_ATTACK_RANGE;
        const enemyTarget = findNearestEnemy(state.enemies, baseX, baseY, attackRange);
        if (
          enemyTarget &&
          fullyCharged &&
          now - tower.lastActionTime >= REPAIR_DRONE_ATTACK_COOLDOWN
        ) {
          tower.storedPower -= REPAIR_DRONE_ATTACK_COST;
          launchAttackDrone(state, tower, enemyTarget, attackRange);
          tower.lastActionTime = now;
          changed = true;
        }
      }
      continue;
    }

    const range: number =
      getTowerRange(tower) ??
      (tower.type === 'sniper' ? SNIPER_RANGE :
      tower.type === 'gatling' ? GATLING_RANGE :
      tower.type === 'missile' ? MISSILE_RANGE :
      BLASTER_RANGE);

    let bestEnemy = resolveTowerTarget(tower, baseX, baseY, range);
    if (!bestEnemy || now >= (tower.aiRetargetAt ?? 0)) {
      bestEnemy = acquireTowerTarget(tower, baseX, baseY, range);
    }
    const hasTarget = Boolean(bestEnemy);
    const targetX = bestEnemy?.x ?? 0;
    const targetY = bestEnemy?.y ?? 0;

    if (hasTarget) {
      const desired = Math.atan2(targetY - baseY, targetX - baseX);
      const diff = normalizeAngleDiff(desired - tower.barrelAngle);
      const maxRotation = BARREL_SPEED * dt;
      tower.barrelAngle += Math.abs(diff) < maxRotation ? diff : Math.sign(diff) * maxRotation;
      changed = true;
    }

    if (tower.type === 'sniper' && !hasTarget) tower.sniperAimSince = undefined;
    if (!hasTarget) continue;

    const baseBarrelLength = Math.min(tower.width, tower.height) * GLOBAL_CONFIG.cellSize / 2 - 4;
    const barrelLength =
      tower.type === 'sniper' ? (baseBarrelLength + 10) * 2.4 - GLOBAL_CONFIG.cellSize :
      tower.type === 'gatling' ? (baseBarrelLength + 4) * 2 :
      tower.type === 'missile' ? (baseBarrelLength + 6) * 1.2 :
      (baseBarrelLength + 6) * 1.28;
    const muzzleX = baseX + Math.cos(tower.barrelAngle) * barrelLength;
    const muzzleY = baseY + Math.sin(tower.barrelAngle) * barrelLength;

    if (tower.type === 'blaster') {
      if (tower.storedPower < BLASTER_POWER_COST || now - tower.lastActionTime <= BLASTER_COOLDOWN) continue;

      const desiredAngle = Math.atan2(targetY - baseY, targetX - baseX);
      const aimDiff = normalizeAngleDiff(desiredAngle - tower.barrelAngle);
      if (Math.abs(aimDiff) > BLASTER_AIM_THRESHOLD) continue;

      tower.storedPower -= BLASTER_POWER_COST;
      state.projectiles.push({
        id: genId(),
        x: muzzleX,
        y: muzzleY,
        targetId: bestEnemy?.id ?? '',
        speed: BLASTER_BULLET_SPEED,
        damage: BLASTER_DAMAGE,
        traveled: 0,
        maxRange: BLASTER_RANGE * (tower.rangeMultiplier ?? 1),
        color: '#f87171',
        size: 3,
      });
      tower.lastActionTime = now;
      changed = true;
      continue;
    }

    if (tower.type === 'gatling') {
      if (
        tower.gatlingAmmo <= 0 ||
        tower.overloaded ||
        now - tower.lastActionTime < GATLING_SHOT_INTERVAL ||
        !bestEnemy
      ) {
        continue;
      }

      fireGatlingShot(state, tower, muzzleX, muzzleY, bestEnemy);
      tower.gatlingAmmo--;
      tower.lastActionTime = now;
      changed = true;
      continue;
    }

    if (tower.type === 'missile') {
      if (tower.storedPower < MISSILE_POWER_COST || now - tower.lastActionTime <= MISSILE_COOLDOWN) continue;

      const siloIndex = tower.missileSiloCursor ?? 0;
      const silo = getMissileSiloWorldPosition(tower, siloIndex);
      const targetDistance = bestEnemy ? Math.hypot(bestEnemy.x - silo.x, bestEnemy.y - silo.y) : MISSILE_RANGE;

      tower.storedPower -= MISSILE_POWER_COST;
      state.projectiles.push({
        id: genId(),
        x: silo.x,
        y: silo.y,
        targetId: bestEnemy?.id ?? '',
        speed: MISSILE_INITIAL_SPEED,
        damage: MISSILE_DAMAGE,
        sourceTowerId: tower.id,
        angle: bestEnemy ? Math.atan2(bestEnemy.y - silo.y, bestEnemy.x - silo.x) : tower.barrelAngle,
        splashRadius: MISSILE_SPLASH_RADIUS,
        color: '#fb7185',
        size: 5,
        acceleration: MISSILE_ACCELERATION,
        accelerationGrowth: MISSILE_ACCELERATION_GROWTH,
        maxSpeed: MISSILE_MAX_SPEED,
        traveled: 0,
        maxRange: Math.max(MISSILE_RANGE * (tower.rangeMultiplier ?? 1), targetDistance * 1.8),
        arcHeight: 70 + Math.min(80, targetDistance * 0.16),
        initialDistance: Math.max(120, targetDistance),
      });
      tower.missileSiloCursor = (siloIndex + 1) % MISSILE_SILO_COUNT;
      tower.lastActionTime = now;
      changed = true;
      continue;
    }

    const desiredAngle = Math.atan2(targetY - baseY, targetX - baseX);
    const aimDiff = normalizeAngleDiff(desiredAngle - tower.barrelAngle);

    const aligned = Math.abs(aimDiff) <= SNIPER_AIM_THRESHOLD;
    if (!aligned) tower.sniperAimSince = undefined;
    else if (tower.sniperAimSince === undefined) tower.sniperAimSince = now;

    if (tower.storedPower < SNIPER_POWER_COST || now - tower.lastActionTime <= SNIPER_COOLDOWN) continue;
    if (!aligned || tower.sniperAimSince === undefined || now - tower.sniperAimSince < SNIPER_MIN_AIM_MS) {
      continue;
    }

    tower.storedPower -= SNIPER_POWER_COST;
    state.projectiles.push({
      id: genId(),
      x: muzzleX,
      y: muzzleY,
      targetId: bestEnemy?.id ?? '',
      speed: SNIPER_SPEED,
      damage: SNIPER_DAMAGE,
      angle: tower.barrelAngle,
      traveled: 0,
      maxRange: SNIPER_MAX_RANGE * (tower.rangeMultiplier ?? 1),
      piercing: true,
      piercedIds: [],
      color: '#a78bfa',
      size: 4,
    });
    tower.sniperAimSince = undefined;
    tower.lastActionTime = now;
    changed = true;
  }

  for (const tower of state.towers) {
    if (tower.isRuined) continue;

    if (tower.type !== 'tesla' || !tower.powered || tower.storedPower <= 0) continue;
    if (now - tower.lastActionTime <= TESLA_COOLDOWN) continue;

    const baseX = (tower.x + tower.width / 2) * GLOBAL_CONFIG.cellSize;
    const baseY = (tower.y + tower.height / 2) * GLOBAL_CONFIG.cellSize;
    let firstEnemy = findNearestEnemy(state.enemies, baseX, baseY, getTowerRange(tower) ?? TESLA_RANGE);
    if (!firstEnemy) continue;

    const power = tower.storedPower;
    tower.storedPower = 0;
    const totalDamage = power * TESLA_DAMAGE_PER_POWER;
    const bounceCount = power;
    const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const hitIds = new Set<string>();
    let currentX = baseX;
    let currentY = baseY;
    let currentEnemy: GameState['enemies'][number] | null = firstEnemy;
    for (let bounce = 0; bounce < bounceCount && currentEnemy; bounce++) {
      segments.push({ x1: currentX, y1: currentY, x2: currentEnemy.x, y2: currentEnemy.y });
      applyDamageToEnemy(state, currentEnemy, totalDamage / bounceCount, currentEnemy.color, true);
      hitIds.add(currentEnemy.id);
      currentX = currentEnemy.x;
      currentY = currentEnemy.y;
      currentEnemy = findNearestEnemy(state.enemies, currentX, currentY, TESLA_BOUNCE_RANGE, hitIds);
    }

    if (segments.length > 0) {
      state.chainLightnings.push({ segments, life: 0, maxLife: 0.4 });
    }

    tower.lastActionTime = now;
    changed = true;
  }

  for (const tower of state.towers) {
    if (tower.type !== 'core' || !tower.coreTurretUnlocked) continue;
    if (now - (tower.coreTurretLastShot ?? 0) <= CORE_TURRET_COOLDOWN) continue;

    const baseX = (tower.x + tower.width / 2) * GLOBAL_CONFIG.cellSize;
    const baseY = (tower.y + tower.height / 2) * GLOBAL_CONFIG.cellSize;
    const target = findNearestEnemy(state.enemies, baseX, baseY, CORE_TURRET_RANGE);
    if (!target) continue;

    state.projectiles.push({
      id: genId(),
      x: baseX,
      y: baseY,
      targetId: target.id,
      speed: BLASTER_BULLET_SPEED,
      damage: CORE_TURRET_DAMAGE,
      sourceTowerId: tower.id,
      color: '#93c5fd',
      size: 3,
    });
    tower.coreTurretLastShot = now;
    changed = true;
  }

  return changed;
};

const createShieldBreakFragments = (): ShieldBreakEffect['fragments'] => {
  const fragments: ShieldBreakEffect['fragments'] = [];
  for (let index = 0; index < 16; index++) {
    fragments.push({
      angle: (index / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.2,
      dist: 0,
      size: 3 + Math.random() * 4,
      speed: 60 + Math.random() * 80,
    });
  }
  return fragments;
};

type EnemyAiTarget = {
  kind: 'tower' | 'shield' | 'wire';
  tower: Tower | null;
  wire: GameState['wires'][number] | null;
  x: number;
  y: number;
};

const ENEMY_RETARGET_MS = 220;
const ENEMY_RETARGET_JITTER_MS = 90;

const getEnemyRetargetDelay = (enemyId: string) => {
  return getStableRetargetDelay(enemyId, ENEMY_RETARGET_MS, ENEMY_RETARGET_JITTER_MS);
};

const resolveCachedEnemyTarget = (
  state: GameState,
  enemy: GameState['enemies'][number],
): EnemyAiTarget | null => {
  if (!enemy.aiTargetKind || !enemy.aiTargetId) return null;

  if (enemy.aiTargetKind === 'wire') {
    const wire = state.wires.find((item) => item.id === enemy.aiTargetId && item.hp > 0);
    if (!wire || enemy.aiTargetX === undefined || enemy.aiTargetY === undefined) return null;
    return { kind: 'wire', tower: null, wire, x: enemy.aiTargetX, y: enemy.aiTargetY };
  }

  const tower = state.towerMap.get(enemy.aiTargetId);
  if (!tower || tower.isRuined) return null;

  if (enemy.aiTargetKind === 'shield') {
    if (tower.shieldHp <= 0 || tower.shieldRadius <= 0 || !tower.powered) return null;
    const shieldCenterX = (tower.x + tower.width / 2) * GLOBAL_CONFIG.cellSize;
    const shieldCenterY = (tower.y + tower.height / 2) * GLOBAL_CONFIG.cellSize;
    const angle = Math.atan2(enemy.y - shieldCenterY, enemy.x - shieldCenterX);
    return {
      kind: 'shield',
      tower,
      wire: null,
      x: shieldCenterX + Math.cos(angle) * tower.shieldRadius,
      y: shieldCenterY + Math.sin(angle) * tower.shieldRadius,
    };
  }

  const closest = closestPointOnTower(tower, enemy.x, enemy.y);
  return { kind: 'tower', tower, wire: null, x: closest.x, y: closest.y };
};

const findEnemyTarget = (
  state: GameState,
  enemy: GameState['enemies'][number],
  now: number,
): EnemyAiTarget | null => {
  let minDistance = Infinity;
  let target: EnemyAiTarget | null = null;
  const isSaboteur = enemy.enemyType === 'saboteur';

  for (const tower of state.towers) {
    if (tower.isRuined) continue;

    const closest = closestPointOnTower(tower, enemy.x, enemy.y);
    const tx = closest.x;
    const ty = closest.y;
    const distance = Math.hypot(tx - enemy.x, ty - enemy.y);
    const weightedDistance = isSaboteur ? distance * ENEMY_AI_CONFIG.saboteurTowerDistMul : distance;

    if (weightedDistance < minDistance) {
      minDistance = weightedDistance;
      target = { kind: 'tower', tower, wire: null, x: tx, y: ty };
    }

    if (tower.shieldHp <= 0 || tower.shieldRadius <= 0 || !tower.powered) continue;

    const shieldCenterX = (tower.x + tower.width / 2) * GLOBAL_CONFIG.cellSize;
    const shieldCenterY = (tower.y + tower.height / 2) * GLOBAL_CONFIG.cellSize;
    const shieldDistance = Math.max(0, Math.hypot(shieldCenterX - enemy.x, shieldCenterY - enemy.y) - tower.shieldRadius);
    const weightedShieldDistance = isSaboteur ? shieldDistance * ENEMY_AI_CONFIG.saboteurTowerDistMul : shieldDistance;
    if (weightedShieldDistance < minDistance) {
      minDistance = weightedShieldDistance;
      const angle = Math.atan2(enemy.y - shieldCenterY, enemy.x - shieldCenterX);
      target = {
        kind: 'shield',
        tower,
        wire: null,
        x: shieldCenterX + Math.cos(angle) * tower.shieldRadius,
        y: shieldCenterY + Math.sin(angle) * tower.shieldRadius,
      };
    }
  }

  for (const wire of state.wires) {
    for (const point of wire.path) {
      const wireX = point.x * GLOBAL_CONFIG.cellSize + GLOBAL_CONFIG.cellSize / 2;
      const wireY = point.y * GLOBAL_CONFIG.cellSize + GLOBAL_CONFIG.cellSize / 2;
      const distance = Math.hypot(wireX - enemy.x, wireY - enemy.y);
      const weightedDistance = isSaboteur ? distance * ENEMY_AI_CONFIG.saboteurWireDistMul : distance;

      if (weightedDistance < minDistance) {
        minDistance = weightedDistance;
        target = { kind: 'wire', tower: null, wire, x: wireX, y: wireY };
      }
    }
  }

  if (target) {
    enemy.aiTargetKind = target.kind;
    enemy.aiTargetId = target.kind === 'wire' ? target.wire?.id : target.tower?.id;
    enemy.aiTargetX = target.x;
    enemy.aiTargetY = target.y;
    enemy.aiRetargetAt = now + getEnemyRetargetDelay(enemy.id);
  } else {
    enemy.aiTargetKind = undefined;
    enemy.aiTargetId = undefined;
    enemy.aiTargetX = undefined;
    enemy.aiTargetY = undefined;
    enemy.aiRetargetAt = undefined;
  }

  return target;
};

const updateEnemyState = (state: GameState, dt: number, now: number) => {
  let changed = false;

  for (const enemy of state.enemies) {
    if (enemy.isStatic) continue;

    let target = resolveCachedEnemyTarget(state, enemy);
    let actualDistance = target ? Math.hypot(target.x - enemy.x, target.y - enemy.y) : Infinity;
    if (!target || now >= (enemy.aiRetargetAt ?? 0) || actualDistance <= ATTACK_RANGE * 1.5) {
      target = findEnemyTarget(state, enemy, now);
      actualDistance = target ? Math.hypot(target.x - enemy.x, target.y - enemy.y) : Infinity;
    }
    if (!target) continue;

    if (actualDistance > ATTACK_RANGE) {
      const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
      enemy.x += Math.cos(angle) * enemy.speed * dt;
      enemy.y += Math.sin(angle) * enemy.speed * dt;
      enemy.heading = angle;
      changed = true;
      continue;
    }

    if (now - enemy.lastAttackTime <= enemy.attackCooldown) continue;

    const targetWire = target.wire;
    const targetTower = target.tower;
    if (targetWire) {
      targetWire.hp -= enemy.damage * enemy.wireDamageMul;
      state.hitEffects.push({ x: target.x, y: target.y, life: 0, maxLife: 0.3, color: '#ef4444', radius: 12 });
      createExplosion(state, target.x, target.y, '#ef4444', 3);
      if (targetWire.hp <= 0) {
        state.wires = state.wires.filter((wire) => wire.id !== targetWire!.id);
        updatePowerGrid(state);
      }
      enemy.lastAttackTime = now;
      changed = true;
      continue;
    }

    if (!targetTower) continue;

    if (target.kind === 'shield') {
      const previousHp = targetTower.shieldHp;
      targetTower.shieldHp = Math.max(0, targetTower.shieldHp - enemy.damage);
      state.hitEffects.push({ x: target.x, y: target.y, life: 0, maxLife: 0.35, color: '#22d3ee', radius: 18 });
      createExplosion(state, target.x, target.y, '#22d3ee', 4);

      if (previousHp > 0 && targetTower.shieldHp <= 0) {
        const shieldCenterX = (targetTower.x + targetTower.width / 2) * GLOBAL_CONFIG.cellSize;
        const shieldCenterY = (targetTower.y + targetTower.height / 2) * GLOBAL_CONFIG.cellSize;
        state.shieldBreakEffects.push({
          x: shieldCenterX,
          y: shieldCenterY,
          radius: targetTower.shieldRadius,
          life: 0,
          maxLife: 0.6,
          fragments: createShieldBreakFragments(),
        });
        createExplosion(state, shieldCenterX, shieldCenterY, '#22d3ee', 20);
      }
    } else {
      targetTower.hp -= enemy.damage;
      targetTower.lastDamagedAt = now;
      state.hitEffects.push({ x: target.x, y: target.y, life: 0, maxLife: 0.3, color: '#ef4444', radius: 14 });
      createExplosion(state, target.x, target.y, '#f87171', 4);

      if (targetTower.hp <= 0) {
        if (targetTower.type === 'core') {
          targetTower.hp = 0;
          state.status = 'gameover';
        } else {
          ruinTower(state, targetTower);
        }
      }
    }

    enemy.lastAttackTime = now;
    changed = true;
  }

  return changed;
};

const updateBossEffects = (state: GameState, now: number) => {
  let changed = false;

  for (const enemy of state.enemies) {
    if (enemy.enemyType !== 'overlord') continue;

    if (enemy.lastSpawnTime === 0) {
      enemy.lastSpawnTime = now;
      continue;
    }

    if (now - enemy.lastSpawnTime >= BOSS_SPAWN_INTERVAL) {
      for (let index = 0; index < BOSS_SPAWN_COUNT; index++) {
        const offset = (Math.random() - 0.5) * enemy.radius * 2;
        spawnEnemyAt(state, 'scout', state.wave, enemy.x + offset, enemy.y + offset, { goldReward: 0 });
      }
      enemy.lastSpawnTime = now;
      createExplosion(state, enemy.x, enemy.y, '#ef4444', 8);
      changed = true;
    }

    if (Math.random() < 0.32) {
      const ox = (Math.random() - 0.5) * enemy.radius * 0.8;
      const oy = (Math.random() - 0.5) * enemy.radius * 0.8;
      state.particles.push({
        x: enemy.x + ox,
        y: enemy.y + oy,
        vx: -Math.cos(enemy.heading) * 20 + (Math.random() - 0.5) * 15,
        vy: -Math.sin(enemy.heading) * 20 + (Math.random() - 0.5) * 15,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
        color: '#ef4444',
        size: 2 + Math.random() * 3,
      });
      changed = true;
    }

    if (Math.random() < 0.45) {
      const back = enemy.radius * 1.35;
      const ox = (Math.random() - 0.5) * enemy.radius * 0.4;
      const oy = (Math.random() - 0.5) * enemy.radius * 0.4;
      state.particles.push({
        x: enemy.x - Math.cos(enemy.heading) * back + ox,
        y: enemy.y - Math.sin(enemy.heading) * back + oy,
        vx: -Math.cos(enemy.heading) * (35 + Math.random() * 25) + (Math.random() - 0.5) * 20,
        vy: -Math.sin(enemy.heading) * (35 + Math.random() * 25) + (Math.random() - 0.5) * 20,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.35,
        color: Math.random() < 0.5 ? '#fca5a5' : '#ef4444',
        size: 2 + Math.random() * 4,
      });
      changed = true;
    }
  }

  return changed;
};

export const updateGameState = (state: GameState, dt: number) => {
  const now = performance.now();
  let changed = false;

  changed = updateIncomingDrops(state, dt) || changed;
  changed = updatePowerSystems(state, dt, now) || changed;
  changed = updatePulses(state, dt, now) || changed;
  changed = updateCombatTowers(state, dt, now) || changed;
  changed = updateWaveState(state, dt) || changed;
  changed = updateEnemyState(state, dt, now) || changed;
  changed = updateBossEffects(state, now) || changed;
  changed = updateRepairDrones(state, dt, now) || changed;
  changed = updateProjectiles(state, dt) || changed;
  changed = updateTransientEffects(state, dt) || changed;

  return changed;
};

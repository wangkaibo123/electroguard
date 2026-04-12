import {
  GameState,
  HitEffect,
  ShieldBreakEffect,
  Tower,
  TOWER_STATS,
} from './types';
import {
  createExplosion,
  dispatchPulse,
  genId,
  generateBossBonusPickOptions,
  generatePickOptions,
  rebuildTowerMap,
  spawnBoss,
  spawnEnemy,
  spawnEnemyAt,
  updatePowerGrid,
} from './engine';
import { closestPointOnTower } from './collider';
import {
  ENEMY_AI_CONFIG,
  ENEMY_SCALING,
  GLOBAL_CONFIG,
  SCORE_CONFIG,
  SHIELD_CONFIG,
  SHOP_CONFIG,
  WEAPON_CONFIG,
} from './config';
import { addTowerToState, createTowerAt } from './towerFactory';
import { canPlaceTowerAt } from './placement';

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
  waveDelay: WAVE_DELAY,
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
const SNIPER_AIM_THRESHOLD = 0.05;

const applyDamageToEnemy = (
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

  state.enemies = state.enemies.filter((item) => item.id !== enemy.id);
  state.score += SCORE_CONFIG[enemy.enemyType] ?? SCORE_CONFIG.default;
  createExplosion(state, enemy.x, enemy.y, enemy.color, bigExplosion ? 15 : 10);
  return true;
};

const findNearestEnemy = (
  enemies: GameState['enemies'],
  x: number,
  y: number,
  range: number,
  excludeIds?: Set<string> | string[],
) => {
  let best: GameState['enemies'][number] | null = null;
  let bestDistance = range;

  for (const enemy of enemies) {
    if (excludeIds && (excludeIds instanceof Set ? excludeIds.has(enemy.id) : excludeIds.includes(enemy.id))) {
      continue;
    }

    const distance = Math.hypot(enemy.x - x, enemy.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = enemy;
    }
  }

  return best;
};

const GATLING_SHOT_INTERVAL = 1000 / GATLING_SHOTS_PER_SECOND;

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
    maxRange: GATLING_BULLET_RANGE,
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

const updateIncomingDrops = (state: GameState, dt: number) => {
  let changed = false;

  for (let index = state.incomingDrops.length - 1; index >= 0; index--) {
    const drop = state.incomingDrops[index];
    drop.life += dt;

    if (drop.life < drop.duration) {
      changed = true;
      continue;
    }

    let towerPlaced = false;
    if (canPlaceTowerAt(state, drop.towerType, drop.targetGridX, drop.targetGridY, drop.id)) {
      addTowerToState(state, createTowerAt(drop.towerType, drop.targetGridX, drop.targetGridY));
      towerPlaced = true;
    }

    if (towerPlaced) {
      const impactColor = TOWER_STATS[drop.towerType].color;
      createExplosion(state, drop.targetX, drop.targetY, impactColor, 18);
      state.hitEffects.push({
        x: drop.targetX,
        y: drop.targetY,
        life: 0,
        maxLife: 0.35,
        color: impactColor,
        radius: 24,
      });
    }

    state.incomingDrops.splice(index, 1);
    changed = true;
  }

  if (state.pendingBossBonusPick && state.incomingDrops.length === 0) {
    state.pendingBossBonusPick = false;
    state.pickOptions = generateBossBonusPickOptions();
    state.pickUiPhase = 'boss_bonus';
    state.status = 'pick';
    changed = true;
  }

  return changed;
};

const updatePowerSystems = (state: GameState, dt: number, now: number) => {
  let changed = false;

  state.powerTimer += dt;
  if (state.powerTimer >= POWER_INTERVAL) {
    state.powerTimer -= POWER_INTERVAL;
    for (const tower of state.towers) {
      if (tower.type === 'core' || (tower.type === 'generator' && tower.powered)) {
        dispatchPulse(state, tower);
        changed = true;
      }
    }
  }

  for (const tower of state.towers) {
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
      if (target) {
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

  for (const tower of state.towers) {
    if (tower.type === 'gatling' && tower.heat > 0) {
      tower.heat = Math.max(0, tower.heat * Math.pow(1 - GATLING_HEAT_DECAY_PCT, dt));
      if (tower.overloaded && tower.heat <= 0.001) {
        tower.heat = 0;
        tower.overloaded = false;
      }
      changed = true;
    }
  }

  const turretTypes = new Set<Tower['type']>(['blaster', 'gatling', 'sniper']);

  for (const tower of state.towers) {
    if (!turretTypes.has(tower.type)) continue;
    if (!tower.powered) {
      if (tower.type === 'sniper') tower.sniperAimSince = undefined;
      continue;
    }

    const baseX = (tower.x + tower.width / 2) * GLOBAL_CONFIG.cellSize;
    const baseY = (tower.y + tower.height / 2) * GLOBAL_CONFIG.cellSize;
    const range: number =
      tower.type === 'sniper' ? SNIPER_RANGE : tower.type === 'gatling' ? GATLING_RANGE : BLASTER_RANGE;

    let bestDistance = range;
    let targetX = 0;
    let targetY = 0;
    let hasTarget = false;
    let bestEnemy: GameState['enemies'][number] | null = null;

    for (const enemy of state.enemies) {
      const distance = Math.hypot(enemy.x - baseX, enemy.y - baseY);
      if (distance < bestDistance) {
        bestDistance = distance;
        targetX = enemy.x;
        targetY = enemy.y;
        hasTarget = true;
        bestEnemy = enemy;
      }
    }

    if (hasTarget) {
      const desired = Math.atan2(targetY - baseY, targetX - baseX);
      let diff = desired - tower.barrelAngle;
      while (diff > Math.PI) diff -= TWO_PI;
      while (diff < -Math.PI) diff += TWO_PI;
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
      (baseBarrelLength + 6) * 1.28;
    const muzzleX = baseX + Math.cos(tower.barrelAngle) * barrelLength;
    const muzzleY = baseY + Math.sin(tower.barrelAngle) * barrelLength;

    if (tower.type === 'blaster') {
      if (tower.storedPower < BLASTER_POWER_COST || now - tower.lastActionTime <= BLASTER_COOLDOWN) continue;

      tower.storedPower -= BLASTER_POWER_COST;
      state.projectiles.push({
        id: genId(),
        x: muzzleX,
        y: muzzleY,
        targetId: bestEnemy?.id ?? '',
        speed: BLASTER_BULLET_SPEED,
        damage: BLASTER_DAMAGE,
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

    const desiredAngle = Math.atan2(targetY - baseY, targetX - baseX);
    let aimDiff = desiredAngle - tower.barrelAngle;
    while (aimDiff > Math.PI) aimDiff -= TWO_PI;
    while (aimDiff < -Math.PI) aimDiff += TWO_PI;

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
      maxRange: SNIPER_MAX_RANGE,
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
    if (tower.type !== 'tesla' || !tower.powered || tower.storedPower <= 0) continue;
    if (now - tower.lastActionTime <= TESLA_COOLDOWN) continue;

    const baseX = (tower.x + tower.width / 2) * GLOBAL_CONFIG.cellSize;
    const baseY = (tower.y + tower.height / 2) * GLOBAL_CONFIG.cellSize;
    let firstEnemy = findNearestEnemy(state.enemies, baseX, baseY, TESLA_RANGE);
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

  return changed;
};

const updateWaveState = (state: GameState, dt: number) => {
  let changed = false;

  if (state.gameMode === 'custom') return changed;

  if (state.enemies.length === 0 && state.enemiesToSpawn === 0) {
    if (state.needsPick) {
      if (state.wave > 0) {
        state.score += state.wave * WAVE_CLEAR_SCORE_MUL;
        state.gold += SHOP_CONFIG.goldPerWave;
      }
      const isBossWave = state.wave > 0 && state.wave % BOSS_WAVE_INTERVAL === 0;
      state.bossBonusPickQueued = isBossWave;
      state.pickUiPhase = 'standard';
      state.pickOptions = generatePickOptions();
      state.status = 'pick';
      changed = true;
    } else {
      state.waveTimer += dt;
      if (state.waveTimer > WAVE_DELAY) {
        state.wave++;
        state.enemiesToSpawn = Math.floor(
          ENEMY_SCALING.spawnBase +
            state.wave * ENEMY_SCALING.spawnLinear +
            Math.sqrt(state.wave) * ENEMY_SCALING.spawnSqrt,
        );
        state.waveTimer = 0;
        state.needsPick = true;
        if (state.wave % BOSS_WAVE_INTERVAL === 0) spawnBoss(state, state.wave);
        changed = true;
      }
    }
  }

  if (state.enemiesToSpawn > 0) {
    state.spawnTimer += dt;
    if (state.spawnTimer > SPAWN_INTERVAL) {
      spawnEnemy(state, state.wave);
      state.enemiesToSpawn--;
      state.spawnTimer = 0;
      changed = true;
    }
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

const updateEnemyState = (state: GameState, dt: number, now: number) => {
  let changed = false;

  for (const enemy of state.enemies) {
    if (enemy.isStatic) continue;

    let minDistance = Infinity;
    let targetPos = { x: 0, y: 0 };
    let isShieldTarget = false;
    let targetTower: Tower | null = null;
    let targetWire: GameState['wires'][number] | null = null;
    const isSaboteur = enemy.enemyType === 'saboteur';

    for (const tower of state.towers) {
      // Query the tower's collider component so enemies must visually touch the body
      const closest = closestPointOnTower(tower, enemy.x, enemy.y);
      const tx = closest.x;
      const ty = closest.y;
      const distance = Math.hypot(tx - enemy.x, ty - enemy.y);
      const weightedDistance = isSaboteur ? distance * ENEMY_AI_CONFIG.saboteurTowerDistMul : distance;

      if (weightedDistance < minDistance) {
        minDistance = weightedDistance;
        targetTower = tower;
        targetWire = null;
        isShieldTarget = false;
        targetPos = { x: tx, y: ty };
      }

      if (tower.shieldHp <= 0 || tower.shieldRadius <= 0 || !tower.powered) continue;

      const shieldCenterX = (tower.x + tower.width / 2) * GLOBAL_CONFIG.cellSize;
      const shieldCenterY = (tower.y + tower.height / 2) * GLOBAL_CONFIG.cellSize;
      const shieldDistance = Math.max(0, Math.hypot(shieldCenterX - enemy.x, shieldCenterY - enemy.y) - tower.shieldRadius);
      const weightedShieldDistance = isSaboteur ? shieldDistance * ENEMY_AI_CONFIG.saboteurTowerDistMul : shieldDistance;
      if (weightedShieldDistance < minDistance) {
        minDistance = weightedShieldDistance;
        targetTower = tower;
        targetWire = null;
        isShieldTarget = true;
        const angle = Math.atan2(enemy.y - shieldCenterY, enemy.x - shieldCenterX);
        targetPos = {
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
          targetTower = null;
          targetWire = wire;
          isShieldTarget = false;
          targetPos = { x: wireX, y: wireY };
        }
      }
    }

    if (!targetTower && !targetWire) continue;

    const actualDistance = Math.hypot(targetPos.x - enemy.x, targetPos.y - enemy.y);
    if (actualDistance > ATTACK_RANGE) {
      const angle = Math.atan2(targetPos.y - enemy.y, targetPos.x - enemy.x);
      enemy.x += Math.cos(angle) * enemy.speed * dt;
      enemy.y += Math.sin(angle) * enemy.speed * dt;
      enemy.heading = angle;
      changed = true;
      continue;
    }

    if (now - enemy.lastAttackTime <= enemy.attackCooldown) continue;

    if (targetWire) {
      targetWire.hp -= enemy.damage * enemy.wireDamageMul;
      state.hitEffects.push({ x: targetPos.x, y: targetPos.y, life: 0, maxLife: 0.3, color: '#ef4444', radius: 12 });
      createExplosion(state, targetPos.x, targetPos.y, '#ef4444', 3);
      if (targetWire.hp <= 0) {
        state.wires = state.wires.filter((wire) => wire.id !== targetWire!.id);
        updatePowerGrid(state);
      }
      enemy.lastAttackTime = now;
      changed = true;
      continue;
    }

    if (!targetTower) continue;

    if (isShieldTarget) {
      const previousHp = targetTower.shieldHp;
      targetTower.shieldHp = Math.max(0, targetTower.shieldHp - enemy.damage);
      state.hitEffects.push({ x: targetPos.x, y: targetPos.y, life: 0, maxLife: 0.35, color: '#22d3ee', radius: 18 });
      createExplosion(state, targetPos.x, targetPos.y, '#22d3ee', 4);

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
      state.hitEffects.push({ x: targetPos.x, y: targetPos.y, life: 0, maxLife: 0.3, color: '#ef4444', radius: 14 });
      createExplosion(state, targetPos.x, targetPos.y, '#f87171', 4);

      if (targetTower.hp <= 0) {
        if (targetTower.type === 'core') state.status = 'gameover';
        destroyTower(state, targetTower.id);
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
        spawnEnemyAt(state, 'scout', state.wave, enemy.x + offset, enemy.y + offset);
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

const findEnemyById = (state: GameState, id: string) => state.enemies.find((enemy) => enemy.id === id);

const updateProjectiles = (state: GameState, dt: number) => {
  let changed = false;

  for (let index = state.projectiles.length - 1; index >= 0; index--) {
    const projectile = state.projectiles[index];

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
        applyDamageToEnemy(state, target, projectile.damage, projectile.color ?? '#fbbf24', true);
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

const updateTransientEffects = (state: GameState, dt: number) => {
  let changed = false;

  for (let index = state.chainLightnings.length - 1; index >= 0; index--) {
    state.chainLightnings[index].life += dt;
    if (state.chainLightnings[index].life >= state.chainLightnings[index].maxLife) {
      state.chainLightnings.splice(index, 1);
    }
    changed = true;
  }

  for (let index = state.particles.length - 1; index >= 0; index--) {
    const particle = state.particles[index];
    particle.life += dt;
    if (particle.life >= particle.maxLife) {
      state.particles.splice(index, 1);
    } else {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
    changed = true;
  }

  for (let index = state.hitEffects.length - 1; index >= 0; index--) {
    const effect: HitEffect = state.hitEffects[index];
    effect.life += dt;
    if (effect.life >= effect.maxLife) state.hitEffects.splice(index, 1);
    changed = true;
  }

  for (let index = state.shieldBreakEffects.length - 1; index >= 0; index--) {
    const effect = state.shieldBreakEffects[index];
    effect.life += dt;
    for (const fragment of effect.fragments) fragment.dist += fragment.speed * dt;
    if (effect.life >= effect.maxLife) state.shieldBreakEffects.splice(index, 1);
    changed = true;
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
  changed = updateProjectiles(state, dt) || changed;
  changed = updateTransientEffects(state, dt) || changed;

  return changed;
};

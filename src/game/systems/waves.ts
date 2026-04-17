import { GameState } from '../types';
import { generatePickOptions, spawnBoss, spawnEnemy, spawnEnemyOfType } from '../engine';
import { ENEMY_SCALING, GLOBAL_CONFIG, THEME_WAVE_CONFIG } from '../config';

const {
  bossWaveInterval: BOSS_WAVE_INTERVAL,
  spawnInterval: SPAWN_INTERVAL,
  waveClearScoreMul: WAVE_CLEAR_SCORE_MUL,
} = GLOBAL_CONFIG;

const getBaseSpawnCount = (wave: number) => {
  const baseCount = Math.floor(
    ENEMY_SCALING.spawnBase +
      wave * ENEMY_SCALING.spawnLinear +
      Math.sqrt(wave) * ENEMY_SCALING.spawnSqrt,
  );
  const lateWave = Math.max(0, wave - ENEMY_SCALING.lateStartWave);
  const lateBonus = Math.floor(
    lateWave * ENEMY_SCALING.lateLinear +
      Math.sqrt(lateWave) * ENEMY_SCALING.lateSqrt,
  );
  return baseCount + lateBonus;
};

const getThemeSpawnQueue = (wave: number): GameState['themeEnemiesToSpawn'] => {
  const { startWave, interval, enemySequence, countBase, countLinear, countSqrt, typeCountWeight } = THEME_WAVE_CONFIG;
  if (wave < startWave || (wave - startWave) % interval !== 0) return [];

  const themeIndex = Math.floor((wave - startWave) / interval);
  const enemyType = enemySequence[themeIndex % enemySequence.length];
  const count = Math.max(1, Math.floor(
    (countBase + themeIndex * countLinear + Math.sqrt(wave) * countSqrt) *
      typeCountWeight[enemyType],
  ));

  return Array.from({ length: count }, () => enemyType);
};

const expandMapAfterBoss = (state: GameState) => {
  const nextWidth = Math.min(GLOBAL_CONFIG.gridWidth, state.mapWidth + GLOBAL_CONFIG.mapExpandStep);
  const nextHeight = Math.min(GLOBAL_CONFIG.gridHeight, state.mapHeight + GLOBAL_CONFIG.mapExpandStep);
  const shiftX = Math.floor((nextWidth - state.mapWidth) / 2);
  const shiftY = Math.floor((nextHeight - state.mapHeight) / 2);
  if (shiftX <= 0 && shiftY <= 0) return false;

  const pixelShiftX = shiftX * GLOBAL_CONFIG.cellSize;
  const pixelShiftY = shiftY * GLOBAL_CONFIG.cellSize;

  state.mapWidth = nextWidth;
  state.mapHeight = nextHeight;

  for (const tower of state.towers) {
    tower.x += shiftX;
    tower.y += shiftY;
  }
  for (const wire of state.wires) {
    wire.path = wire.path.map(point => ({ x: point.x + shiftX, y: point.y + shiftY }));
  }
  for (const drop of state.incomingDrops) {
    drop.targetGridX += shiftX;
    drop.targetGridY += shiftY;
    drop.startX += pixelShiftX;
    drop.startY += pixelShiftY;
    drop.targetX += pixelShiftX;
    drop.targetY += pixelShiftY;
  }
  for (const pulse of state.pulses) {
    pulse.path = pulse.path.map(point => ({ x: point.x + pixelShiftX, y: point.y + pixelShiftY }));
  }
  for (const enemy of state.enemies) {
    enemy.x += pixelShiftX;
    enemy.y += pixelShiftY;
  }
  for (const projectile of state.projectiles) {
    projectile.x += pixelShiftX;
    projectile.y += pixelShiftY;
  }
  for (const drone of state.repairDrones) {
    drone.x += pixelShiftX;
    drone.y += pixelShiftY;
    drone.homeX += pixelShiftX;
    drone.homeY += pixelShiftY;
    drone.targetX += pixelShiftX;
    drone.targetY += pixelShiftY;
  }
  for (const lightning of state.chainLightnings) {
    lightning.segments = lightning.segments.map(segment => ({
      x1: segment.x1 + pixelShiftX,
      y1: segment.y1 + pixelShiftY,
      x2: segment.x2 + pixelShiftX,
      y2: segment.y2 + pixelShiftY,
    }));
  }
  for (const particle of state.particles) {
    particle.x += pixelShiftX;
    particle.y += pixelShiftY;
  }
  for (const effect of state.hitEffects) {
    effect.x += pixelShiftX;
    effect.y += pixelShiftY;
  }
  for (const effect of state.shieldBreakEffects) {
    effect.x += pixelShiftX;
    effect.y += pixelShiftY;
  }

  return true;
};

export const startNextWave = (state: GameState) => {
  if (state.gameMode === 'custom') return false;
  if (state.status !== 'playing') return false;
  if (state.enemies.length > 0 || state.enemiesToSpawn > 0 || state.themeEnemiesToSpawn.length > 0) return false;
  if (state.needsPick || state.pendingBossBonusPick) return false;

  state.wave++;
  state.enemiesToSpawn = getBaseSpawnCount(state.wave);
  state.themeEnemiesToSpawn = getThemeSpawnQueue(state.wave);
  state.waveTimer = 0;
  state.spawnTimer = 0;
  state.needsPick = true;
  if (state.wave % BOSS_WAVE_INTERVAL === 0) spawnBoss(state, state.wave);
  return true;
};

export const updateWaveState = (state: GameState, dt: number) => {
  let changed = false;

  if (state.gameMode === 'custom') return changed;

  if (state.enemies.length === 0 && state.enemiesToSpawn === 0 && state.themeEnemiesToSpawn.length === 0) {
    if (state.needsPick) {
      if (state.wave > 0) {
        state.score += state.wave * WAVE_CLEAR_SCORE_MUL;
      }
      const isBossWave = state.wave > 0 && state.wave % BOSS_WAVE_INTERVAL === 0;
      if (isBossWave) changed = expandMapAfterBoss(state) || changed;
      state.bossBonusPickQueued = isBossWave;
      state.pickUiPhase = 'standard';
      state.pickOptions = generatePickOptions();
      state.status = 'pick';
      changed = true;
    }
  }

  if (state.enemiesToSpawn > 0 || state.themeEnemiesToSpawn.length > 0) {
    state.spawnTimer += dt;
    if (state.spawnTimer > SPAWN_INTERVAL) {
      if (state.enemiesToSpawn > 0) {
        spawnEnemy(state, state.wave);
        state.enemiesToSpawn--;
      } else {
        const themeEnemyType = state.themeEnemiesToSpawn.shift();
        if (themeEnemyType) spawnEnemyOfType(state, themeEnemyType, state.wave);
      }
      state.spawnTimer = 0;
      changed = true;
    }
  }

  return changed;
};



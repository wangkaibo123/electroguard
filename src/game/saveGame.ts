import { GameState } from './types';
import { rebuildTowerMap } from './engine';

const SAVE_KEY = 'electroguard_save_v1';

const TRANSIENT_KEYS = new Set<keyof GameState>([
  'enemies',
  'projectiles',
  'pulses',
  'chainLightnings',
  'particles',
  'hitEffects',
  'shieldBreakEffects',
  'incomingDrops',
  'repairDrones',
]);

const normalizeLoadedRuntimeState = (state: GameState) => {
  for (const tower of state.towers) {
    tower.incomingPower = 0;
    tower.lastActionTime = 0;
    tower.lastDamagedAt = 0;
    tower.sniperAimSince = undefined;
    tower.coreTurretLastShot = 0;
    tower.aiTargetId = undefined;
    tower.aiRetargetAt = undefined;
  }

  for (const wire of state.wires) {
    wire.createdAt = undefined;
  }
};

export const hasSavedGame = (): boolean => {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
};

export const clearSavedGame = () => {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
};

export const saveGameState = (state: GameState) => {
  if (state.gameMode === 'custom') return;
  try {
    const data = JSON.stringify(state, (key, value) => {
      if (key === 'towerMap') return undefined;
      if (TRANSIENT_KEYS.has(key as keyof GameState)) return [];
      return value;
    });
    localStorage.setItem(SAVE_KEY, data);
  } catch {}
};

export const loadSavedGame = (): GameState | null => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    parsed.towerMap = new Map();
    rebuildTowerMap(parsed);
    parsed.status = 'playing';
    parsed.needsPick = false;
    parsed.pickOptions = [];
    parsed.pendingBossBonusPick = false;
    parsed.bossBonusPickQueued = false;
    parsed.enemies = [];
    parsed.projectiles = [];
    parsed.pulses = [];
    parsed.chainLightnings = [];
    parsed.particles = [];
    parsed.hitEffects = [];
    parsed.shieldBreakEffects = [];
    parsed.incomingDrops = [];
    parsed.repairDrones = [];
    parsed.enemiesToSpawn = 0;
    parsed.themeEnemiesToSpawn = [];
    parsed.spawnTimer = 0;
    parsed.waveTimer = 0;
    normalizeLoadedRuntimeState(parsed);
    return parsed;
  } catch {
    clearSavedGame();
    return null;
  }
};

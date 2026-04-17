import { GameState, TOWER_STATS } from '../types';
import { createExplosion, generateBossBonusPickOptions } from '../engine';
import { addTowerToState, createTowerAt } from '../towerFactory';
import { canPlaceTowerAt } from '../placement';

export const updateIncomingDrops = (state: GameState, dt: number) => {
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



import { GameState, HitEffect } from '../types';

const MAX_CHAIN_LIGHTNINGS = 96;
const MAX_PARTICLES = 900;
const MAX_HIT_EFFECTS = 260;
const MAX_SHIELD_BREAK_EFFECTS = 24;

const trimOldest = <T>(items: T[], maxLength: number) => {
  const overflow = items.length - maxLength;
  if (overflow > 0) items.splice(0, overflow);
};

export const updateTransientEffects = (state: GameState, dt: number) => {
  let changed = false;

  trimOldest(state.chainLightnings, MAX_CHAIN_LIGHTNINGS);
  trimOldest(state.particles, MAX_PARTICLES);
  trimOldest(state.hitEffects, MAX_HIT_EFFECTS);
  trimOldest(state.shieldBreakEffects, MAX_SHIELD_BREAK_EFFECTS);

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


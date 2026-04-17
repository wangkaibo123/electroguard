import { GameState, HitEffect } from '../types';

export const updateTransientEffects = (state: GameState, dt: number) => {
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



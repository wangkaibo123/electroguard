import {
  GameState,
  Port,
  PortDirection,
  Tower,
  TowerType,
  TOWER_STATS,
} from './types';
import { genId, generatePorts, updatePowerGrid } from './engine';

const createTowerPorts = (type: TowerType): Port[] => {
  if (type === 'battery') {
    return [
      { id: genId(), direction: 'left', portType: 'input' },
      { id: genId(), direction: 'right', portType: 'output' },
    ];
  }

  if (type === 'generator') {
    return generatePorts('output');
  }

  if (type === 'shield') {
    const dirs: PortDirection[] = ['top', 'right', 'bottom', 'left'];
    return [{ id: genId(), direction: dirs[(Math.random() * 4) | 0], portType: 'input' }];
  }

  if (type === 'bus') {
    return [
      { id: genId(), direction: 'top', portType: 'input', sideOffset: 1 / 6 },
      { id: genId(), direction: 'top', portType: 'input', sideOffset: 3 / 6 },
      { id: genId(), direction: 'top', portType: 'input', sideOffset: 5 / 6 },
      { id: genId(), direction: 'bottom', portType: 'output', sideOffset: 1 / 6 },
      { id: genId(), direction: 'bottom', portType: 'output', sideOffset: 3 / 6 },
      { id: genId(), direction: 'bottom', portType: 'output', sideOffset: 5 / 6 },
    ];
  }

  if (type === 'blaster' || type === 'gatling' || type === 'sniper' || type === 'tesla') {
    return generatePorts('input');
  }

  return [];
};

export const createTowerAt = (type: TowerType, x: number, y: number): Tower => {
  const stats = TOWER_STATS[type];

  return {
    id: genId(),
    type,
    x,
    y,
    width: stats.width,
    height: stats.height,
    hp: stats.hp,
    maxHp: stats.hp,
    powered: false,
    storedPower: 0,
    maxPower: stats.maxPower,
    incomingPower: 0,
    shieldHp: stats.maxShieldHp,
    maxShieldHp: stats.maxShieldHp,
    shieldRadius: stats.shieldRadius,
    lastActionTime: type === 'shield' ? performance.now() : 0,
    ports: createTowerPorts(type),
    rotation: 0,
    barrelAngle: 0,
    heat: 0,
    overloaded: false,
    gatlingAmmo: 0,
  };
};

export const addTowerToState = (state: GameState, tower: Tower) => {
  state.towers.push(tower);
  state.towerMap.set(tower.id, tower);
  updatePowerGrid(state);
};

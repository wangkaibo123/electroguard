import {
  GameState,
  Port,
  Tower,
  TowerType,
  TOWER_STATS,
} from './types';
import { genId, generatePorts, syncDirectPortLinks, updatePowerGrid } from './engine';
import { makeTowerCollider } from './collider';

const createTowerPorts = (type: TowerType): Port[] => {
  const allSideInputPorts = (): Port[] => [
    { id: genId(), direction: 'top', portType: 'input' },
    { id: genId(), direction: 'right', portType: 'input' },
    { id: genId(), direction: 'bottom', portType: 'input' },
    { id: genId(), direction: 'left', portType: 'input' },
  ];

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
    return allSideInputPorts();
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
    return allSideInputPorts();
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
    lastDamagedAt: 0,
    ports: createTowerPorts(type),
    rotation: 0,
    barrelAngle: 0,
    heat: 0,
    overloaded: false,
    gatlingAmmo: 0,
    collider: makeTowerCollider(type, stats.width, stats.height),
  };
};

export const addTowerToState = (state: GameState, tower: Tower) => {
  state.towers.push(tower);
  state.towerMap.set(tower.id, tower);
  if (!syncDirectPortLinks(state, { towerId: tower.id, createSpark: true })) {
    updatePowerGrid(state);
  }
};

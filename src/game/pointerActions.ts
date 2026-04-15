import {
  applyTowerRotation,
  canDirectLinkPorts,
  collidesWithTowers,
  collidesWithWires,
  findWirePath,
  getPortCell,
  getPortPos,
  isPortAccessible,
  repathConnectedWires,
  snapRotation,
  updatePowerGrid,
} from './engine';
import { CELL_SIZE, GRID_HEIGHT, GRID_WIDTH, GameState, WIRE_MAX_HP, Wire } from './types';
import { getDeleteButtonLayout, getRotationKnobLayout } from './render/towers';
import { isWorldPointInTowerFootprint } from './footprint';

export const getGridCell = (wx: number, wy: number) => ({
  x: (wx / CELL_SIZE) | 0,
  y: (wy / CELL_SIZE) | 0,
});

export const getHoverCell = (wx: number, wy: number) => {
  const cell = getGridCell(wx, wy);
  return cell.x >= 0 && cell.x < GRID_WIDTH && cell.y >= 0 && cell.y < GRID_HEIGHT ? cell : null;
};

export const previewWirePath = (
  state: GameState,
  dragStart: { towerId: string; portId: string },
  wx: number,
  wy: number,
  hitRadius: number,
) => {
  const startTower = state.towerMap.get(dragStart.towerId);
  const startPort = startTower?.ports.find(port => port.id === dragStart.portId);
  if (!startTower || startTower.isRuined || !startPort) return null;

  const startCell = getPortCell(startTower, startPort);
  let endCell = getGridCell(wx, wy);
  let directPath = false;

  for (const tower of state.towers) {
    if (tower.isRuined) continue;
    for (const port of tower.ports) {
      const portPos = getPortPos(tower, port);
      if (Math.hypot(portPos.x - wx, portPos.y - wy) >= hitRadius || tower.id === startTower.id) continue;
      if (canDirectLinkPorts(state, startTower, startPort, tower, port)) {
        directPath = true;
        break;
      }
      if (isPortAccessible(state, tower, port)) {
        endCell = getPortCell(tower, port);
        break;
      }
    }
    if (directPath) break;
  }

  return directPath ? [] : findWirePath(startCell, endCell, state);
};

export const moveDraggedTower = (
  state: GameState,
  towerId: string,
  wx: number,
  wy: number,
) => {
  const tower = state.towerMap.get(towerId);
  if (!tower) return false;

  const nx = ((wx / CELL_SIZE) | 0) - (tower.width >> 1);
  const ny = ((wy / CELL_SIZE) | 0) - (tower.height >> 1);
  if (nx < 0 || ny < 0 || nx + tower.width > GRID_WIDTH || ny + tower.height > GRID_HEIGHT) return false;
  if (collidesWithTowers(nx, ny, tower.width, tower.height, state.towers, tower.id, 0, tower.type)) return false;
  if (collidesWithWires(nx, ny, tower.width, tower.height, state.wires, tower.id, 0, tower.type)) return false;
  if (tower.x === nx && tower.y === ny) return false;

  tower.x = nx;
  tower.y = ny;
  repathConnectedWires(state, tower.id);
  return true;
};

export const hitRotatingControl = (
  state: GameState,
  towerId: string | null,
  wx: number,
  wy: number,
  touchPadding = 0,
): 'delete' | 'rotate' | null => {
  if (!towerId) return null;
  const tower = state.towerMap.get(towerId);
  if (!tower) return null;

  if (state.gameMode !== 'custom' && tower.type !== 'core') {
    const { buttonX, buttonY, buttonWidth, buttonHeight } = getDeleteButtonLayout(tower);
    if (
      wx >= buttonX - touchPadding &&
      wx <= buttonX + buttonWidth + touchPadding &&
      wy >= buttonY - touchPadding &&
      wy <= buttonY + buttonHeight + touchPadding
    ) {
      return 'delete';
    }
  }

  if (!tower.isRuined) {
    const { buttonX, buttonY, buttonWidth, buttonHeight } = getRotationKnobLayout(tower);
    if (
      wx >= buttonX - touchPadding &&
      wx <= buttonX + buttonWidth + touchPadding &&
      wy >= buttonY - touchPadding &&
      wy <= buttonY + buttonHeight + touchPadding
    ) {
      return 'rotate';
    }
  }

  return null;
};

export const rotateTowerQuarterTurn = (state: GameState, towerId: string) => {
  const tower = state.towerMap.get(towerId);
  if (!tower || tower.isRuined) return false;
  const oldAngle = snapRotation(tower.rotation);
  const newAngle = snapRotation(oldAngle + Math.PI / 2);
  return applyTowerRotation(tower, newAngle, oldAngle, state);
};

export type WireDragStartResult =
  | { kind: 'none' }
  | { kind: 'direct_wire' }
  | { kind: 'no_wires' }
  | { kind: 'inaccessible' }
  | { kind: 'started'; dragStart: { towerId: string; portId: string }; removedWire: boolean };

export const startWireDragAt = (
  state: GameState,
  wx: number,
  wy: number,
  hitRadius: number,
): WireDragStartResult => {
  for (const tower of state.towers) {
    if (tower.isRuined) continue;
    for (const port of tower.ports) {
      const portPos = getPortPos(tower, port);
      if (Math.hypot(portPos.x - wx, portPos.y - wy) >= hitRadius) continue;
      const existIdx = state.wires.findIndex(wire => wire.startPortId === port.id || wire.endPortId === port.id);

      if (existIdx !== -1) {
        if (state.wires[existIdx].direct) return { kind: 'direct_wire' };
        state.wires.splice(existIdx, 1);
        if (state.gameMode !== 'custom') state.wireInventory++;
        updatePowerGrid(state);
        return {
          kind: 'started',
          dragStart: { towerId: tower.id, portId: port.id },
          removedWire: true,
        };
      }

      if (state.gameMode !== 'custom' && state.wireInventory <= 0) return { kind: 'no_wires' };
      if (!isPortAccessible(state, tower, port)) return { kind: 'inaccessible' };

      return {
        kind: 'started',
        dragStart: { towerId: tower.id, portId: port.id },
        removedWire: false,
      };
    }
  }

  return { kind: 'none' };
};

export type TowerDragStartResult =
  | { kind: 'none' }
  | { kind: 'core' }
  | { kind: 'tower'; towerId: string; originalPos: { x: number; y: number }; connectedWires: Wire[]; wireInventory: number };

export const startTowerDragAt = (
  state: GameState,
  wx: number,
  wy: number,
): TowerDragStartResult => {
  for (const tower of state.towers) {
    if (!isWorldPointInTowerFootprint(tower, wx, wy)) continue;
    if (tower.type === 'core') return { kind: 'core' };

    const connectedWires = state.wires
      .filter(wire => wire.startTowerId === tower.id || wire.endTowerId === tower.id)
      .map(wire => ({ ...wire, path: wire.path.map(point => ({ ...point })) }));

    return {
      kind: 'tower',
      towerId: tower.id,
      originalPos: { x: tower.x, y: tower.y },
      connectedWires,
      wireInventory: state.wireInventory,
    };
  }

  return { kind: 'none' };
};

export const createDirectWire = (
  state: GameState,
  startTower: GameState['towers'][number],
  startPort: GameState['towers'][number]['ports'][number],
  endTower: GameState['towers'][number],
  endPort: GameState['towers'][number]['ports'][number],
  id: string,
) => {
  state.wires.push({
    id,
    startTowerId: startTower.id,
    startPortId: startPort.id,
    endTowerId: endTower.id,
    endPortId: endPort.id,
    path: [],
    hp: WIRE_MAX_HP,
    maxHp: WIRE_MAX_HP,
    direct: true,
    createdAt: performance.now(),
  });
};

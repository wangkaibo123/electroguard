import {
  canDirectLinkPorts,
  collidesWithTowers,
  collidesWithWires,
  findWirePath,
  getPortCell,
  getPortPos,
  isPortAccessible,
  repathConnectedWires,
} from './engine';
import { CELL_SIZE, GRID_HEIGHT, GRID_WIDTH, GameState } from './types';

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
  if (!startTower || !startPort) return null;

  const startCell = getPortCell(startTower, startPort);
  let endCell = getGridCell(wx, wy);
  let directPath = false;

  for (const tower of state.towers) {
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

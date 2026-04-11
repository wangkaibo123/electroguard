import { CELL_SIZE, Position, Tower, TowerType } from './types';

export type TowerFootprintSpec = {
  x: number;
  y: number;
  width: number;
  height: number;
  type: TowerType;
};

const isShieldCross = (type: TowerType, width: number, height: number) =>
  type === 'shield' && width === 3 && height === 3;

export const getTowerFootprintCells = (
  x: number,
  y: number,
  width: number,
  height: number,
  type: TowerType,
): Position[] => {
  if (isShieldCross(type, width, height)) {
    return [
      { x: x + 1, y },
      { x, y: y + 1 },
      { x: x + 1, y: y + 1 },
      { x: x + 2, y: y + 1 },
      { x: x + 1, y: y + 2 },
    ];
  }

  const cells: Position[] = [];
  for (let gx = x; gx < x + width; gx++) {
    for (let gy = y; gy < y + height; gy++) {
      cells.push({ x: gx, y: gy });
    }
  }
  return cells;
};

export const getTowerCells = (tower: Tower) =>
  getTowerFootprintCells(tower.x, tower.y, tower.width, tower.height, tower.type);

export const footprintsOverlap = (
  a: TowerFootprintSpec,
  b: TowerFootprintSpec,
  clearance = 0,
) => {
  const aCells = getTowerFootprintCells(a.x, a.y, a.width, a.height, a.type);
  const bCells = getTowerFootprintCells(b.x, b.y, b.width, b.height, b.type);
  for (const ac of aCells) {
    for (const bc of bCells) {
      if (Math.abs(ac.x - bc.x) <= clearance && Math.abs(ac.y - bc.y) <= clearance) {
        return true;
      }
    }
  }
  return false;
};

export const isWorldPointInTowerFootprint = (tower: Tower, wx: number, wy: number) => {
  const gx = Math.floor(wx / CELL_SIZE);
  const gy = Math.floor(wy / CELL_SIZE);
  return getTowerCells(tower).some(cell => cell.x === gx && cell.y === gy);
};

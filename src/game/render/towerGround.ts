import { CELL_SIZE, GameState } from '../types';
import { getTowerCells } from '../footprint';

let cachedGround:
  | {
      key: string;
      cells: { x: number; y: number }[];
      cellKeys: Set<string>;
      hasCore: boolean;
    }
  | null = null;

const getGroundCacheKey = (state: GameState) =>
  state.towers
    .map((tower) => `${tower.id}:${tower.type}:${tower.x}:${tower.y}:${tower.width}:${tower.height}`)
    .join('|');

export const drawOccupiedGround = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const key = getGroundCacheKey(state);
  if (!cachedGround || cachedGround.key !== key) {
    const cellKeys = new Set<string>();
    const cells: { x: number; y: number }[] = [];
    let hasCore = false;

    for (const tower of state.towers) {
      if (tower.type === 'core') hasCore = true;
      for (const cell of getTowerCells(tower)) {
        const cellKey = `${cell.x},${cell.y}`;
        if (cellKeys.has(cellKey)) continue;
        cellKeys.add(cellKey);
        cells.push(cell);
      }
    }

    cachedGround = { key, cells, cellKeys, hasCore };
  }

  if (!cachedGround.cells.length) return;

  const hasCell = (x: number, y: number) => cachedGround!.cellKeys.has(`${x},${y}`);
  const baseInset = 1;
  const cellSize = CELL_SIZE - baseInset * 2;

  ctx.fillStyle = cachedGround.hasCore ? 'rgba(16,26,42,0.92)' : 'rgba(14,22,36,0.9)';
  for (const { x: gx, y: gy } of cachedGround.cells) {
    const px = gx * CELL_SIZE + baseInset;
    const py = gy * CELL_SIZE + baseInset;
    ctx.fillRect(px, py, cellSize, cellSize);
  }

  ctx.strokeStyle = cachedGround.hasCore ? 'rgba(96,165,250,0.14)' : 'rgba(148,163,184,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (const { x: gx, y: gy } of cachedGround.cells) {
    const left = gx * CELL_SIZE + baseInset;
    const right = (gx + 1) * CELL_SIZE - baseInset;
    const top = gy * CELL_SIZE + baseInset;
    const bottom = (gy + 1) * CELL_SIZE - baseInset;

    if (!hasCell(gx, gy - 1)) {
      ctx.moveTo(left, top);
      ctx.lineTo(right, top);
    }
    if (!hasCell(gx + 1, gy)) {
      ctx.moveTo(right, top);
      ctx.lineTo(right, bottom);
    }
    if (!hasCell(gx, gy + 1)) {
      ctx.moveTo(right, bottom);
      ctx.lineTo(left, bottom);
    }
    if (!hasCell(gx - 1, gy)) {
      ctx.moveTo(left, bottom);
      ctx.lineTo(left, top);
    }
  }

  ctx.stroke();
};

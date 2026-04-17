import { CELL_SIZE, GameState } from '../types';
import { getTowerCells } from '../footprint';

export const drawOccupiedGround = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const occupied = new Set<string>();
  let hasCore = false;

  for (const tower of state.towers) {
    if (tower.type === 'core') hasCore = true;
    for (const cell of getTowerCells(tower)) occupied.add(`${cell.x},${cell.y}`);
  }

  if (!occupied.size) return;

  const hasCell = (x: number, y: number) => occupied.has(`${x},${y}`);
  const baseInset = 1;
  const cellSize = CELL_SIZE - baseInset * 2;

  ctx.fillStyle = hasCore ? 'rgba(16,26,42,0.92)' : 'rgba(14,22,36,0.9)';
  for (const cell of occupied) {
    const [gx, gy] = cell.split(',').map(Number);
    const px = gx * CELL_SIZE + baseInset;
    const py = gy * CELL_SIZE + baseInset;
    ctx.fillRect(px, py, cellSize, cellSize);
  }

  ctx.strokeStyle = hasCore ? 'rgba(96,165,250,0.14)' : 'rgba(148,163,184,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (const cell of occupied) {
    const [gx, gy] = cell.split(',').map(Number);
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

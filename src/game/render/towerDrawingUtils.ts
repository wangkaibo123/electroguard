import { CELL_SIZE } from '../types';

export type LucideIconNode = [string, Record<string, string>][];

export const drawFootprintCells = (
  ctx: CanvasRenderingContext2D,
  cells: { x: number; y: number }[],
  inset: number,
  fill = true,
  stroke = true,
) => {
  for (const cell of cells) {
    const px = cell.x * CELL_SIZE;
    const py = cell.y * CELL_SIZE;
    if (fill) ctx.fillRect(px + inset, py + inset, CELL_SIZE - inset * 2, CELL_SIZE - inset * 2);
    if (stroke) ctx.strokeRect(px + inset, py + inset, CELL_SIZE - inset * 2, CELL_SIZE - inset * 2);
  }
};

export const drawLucideIconNode = (
  ctx: CanvasRenderingContext2D,
  iconNode: LucideIconNode,
  cx: number,
  cy: number,
  size: number,
  color: string,
) => {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'transparent';

  for (const [tag, attrs] of iconNode) {
    if (tag === 'path' && attrs.d) {
      ctx.stroke(new Path2D(attrs.d));
    } else if (tag === 'circle') {
      ctx.beginPath();
      ctx.arc(Number(attrs.cx), Number(attrs.cy), Number(attrs.r), 0, Math.PI * 2);
      ctx.stroke();
    } else if (tag === 'line') {
      ctx.beginPath();
      ctx.moveTo(Number(attrs.x1), Number(attrs.y1));
      ctx.lineTo(Number(attrs.x2), Number(attrs.y2));
      ctx.stroke();
    }
  }

  ctx.restore();
};

import { getTowerCells, getTowerFootprintCells } from '../footprint';
import { getLinearTowerBodyAspectRatio, getLinearTowerBodyRect } from '../linearTowerGeometry';
import { CELL_SIZE, GameState, TowerType, TOWER_STATS, getTowerRange } from '../types';
import { INSET } from './constants';
import { drawRangeCircle } from './helpers';
import { drawFootprintCells } from './towerDrawingUtils';

export const drawPlacementPreview = (
  ctx: CanvasRenderingContext2D, state: GameState,
  hoverPos: { x: number; y: number } | null,
  selectedTower: TowerType | null,
  canPlaceFlag: boolean,
) => {
  if (!hoverPos || !selectedTower || state.status !== 'playing') return;
  const stats = TOWER_STATS[selectedTower];
  const pi = INSET;
  const prevPx = hoverPos.x * CELL_SIZE;
  const prevPy = hoverPos.y * CELL_SIZE;
  const prevTw = stats.width * CELL_SIZE;
  const prevTh = stats.height * CELL_SIZE;
  const previewBody = (selectedTower === 'battery' || selectedTower === 'bus')
    ? getLinearTowerBodyRect(prevPx, prevPy, prevTw, prevTh, prevTw >= prevTh, getLinearTowerBodyAspectRatio(selectedTower))
    : { x: prevPx, y: prevPy, width: prevTw, height: prevTh };
  ctx.strokeStyle = canPlaceFlag ? stats.color : '#ef4444';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  if (selectedTower === 'shield') {
    drawFootprintCells(ctx, getTowerFootprintCells(hoverPos.x, hoverPos.y, stats.width, stats.height, selectedTower), pi, false, true);
  } else {
    ctx.strokeRect(previewBody.x + pi, previewBody.y + pi, previewBody.width - pi * 2, previewBody.height - pi * 2);
  }
  if (canPlaceFlag) {
    ctx.fillStyle = stats.color;
    ctx.globalAlpha = 0.15;
    if (selectedTower === 'shield') {
      drawFootprintCells(ctx, getTowerFootprintCells(hoverPos.x, hoverPos.y, stats.width, stats.height, selectedTower), pi, true, false);
    } else {
      ctx.fillRect(previewBody.x + pi, previewBody.y + pi, previewBody.width - pi * 2, previewBody.height - pi * 2);
    }
  }
  ctx.globalAlpha = 1;
};

export const drawDraggedTowerFootprint = (
  ctx: CanvasRenderingContext2D,
  state: GameState,
  draggedTowerId: string | null,
) => {
  if (!draggedTowerId || state.status !== 'playing') return;
  const tower = state.towerMap.get(draggedTowerId);
  if (!tower) return;

  const px = tower.x * CELL_SIZE;
  const py = tower.y * CELL_SIZE;
  const tw = tower.width * CELL_SIZE;
  const th = tower.height * CELL_SIZE;

  ctx.save();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 6]);
  if (tower.type === 'shield') {
    drawFootprintCells(ctx, getTowerCells(tower), 0, false, true);
  } else {
    ctx.strokeRect(px, py, tw, th);
  }
  ctx.setLineDash([4, 8]);
  ctx.fillStyle = 'rgba(250,204,21,0.08)';
  if (tower.type === 'shield') {
    drawFootprintCells(ctx, getTowerCells(tower), 0, true, false);
  } else {
    ctx.fillRect(px, py, tw, th);
  }
  ctx.restore();
};

export const drawRangePreview = (
  ctx: CanvasRenderingContext2D, state: GameState,
  hoverPos: { x: number; y: number } | null,
  selectedTower: TowerType | null,
  rotatingTowerId: string | null,
  draggedTowerId: string | null,
) => {
  if (hoverPos && selectedTower && state.status === 'playing') {
    const range = getTowerRange(selectedTower);
    if (range) {
      const stats = TOWER_STATS[selectedTower];
      const rcx = (hoverPos.x + stats.width / 2) * CELL_SIZE;
      const rcy = (hoverPos.y + stats.height / 2) * CELL_SIZE;
      drawRangeCircle(ctx, rcx, rcy, range, 0.15, 0.03);
    }
  }
  if (rotatingTowerId) {
    const rt = state.towerMap.get(rotatingTowerId);
    if (rt) {
      const range = getTowerRange(rt);
      if (range) {
        const rcx = (rt.x + rt.width / 2) * CELL_SIZE;
        const rcy = (rt.y + rt.height / 2) * CELL_SIZE;
        drawRangeCircle(ctx, rcx, rcy, range, 0.2, 0.04);
      }
    }
  }
  if (draggedTowerId) {
    const draggedTower = state.towerMap.get(draggedTowerId);
    if (draggedTower) {
      const range = getTowerRange(draggedTower);
      if (range) {
        const rcx = (draggedTower.x + draggedTower.width / 2) * CELL_SIZE;
        const rcy = (draggedTower.y + draggedTower.height / 2) * CELL_SIZE;
        drawRangeCircle(ctx, rcx, rcy, range, 0.24, 0.05);
      }
    }
  }
};

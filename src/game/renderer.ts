import { GameState, TowerType, CommandCardType, CELL_SIZE, Camera, getCanvasHeight, getCanvasWidth } from './types';
import { BG_DARK, BG_MID, BG_GRID, MAP_BORDER } from './render/constants';
import { updateAndDrawDecorations } from './render/decorations';
import {
  drawOccupiedGround, drawPorts, drawTowers, drawPlacementPreview, drawRangePreview,
  drawRotationKnob, drawDeleteButton, drawDraggedTowerFootprint, drawCommandCardTargeting, drawRepairTargeting,
} from './render/towers';
import { drawEnemies, drawEnemyPreview, drawOffscreenEnemyIndicators } from './render/enemies';
import {
  drawWires, drawDraggedWire, drawPulses, drawWireHpBars,
  drawShields, drawProjectiles, drawChainLightning,
  drawParticles, drawHitEffects, drawShieldBreakEffects, drawIncomingDrops, drawRepairDrones,
} from './render/effects';

export const renderGame = (
  ctx: CanvasRenderingContext2D,
  state: GameState,
  viewWidth: number,
  viewHeight: number,
  camera: Camera,
  hoverPos: { x: number; y: number } | null,
  selectedTower: TowerType | null,
  canPlaceFlag: boolean,
  draggedWireStart: { towerId: string; portId: string } | null,
  mouseWorldPos: { x: number; y: number } | null,
  draggedWirePath: { x: number; y: number }[] | null = null,
  draggedTowerId: string | null = null,
  rotatingTowerId: string | null = null,
  enemyPreview: { x: number; y: number; enemyType: import('./types').EnemyType; isStatic: boolean } | null = null,
  activeCommandCard: CommandCardType | null = null,
  activeRepair = false,
) => {
  const now = performance.now();

  const grad = ctx.createRadialGradient(
    viewWidth / 2,
    viewHeight / 2,
    0,
    viewWidth / 2,
    viewHeight / 2,
    Math.max(viewWidth, viewHeight) * 0.7,
  );
  grad.addColorStop(0, BG_MID);
  grad.addColorStop(1, BG_DARK);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  const canvasWidth = getCanvasWidth(state);
  const canvasHeight = getCanvasHeight(state);

  updateAndDrawDecorations(ctx, canvasWidth, canvasHeight, now);

  ctx.beginPath();
  for (let i = 0; i <= canvasWidth; i += CELL_SIZE) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvasHeight);
  }
  for (let i = 0; i <= canvasHeight; i += CELL_SIZE) {
    ctx.moveTo(0, i);
    ctx.lineTo(canvasWidth, i);
  }
  ctx.strokeStyle = BG_GRID;
  ctx.lineWidth = 1;
  ctx.stroke();

  const borderW = Math.max(1.5, CELL_SIZE * 0.12);
  ctx.fillStyle = MAP_BORDER;
  ctx.fillRect(0, 0, canvasWidth, borderW);
  ctx.fillRect(0, canvasHeight - borderW, canvasWidth, borderW);
  ctx.fillRect(0, 0, borderW, canvasHeight);
  ctx.fillRect(canvasWidth - borderW, 0, borderW, canvasHeight);

  drawOccupiedGround(ctx, state);
  drawWires(ctx, state);
  drawDraggedWire(ctx, state, draggedWireStart, mouseWorldPos, draggedWirePath);
  drawPulses(ctx, state, now, { launchEffects: false });
  drawWireHpBars(ctx, state);

  drawShields(ctx, state, now);
  drawRangePreview(ctx, state, hoverPos, selectedTower, rotatingTowerId, draggedTowerId);

  drawPorts(ctx, state);
  drawTowers(ctx, state, now, activeRepair);
  drawPulses(ctx, state, now, { travellingPulses: false });
  drawCommandCardTargeting(ctx, state, now, activeCommandCard);
  drawRepairTargeting(ctx, state, now, activeRepair);

  drawPlacementPreview(ctx, state, hoverPos, selectedTower, canPlaceFlag);
  drawDraggedTowerFootprint(ctx, state, draggedTowerId);
  drawRotationKnob(ctx, state, rotatingTowerId);
  drawDeleteButton(ctx, state, rotatingTowerId);

  drawIncomingDrops(ctx, state);
  drawEnemies(ctx, state, now);
  drawEnemyPreview(ctx, enemyPreview, now);

  drawRepairDrones(ctx, state, now);
  drawProjectiles(ctx, state);
  drawChainLightning(ctx, state);
  drawParticles(ctx, state);
  drawHitEffects(ctx, state);
  drawShieldBreakEffects(ctx, state);

  ctx.restore();

  drawOffscreenEnemyIndicators(ctx, state, viewWidth, viewHeight, camera, now);
};

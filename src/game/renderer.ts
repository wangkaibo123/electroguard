import { GameState, TowerType, CELL_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT, Camera } from './types';
import { BG_DARK, BG_MID, BG_GRID, MAP_BORDER } from './render/constants';
import { updateAndDrawDecorations } from './render/decorations';
import { drawPorts, drawTowers, drawPlacementPreview, drawRangePreview, drawRotationKnob } from './render/towers';
import { drawEnemies, drawEnemyPreview } from './render/enemies';
import {
  drawWires, drawDraggedWire, drawPulses, drawWireHpBars,
  drawShields, drawProjectiles, drawChainLightning,
  drawParticles, drawHitEffects, drawShieldBreakEffects, drawIncomingDrops,
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
  rotatingTowerId: string | null = null,
  enemyPreview: { x: number; y: number; enemyType: import('./types').EnemyType; isStatic: boolean } | null = null,
) => {
  const now = performance.now();

  // ── Background (screen space) ──────────────────────────────────────────────
  const grad = ctx.createRadialGradient(viewWidth / 2, viewHeight / 2, 0, viewWidth / 2, viewHeight / 2, Math.max(viewWidth, viewHeight) * 0.7);
  grad.addColorStop(0, BG_MID);
  grad.addColorStop(1, BG_DARK);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  // ── Camera transform (world space from here) ──────────────────────────────
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // ── Animated geometric decorations ─────────────────────────────────────────
  updateAndDrawDecorations(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, now);

  // ── Grid (very subtle) ─────────────────────────────────────────────────────
  ctx.beginPath();
  for (let i = 0; i <= CANVAS_WIDTH; i += CELL_SIZE) { ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); }
  for (let i = 0; i <= CANVAS_HEIGHT; i += CELL_SIZE) { ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); }
  ctx.strokeStyle = BG_GRID;
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── Map border ───────────────────────────────────────────────────────────
  const borderW = Math.max(1.5, CELL_SIZE * 0.12);
  ctx.fillStyle = MAP_BORDER;
  ctx.fillRect(0, 0, CANVAS_WIDTH, borderW);
  ctx.fillRect(0, CANVAS_HEIGHT - borderW, CANVAS_WIDTH, borderW);
  ctx.fillRect(0, 0, borderW, CANVAS_HEIGHT);
  ctx.fillRect(CANVAS_WIDTH - borderW, 0, borderW, CANVAS_HEIGHT);

  // ── Wires & pulses ────────────────────────────────────────────────────────
  drawWires(ctx, state);
  drawDraggedWire(ctx, state, draggedWireStart, mouseWorldPos, draggedWirePath);
  drawPulses(ctx, state, now);
  drawWireHpBars(ctx, state);

  // ── Shields ───────────────────────────────────────────────────────────────
  drawShields(ctx, state, now);

  // ── Range previews ────────────────────────────────────────────────────────
  drawRangePreview(ctx, state, hoverPos, selectedTower, rotatingTowerId);

  // ── Ports & towers ────────────────────────────────────────────────────────
  drawPorts(ctx, state);
  drawTowers(ctx, state, now);

  // ── Placement preview ─────────────────────────────────────────────────────
  drawPlacementPreview(ctx, state, hoverPos, selectedTower, canPlaceFlag);

  // ── Rotation knob ─────────────────────────────────────────────────────────
  drawRotationKnob(ctx, state, rotatingTowerId);

  // ── Incoming tower drops ─────────────────────────────────────────────────
  drawIncomingDrops(ctx, state);

  // ── Enemies ───────────────────────────────────────────────────────────────
  drawEnemies(ctx, state, now);
  drawEnemyPreview(ctx, enemyPreview, now);

  // ── Projectiles & effects ─────────────────────────────────────────────────
  drawProjectiles(ctx, state);
  drawChainLightning(ctx, state);
  drawParticles(ctx, state);
  drawHitEffects(ctx, state);
  drawShieldBreakEffects(ctx, state);

  // ── End camera transform ──────────────────────────────────────────────────
  ctx.restore();
};

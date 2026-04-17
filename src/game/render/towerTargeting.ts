import { COMMAND_CARD_CONFIG } from '../config';
import { canUseCommandCardOnTower } from '../commandCards';
import { CELL_SIZE, CommandCardType, GameState, Tower, getCanvasHeight, getCanvasWidth } from '../types';
import { TWO_PI } from './constants';

const drawTowerTargeting = (
  ctx: CanvasRenderingContext2D,
  state: GameState,
  now: number,
  targets: Tower[],
  color: string,
  compact = false,
) => {
  if (!targets.length) return;

  const pulse = 0.5 + 0.5 * Math.sin(now / 210);
  const bounce = Math.sin(now / 260) * 5;
  const maskPad = compact ? 3 + pulse : 10 + pulse * 3;
  const outlinePad = compact ? 2 : 8;
  const haloScale = compact ? 0.62 : 0.9;

  ctx.save();
  const mask = new Path2D();
  mask.rect(0, 0, getCanvasWidth(state), getCanvasHeight(state));
  for (const tower of targets) {
    const px = tower.x * CELL_SIZE;
    const py = tower.y * CELL_SIZE;
    const tw = tower.width * CELL_SIZE;
    const th = tower.height * CELL_SIZE;
    mask.roundRect(px - maskPad, py - maskPad, tw + maskPad * 2, th + maskPad * 2, 6);
  }
  ctx.fillStyle = 'rgba(2, 6, 23, 0.58)';
  ctx.fill(mask, 'evenodd');
  ctx.restore();

  for (const tower of targets) {
    const px = tower.x * CELL_SIZE;
    const py = tower.y * CELL_SIZE;
    const tw = tower.width * CELL_SIZE;
    const th = tower.height * CELL_SIZE;
    const cx = px + tw / 2;
    const bottomY = py + th;
    const haloAlpha = 0.18 + pulse * 0.16;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = compact ? 10 + pulse * 7 : 16 + pulse * 12;
    ctx.strokeStyle = color;
    ctx.lineWidth = compact ? 1.8 + pulse * 0.5 : 2.2 + pulse * 0.8;
    ctx.setLineDash(compact ? [7, 5] : [9, 6]);
    ctx.lineDashOffset = -now / 55;
    ctx.strokeRect(px - outlinePad, py - outlinePad, tw + outlinePad * 2, th + outlinePad * 2);
    ctx.setLineDash([]);

    const halo = ctx.createRadialGradient(cx, py + th / 2, 0, cx, py + th / 2, Math.max(tw, th) * haloScale);
    halo.addColorStop(0, `${color}${Math.round(haloAlpha * 255).toString(16).padStart(2, '0')}`);
    halo.addColorStop(1, `${color}00`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, py + th / 2, Math.max(tw, th) * haloScale, 0, TWO_PI);
    ctx.fill();

    const arrowTipY = Math.min(getCanvasHeight(state) - 42, bottomY + 30 + bounce);
    const arrowTailY = arrowTipY + 28;
    const arrowHeadY = arrowTipY + 12;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(2,6,23,0.95)';
    ctx.beginPath();
    ctx.moveTo(cx, arrowTailY);
    ctx.lineTo(cx, arrowTipY);
    ctx.moveTo(cx - 11, arrowHeadY);
    ctx.lineTo(cx, arrowTipY);
    ctx.lineTo(cx + 11, arrowHeadY);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx, arrowTailY);
    ctx.lineTo(cx, arrowTipY);
    ctx.moveTo(cx - 11, arrowHeadY);
    ctx.lineTo(cx, arrowTipY);
    ctx.lineTo(cx + 11, arrowHeadY);
    ctx.stroke();
    ctx.restore();
  }
};

export const drawCommandCardTargeting = (
  ctx: CanvasRenderingContext2D,
  state: GameState,
  now: number,
  activeCommandCard: CommandCardType | null,
) => {
  if (!activeCommandCard || state.status !== 'playing') return;

  drawTowerTargeting(
    ctx,
    state,
    now,
    state.towers.filter(tower => canUseCommandCardOnTower(state, activeCommandCard, tower)),
    COMMAND_CARD_CONFIG[activeCommandCard].color,
    true,
  );
};

export const drawRepairTargeting = (
  ctx: CanvasRenderingContext2D,
  state: GameState,
  now: number,
  activeRepair: boolean,
) => {
  if (!activeRepair || state.status !== 'playing') return;

  drawTowerTargeting(
    ctx,
    state,
    now,
    state.towers.filter(tower => tower.type !== 'core' && (tower.isRuined || tower.hp < tower.maxHp)),
    '#22d3ee',
  );
};

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
) => {
  if (!targets.length) return;

  const pulse = 0.5 + 0.5 * Math.sin(now / 210);
  const bounce = Math.sin(now / 260) * 5;

  ctx.save();
  const mask = new Path2D();
  mask.rect(0, 0, getCanvasWidth(state), getCanvasHeight(state));
  for (const tower of targets) {
    const px = tower.x * CELL_SIZE;
    const py = tower.y * CELL_SIZE;
    const tw = tower.width * CELL_SIZE;
    const th = tower.height * CELL_SIZE;
    const pad = 10 + pulse * 3;
    mask.roundRect(px - pad, py - pad, tw + pad * 2, th + pad * 2, 8);
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
    const pad = 8;
    const haloAlpha = 0.18 + pulse * 0.16;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 16 + pulse * 12;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2 + pulse * 0.8;
    ctx.setLineDash([9, 6]);
    ctx.lineDashOffset = -now / 55;
    ctx.strokeRect(px - pad, py - pad, tw + pad * 2, th + pad * 2);
    ctx.setLineDash([]);

    const halo = ctx.createRadialGradient(cx, py + th / 2, 0, cx, py + th / 2, Math.max(tw, th) * 0.9);
    halo.addColorStop(0, `${color}${Math.round(haloAlpha * 255).toString(16).padStart(2, '0')}`);
    halo.addColorStop(1, `${color}00`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, py + th / 2, Math.max(tw, th) * 0.9, 0, TWO_PI);
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

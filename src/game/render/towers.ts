import { GameState, Tower, CELL_SIZE, TOWER_STATS } from '../types';
import { getLinearTowerBodyAspectRatio, getLinearTowerBodyRect } from '../linearTowerGeometry';
import { GLOBAL_CONFIG } from '../config';
import { TWO_PI, UNPOWERED, PULSE_CLR, HP_BG, HP_FG, INSET } from './constants';
import { getTowerCells } from '../footprint';
import { drawFootprintCells } from './towerDrawingUtils';
import { drawTowerDetails } from './towerDetails';
import { addRoundedRectPath } from './helpers';

export { drawPorts } from './towerPorts';
export {
  DELETE_BUTTON_HEIGHT,
  DELETE_BUTTON_WIDTH,
  ROTATION_BUTTON_HEIGHT,
  ROTATION_BUTTON_WIDTH,
  drawTowerInfoButtons,
  drawDeleteButton,
  drawRotationKnob,
  getCodexButtonLayout,
  getDeleteButtonLayout,
  getDetailsButtonLayout,
  getRotationKnobLayout,
} from './towerControls';
export { drawOccupiedGround } from './towerGround';
export { drawCommandCardTargeting, drawRepairTargeting } from './towerTargeting';
export { drawDraggedTowerFootprint, drawPlacementPreview, drawRangePreview } from './towerPreviews';

const TOWER_BAR_SHOW_MS = 1800;
const TOWER_BAR_FADE_MS = 700;
const MAX_COMMAND_UPGRADE_MARKS = 3;

const getTowerVisualRect = (tower: Tower, px: number, py: number, tw: number, th: number) => {
  const steps = Math.round(tower.rotation / (Math.PI / 2));
  if (Math.abs(steps) % 2 !== 1 || tower.width === tower.height) {
    return { px, py, tw, th };
  }

  const cx = px + tw / 2;
  const cy = py + th / 2;
  const visualTw = th;
  const visualTh = tw;
  return {
    px: cx - visualTw / 2,
    py: cy - visualTh / 2,
    tw: visualTw,
    th: visualTh,
  };
};

const getLinearTowerVisualLandscape = (tower: Tower) =>
  TOWER_STATS[tower.type].width >= TOWER_STATS[tower.type].height;

const drawCommandUpgradeMarks = (
  ctx: CanvasRenderingContext2D,
  tower: Tower,
  px: number,
  py: number,
  tw: number,
) => {
  const count = Math.min(MAX_COMMAND_UPGRADE_MARKS, tower.commandUpgradeCount ?? 0);
  if (count <= 0) return;

  const markSize = 6;
  const gap = 3;
  const totalW = count * markSize + (count - 1) * gap;
  const startX = px + tw - totalW - 5;
  const y = py + 5;

  ctx.save();
  ctx.fillStyle = '#facc15';
  ctx.strokeStyle = 'rgba(10,14,26,0.9)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < count; i++) {
      const x = startX + i * (markSize + gap);
      ctx.beginPath();
      addRoundedRectPath(ctx, x, y, markSize, markSize, 1.5);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
};

const drawRuinOverlay = (
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  tw: number,
  th: number,
  inset: number,
) => {
  const left = px + inset;
  const top = py + inset;
  const right = px + tw - inset;
  const bottom = py + th - inset;
  const cx = px + tw / 2;
  const cy = py + th / 2;

  ctx.save();
  ctx.strokeStyle = 'rgba(203,213,225,0.55)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(left + tw * 0.18, top + th * 0.18);
  ctx.lineTo(cx - tw * 0.08, cy - th * 0.05);
  ctx.lineTo(left + tw * 0.33, bottom - th * 0.14);
  ctx.moveTo(right - tw * 0.16, top + th * 0.2);
  ctx.lineTo(cx + tw * 0.08, cy + th * 0.02);
  ctx.lineTo(right - tw * 0.28, bottom - th * 0.18);
  ctx.moveTo(cx - tw * 0.2, top + th * 0.62);
  ctx.lineTo(cx + tw * 0.02, cy + th * 0.12);
  ctx.lineTo(cx + tw * 0.24, top + th * 0.56);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(15,23,42,0.85)';
  ctx.lineWidth = 4;
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.moveTo(left + tw * 0.2, top + th * 0.2);
  ctx.lineTo(cx - tw * 0.08, cy - th * 0.05);
  ctx.moveTo(right - tw * 0.18, top + th * 0.22);
  ctx.lineTo(cx + tw * 0.08, cy + th * 0.02);
  ctx.stroke();

  const fontSize = Math.max(12, Math.min(18, Math.floor(Math.min(tw, th) * 0.2)));
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(2,6,23,0.92)';
  ctx.fillStyle = 'rgba(226,232,240,0.92)';
  ctx.strokeText('废墟', cx, cy);
  ctx.fillText('废墟', cx, cy);
  ctx.restore();
};

// ── Tower bodies ────────────────────────────────────────────────────────────
export const drawTowers = (ctx: CanvasRenderingContext2D, state: GameState, now: number, activeRepair = false) => {
  const generatorPowerProgress = state.powerTimer / GLOBAL_CONFIG.powerInterval;

  for (const tower of state.towers) {
    let towerTransformSaved = false;
    try {
    const px = tower.x * CELL_SIZE, py = tower.y * CELL_SIZE;
    const tw = tower.width * CELL_SIZE, th = tower.height * CELL_SIZE;
    const cx = px + tw / 2, cy = py + th / 2;
    const visual = getTowerVisualRect(tower, px, py, tw, th);
    const inset = (tower.width === 1 && tower.height === 1) ? 5 : INSET;

    ctx.save();
    towerTransformSaved = true;
    ctx.translate(cx, cy);
    ctx.rotate(tower.rotation);
    ctx.translate(-cx, -cy);

    const tColor = tower.isRuined
      ? 'rgba(148,163,184,0.72)'
      : (!tower.powered && tower.type !== 'core') ? UNPOWERED : TOWER_STATS[tower.type].color;

    // Outlined style: dark fill + colored border (shape varies by turret type)
    ctx.fillStyle = tower.isRuined ? 'rgba(24,24,27,0.92)' : 'rgba(10,14,26,0.85)';
    ctx.strokeStyle = tColor;
    ctx.lineWidth = 1.75;

    if (tower.type === 'gatling') {
      const cr = 8;
      ctx.beginPath();
      addRoundedRectPath(ctx, visual.px + inset, visual.py + inset, visual.tw - inset * 2, visual.th - inset * 2, cr);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = tColor; ctx.lineWidth = 1; ctx.globalAlpha = 0.4;
      const ventCount = 3;
      const ventSpacing = (visual.th - inset * 2) / (ventCount + 1);
      for (let v = 1; v <= ventCount; v++) {
        const vy = visual.py + inset + v * ventSpacing;
        ctx.beginPath(); ctx.moveTo(visual.px + inset + 2, vy); ctx.lineTo(visual.px + inset + 7, vy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(visual.px + visual.tw - inset - 2, vy); ctx.lineTo(visual.px + visual.tw - inset - 7, vy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (tower.type === 'sniper') {
      ctx.beginPath();
      ctx.moveTo(cx, visual.py + inset);
      ctx.lineTo(visual.px + visual.tw - inset, cy);
      ctx.lineTo(cx, visual.py + visual.th - inset);
      ctx.lineTo(visual.px + inset, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = tColor;
      const dotR = 1.8;
      ctx.beginPath(); ctx.arc(cx, visual.py + inset, dotR, 0, TWO_PI); ctx.fill();
      ctx.beginPath(); ctx.arc(visual.px + visual.tw - inset, cy, dotR, 0, TWO_PI); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, visual.py + visual.th - inset, dotR, 0, TWO_PI); ctx.fill();
      ctx.beginPath(); ctx.arc(visual.px + inset, cy, dotR, 0, TWO_PI); ctx.fill();
    } else if (tower.type === 'tesla') {
      const hexR = Math.min(visual.tw, visual.th) / 2 - inset;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3 - Math.PI / 6;
        const hx = cx + hexR * Math.cos(angle);
        const hy = cy + hexR * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (tower.type === 'blaster') {
      const baseR = Math.min(visual.tw, visual.th) / 2 - inset - 3;
      ctx.beginPath(); ctx.arc(cx, cy, baseR, 0, TWO_PI);
      ctx.fill();
      ctx.stroke();
    } else if (tower.type === 'battery' || tower.type === 'bus') {
      const body = getLinearTowerBodyRect(
        visual.px, visual.py, visual.tw, visual.th,
        getLinearTowerVisualLandscape(tower),
        getLinearTowerBodyAspectRatio(tower.type),
      );
      ctx.fillRect(body.x + inset, body.y + inset, body.width - inset * 2, body.height - inset * 2);
      ctx.strokeRect(body.x + inset, body.y + inset, body.width - inset * 2, body.height - inset * 2);
    } else if (tower.type === 'shield') {
      drawFootprintCells(ctx, getTowerCells(tower), inset);
    } else {
      ctx.fillRect(visual.px + inset, visual.py + inset, visual.tw - inset * 2, visual.th - inset * 2);
      ctx.strokeRect(visual.px + inset, visual.py + inset, visual.tw - inset * 2, visual.th - inset * 2);
    }

    if (tower.type === 'battery' || tower.type === 'bus') {
      const body = getLinearTowerBodyRect(
        visual.px, visual.py, visual.tw, visual.th,
        getLinearTowerVisualLandscape(tower),
        getLinearTowerBodyAspectRatio(tower.type),
      );
      drawTowerDetails(ctx, state, tower, body.x, body.y, body.width, body.height, cx, cy, tColor, inset, now, generatorPowerProgress);
      if (tower.isRuined) drawRuinOverlay(ctx, body.x, body.y, body.width, body.height, inset);
    } else {
      drawTowerDetails(ctx, state, tower, visual.px, visual.py, visual.tw, visual.th, cx, cy, tColor, inset, now, generatorPowerProgress);
      if (tower.isRuined) drawRuinOverlay(ctx, visual.px, visual.py, visual.tw, visual.th, inset);
    }

    ctx.restore();
    towerTransformSaved = false;

    if (!tower.isRuined) drawCommandUpgradeMarks(ctx, tower, px, py, tw);

    // Bars (not rotated) — shield bar removed, shield uses fade visualization
    if (tower.type !== 'core' && (tower.isRuined || tower.hp < tower.maxHp)) {
      const elapsed = now - tower.lastDamagedAt;
      const fadeRatio = activeRepair
        ? 1
        : elapsed <= TOWER_BAR_SHOW_MS
        ? 1
        : Math.max(0, 1 - (elapsed - TOWER_BAR_SHOW_MS) / TOWER_BAR_FADE_MS);
      if (fadeRatio > 0) {
        ctx.save();
        ctx.globalAlpha = fadeRatio;
        ctx.fillStyle = HP_BG; ctx.fillRect(px, py - 5, tw, 3);
        ctx.fillStyle = HP_FG; ctx.fillRect(px, py - 5, tw * (tower.hp / tower.maxHp), 3);
        ctx.restore();
      }
    }
    if (!tower.isRuined && tower.maxPower > 0 && tower.type !== 'core' && tower.type !== 'battery' && tower.type !== 'blaster' && tower.type !== 'gatling' && tower.type !== 'sniper' && tower.type !== 'tesla' && tower.type !== 'missile' && tower.type !== 'repair_drone') {
      const pr = Math.min(tw, th) / 3;
      const pcx = px + tw / 2, pcy = py + th / 2;
      if (tower.storedPower > 0) {
        const arcPer = TWO_PI / tower.maxPower;
        const startA = -Math.PI / 2;
        ctx.fillStyle = PULSE_CLR;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(pcx, pcy);
        ctx.arc(pcx, pcy, pr - 0.5, startA, startA + arcPer * tower.storedPower);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    } catch (error) {
      if (towerTransformSaved) ctx.restore();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
      console.warn('Tower render skipped after canvas error:', tower.type, error);
    }
  }
};

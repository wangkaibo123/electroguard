import { __iconNode as bookOpenIconNode } from 'lucide-react/dist/esm/icons/book-open.js';
import { __iconNode as coinsIconNode } from 'lucide-react/dist/esm/icons/coins.js';
import { __iconNode as infoIconNode } from 'lucide-react/dist/esm/icons/info.js';
import { __iconNode as trash2IconNode } from 'lucide-react/dist/esm/icons/trash-2.js';
import { getTowerSellPrice } from '../config';
import { CELL_SIZE, GameState, Tower } from '../types';
import { KNOB_CLR } from './constants';
import { addRoundedRectPath } from './helpers';
import { drawLucideIconNode, LucideIconNode } from './towerDrawingUtils';

const ROTATION_KNOB_BASE_OFFSET = 20;
const SIDE_CONTROL_BUTTON_OFFSET = 30;
export const TOWER_CONTROL_BUTTON_WIDTH = 72;
export const TOWER_CONTROL_BUTTON_HEIGHT = 28;
export const SIDE_CONTROL_BUTTON_WIDTH = 56;
export const SIDE_CONTROL_BUTTON_HEIGHT = 28;
export const ROTATION_BUTTON_WIDTH = TOWER_CONTROL_BUTTON_WIDTH;
export const ROTATION_BUTTON_HEIGHT = TOWER_CONTROL_BUTTON_HEIGHT;
export const DELETE_BUTTON_WIDTH = TOWER_CONTROL_BUTTON_WIDTH;
export const DELETE_BUTTON_HEIGHT = TOWER_CONTROL_BUTTON_HEIGHT;

export const getRotationKnobLayout = (tower: Tower) => {
  const tpx = tower.x * CELL_SIZE;
  const tpy = tower.y * CELL_SIZE;
  const ttw = tower.width * CELL_SIZE;
  const tth = tower.height * CELL_SIZE;
  const tcx = tpx + ttw / 2;
  const tcy = tpy + tth / 2;
  const kd = tth / 2 + ROTATION_KNOB_BASE_OFFSET * 2;
  const kx = tcx;
  const ky = tcy - kd;
  const buttonWidth = ROTATION_BUTTON_WIDTH;
  const buttonHeight = ROTATION_BUTTON_HEIGHT;
  const buttonX = kx - buttonWidth / 2;
  const buttonY = ky - buttonHeight / 2;

  return { tpx, tpy, ttw, tth, tcx, tcy, kd, kx, ky, buttonX, buttonY, buttonWidth, buttonHeight };
};

export const getDeleteButtonLayout = (tower: Tower) => {
  const tpx = tower.x * CELL_SIZE;
  const tpy = tower.y * CELL_SIZE;
  const ttw = tower.width * CELL_SIZE;
  const tth = tower.height * CELL_SIZE;
  const tcx = tpx + ttw / 2;
  const buttonWidth = DELETE_BUTTON_WIDTH;
  const buttonHeight = DELETE_BUTTON_HEIGHT;
  const buttonX = tcx - buttonWidth / 2;
  const buttonY = tpy + tth + 22;

  return { buttonX, buttonY, buttonWidth, buttonHeight };
};

export const getDetailsButtonLayout = (tower: Tower) => {
  const tpx = tower.x * CELL_SIZE;
  const tpy = tower.y * CELL_SIZE;
  const tth = tower.height * CELL_SIZE;
  const buttonWidth = SIDE_CONTROL_BUTTON_WIDTH;
  const buttonHeight = SIDE_CONTROL_BUTTON_HEIGHT;
  const buttonX = tpx - buttonWidth - SIDE_CONTROL_BUTTON_OFFSET;
  const buttonY = tpy + tth / 2 - buttonHeight / 2;

  return { buttonX, buttonY, buttonWidth, buttonHeight };
};

export const getCodexButtonLayout = (tower: Tower) => {
  const tpx = tower.x * CELL_SIZE;
  const tpy = tower.y * CELL_SIZE;
  const ttw = tower.width * CELL_SIZE;
  const tth = tower.height * CELL_SIZE;
  const buttonWidth = SIDE_CONTROL_BUTTON_WIDTH;
  const buttonHeight = SIDE_CONTROL_BUTTON_HEIGHT;
  const buttonX = tpx + ttw + SIDE_CONTROL_BUTTON_OFFSET;
  const buttonY = tpy + tth / 2 - buttonHeight / 2;

  return { buttonX, buttonY, buttonWidth, buttonHeight };
};

const drawControlButton = (
  ctx: CanvasRenderingContext2D,
  layout: { buttonX: number; buttonY: number; buttonWidth: number; buttonHeight: number },
  fillStyle: string,
  strokeStyle: string,
  label: string,
  iconNode?: LucideIconNode,
) => {
  const { buttonX, buttonY, buttonWidth, buttonHeight } = layout;

  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  addRoundedRectPath(ctx, buttonX, buttonY, buttonWidth, buttonHeight, 8);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.stroke();

  const centerY = buttonY + buttonHeight / 2;
  const contentCx = buttonX + buttonWidth / 2;
  const hasIcon = Boolean(iconNode);
  if (iconNode) drawLucideIconNode(ctx, iconNode, contentCx - 15, centerY, 13, '#ffffff');

  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, contentCx + (hasIcon ? 8 : 0), centerY + 0.5);
};

export const drawRotationKnob = (ctx: CanvasRenderingContext2D, state: GameState, rotatingTowerId: string | null) => {
  if (!rotatingTowerId) return;
  const tower = state.towerMap.get(rotatingTowerId);
  if (!tower || tower.isRuined) return;

  const { tpx, tpy, ttw, tth, tcx, tcy, buttonX, buttonY, buttonWidth, buttonHeight } = getRotationKnobLayout(tower);

  ctx.strokeStyle = KNOB_CLR; ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(tpx - 2, tpy - 2, ttw + 4, tth + 4);
  ctx.setLineDash([]);

  const buttonCx = buttonX + buttonWidth / 2;
  const buttonCy = buttonY + buttonHeight / 2;
  const arrowY = buttonY;
  const arrowR = 19;
  const arrowStart = Math.PI * 1.12;
  const arrowEnd = Math.PI * 1.9;

  ctx.strokeStyle = 'rgba(245,158,11,0.72)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(buttonCx, buttonY + buttonHeight);
  ctx.lineTo(tcx, tcy);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(buttonCx, arrowY, arrowR, arrowStart, arrowEnd);
  ctx.stroke();
  const arrowDir = arrowEnd + Math.PI / 2;
  const arrowTipOffset = 4;
  const arrowTipX = buttonCx + arrowR * Math.cos(arrowEnd) + Math.cos(arrowDir) * arrowTipOffset;
  const arrowTipY = arrowY + arrowR * Math.sin(arrowEnd) + Math.sin(arrowDir) * arrowTipOffset;
  const arrowBaseX = arrowTipX - Math.cos(arrowDir) * 8;
  const arrowBaseY = arrowTipY - Math.sin(arrowDir) * 8;
  const arrowSideX = -Math.sin(arrowDir);
  const arrowSideY = Math.cos(arrowDir);
  const arrowHalfW = 4.5;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(arrowTipX, arrowTipY);
  ctx.lineTo(arrowBaseX + arrowSideX * arrowHalfW, arrowBaseY + arrowSideY * arrowHalfW);
  ctx.lineTo(arrowBaseX - arrowSideX * arrowHalfW, arrowBaseY - arrowSideY * arrowHalfW);
  ctx.closePath();
  ctx.fill();
  ctx.lineCap = 'butt';

  ctx.fillStyle = 'rgba(217,119,6,0.92)';
  ctx.strokeStyle = 'rgba(245,158,11,0.9)';
  ctx.lineWidth = 1;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  addRoundedRectPath(ctx, buttonX, buttonY, buttonWidth, buttonHeight, 8);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.stroke();

  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('旋转', buttonCx, buttonCy + 0.5);
};

export const drawDeleteButton = (ctx: CanvasRenderingContext2D, state: GameState, rotatingTowerId: string | null) => {
  if (!rotatingTowerId || state.status !== 'playing' || state.gameMode === 'custom') return;
  const tower = state.towerMap.get(rotatingTowerId);
  if (!tower || tower.type === 'core') return;

  const { buttonX, buttonY, buttonWidth, buttonHeight } = getDeleteButtonLayout(tower);

  ctx.fillStyle = 'rgba(220,38,38,0.92)';
  ctx.strokeStyle = 'rgba(248,113,113,0.9)';
  ctx.lineWidth = 1;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  addRoundedRectPath(ctx, buttonX, buttonY, buttonWidth, buttonHeight, 8);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.stroke();

  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  const centerY = buttonY + buttonHeight / 2;
  const contentCx = buttonX + buttonWidth / 2;
  const trashX = contentCx - 21;
  const coinX = contentCx + 22;

  drawLucideIconNode(ctx, trash2IconNode as LucideIconNode, trashX, centerY, 13, '#ffffff');

  ctx.fillText(String(getTowerSellPrice(tower)), contentCx, centerY + 0.5);

  drawLucideIconNode(ctx, coinsIconNode as LucideIconNode, coinX, centerY, 13, 'rgba(250,204,21,0.96)');
};

export const drawTowerInfoButtons = (ctx: CanvasRenderingContext2D, state: GameState, rotatingTowerId: string | null) => {
  if (!rotatingTowerId) return;
  const tower = state.towerMap.get(rotatingTowerId);
  if (!tower || tower.isRuined) return;

  drawControlButton(
    ctx,
    getDetailsButtonLayout(tower),
    'rgba(37,99,235,0.92)',
    'rgba(96,165,250,0.9)',
    '详情',
    infoIconNode as LucideIconNode,
  );
  drawControlButton(
    ctx,
    getCodexButtonLayout(tower),
    'rgba(75,85,99,0.92)',
    'rgba(156,163,175,0.9)',
    '图鉴',
    bookOpenIconNode as LucideIconNode,
  );
};

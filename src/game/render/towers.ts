import { GameState, Tower, TowerType, CommandCardType, CELL_SIZE, HALF_CELL, TOWER_STATS, CANVAS_WIDTH, CANVAS_HEIGHT, getTowerRange } from '../types';
import { getPortPos, isPortAccessible } from '../engine';
import { getLinearTowerBodyAspectRatio, getLinearTowerBodyRect } from '../linearTowerGeometry';
import { COMMAND_CARD_CONFIG, getTowerSellPrice } from '../config';
import { __iconNode as coinsIconNode } from 'lucide-react/dist/esm/icons/coins.js';
import { __iconNode as trash2IconNode } from 'lucide-react/dist/esm/icons/trash-2.js';
import {
  TWO_PI, BG_DARK, UNPOWERED, PULSE_CLR, HP_BG, HP_FG,
  PORT_OUT, PORT_OUT_USED, PORT_IN, PORT_IN_USED, KNOB_CLR, POWER_ON,
  INSET, portOutward,
} from './constants';
import {
  drawPowerArc, drawRangeCircle, drawMuzzleFlash,
  FLASH_DUR_BLASTER, FLASH_DUR_GATLING, FLASH_DUR_SNIPER, FLASH_DUR_TESLA,
  SNIPER_COOLDOWN_MS,
} from './helpers';
import { getTowerCells, getTowerFootprintCells } from '../footprint';
import { canUseCommandCardOnTower } from '../commandCards';

const ROTATION_KNOB_BASE_OFFSET = 20;
export const ROTATION_BUTTON_WIDTH = 58;
export const ROTATION_BUTTON_HEIGHT = 28;
export const DELETE_BUTTON_WIDTH = 78;
export const DELETE_BUTTON_HEIGHT = 28;
const TOWER_BAR_SHOW_MS = 1800;
const TOWER_BAR_FADE_MS = 700;
const ENERGY_EFFECT_SIZE = CELL_SIZE * 0.5;
const MAX_COMMAND_UPGRADE_MARKS = 3;
type LucideIconNode = [string, Record<string, string>][];

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

const drawEnergyEffect = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  now: number,
  powered: boolean,
  color: string,
) => {
  const s = ENERGY_EFFECT_SIZE;

  ctx.lineWidth = 1.5;
  if (powered) {
    const arcCount = 3;
    for (let i = 0; i < arcCount; i++) {
      const baseAngle = (i / arcCount) * TWO_PI + now / 800;
      const arcR = s * 1.2 + Math.sin(now / 400 + i * 2) * 2;
      const arcOp = 0.2 + 0.25 * Math.sin(now / 300 + i * 1.5);
      ctx.strokeStyle = `rgba(251,191,36,${arcOp})`;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, baseAngle, baseAngle + Math.PI * 0.5);
      ctx.stroke();
    }
  }

  if (powered) {
    const pulse = 0.08 + 0.07 * Math.sin(now / 250);
    const glowR = s * 1.5;
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    grd.addColorStop(0, `rgba(251,191,36,${pulse})`);
    grd.addColorStop(1, 'rgba(251,191,36,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, TWO_PI);
    ctx.fill();
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.1, cy - s);
  ctx.lineTo(cx - s * 0.4, cy + s * 0.1);
  ctx.lineTo(cx + s * 0.1, cy + s * 0.1);
  ctx.lineTo(cx - s * 0.1, cy + s);
  ctx.stroke();

  if (powered) {
    ctx.lineWidth = 1;
    for (let sp = 0; sp < 4; sp++) {
      const spAngle = (sp / 4) * TWO_PI + now / 600;
      const spDist = s * (0.6 + 0.6 * ((now / 500 + sp * 0.25) % 1));
      const spOp = 0.6 * (1 - ((now / 500 + sp * 0.25) % 1));
      if (spOp < 0.05) continue;
      const spx = cx + Math.cos(spAngle) * spDist;
      const spy = cy + Math.sin(spAngle) * spDist;
      ctx.strokeStyle = `rgba(251,191,36,${spOp})`;
      ctx.beginPath();
      const jx = Math.sin(now / 100 + sp) * 2;
      const jy = Math.cos(now / 100 + sp) * 2;
      ctx.moveTo(spx - 2 + jx, spy - 2 + jy);
      ctx.lineTo(spx + 2 - jx, spy + 2 - jy);
      ctx.stroke();
    }
  }
};

const drawFootprintCells = (
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

const drawLucideIconNode = (
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
      ctx.arc(Number(attrs.cx), Number(attrs.cy), Number(attrs.r), 0, TWO_PI);
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
    ctx.roundRect(x, y, markSize, markSize, 1.5);
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

// ── Ports (drawn under tower bodies) ─────────────────────────────────────
export const drawPorts = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const PORT_SCALE = 4 / 3;
  const OUT_TRI = 7.5 * PORT_SCALE;
  const IN_CHEVRON = OUT_TRI * 0.5;
  const DIRECT_DOCK_MS = 420;
  const DIRECT_INPUT_RECOIL = 3.5;
  const DIRECT_OUTPUT_RECOIL = 9;
  const DIRECT_OUTPUT_INSERT = 8;
  const portStrokeW = 1.35;
  const now = performance.now();

  const unitForDirection = (dir: string) => {
    switch (dir) {
      case 'top': return { x: 0, y: -1 };
      case 'bottom': return { x: 0, y: 1 };
      case 'left': return { x: -1, y: 0 };
      default: return { x: 1, y: 0 };
    }
  };

  const directRecoil = (createdAt: number | undefined, distance: number) => {
    if (!createdAt) return 0;
    const t = Math.min(1, Math.max(0, (now - createdAt) / DIRECT_DOCK_MS));
    return Math.sin(t * Math.PI) * distance * (1 - t * 0.28);
  };

  for (const tower of state.towers) {
    if (tower.isRuined) continue;
    for (const port of tower.ports) {
      const pos = getPortPos(tower, port);
      const off = portOutward(port.direction);
      const unit = unitForDirection(port.direction);
      const linkedWire = state.wires.find(w => w.startPortId === port.id || w.endPortId === port.id);
      const directWire = linkedWire?.direct ? linkedWire : null;
      const directOutputInsert = directWire && port.portType === 'output' ? DIRECT_OUTPUT_INSERT : 0;
      const recoil = directWire
        ? directRecoil(directWire.createdAt, port.portType === 'output' ? DIRECT_OUTPUT_RECOIL : DIRECT_INPUT_RECOIL)
        : 0;
      const lineX = directWire ? pos.x + unit.x * directOutputInsert - unit.x * recoil : pos.x + off.x;
      const lineY = directWire ? pos.y + unit.y * directOutputInsert - unit.y * recoil : pos.y + off.y;
      const used = Boolean(linkedWire);
      const accessible = isPortAccessible(state, tower, port);
      const portColor = port.portType === 'output'
        ? (used ? PORT_OUT_USED : PORT_OUT)
        : (used ? PORT_IN_USED : PORT_IN);
      const displayColor = !used && !accessible ? 'rgba(107,114,128,0.7)' : portColor;
      const portActive = tower.powered || tower.type === 'core';
      const pulse = portActive ? 0.55 + 0.45 * (Math.sin(now / 260) * 0.5 + 0.5) : 0;

      const showPortStem = port.portType === 'output';

      if (showPortStem) {
        ctx.strokeStyle = displayColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(lineX, lineY);
        ctx.stroke();
      }

      if (showPortStem && used && portActive) {
        ctx.save();
        ctx.shadowColor = portColor;
        ctx.shadowBlur = 8 + 8 * pulse;
        ctx.strokeStyle = `rgba(255,255,255,${0.18 + pulse * 0.18})`;
        ctx.lineWidth = 1.5 + pulse;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(lineX, lineY);
        ctx.stroke();
        ctx.restore();
      }

      if (port.portType === 'output') {
        ctx.fillStyle = displayColor;
        const s = OUT_TRI;
        const centerX = directWire ? pos.x + unit.x * directOutputInsert - unit.x * (s + recoil) : pos.x + off.x;
        const centerY = directWire ? pos.y + unit.y * directOutputInsert - unit.y * (s + recoil) : pos.y + off.y;
        const perp = { x: -unit.y, y: unit.x };
        const tip = { x: centerX + unit.x * s, y: centerY + unit.y * s };
        const base = { x: centerX - unit.x * s / 2, y: centerY - unit.y * s / 2 };
        ctx.beginPath();
        ctx.moveTo(base.x + perp.x * s, base.y + perp.y * s);
        ctx.lineTo(base.x - perp.x * s, base.y - perp.y * s);
        ctx.lineTo(tip.x, tip.y);
        ctx.closePath();
        ctx.fill();
        if (used && portActive) {
          ctx.save();
          ctx.fillStyle = `rgba(255,255,255,${0.12 + pulse * 0.18})`;
          ctx.shadowColor = portColor;
          ctx.shadowBlur = 10 + 10 * pulse;
          ctx.fill();
          ctx.restore();
        }
        ctx.strokeStyle = BG_DARK;
        ctx.lineWidth = portStrokeW;
        ctx.stroke();
      } else {
        const s = IN_CHEVRON;
        const mouthX = directWire ? pos.x - unit.x * recoil : pos.x + off.x;
        const mouthY = directWire ? pos.y - unit.y * recoil : pos.y + off.y;
        const perp = { x: -unit.y, y: unit.x };
        const tipX = mouthX - unit.x * s * 1.5;
        const tipY = mouthY - unit.y * s * 1.5;
        ctx.beginPath();
        ctx.moveTo(mouthX + perp.x * s, mouthY + perp.y * s);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(mouthX - perp.x * s, mouthY - perp.y * s);
        ctx.strokeStyle = BG_DARK;
        ctx.lineWidth = 5.4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.strokeStyle = displayColor;
        ctx.lineWidth = 3.2;
        ctx.stroke();
        if (used && portActive) {
          ctx.save();
          ctx.strokeStyle = `rgba(255,255,255,${0.1 + pulse * 0.16})`;
          ctx.lineWidth = 3.8 + pulse;
          ctx.shadowColor = portColor;
          ctx.shadowBlur = 10 + 10 * pulse;
          ctx.stroke();
          ctx.restore();
        }
      }
    }

  }
};

// ── Tower bodies ────────────────────────────────────────────────────────────
export const drawTowers = (ctx: CanvasRenderingContext2D, state: GameState, now: number, activeRepair = false) => {
  for (const tower of state.towers) {
    const px = tower.x * CELL_SIZE, py = tower.y * CELL_SIZE;
    const tw = tower.width * CELL_SIZE, th = tower.height * CELL_SIZE;
    const cx = px + tw / 2, cy = py + th / 2;
    const visual = getTowerVisualRect(tower, px, py, tw, th);
    const inset = (tower.width === 1 && tower.height === 1) ? 5 : INSET;

    ctx.save();
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
      ctx.roundRect(visual.px + inset, visual.py + inset, visual.tw - inset * 2, visual.th - inset * 2, cr);
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
      drawTowerDetails(ctx, tower, body.x, body.y, body.width, body.height, cx, cy, tColor, inset, now);
      if (tower.isRuined) drawRuinOverlay(ctx, body.x, body.y, body.width, body.height, inset);
    } else {
      drawTowerDetails(ctx, tower, visual.px, visual.py, visual.tw, visual.th, cx, cy, tColor, inset, now);
      if (tower.isRuined) drawRuinOverlay(ctx, visual.px, visual.py, visual.tw, visual.th, inset);
    }

    ctx.restore();

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
    if (!tower.isRuined && tower.maxPower > 0 && tower.type !== 'core' && tower.type !== 'battery' && tower.type !== 'blaster' && tower.type !== 'gatling' && tower.type !== 'sniper' && tower.type !== 'tesla') {
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
  }
};

const drawTowerTargeting = (
  ctx: CanvasRenderingContext2D,
  now: number,
  targets: Tower[],
  color: string,
) => {
  if (!targets.length) return;

  const pulse = 0.5 + 0.5 * Math.sin(now / 210);
  const bounce = Math.sin(now / 260) * 5;

  ctx.save();
  const mask = new Path2D();
  mask.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
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

    const arrowTipY = Math.min(CANVAS_HEIGHT - 42, bottomY + 30 + bounce);
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
    now,
    state.towers.filter(tower => tower.type !== 'core' && (tower.isRuined || tower.hp < tower.maxHp)),
    '#22d3ee',
  );
};

// ── Placement preview ─────────────────────────────────────────────────────
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

// ── Range preview ─────────────────────────────────────────────────────────
export const drawRangePreview = (
  ctx: CanvasRenderingContext2D, state: GameState,
  hoverPos: { x: number; y: number } | null,
  selectedTower: TowerType | null,
  rotatingTowerId: string | null,
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
};

// ── Rotation knob ─────────────────────────────────────────────────────────
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
  ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
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
  ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
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

const drawCapsuleBarrel = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  localAngle: number,
  startDist: number,
  endDist: number,
  halfWidth: number,
  fill: string,
  stroke: string,
  strokeWidth = 1.5,
) => {
  const len = endDist - startDist;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(localAngle);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;
  ctx.beginPath();
  ctx.roundRect(startDist, -halfWidth, len, halfWidth * 2, halfWidth);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  return {
    mx: cx + Math.cos(localAngle) * endDist,
    my: cy + Math.sin(localAngle) * endDist,
  };
};

const drawBarrelBand = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  localAngle: number,
  dist: number,
  halfWidth: number,
  width: number,
  fill: string,
  stroke: string,
) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(localAngle);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(dist - width / 2, -halfWidth, width, halfWidth * 2, Math.min(halfWidth, 3));
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

const drawMuzzleRing = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  radius: number,
  fill: string,
  stroke: string,
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.72, radius, 0, 0, TWO_PI);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(5,8,16,0.78)';
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.34, radius * 0.48, 0, 0, TWO_PI);
  ctx.fill();
  ctx.restore();
};

const drawMuzzleBrake = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  localAngle: number,
  dist: number,
  halfWidth: number,
  color: string,
) => {
  const sideX = -Math.sin(localAngle);
  const sideY = Math.cos(localAngle);
  const forwardX = Math.cos(localAngle);
  const forwardY = Math.sin(localAngle);

  for (const offset of [-1, 1]) {
    const baseX = cx + forwardX * dist + sideX * halfWidth * offset;
    const baseY = cy + forwardY * dist + sideY * halfWidth * offset;
    ctx.strokeStyle = 'rgba(5,8,16,0.78)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(baseX + sideX * 8 * offset - forwardX * 5, baseY + sideY * 8 * offset - forwardY * 5);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(baseX + sideX * 8 * offset - forwardX * 5, baseY + sideY * 8 * offset - forwardY * 5);
    ctx.stroke();
  }
};

// ── Tower detail drawing (called within rotation transform) ──────────────────
function drawTowerDetails(
  ctx: CanvasRenderingContext2D, t: Tower,
  px: number, py: number, tw: number, th: number, cx: number, cy: number,
  tColor: string, inset: number, now: number,
) {
  if (t.type === 'core') {
    const R = Math.min(tw, th);
    drawEnergyEffect(ctx, cx, cy, now, t.powered, tColor);
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R / 3 - 2, 0, TWO_PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R / 5, 0, TWO_PI); ctx.stroke();
  } else if (t.type === 'blaster') {
    const r = Math.min(tw, th) / 5;
    const hs = r * 0.9;
    const localAngle = t.barrelAngle - t.rotation;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(localAngle);
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.strokeRect(-hs, -hs, hs * 2, hs * 2);
    if (t.maxPower > 0 && t.storedPower > 0) {
      ctx.fillStyle = PULSE_CLR;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(-hs, -hs, hs * 2, hs * 2 * (t.storedPower / t.maxPower));
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    const barrelLen = (Math.min(tw, th) / 2 - inset + 6) * 1.28;
    const barrelStart = r * 0.3;
    const { mx, my } = drawCapsuleBarrel(
      ctx, cx, cy, localAngle, barrelStart, barrelLen, 5.2,
      'rgba(10,14,26,0.9)', tColor, 2,
    );
    drawBarrelBand(ctx, cx, cy, localAngle, barrelLen * 0.6, 6.8, 7, 'rgba(15,23,42,0.95)', tColor);
    drawMuzzleRing(ctx, mx, my, localAngle, 6, 'rgba(15,23,42,0.98)', tColor);
    const flashT = now - t.lastActionTime;
    if (t.powered && flashT < FLASH_DUR_BLASTER && t.lastActionTime > 0) {
      drawMuzzleFlash(ctx, mx, my, localAngle, flashT / FLASH_DUR_BLASTER, tColor, '248,113,113', 8, true, t.lastActionTime);
    }
  } else if (t.type === 'gatling') {
    const r = Math.min(tw, th) / 4 - 1;
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI); ctx.stroke();
    const localAngle = t.barrelAngle - t.rotation;
    const barrelLen = (Math.min(tw, th) / 2 - inset + 4) * 1.5;
    const firingRecently = t.powered && t.lastActionTime > 0 && now - t.lastActionTime < 140;
    // Heat glow on barrels
    const heat = t.heat;
    if (t.powered && heat > 0.1) {
      const glowR = r * 1.3;
      const heatOp = heat * 0.15;
      const hGrd = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, glowR);
      hGrd.addColorStop(0, `rgba(255,${Math.floor(100 * (1 - heat))},0,${heatOp})`);
      hGrd.addColorStop(1, 'rgba(255,100,0,0)');
      ctx.fillStyle = hGrd;
      ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, TWO_PI); ctx.fill();
    }
    const spinSpeed = firingRecently ? 2 + heat * 8 : 0;
    const spinOffset = firingRecently ? now / 1000 * spinSpeed * TWO_PI : 0;
    const barrelCount = 5;
    const maxSpread = 11;
    for (let b = 0; b < barrelCount; b++) {
      const bAngle = spinOffset + b * TWO_PI / barrelCount;
      const perpDist = Math.sin(bAngle) * maxSpread;
      const depth = Math.cos(bAngle);
      const perpX = -Math.sin(localAngle) * perpDist;
      const perpY = Math.cos(localAngle) * perpDist;
      const sx = cx + perpX + Math.cos(localAngle) * r * -0.5;
      const sy = cy + perpY + Math.sin(localAngle) * r * -0.5;
      const ex = cx + perpX + Math.cos(localAngle) * barrelLen;
      const ey = cy + perpY + Math.sin(localAngle) * barrelLen;
      const bColorR = Math.floor(245 + 10 * heat);
      const bColorG = Math.floor(158 * (1 - heat * 0.6));
      const bColorB = Math.floor(11 * (1 - heat));
      const barrelColor = t.powered && heat > 0.1 ? `rgb(${bColorR},${bColorG},${bColorB})` : tColor;
      const bAlpha = 0.4 + 0.6 * (depth * 0.5 + 0.5);
      ctx.globalAlpha = bAlpha;
      ctx.strokeStyle = 'rgba(5,8,16,0.72)'; ctx.lineWidth = 7 + (depth * 0.5 + 0.5); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = barrelColor; ctx.lineWidth = 5 + (depth * 0.5 + 0.5) * 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = barrelColor;
      ctx.beginPath(); ctx.arc(ex, ey, 2.8 + (depth * 0.5 + 0.5), 0, TWO_PI); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const dist of [barrelLen * 0.38, barrelLen * 0.68]) {
      drawBarrelBand(ctx, cx, cy, localAngle, dist, maxSpread + 4, 7, 'rgba(10,14,26,0.88)', tColor);
    }
    const hubX = cx + Math.cos(localAngle) * (r * 0.25);
    const hubY = cy + Math.sin(localAngle) * (r * 0.25);
    ctx.fillStyle = 'rgba(10,14,26,0.92)';
    ctx.strokeStyle = tColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(hubX, hubY, r * 0.55, 0, TWO_PI); ctx.fill(); ctx.stroke();
    const gFlashT = now - t.lastActionTime;
    if (t.powered && gFlashT < FLASH_DUR_GATLING && t.lastActionTime > 0) {
      const gfx = cx + Math.cos(localAngle) * barrelLen;
      const gfy = cy + Math.sin(localAngle) * barrelLen;
      drawMuzzleFlash(ctx, gfx, gfy, localAngle, gFlashT / FLASH_DUR_GATLING, tColor, '245,158,11', 8, true, t.lastActionTime);
    }

    // Ring heat indicator
    if (t.powered && (t.heat > 0.01 || t.overloaded)) {
      const ringR = Math.min(tw, th) / 2 - inset;
      const heat = t.overloaded ? 1 : t.heat;
      const hStartA = -Math.PI / 2;
      ctx.strokeStyle = 'rgba(30,41,59,0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, TWO_PI); ctx.stroke();
      const hEndA = hStartA + TWO_PI * heat;
      const hR = Math.floor(245 + 10 * heat);
      const hG = Math.floor(158 * (1 - heat * 0.7));
      const hB = Math.floor(11 * (1 - heat));
      ctx.strokeStyle = `rgb(${hR},${hG},${hB})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, ringR, hStartA, hEndA); ctx.stroke();
      const htipX = cx + Math.cos(hEndA) * ringR;
      const htipY = cy + Math.sin(hEndA) * ringR;
      ctx.fillStyle = `rgb(${hR},${hG},${hB})`;
      ctx.shadowColor = `rgb(${hR},${hG},${hB})`; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(htipX, htipY, 3, 0, TWO_PI); ctx.fill();
      ctx.shadowBlur = 0;
      if (heat > 0.8 || t.overloaded) {
        const wPulse = 0.1 + 0.08 * Math.sin(now / 200);
        const wGrd = ctx.createRadialGradient(cx, cy, ringR - 3, cx, cy, ringR + 8);
        wGrd.addColorStop(0, `rgba(255,50,0,${wPulse})`);
        wGrd.addColorStop(1, 'rgba(255,50,0,0)');
        ctx.fillStyle = wGrd;
        ctx.beginPath(); ctx.arc(cx, cy, ringR + 8, 0, TWO_PI); ctx.fill();
      }

      if (t.overloaded) {
        const smokeBaseY = cy - r - 6;
        for (let i = 0; i < 6; i++) {
          const smokePhase = now / 820 + i * 0.72;
          const drift = (smokePhase % 1);
          const smokeX = cx + Math.sin(smokePhase * 1.25) * (8 + i * 3.5) + (i % 2 === 0 ? -1 : 1) * drift * 10;
          const smokeY = smokeBaseY - i * 11 - drift * (20 + i * 4);
          const smokeR = 7 + i * 2.8 + Math.sin(smokePhase * 2.2) * 1.4;
          ctx.fillStyle = `rgba(160,170,180,${0.2 - i * 0.024})`;
          ctx.beginPath(); ctx.arc(smokeX, smokeY, smokeR, 0, TWO_PI); ctx.fill();
        }

        ctx.shadowBlur = 0;
        for (let spark = 0; spark < 4; spark++) {
          const jitterSeed = Math.sin(now / 170 + spark * 12.37);
          const barrelPos = 0.25 + (((jitterSeed + 1) * 0.5 + spark * 0.17) % 0.55);
          const lateralSide = spark % 2 === 0 ? 1 : -1;
          const lateralOffset = (2 + ((jitterSeed + 1) * 0.5) * 4) * lateralSide;
          const sx =
            cx +
            Math.cos(localAngle) * (r * 0.2 + barrelLen * barrelPos) +
            -Math.sin(localAngle) * lateralOffset;
          const sy =
            cy +
            Math.sin(localAngle) * (r * 0.2 + barrelLen * barrelPos) +
            Math.cos(localAngle) * lateralOffset;
          const sparkLen = 5 + spark * 1.4 + ((jitterSeed + 1) * 0.5) * 2;
          const sparkDir = localAngle + lateralSide * (0.9 + ((jitterSeed + 1) * 0.5) * 0.45);
          const sparkSpread = 0.12 + spark * 0.02;

          ctx.strokeStyle = 'rgba(255,200,90,0.85)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(
            sx + Math.cos(sparkDir - sparkSpread) * sparkLen,
            sy + Math.sin(sparkDir - sparkSpread) * sparkLen,
          );
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255,120,40,0.95)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(
            sx + Math.cos(sparkDir + sparkSpread) * (sparkLen * 0.9),
            sy + Math.sin(sparkDir + sparkSpread) * (sparkLen * 0.9),
          );
          ctx.stroke();

          ctx.fillStyle = 'rgba(255,245,220,0.9)';
          ctx.beginPath();
          ctx.arc(sx, sy, 1.4, 0, TWO_PI);
          ctx.fill();
        }

        const flamePulse = 0.85 + 0.15 * Math.sin(now / 120);
        for (let flame = 0; flame < 3; flame++) {
          const flameHeight = (10 + flame * 5) * flamePulse;
          const flameWidth = 5 + flame * 2.5;
          const flameYOffset = 2 + flame * 2.2;
          const flicker = Math.sin(now / 90 + flame * 1.7) * 1.4;
          ctx.fillStyle =
            flame === 0 ? 'rgba(255,245,210,0.92)' :
            flame === 1 ? 'rgba(255,170,55,0.82)' :
            'rgba(255,90,20,0.72)';
          ctx.beginPath();
          ctx.moveTo(cx + flicker, cy + 8 - flameYOffset);
          ctx.quadraticCurveTo(
            cx - flameWidth + flicker,
            cy + 4 - flameYOffset,
            cx - flameWidth * 0.55 + flicker,
            cy - flameHeight * 0.25,
          );
          ctx.quadraticCurveTo(
            cx - flameWidth * 0.18 + flicker,
            cy - flameHeight,
            cx + flicker,
            cy - flameHeight - 4,
          );
          ctx.quadraticCurveTo(
            cx + flameWidth * 0.2 + flicker,
            cy - flameHeight * 0.95,
            cx + flameWidth * 0.65 + flicker,
            cy - flameHeight * 0.2,
          );
          ctx.quadraticCurveTo(
            cx + flameWidth + flicker,
            cy + 3 - flameYOffset,
            cx + flicker,
            cy + 8 - flameYOffset,
          );
          ctx.fill();
        }
      }
    }
  } else if (t.type === 'sniper') {
    const r = Math.min(tw, th) / 5;
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI); ctx.stroke();
    drawPowerArc(ctx, cx, cy, r, t.maxPower, t.storedPower);
    const localAngle = t.barrelAngle - t.rotation;
    const barrelLen = (Math.min(tw, th) / 2 - inset + 10) * 2.4;
    const barrelOffset = -CELL_SIZE;
    const { mx, my } = drawCapsuleBarrel(
      ctx, cx, cy, localAngle, barrelOffset + r * 0.2, barrelOffset + barrelLen, 4,
      'rgba(10,14,26,0.88)', tColor, 1.8,
    );
    drawBarrelBand(ctx, cx, cy, localAngle, barrelOffset + barrelLen * 0.48, 5.6, 6, 'rgba(15,23,42,0.94)', tColor);
    drawBarrelBand(ctx, cx, cy, localAngle, barrelOffset + barrelLen * 0.78, 5.8, 7, 'rgba(15,23,42,0.94)', tColor);
    drawMuzzleRing(ctx, mx, my, localAngle, 5, 'rgba(15,23,42,0.96)', tColor);
    drawMuzzleBrake(ctx, cx, cy, localAngle, barrelOffset + barrelLen - 6, 5.2, tColor);
    drawMuzzleBrake(ctx, cx, cy, localAngle, barrelOffset + barrelLen - 18, 5.2, tColor);
    const sFlashT = now - t.lastActionTime;
    if (t.powered && sFlashT < FLASH_DUR_SNIPER && t.lastActionTime > 0) {
      drawMuzzleFlash(ctx, mx, my, localAngle, sFlashT / FLASH_DUR_SNIPER, tColor, '167,139,250', 14, true, t.lastActionTime);
    }

    // Ring cooldown indicator
    const ringR = Math.min(tw, th) / 2 - inset;
    const elapsed = now - t.lastActionTime;
    const cdRatio = t.lastActionTime > 0 ? Math.min(1, elapsed / SNIPER_COOLDOWN_MS) : 1;
    const startA = -Math.PI / 2;
    ctx.strokeStyle = 'rgba(30,41,59,0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, TWO_PI); ctx.stroke();
    if (t.powered && cdRatio < 1) {
      const endA = startA + TWO_PI * cdRatio;
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, ringR, startA, endA); ctx.stroke();
      const tipX = cx + Math.cos(endA) * ringR;
      const tipY = cy + Math.sin(endA) * ringR;
      const tipGrd = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 5);
      tipGrd.addColorStop(0, 'rgba(167,139,250,0.8)');
      tipGrd.addColorStop(1, 'rgba(167,139,250,0)');
      ctx.fillStyle = tipGrd;
      ctx.beginPath(); ctx.arc(tipX, tipY, 5, 0, TWO_PI); ctx.fill();
    } else if (t.storedPower >= 4 && t.powered) {
      const pulse = 0.4 + 0.3 * Math.sin(now / 300);
      ctx.strokeStyle = `rgba(167,139,250,${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 8 * pulse;
      ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, TWO_PI); ctx.stroke();
      ctx.shadowBlur = 0;
      const glowGrd = ctx.createRadialGradient(cx, cy, ringR - 3, cx, cy, ringR + 6);
      glowGrd.addColorStop(0, `rgba(167,139,250,${pulse * 0.2})`);
      glowGrd.addColorStop(1, 'rgba(167,139,250,0)');
      ctx.fillStyle = glowGrd;
      ctx.beginPath(); ctx.arc(cx, cy, ringR + 6, 0, TWO_PI); ctx.fill();
    }
  } else if (t.type === 'tesla') {
    const r1 = Math.min(tw, th) / 3; const r2 = Math.min(tw, th) / 5;
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r1, 0, TWO_PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r2, 0, TWO_PI); ctx.stroke();
    drawPowerArc(ctx, cx, cy, r1, t.maxPower, t.storedPower, tColor);
    if (t.powered) {
      ctx.strokeStyle = tColor; ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
      for (let s = 0; s < 4; s++) {
        const a = s * Math.PI / 2 + (now / 500);
        const sx = cx + Math.cos(a) * r2; const sy = cy + Math.sin(a) * r2;
        const ex = cx + Math.cos(a) * r1; const ey = cy + Math.sin(a) * r1;
        const midX = (sx + ex) / 2 + Math.sin(a + now / 200) * 3;
        const midY = (sy + ey) / 2 + Math.cos(a + now / 200) * 3;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(midX, midY); ctx.lineTo(ex, ey); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = tColor;
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, TWO_PI); ctx.fill();
    const tFlashT = now - t.lastActionTime;
    if (t.powered && tFlashT < FLASH_DUR_TESLA && t.lastActionTime > 0) {
      drawMuzzleFlash(ctx, cx, cy, 0, tFlashT / FLASH_DUR_TESLA, tColor, '232,121,249', 14, false, t.lastActionTime);
    }
  } else if (t.type === 'missile') {
    const localAngle = t.barrelAngle - t.rotation;
    const rackW = Math.min(tw, th) * 0.24;
    const rackLen = Math.min(tw, th) * 0.44;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(localAngle);
    ctx.strokeStyle = tColor;
    ctx.fillStyle = 'rgba(15,23,42,0.95)';
    ctx.lineWidth = 1.8;
    for (const off of [-rackW * 0.65, rackW * 0.65]) {
      ctx.beginPath();
      ctx.roundRect(-rackLen * 0.35, off - rackW * 0.35, rackLen, rackW * 0.7, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = t.storedPower >= t.maxPower ? '#fecdd3' : 'rgba(15,23,42,0.95)';
    }
    ctx.restore();
    drawPowerArc(ctx, cx, cy, Math.min(tw, th) / 2 - inset - 2, t.maxPower, t.storedPower, tColor);
  } else if (t.type === 'generator' || t.type === 'big_generator') {
    drawEnergyEffect(ctx, cx, cy, now, t.powered, tColor);
    if (t.type === 'big_generator') {
      ctx.strokeStyle = tColor;
      ctx.lineWidth = 1.5;
      const r = Math.min(tw, th) / 2 - inset - 4;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI); ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + now / 700;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, 3, 0, TWO_PI);
        ctx.fillStyle = tColor;
        ctx.fill();
      }
    }
  } else if (t.type === 'repair_drone') {
    drawPowerArc(ctx, cx, cy, Math.min(tw, th) / 2 - inset - 2, t.maxPower, t.storedPower, tColor);
    const orbit = Math.min(tw, th) * 0.28;
    const a = now / 850;
    const dx = cx + Math.cos(a) * orbit;
    const dy = cy + Math.sin(a) * orbit * 0.55;
    ctx.strokeStyle = tColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, orbit, 0, TWO_PI); ctx.stroke();
    ctx.fillStyle = 'rgba(15,23,42,0.95)';
    ctx.beginPath(); ctx.arc(dx, dy, 6, 0, TWO_PI); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dx - 10, dy); ctx.lineTo(dx + 10, dy); ctx.stroke();
  } else if (t.type === 'battery') {
    const isLandscape = tw >= th;
    const cc = t.maxPower;
    const cg = 2;
    for (let i = 0; i < cc; i++) {
      const bw = isLandscape
        ? (tw - inset * 2 - 2 - (cc - 1) * cg) / cc
        : tw - inset * 2 - 4;
      const bh = isLandscape
        ? th - inset * 2 - 4
        : (th - inset * 2 - 2 - (cc - 1) * cg) / cc;
      const bx = isLandscape ? px + inset + 1 + i * (bw + cg) : px + inset + 2;
      const by = isLandscape ? py + inset + 2 : py + inset + 1 + i * (bh + cg);
      if (i < t.storedPower) {
        ctx.fillStyle = POWER_ON; ctx.shadowColor = POWER_ON; ctx.shadowBlur = 3;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(bx, by, bw, bh);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = tColor; ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.shadowBlur = 0;
    }
  } else if (t.type === 'shield') {
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    const r = Math.min(tw, th) / 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI * 0.8, Math.PI * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TWO_PI); ctx.stroke();
  } else if (t.type === 'bus') {
    const isLandscape = tw >= th;
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (isLandscape) {
      ctx.moveTo(cx, py + inset + 2);
      ctx.lineTo(cx, py + th - inset - 2);
    } else {
      ctx.moveTo(px + inset + 2, cy);
      ctx.lineTo(px + tw - inset - 2, cy);
    }
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const tPos = isLandscape
        ? { x: px + tw * ((i * 2 + 1) / 6), y: py + inset }
        : { x: px + inset, y: py + th * ((i * 2 + 1) / 6) };
      ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tPos.x, tPos.y);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      if (isLandscape) {
        ctx.arc(tPos.x, tPos.y + 2, 2, 0, TWO_PI);
      } else {
        ctx.arc(tPos.x + 2, tPos.y, 2, 0, TWO_PI);
      }
      ctx.fill();
    }
    for (let i = 0; i < 3; i++) {
      const tPos = isLandscape
        ? { x: px + tw * ((i * 2 + 1) / 6), y: py + th - inset }
        : { x: px + tw - inset, y: py + th * ((i * 2 + 1) / 6) };
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tPos.x, tPos.y);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      if (isLandscape) {
        const tipY = tPos.y - 2;
        ctx.beginPath();
        ctx.moveTo(tPos.x, tipY + 4); ctx.lineTo(tPos.x - 3, tipY); ctx.lineTo(tPos.x + 3, tipY); ctx.closePath();
        ctx.fill();
      } else {
        const tipX = tPos.x - 2;
        ctx.beginPath();
        ctx.moveTo(tipX + 4, tPos.y); ctx.lineTo(tipX, tPos.y - 3); ctx.lineTo(tipX, tPos.y + 3); ctx.closePath();
        ctx.fill();
      }
    }
    ctx.fillStyle = tColor;
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TWO_PI); ctx.fill();
  }
}

import { GameState, Tower, TowerType, CELL_SIZE, HALF_CELL, TOWER_STATS, TURRET_RANGE } from '../types';
import { getPortPos } from '../engine';
import {
  TWO_PI, BG_DARK, UNPOWERED, PULSE_CLR, HP_BG, HP_FG,
  PORT_OUT, PORT_OUT_USED, PORT_IN, PORT_IN_USED, KNOB_CLR, POWER_ON,
  INSET, portOutward,
} from './constants';
import {
  drawPowerArc, drawRangeCircle, drawMuzzleFlash, drawBarrel,
  FLASH_DUR_BLASTER, FLASH_DUR_GATLING, FLASH_DUR_SNIPER, FLASH_DUR_TESLA,
  SNIPER_COOLDOWN_MS,
} from './helpers';

const getLinearTowerBodyRect = (
  px: number, py: number, tw: number, th: number,
) => {
  const isLandscape = tw >= th;
  if (isLandscape) {
    const bodyH = tw / 2;
    return {
      isLandscape,
      x: px,
      y: py + (th - bodyH) / 2,
      width: tw,
      height: bodyH,
    };
  }

  const bodyW = th / 2;
  return {
    isLandscape,
    x: px + (tw - bodyW) / 2,
    y: py,
    width: bodyW,
    height: th,
  };
};

// ── Ports (drawn under tower bodies) ─────────────────────────────────────
export const drawPorts = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const OUT_TRI = 7.5;
  const IN_HALF = 6;
  const portStrokeW = 1.35;
  for (const tower of state.towers) {
    const ppx = tower.x * CELL_SIZE, ppy = tower.y * CELL_SIZE;
    const ptw = tower.width * CELL_SIZE, pth = tower.height * CELL_SIZE;
    const pcx = ppx + ptw / 2, pcy = ppy + pth / 2;

    ctx.save();
    ctx.translate(pcx, pcy);
    ctx.rotate(tower.rotation);
    ctx.translate(-pcx, -pcy);

    for (const port of tower.ports) {
      const pos = getPortPos(tower, port);
      const off = portOutward(port.direction);
      const drawX = pos.x + off.x, drawY = pos.y + off.y;
      const used = state.wires.some(w => w.startPortId === port.id || w.endPortId === port.id);
      const portColor = port.portType === 'output'
        ? (used ? PORT_OUT_USED : PORT_OUT)
        : (used ? PORT_IN_USED : PORT_IN);

      ctx.strokeStyle = portColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(drawX, drawY);
      ctx.stroke();

      if (port.portType === 'output') {
        ctx.fillStyle = portColor;
        const s = OUT_TRI;
        ctx.beginPath();
        switch (port.direction) {
          case 'top':    ctx.moveTo(drawX - s, drawY + s / 2); ctx.lineTo(drawX + s, drawY + s / 2); ctx.lineTo(drawX, drawY - s); break;
          case 'bottom': ctx.moveTo(drawX - s, drawY - s / 2); ctx.lineTo(drawX + s, drawY - s / 2); ctx.lineTo(drawX, drawY + s); break;
          case 'left':   ctx.moveTo(drawX + s / 2, drawY - s); ctx.lineTo(drawX + s / 2, drawY + s); ctx.lineTo(drawX - s, drawY); break;
          case 'right':  ctx.moveTo(drawX - s / 2, drawY - s); ctx.lineTo(drawX - s / 2, drawY + s); ctx.lineTo(drawX + s, drawY); break;
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = BG_DARK;
        ctx.lineWidth = portStrokeW;
        ctx.stroke();
      } else {
        ctx.fillStyle = portColor;
        const h = IN_HALF;
        const r = 2.25;
        ctx.beginPath();
        ctx.roundRect(drawX - h, drawY - h, h * 2, h * 2, r);
        ctx.fill();
        ctx.strokeStyle = BG_DARK;
        ctx.lineWidth = portStrokeW;
        ctx.stroke();
      }
    }

    ctx.restore();
  }
};

// ── Tower bodies ────────────────────────────────────────────────────────────
export const drawTowers = (ctx: CanvasRenderingContext2D, state: GameState, now: number) => {
  for (const tower of state.towers) {
    const px = tower.x * CELL_SIZE, py = tower.y * CELL_SIZE;
    const tw = tower.width * CELL_SIZE, th = tower.height * CELL_SIZE;
    const cx = px + tw / 2, cy = py + th / 2;
    const inset = (tower.width === 1 && tower.height === 1) ? 5 : INSET;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tower.rotation);
    ctx.translate(-cx, -cy);

    const tColor = (!tower.powered && tower.type !== 'core') ? UNPOWERED : TOWER_STATS[tower.type].color;

    // Outlined style: dark fill + colored border (shape varies by turret type)
    ctx.fillStyle = 'rgba(10,14,26,0.85)';
    ctx.strokeStyle = tColor;
    ctx.lineWidth = 1.75;

    if (tower.type === 'gatling') {
      const cr = 8;
      ctx.beginPath();
      ctx.roundRect(px + inset, py + inset, tw - inset * 2, th - inset * 2, cr);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = tColor; ctx.lineWidth = 1; ctx.globalAlpha = 0.4;
      const ventCount = 3;
      const ventSpacing = (th - inset * 2) / (ventCount + 1);
      for (let v = 1; v <= ventCount; v++) {
        const vy = py + inset + v * ventSpacing;
        ctx.beginPath(); ctx.moveTo(px + inset + 2, vy); ctx.lineTo(px + inset + 7, vy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + tw - inset - 2, vy); ctx.lineTo(px + tw - inset - 7, vy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (tower.type === 'sniper') {
      ctx.beginPath();
      ctx.moveTo(cx, py + inset);
      ctx.lineTo(px + tw - inset, cy);
      ctx.lineTo(cx, py + th - inset);
      ctx.lineTo(px + inset, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = tColor;
      const dotR = 1.8;
      ctx.beginPath(); ctx.arc(cx, py + inset, dotR, 0, TWO_PI); ctx.fill();
      ctx.beginPath(); ctx.arc(px + tw - inset, cy, dotR, 0, TWO_PI); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, py + th - inset, dotR, 0, TWO_PI); ctx.fill();
      ctx.beginPath(); ctx.arc(px + inset, cy, dotR, 0, TWO_PI); ctx.fill();
    } else if (tower.type === 'tesla') {
      const hexR = Math.min(tw, th) / 2 - inset;
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
      const baseR = Math.min(tw, th) / 2 - inset - 3;
      ctx.beginPath(); ctx.arc(cx, cy, baseR, 0, TWO_PI);
      ctx.fill();
      ctx.stroke();
    } else if (tower.type === 'battery' || tower.type === 'bus') {
      const body = getLinearTowerBodyRect(px, py, tw, th);
      ctx.fillRect(body.x + inset, body.y + inset, body.width - inset * 2, body.height - inset * 2);
      ctx.strokeRect(body.x + inset, body.y + inset, body.width - inset * 2, body.height - inset * 2);
    } else {
      ctx.fillRect(px + inset, py + inset, tw - inset * 2, th - inset * 2);
      ctx.strokeRect(px + inset, py + inset, tw - inset * 2, th - inset * 2);
    }

    if (tower.type === 'battery' || tower.type === 'bus') {
      const body = getLinearTowerBodyRect(px, py, tw, th);
      drawTowerDetails(
        ctx, tower, body.x, body.y, body.width, body.height, cx, cy, tColor, inset, now,
      );
    } else {
      drawTowerDetails(ctx, tower, px, py, tw, th, cx, cy, tColor, inset, now);
    }

    ctx.restore();

    // Bars (not rotated) — shield bar removed, shield uses fade visualization
    if (tower.hp < tower.maxHp) {
      ctx.fillStyle = HP_BG; ctx.fillRect(px, py - 5, tw, 3);
      ctx.fillStyle = HP_FG; ctx.fillRect(px, py - 5, tw * (tower.hp / tower.maxHp), 3);
    }
    if (tower.maxPower > 0 && tower.type !== 'core' && tower.type !== 'battery' && tower.type !== 'blaster' && tower.type !== 'gatling' && tower.type !== 'sniper' && tower.type !== 'tesla') {
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
    ? getLinearTowerBodyRect(prevPx, prevPy, prevTw, prevTh)
    : { x: prevPx, y: prevPy, width: prevTw, height: prevTh };
  ctx.strokeStyle = canPlaceFlag ? stats.color : '#ef4444';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  ctx.strokeRect(previewBody.x + pi, previewBody.y + pi, previewBody.width - pi * 2, previewBody.height - pi * 2);
  if (canPlaceFlag) {
    ctx.fillStyle = stats.color;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(previewBody.x + pi, previewBody.y + pi, previewBody.width - pi * 2, previewBody.height - pi * 2);
  }
  ctx.globalAlpha = 1;
};

// ── Range preview ─────────────────────────────────────────────────────────
export const drawRangePreview = (
  ctx: CanvasRenderingContext2D, state: GameState,
  hoverPos: { x: number; y: number } | null,
  selectedTower: TowerType | null,
  rotatingTowerId: string | null,
) => {
  if (hoverPos && selectedTower && state.status === 'playing') {
    const range = TURRET_RANGE[selectedTower];
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
      const range = TURRET_RANGE[rt.type];
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
  if (!tower) return;

  const tpx = tower.x * CELL_SIZE, tpy = tower.y * CELL_SIZE;
  const ttw = tower.width * CELL_SIZE, tth = tower.height * CELL_SIZE;
  const tcx = tpx + ttw / 2, tcy = tpy + tth / 2;
  const kd = Math.max(tower.width, tower.height) * CELL_SIZE / 2 + 20;
  const kx = tcx + Math.cos(tower.rotation - Math.PI / 2) * kd;
  const ky = tcy + Math.sin(tower.rotation - Math.PI / 2) * kd;

  ctx.strokeStyle = KNOB_CLR; ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(tpx - 2, tpy - 2, ttw + 4, tth + 4);
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(251,191,36,0.2)';
  for (let i = 0; i < 4; i++) {
    const sa = i * Math.PI / 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(tcx + Math.cos(sa) * kd, tcy + Math.sin(sa) * kd, 3, 0, TWO_PI);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(251,191,36,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(tcx, tcy); ctx.lineTo(kx, ky); ctx.stroke();

  ctx.fillStyle = KNOB_CLR; ctx.shadowColor = KNOB_CLR; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(kx, ky, 7, 0, TWO_PI); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = BG_DARK;
  ctx.beginPath(); ctx.arc(kx, ky, 3, 0, TWO_PI); ctx.fill();

  // Arc arrow wrapping around the knob
  const arcR = 14;
  const arcStart = Math.PI * 0.8;
  const arcEnd = Math.PI * 0.2;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(kx, ky, arcR, arcStart, arcEnd, false);
  ctx.stroke();
  const arrowLen = 5;
  // Left arrowhead
  const la = arcStart;
  const lx = kx + arcR * Math.cos(la), ly = ky + arcR * Math.sin(la);
  const lTan = la - Math.PI / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(lx + arrowLen * Math.cos(lTan - 0.5), ly + arrowLen * Math.sin(lTan - 0.5));
  ctx.lineTo(lx, ly);
  ctx.lineTo(lx + arrowLen * Math.cos(lTan + 0.5), ly + arrowLen * Math.sin(lTan + 0.5));
  ctx.fill();
  // Right arrowhead
  const ra = arcEnd;
  const rx = kx + arcR * Math.cos(ra), ry = ky + arcR * Math.sin(ra);
  const rTan = ra + Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(rx + arrowLen * Math.cos(rTan - 0.5), ry + arrowLen * Math.sin(rTan - 0.5));
  ctx.lineTo(rx, ry);
  ctx.lineTo(rx + arrowLen * Math.cos(rTan + 0.5), ry + arrowLen * Math.sin(rTan + 0.5));
  ctx.fill();

  // "拖动旋转" label
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('拖动旋转', kx, ky - arcR - 6);
};

// ── Tower detail drawing (called within rotation transform) ──────────────────
function drawTowerDetails(
  ctx: CanvasRenderingContext2D, t: Tower,
  px: number, py: number, tw: number, th: number, cx: number, cy: number,
  tColor: string, inset: number, now: number,
) {
  if (t.type === 'core') {
    const R = Math.min(tw, th);
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
    const barrelLen = Math.min(tw, th) / 2 - inset + 6;
    drawBarrel(ctx, cx, cy, localAngle, r, barrelLen, tColor, 5, 0.3, 3.5);
    const flashT = now - t.lastActionTime;
    if (flashT < FLASH_DUR_BLASTER && t.lastActionTime > 0) {
      const fmx = cx + Math.cos(localAngle) * barrelLen;
      const fmy = cy + Math.sin(localAngle) * barrelLen;
      drawMuzzleFlash(ctx, fmx, fmy, localAngle, flashT / FLASH_DUR_BLASTER, tColor, '248,113,113', 8, true, t.lastActionTime);
    }
  } else if (t.type === 'gatling') {
    const r = Math.min(tw, th) / 4 - 1;
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI); ctx.stroke();
    const localAngle = t.barrelAngle - t.rotation;
    const barrelLen = Math.min(tw, th) / 2 - inset + 4;
    // Heat glow on barrels
    const heat = t.heat;
    if (heat > 0.1) {
      const glowR = r * 1.3;
      const heatOp = heat * 0.15;
      const hGrd = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, glowR);
      hGrd.addColorStop(0, `rgba(255,${Math.floor(100 * (1 - heat))},0,${heatOp})`);
      hGrd.addColorStop(1, 'rgba(255,100,0,0)');
      ctx.fillStyle = hGrd;
      ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, TWO_PI); ctx.fill();
    }
    const spinSpeed = 2 + heat * 8;
    const spinOffset = now / 1000 * spinSpeed * TWO_PI;
    const barrelCount = 5;
    const maxSpread = 8;
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
      const barrelColor = heat > 0.1 ? `rgb(${bColorR},${bColorG},${bColorB})` : tColor;
      const bAlpha = 0.4 + 0.6 * (depth * 0.5 + 0.5);
      ctx.globalAlpha = bAlpha;
      ctx.strokeStyle = barrelColor; ctx.lineWidth = 2.5 + (depth * 0.5 + 0.5); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const gFlashT = now - t.lastActionTime;
    if (gFlashT < FLASH_DUR_GATLING && t.lastActionTime > 0) {
      const gfx = cx + Math.cos(localAngle) * barrelLen;
      const gfy = cy + Math.sin(localAngle) * barrelLen;
      drawMuzzleFlash(ctx, gfx, gfy, localAngle, gFlashT / FLASH_DUR_GATLING, tColor, '245,158,11', 6, true, t.lastActionTime);
    }

    // Ring heat indicator
    if (t.heat > 0.01) {
      const ringR = Math.min(tw, th) / 2 - inset;
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
      if (heat > 0.8) {
        const wPulse = 0.1 + 0.08 * Math.sin(now / 200);
        const wGrd = ctx.createRadialGradient(cx, cy, ringR - 3, cx, cy, ringR + 8);
        wGrd.addColorStop(0, `rgba(255,50,0,${wPulse})`);
        wGrd.addColorStop(1, 'rgba(255,50,0,0)');
        ctx.fillStyle = wGrd;
        ctx.beginPath(); ctx.arc(cx, cy, ringR + 8, 0, TWO_PI); ctx.fill();
      }
    }
  } else if (t.type === 'sniper') {
    const r = Math.min(tw, th) / 5;
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI); ctx.stroke();
    drawPowerArc(ctx, cx, cy, r, t.maxPower, t.storedPower);
    const localAngle = t.barrelAngle - t.rotation;
    const barrelLen = Math.min(tw, th) / 2 - inset + 10;
    const { mx, my } = drawBarrel(ctx, cx, cy, localAngle, r, barrelLen, tColor, 3, 0.2, 2);
    const scopeD = barrelLen * 0.7;
    const scopeX = cx + Math.cos(localAngle) * scopeD;
    const scopeY = cy + Math.sin(localAngle) * scopeD;
    ctx.strokeStyle = tColor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(scopeX, scopeY, 4, 0, TWO_PI); ctx.stroke();
    const sFlashT = now - t.lastActionTime;
    if (sFlashT < FLASH_DUR_SNIPER && t.lastActionTime > 0) {
      drawMuzzleFlash(ctx, mx, my, localAngle, sFlashT / FLASH_DUR_SNIPER, tColor, '167,139,250', 12, true, t.lastActionTime);
    }

    // Ring cooldown indicator
    const ringR = Math.min(tw, th) / 2 - inset;
    const elapsed = now - t.lastActionTime;
    const cdRatio = t.lastActionTime > 0 ? Math.min(1, elapsed / SNIPER_COOLDOWN_MS) : 1;
    const startA = -Math.PI / 2;
    ctx.strokeStyle = 'rgba(30,41,59,0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, TWO_PI); ctx.stroke();
    if (cdRatio < 1) {
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
    ctx.fillStyle = tColor;
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, TWO_PI); ctx.fill();
    const tFlashT = now - t.lastActionTime;
    if (tFlashT < FLASH_DUR_TESLA && t.lastActionTime > 0) {
      drawMuzzleFlash(ctx, cx, cy, 0, tFlashT / FLASH_DUR_TESLA, tColor, '232,121,249', 14, false, t.lastActionTime);
    }
  } else if (t.type === 'generator') {
    const s = Math.min(tw, th) * 0.25;

    // Rotating energy arcs
    ctx.lineWidth = 1.5;
    const arcCount = 3;
    for (let i = 0; i < arcCount; i++) {
      const baseAngle = (i / arcCount) * TWO_PI + now / 800;
      const arcR = s * 1.2 + Math.sin(now / 400 + i * 2) * 2;
      const arcOp = t.powered ? (0.2 + 0.25 * Math.sin(now / 300 + i * 1.5)) : 0.08;
      ctx.strokeStyle = `rgba(251,191,36,${arcOp})`;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, baseAngle, baseAngle + Math.PI * 0.5);
      ctx.stroke();
    }

    // Pulsing center glow
    if (t.powered) {
      const pulse = 0.08 + 0.07 * Math.sin(now / 250);
      const glowR = s * 1.5;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grd.addColorStop(0, `rgba(251,191,36,${pulse})`);
      grd.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, TWO_PI); ctx.fill();
    }

    // Lightning bolt icon
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.1, cy - s); ctx.lineTo(cx - s * 0.4, cy + s * 0.1);
    ctx.lineTo(cx + s * 0.1, cy + s * 0.1); ctx.lineTo(cx - s * 0.1, cy + s);
    ctx.stroke();

    // Small electric sparks flying outward when powered
    if (t.powered) {
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
        const jx = (Math.sin(now / 100 + sp) * 2);
        const jy = (Math.cos(now / 100 + sp) * 2);
        ctx.moveTo(spx - 2 + jx, spy - 2 + jy);
        ctx.lineTo(spx + 2 - jx, spy + 2 - jy);
        ctx.stroke();
      }
    }
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

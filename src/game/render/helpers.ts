import { WEAPON_CONFIG } from '../config';
import { TWO_PI, PULSE_CLR } from './constants';

export const SNIPER_COOLDOWN_MS = WEAPON_CONFIG.sniper.cooldown;

export const FLASH_DUR_BLASTER = 150;
export const FLASH_DUR_GATLING = 100;
export const FLASH_DUR_SNIPER = 250;
export const FLASH_DUR_TESLA = 300;

export const drawPowerArc = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, maxPower: number, storedPower: number, color = PULSE_CLR) => {
  if (maxPower <= 0 || storedPower <= 0) return;
  const arcPer = TWO_PI / maxPower;
  const startA = -Math.PI / 2;
  ctx.fillStyle = color;
  ctx.globalAlpha = color === PULSE_CLR ? 0.5 : 0.25;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r - 0.5, startA, startA + arcPer * storedPower);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
};

export const drawRangeCircle = (ctx: CanvasRenderingContext2D, cx: number, cy: number, range: number, strokeOp: number, fillOp: number) => {
  ctx.beginPath();
  ctx.arc(cx, cy, range, 0, TWO_PI);
  ctx.strokeStyle = `rgba(255,255,255,${strokeOp})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = `rgba(255,255,255,${fillOp})`;
  ctx.fill();
};

export const drawMuzzleFlash = (
  ctx: CanvasRenderingContext2D, x: number, y: number, angle: number,
  progress: number, _color: string, rgb: string, size: number, directional: boolean,
  seed: number,
) => {
  const alpha = 1 - progress;
  const expand = 1 + progress * 0.8;

  // Outer glow halo
  const glowR = size * expand * 3;
  const grd = ctx.createRadialGradient(x, y, 0, x, y, glowR);
  grd.addColorStop(0, `rgba(${rgb},${alpha * 0.5})`);
  grd.addColorStop(0.3, `rgba(${rgb},${alpha * 0.25})`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(x, y, glowR, 0, TWO_PI); ctx.fill();

  // Bright colored core
  ctx.fillStyle = `rgba(${rgb},${alpha * 0.8})`;
  ctx.beginPath(); ctx.arc(x, y, size * expand, 0, TWO_PI); ctx.fill();

  // White-hot center
  const coreR = size * 0.7 * (1 - progress * 0.4);
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`;
  ctx.shadowColor = `rgba(${rgb},1)`; ctx.shadowBlur = size * 2 * alpha;
  ctx.beginPath(); ctx.arc(x, y, coreR, 0, TWO_PI); ctx.fill();
  ctx.shadowBlur = 0;

  // Sparks flying outward
  const sparkCount = directional ? 6 : 8;
  let rng = seed;
  const nextRng = () => { rng = (rng * 16807 + 7) % 2147483647; return (rng & 0x7fffffff) / 0x7fffffff; };
  ctx.lineCap = 'round';
  for (let i = 0; i < sparkCount; i++) {
    const baseA = directional
      ? angle + (nextRng() - 0.5) * Math.PI * 0.8
      : nextRng() * TWO_PI;
    const sparkLen = size * (1.5 + nextRng() * 2.5) * alpha;
    const sparkDist = size * 0.5 + size * progress * (1 + nextRng() * 2);
    const sx = x + Math.cos(baseA) * sparkDist;
    const sy = y + Math.sin(baseA) * sparkDist;
    const ex = sx + Math.cos(baseA) * sparkLen;
    const ey = sy + Math.sin(baseA) * sparkLen;
    const sparkOp = alpha * (0.5 + nextRng() * 0.5);
    ctx.strokeStyle = `rgba(${rgb},${sparkOp})`;
    ctx.lineWidth = 1 + nextRng() * 1.5;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    // Bright spark tip
    ctx.fillStyle = `rgba(255,255,255,${sparkOp * 0.8})`;
    ctx.beginPath(); ctx.arc(ex, ey, 0.8 + nextRng(), 0, TWO_PI); ctx.fill();
  }

  // Directional blast cone
  if (directional) {
    const coneLen = size * 4 * alpha;
    const coneSpread = 0.3;
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = `rgba(${rgb},0.6)`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle - coneSpread) * coneLen, y + Math.sin(angle - coneSpread) * coneLen);
    ctx.lineTo(x + Math.cos(angle) * coneLen * 1.2, y + Math.sin(angle) * coneLen * 1.2);
    ctx.lineTo(x + Math.cos(angle + coneSpread) * coneLen, y + Math.sin(angle + coneSpread) * coneLen);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
};

export const drawBarrel = (ctx: CanvasRenderingContext2D, cx: number, cy: number, localAngle: number, r: number, barrelLen: number, tColor: string, lineWidth: number, startFrac: number, muzzleR: number) => {
  const bx = cx + Math.cos(localAngle) * r * startFrac;
  const by = cy + Math.sin(localAngle) * r * startFrac;
  const mx = cx + Math.cos(localAngle) * barrelLen;
  const my = cy + Math.sin(localAngle) * barrelLen;
  ctx.strokeStyle = tColor; ctx.lineWidth = lineWidth; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(mx, my); ctx.stroke();
  ctx.fillStyle = tColor;
  ctx.beginPath(); ctx.arc(mx, my, muzzleR, 0, TWO_PI); ctx.fill();
  return { mx, my };
};

import { GameState, CELL_SIZE, HALF_CELL, TOWER_STATS } from '../types';
import { getPortPos } from '../engine';
import {
  TWO_PI, WIRE_ON, WIRE_OFF, PULSE_CLR, PROJ_CLR, HP_BG, HP_FG,
  WIRE_LINE_WIDTH, portOutward, posOnPath,
} from './constants';

// ── Wires ─────────────────────────────────────────────────────────────────
export const drawWires = (ctx: CanvasRenderingContext2D, state: GameState) => {
  ctx.lineWidth = WIRE_LINE_WIDTH;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const wire of state.wires) {
    if (!wire.path.length) continue;
    const t1 = state.towerMap.get(wire.startTowerId);
    const t2 = state.towerMap.get(wire.endTowerId);
    const p1 = t1?.ports.find(p => p.id === wire.startPortId);
    const p2 = t2?.ports.find(p => p.id === wire.endPortId);
    if (!t1 || !p1 || !t2 || !p2) continue;

    const powered = t1.powered || t2.powered;
    ctx.strokeStyle = powered ? WIRE_ON : WIRE_OFF;
    if (powered) { ctx.shadowColor = WIRE_ON; ctx.shadowBlur = 9; }
    ctx.beginPath();
    const sp = getPortPos(t1, p1);
    const so = portOutward(p1.direction);
    ctx.moveTo(sp.x + so.x, sp.y + so.y);
    for (const pt of wire.path) ctx.lineTo(pt.x * CELL_SIZE + HALF_CELL, pt.y * CELL_SIZE + HALF_CELL);
    const ep = getPortPos(t2, p2);
    const eo = portOutward(p2.direction);
    ctx.lineTo(ep.x + eo.x, ep.y + eo.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
};

// ── Dragged wire preview ──────────────────────────────────────────────────
export const drawDraggedWire = (
  ctx: CanvasRenderingContext2D, state: GameState,
  draggedWireStart: { towerId: string; portId: string } | null,
  mouseWorldPos: { x: number; y: number } | null,
  draggedWirePath: { x: number; y: number }[] | null,
) => {
  if (!draggedWireStart || !mouseWorldPos) return;
  const t1 = state.towerMap.get(draggedWireStart.towerId);
  const p1 = t1?.ports.find(p => p.id === draggedWireStart.portId);
  if (!t1 || !p1) return;

  const sp = getPortPos(t1, p1);
  const spo = portOutward(p1.direction);
  ctx.strokeStyle = draggedWirePath ? 'rgba(96,165,250,0.8)' : 'rgba(239,68,68,0.8)';
  ctx.lineWidth = WIRE_LINE_WIDTH;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(sp.x + spo.x, sp.y + spo.y);
  if (draggedWirePath) {
    for (const pt of draggedWirePath) ctx.lineTo(pt.x * CELL_SIZE + HALF_CELL, pt.y * CELL_SIZE + HALF_CELL);
  }
  ctx.lineTo(mouseWorldPos.x, mouseWorldPos.y);
  ctx.stroke();
  ctx.setLineDash([]);
};

// ── Pulses ────────────────────────────────────────────────────────────────
export const drawPulses = (ctx: CanvasRenderingContext2D, state: GameState) => {
  ctx.fillStyle = PULSE_CLR;
  ctx.shadowColor = PULSE_CLR;
  ctx.shadowBlur = 12;
  for (const p of state.pulses) {
    const pos = posOnPath(p.path, p.progress);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 6.5, 0, TWO_PI);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
};

// ── Wire HP bars ──────────────────────────────────────────────────────────
export const drawWireHpBars = (ctx: CanvasRenderingContext2D, state: GameState) => {
  for (const wire of state.wires) {
    if (wire.hp >= wire.maxHp || !wire.path.length) continue;
    const mid = wire.path[(wire.path.length >> 1)];
    const px = mid.x * CELL_SIZE, py = mid.y * CELL_SIZE;
    ctx.fillStyle = HP_BG;
    ctx.fillRect(px + 2, py - 6, CELL_SIZE - 4, 3);
    ctx.fillStyle = HP_FG;
    ctx.fillRect(px + 2, py - 6, (CELL_SIZE - 4) * (wire.hp / wire.maxHp), 3);
  }
};

// ── Shields (fade-based visualization) ───────────────────────────────
export const drawShields = (ctx: CanvasRenderingContext2D, state: GameState, now: number) => {
  for (const t of state.towers) {
    if (t.maxShieldHp <= 0 || t.shieldHp <= 0) continue;
    const cx = (t.x + t.width / 2) * CELL_SIZE, cy = (t.y + t.height / 2) * CELL_SIZE;
    const ratio = t.shieldHp / t.maxShieldHp;
    const r = t.shieldRadius;

    // Outer glow
    const glowOp = 0.04 + 0.12 * ratio;
    const sGrad = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
    sGrad.addColorStop(0, `rgba(34,211,238,0)`);
    sGrad.addColorStop(1, `rgba(34,211,238,${glowOp})`);
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.fill();

    // Shield ring
    const ringWidth = 1 + 2 * ratio;
    const ringOp = 0.15 + 0.6 * ratio;
    ctx.lineWidth = ringWidth;
    ctx.strokeStyle = `rgba(34,211,238,${ringOp})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.stroke();

    // Hex-pattern segments
    const segCount = 12;
    const segAngle = TWO_PI / segCount;
    const activeSegs = Math.ceil(segCount * ratio);
    const shimmer = Math.sin(now / 300) * 0.1;
    ctx.lineWidth = 1;
    for (let s = 0; s < activeSegs; s++) {
      const a = s * segAngle + now / 3000;
      const segOp = (0.1 + 0.25 * ratio + shimmer) * (s < activeSegs - 1 ? 1 : ratio * segCount - Math.floor(ratio * segCount));
      if (segOp < 0.01) continue;
      ctx.strokeStyle = `rgba(34,211,238,${Math.max(0, segOp)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, a, a + segAngle * 0.7);
      ctx.stroke();
    }

    // Inner flicker when low HP
    if (ratio < 0.4) {
      const flicker = Math.random() < 0.3 ? 0.15 : 0;
      if (flicker > 0) {
        ctx.strokeStyle = `rgba(34,211,238,${flicker})`;
        ctx.lineWidth = 2;
        const fa = Math.random() * TWO_PI;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (0.8 + Math.random() * 0.2), fa, fa + 0.5);
        ctx.stroke();
      }
    }
  }
};

// ── Projectiles ───────────────────────────────────────────────────────────
export const drawProjectiles = (ctx: CanvasRenderingContext2D, state: GameState) => {
  if (!state.projectiles.length) return;
  for (const p of state.projectiles) {
    const color = p.color ?? PROJ_CLR;
    const sz = p.size ?? 3;

    if (p.piercing && p.angle !== undefined) {
      const trailLen = 28;
      const tailX = p.x - Math.cos(p.angle) * trailLen;
      const tailY = p.y - Math.sin(p.angle) * trailLen;
      const tGrd = ctx.createLinearGradient(tailX, tailY, p.x, p.y);
      tGrd.addColorStop(0, 'rgba(167,139,250,0)');
      tGrd.addColorStop(0.6, 'rgba(167,139,250,0.25)');
      tGrd.addColorStop(1, 'rgba(167,139,250,0.7)');
      ctx.strokeStyle = tGrd;
      ctx.lineWidth = sz * 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(167,139,250,0.15)';
      ctx.lineWidth = sz * 3.5;
      ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(p.x, p.y); ctx.stroke();
    }

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, TWO_PI); ctx.fill();
  }
  ctx.shadowBlur = 0;
};

// ── Chain Lightning ─────────────────────────────────────────────────────
export const drawChainLightning = (ctx: CanvasRenderingContext2D, state: GameState) => {
  for (const cl of state.chainLightnings) {
    const alpha = 1 - cl.life / cl.maxLife;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#e879f9';
    ctx.shadowColor = '#e879f9';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const seg of cl.segments) {
      const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) continue;
      const nx = -dy / len, ny = dx / len;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      for (let j = 1; j <= 3; j++) {
        const t = j / 4;
        const jitter = (Math.random() - 0.5) * Math.min(len * 0.3, 20);
        ctx.lineTo(seg.x1 + dx * t + nx * jitter, seg.y1 + dy * t + ny * jitter);
      }
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
      ctx.fillStyle = '#e879f9';
      ctx.beginPath(); ctx.arc(seg.x2, seg.y2, 5 * alpha, 0, TWO_PI); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
};

// ── Particles ─────────────────────────────────────────────────────────────
export const drawParticles = (ctx: CanvasRenderingContext2D, state: GameState) => {
  for (const p of state.particles) {
    ctx.globalAlpha = 1 - p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TWO_PI); ctx.fill();
  }
  ctx.globalAlpha = 1;
};

// ── Hit effects (expanding ring flash) ──────────────────────────────────
export const drawHitEffects = (ctx: CanvasRenderingContext2D, state: GameState) => {
  for (const h of state.hitEffects) {
    const t = h.life / h.maxLife;
    const alpha = 1 - t;
    const r = h.radius * (0.5 + t * 1.5);
    ctx.strokeStyle = h.color;
    ctx.lineWidth = 2 * (1 - t);
    ctx.globalAlpha = alpha * 0.8;
    ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, TWO_PI); ctx.stroke();
    ctx.fillStyle = h.color;
    ctx.globalAlpha = alpha * 0.3;
    ctx.beginPath(); ctx.arc(h.x, h.y, r * 0.4, 0, TWO_PI); ctx.fill();
  }
  ctx.globalAlpha = 1;
};

// ── Shield break effects ──────────────────────────────────────────────
export const drawShieldBreakEffects = (ctx: CanvasRenderingContext2D, state: GameState) => {
  for (const sb of state.shieldBreakEffects) {
    const t = sb.life / sb.maxLife;
    const alpha = (1 - t) * 0.9;
    ctx.strokeStyle = `rgba(34,211,238,${alpha * 0.5})`;
    ctx.lineWidth = 3 * (1 - t);
    ctx.beginPath(); ctx.arc(sb.x, sb.y, sb.radius + sb.life * 100, 0, TWO_PI); ctx.stroke();
    for (const f of sb.fragments) {
      const fx = sb.x + Math.cos(f.angle) * (sb.radius + f.dist);
      const fy = sb.y + Math.sin(f.angle) * (sb.radius + f.dist);
      ctx.fillStyle = `rgba(34,211,238,${alpha})`;
      ctx.beginPath(); ctx.arc(fx, fy, f.size * (1 - t * 0.5), 0, TWO_PI); ctx.fill();
    }
    if (t < 0.2) {
      const flashOp = (1 - t / 0.2) * 0.2;
      ctx.fillStyle = `rgba(34,211,238,${flashOp})`;
      ctx.beginPath(); ctx.arc(sb.x, sb.y, sb.radius * (1 + t * 2), 0, TWO_PI); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
};

// ── Incoming tower drops ────────────────────────────────────────────────
export const drawIncomingDrops = (ctx: CanvasRenderingContext2D, state: GameState) => {
  for (const drop of state.incomingDrops) {
    const t = Math.min(1, drop.life / drop.duration);
    const eased = 1 - (1 - t) * (1 - t);
    const x = drop.startX + (drop.targetX - drop.startX) * eased;
    const y = drop.startY + (drop.targetY - drop.startY) * eased;
    const dx = drop.targetX - drop.startX;
    const dy = drop.targetY - drop.startY;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / len;
    const ny = dy / len;
    const tailLen = 90 + (1 - t) * 50;
    const tailX = x - nx * tailLen;
    const tailY = y - ny * tailLen;
    const color = TOWER_STATS[drop.towerType].color;

    const trail = ctx.createLinearGradient(tailX, tailY, x, y);
    trail.addColorStop(0, 'rgba(255,255,255,0)');
    trail.addColorStop(0.45, `${color}22`);
    trail.addColorStop(1, `${color}ee`);
    ctx.strokeStyle = trail;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.strokeStyle = `${color}33`;
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, TWO_PI);
    ctx.fill();
    ctx.shadowBlur = 0;

    const pulse = 1 + Math.sin(t * Math.PI * 4) * 0.12;
    ctx.strokeStyle = `${color}88`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(drop.targetX, drop.targetY, 18 * pulse, 0, TWO_PI);
    ctx.stroke();

    ctx.strokeStyle = `${color}44`;
    ctx.beginPath();
    ctx.arc(drop.targetX, drop.targetY, 28 * pulse, 0, TWO_PI);
    ctx.stroke();
  }
};

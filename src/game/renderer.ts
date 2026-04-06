import { GameState, Tower, TowerType, CELL_SIZE, HALF_CELL, TOWER_STATS, Camera, CANVAS_WIDTH, CANVAS_HEIGHT, TURRET_RANGE, HitEffect, ShieldBreakEffect } from './types';
import { getPortPos } from './engine';

const TWO_PI = Math.PI * 2;
const SNIPER_COOLDOWN_MS = 4000; // must match useGameLoop

// ── Blue palette ──────────────────────────────────────────────────────────────
const BG_DARK   = '#0a0e1a';
const BG_MID    = '#111827';
const BG_GRID   = 'rgba(140,180,255,0.04)';
const MAP_BORDER = 'rgba(96,165,250,0.35)';
const WIRE_ON   = '#60a5fa';
const WIRE_OFF  = '#374151';
const PULSE_CLR = '#93c5fd';
const PORT_OUT  = '#fbbf24';
const PORT_OUT_USED = '#fcd34d';
const PORT_IN   = '#60a5fa';
const PORT_IN_USED  = '#93c5fd';
const HP_BG     = '#1e293b';
const HP_FG     = '#22c55e';
const SHIELD_CLR = 'rgba(34,211,238,';
const PROJ_CLR  = '#fbbf24';
const KNOB_CLR  = '#fbbf24';
const UNPOWERED = '#4b5563';
const POWER_ON  = '#34d399';
const POWER_OFF = '#1e293b';

/** Convert hex color to "r,g,b" string for use in rgba() */
const hexToRgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

/** Interpolate position along a polyline at `dist` pixels from the start. */
const posOnPath = (path: { x: number; y: number }[], dist: number) => {
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1].x - path[i].x, dy = path[i + 1].y - path[i].y;
    const seg = Math.sqrt(dx * dx + dy * dy);
    if (dist <= seg) {
      const r = dist / seg;
      return { x: path[i].x + dx * r, y: path[i].y + dy * r };
    }
    dist -= seg;
  }
  return path[path.length - 1];
};

// ── Animated background decorations ─────────────────────────────────────────
interface Deco {
  x: number; y: number;
  vx: number; vy: number;
  type: number; rot: number; rotSpeed: number;
  size: number;
  baseOpacity: number;
  phase: number;
  fadeSpeed: number;
}
let _decoCache: Deco[] | null = null;
let _decoKey = '';

const initDecorations = (w: number, h: number): Deco[] => {
  const key = `${w}x${h}`;
  if (_decoCache && _decoKey === key) return _decoCache;
  _decoKey = key;
  const seed = (n: number) => { let s = n; return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; }; };
  const rng = seed(42);
  const count = Math.floor((w * h) / 8000);
  _decoCache = [];
  for (let i = 0; i < count; i++) {
    _decoCache.push({
      x: rng() * w, y: rng() * h,
      vx: (rng() - 0.5) * 6, vy: (rng() - 0.5) * 6,
      type: Math.floor(rng() * 3),
      rot: rng() * TWO_PI, rotSpeed: (rng() - 0.5) * 0.4,
      size: 3 + rng() * 6,
      baseOpacity: 0.03 + rng() * 0.05,
      phase: rng() * TWO_PI, fadeSpeed: 0.3 + rng() * 0.5,
    });
  }
  return _decoCache;
};

let _lastDecoTime = 0;

const updateAndDrawDecorations = (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => {
  const decos = initDecorations(w, h);
  const dt = _lastDecoTime ? Math.min((now - _lastDecoTime) / 1000, 0.1) : 0;
  _lastDecoTime = now;

  for (const d of decos) {
    d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.rotSpeed * dt;
    if (d.x < -10) d.x = w + 10; else if (d.x > w + 10) d.x = -10;
    if (d.y < -10) d.y = h + 10; else if (d.y > h + 10) d.y = -10;

    const fade = 0.5 + 0.5 * Math.sin(now / 1000 * d.fadeSpeed + d.phase);
    const opacity = d.baseOpacity * fade;
    if (opacity < 0.005) continue;

    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.strokeStyle = `rgba(140,180,255,${opacity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (d.type === 0) {
      ctx.moveTo(0, -d.size); ctx.lineTo(-d.size * 0.87, d.size * 0.5); ctx.lineTo(d.size * 0.87, d.size * 0.5); ctx.closePath();
    } else if (d.type === 1) {
      ctx.moveTo(0, -d.size); ctx.lineTo(d.size * 0.6, 0); ctx.lineTo(0, d.size); ctx.lineTo(-d.size * 0.6, 0); ctx.closePath();
    } else {
      const hs = d.size * 0.6;
      ctx.rect(-hs, -hs, hs * 2, hs * 2);
    }
    ctx.stroke();
    ctx.restore();
  }
};

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

  // ── Map border (adapts with cell size) ───────────────────────────────────
  const borderW = Math.max(1.5, CELL_SIZE * 0.12);
  ctx.fillStyle = MAP_BORDER;
  // Draw border as 4 inner strips so it aligns exactly with map cell bounds.
  ctx.fillRect(0, 0, CANVAS_WIDTH, borderW); // top
  ctx.fillRect(0, CANVAS_HEIGHT - borderW, CANVAS_WIDTH, borderW); // bottom
  ctx.fillRect(0, 0, borderW, CANVAS_HEIGHT); // left
  ctx.fillRect(CANVAS_WIDTH - borderW, 0, borderW, CANVAS_HEIGHT); // right

  // ── Wires ─────────────────────────────────────────────────────────────────
  const WIRE_LINE_WIDTH = 5.5;
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
    ctx.moveTo(sp.x, sp.y);
    for (const pt of wire.path) ctx.lineTo(pt.x * CELL_SIZE + HALF_CELL, pt.y * CELL_SIZE + HALF_CELL);
    const ep = getPortPos(t2, p2);
    ctx.lineTo(ep.x, ep.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ── Dragged wire preview ──────────────────────────────────────────────────
  if (draggedWireStart && mouseWorldPos) {
    const t1 = state.towerMap.get(draggedWireStart.towerId);
    const p1 = t1?.ports.find(p => p.id === draggedWireStart.portId);
    if (t1 && p1) {
      const sp = getPortPos(t1, p1);
      ctx.strokeStyle = draggedWirePath ? 'rgba(96,165,250,0.8)' : 'rgba(239,68,68,0.8)';
      ctx.lineWidth = WIRE_LINE_WIDTH;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      if (draggedWirePath) {
        for (const pt of draggedWirePath) ctx.lineTo(pt.x * CELL_SIZE + HALF_CELL, pt.y * CELL_SIZE + HALF_CELL);
      }
      ctx.lineTo(mouseWorldPos.x, mouseWorldPos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── Pulses ────────────────────────────────────────────────────────────────
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

  // ── Wire HP bars ──────────────────────────────────────────────────────────
  for (const wire of state.wires) {
    if (wire.hp >= wire.maxHp || !wire.path.length) continue;
    const mid = wire.path[(wire.path.length >> 1)];
    const px = mid.x * CELL_SIZE, py = mid.y * CELL_SIZE;
    ctx.fillStyle = HP_BG;
    ctx.fillRect(px + 2, py - 6, CELL_SIZE - 4, 3);
    ctx.fillStyle = HP_FG;
    ctx.fillRect(px + 2, py - 6, (CELL_SIZE - 4) * (wire.hp / wire.maxHp), 3);
  }

  // ── Shields (fade-based visualization) ───────────────────────────────
  for (const t of state.towers) {
    if (t.maxShieldHp <= 0 || t.shieldHp <= 0) continue;
    const cx = (t.x + t.width / 2) * CELL_SIZE, cy = (t.y + t.height / 2) * CELL_SIZE;
    const ratio = t.shieldHp / t.maxShieldHp;
    const r = t.shieldRadius;

    // Outer glow — fades as shield weakens
    const glowOp = 0.04 + 0.12 * ratio;
    const sGrad = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
    sGrad.addColorStop(0, `rgba(34,211,238,0)`);
    sGrad.addColorStop(1, `rgba(34,211,238,${glowOp})`);
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.fill();

    // Shield ring — thicker and brighter at full HP, thin and dim at low HP
    const ringWidth = 1 + 2 * ratio;
    const ringOp = 0.15 + 0.6 * ratio;
    ctx.lineWidth = ringWidth;
    ctx.strokeStyle = `rgba(34,211,238,${ringOp})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.stroke();

    // Hex-pattern segments — fade out as HP decreases
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

  // ── Range preview for selected turret placement ───────────────────────────
  if (hoverPos && selectedTower && state.status === 'playing') {
    const range = TURRET_RANGE[selectedTower];
    if (range) {
      const stats = TOWER_STATS[selectedTower];
      const rcx = (hoverPos.x + stats.width / 2) * CELL_SIZE;
      const rcy = (hoverPos.y + stats.height / 2) * CELL_SIZE;
      drawRangeCircle(ctx, rcx, rcy, range, 0.15, 0.03);
    }
  }

  // ── Range preview for rotating/selected turret ────────────────────────────
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

  // ── Towers ────────────────────────────────────────────────────────────────
  const INSET = 6;
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

    // Outlined style: dark fill + colored border
    ctx.fillStyle = 'rgba(10,14,26,0.85)';
    ctx.fillRect(px + inset, py + inset, tw - inset * 2, th - inset * 2);
    ctx.strokeStyle = tColor;
    ctx.lineWidth = 1.75;
    ctx.strokeRect(px + inset, py + inset, tw - inset * 2, th - inset * 2);

    drawTowerDetails(ctx, tower, px, py, tw, th, cx, cy, tColor, inset);

    // ── Ports (drawn inside rotation transform) ───────────────────────────
    const OUT_TRI = 7.5;
    const IN_HALF = 6;
    const portStrokeW = 1.35;
    for (const port of tower.ports) {
      const pos = getPortPos(tower, port);
      const used = state.wires.some(w => w.startPortId === port.id || w.endPortId === port.id);

      if (port.portType === 'output') {
        ctx.fillStyle = used ? PORT_OUT_USED : PORT_OUT;
        const s = OUT_TRI;
        ctx.beginPath();
        switch (port.direction) {
          case 'top':    ctx.moveTo(pos.x - s, pos.y + s / 2); ctx.lineTo(pos.x + s, pos.y + s / 2); ctx.lineTo(pos.x, pos.y - s); break;
          case 'bottom': ctx.moveTo(pos.x - s, pos.y - s / 2); ctx.lineTo(pos.x + s, pos.y - s / 2); ctx.lineTo(pos.x, pos.y + s); break;
          case 'left':   ctx.moveTo(pos.x + s / 2, pos.y - s); ctx.lineTo(pos.x + s / 2, pos.y + s); ctx.lineTo(pos.x - s, pos.y); break;
          case 'right':  ctx.moveTo(pos.x - s / 2, pos.y - s); ctx.lineTo(pos.x - s / 2, pos.y + s); ctx.lineTo(pos.x + s, pos.y); break;
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = BG_DARK;
        ctx.lineWidth = portStrokeW;
        ctx.stroke();
      } else {
        ctx.fillStyle = used ? PORT_IN_USED : PORT_IN;
        const h = IN_HALF;
        const r = 2.25;
        const x0 = pos.x - h, y0 = pos.y - h, side = h * 2;
        ctx.beginPath();
        ctx.roundRect(x0, y0, side, side, r);
        ctx.fill();
        ctx.strokeStyle = BG_DARK;
        ctx.lineWidth = portStrokeW;
        ctx.stroke();
      }
    }

    ctx.restore();

    // Bars (not rotated) — shield bar removed, shield uses fade visualization
    if (tower.hp < tower.maxHp) {
      ctx.fillStyle = HP_BG; ctx.fillRect(px, py - 5, tw, 3);
      ctx.fillStyle = HP_FG; ctx.fillRect(px, py - 5, tw * (tower.hp / tower.maxHp), 3);
    }
    // Sniper cooldown bar
    if (tower.type === 'sniper') {
      const elapsed = now - tower.lastActionTime;
      const cdRatio = tower.lastActionTime > 0 ? Math.min(1, elapsed / SNIPER_COOLDOWN_MS) : 1;
      if (cdRatio < 1) {
        const barY = py + th + 2;
        ctx.fillStyle = HP_BG; ctx.fillRect(px, barY, tw, 3);
        ctx.fillStyle = '#a78bfa'; ctx.fillRect(px, barY, tw * cdRatio, 3);
      } else if (tower.storedPower >= 4 && tower.powered) {
        // Ready indicator glow
        const pulse = 0.4 + 0.3 * Math.sin(now / 300);
        ctx.fillStyle = `rgba(167,139,250,${pulse})`;
        ctx.fillRect(px, py + th + 2, tw, 3);
      }
    }
    // Gatling heat bar
    if (tower.type === 'gatling' && tower.heat > 0.01) {
      const barY = py + th + 2;
      ctx.fillStyle = HP_BG; ctx.fillRect(px, barY, tw, 3);
      // Gradient from yellow to red based on heat
      const r = Math.floor(245 + 10 * tower.heat);
      const g = Math.floor(158 * (1 - tower.heat * 0.7));
      const b = Math.floor(11 * (1 - tower.heat));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(px, barY, tw * tower.heat, 3);
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

  // ── Placement preview ─────────────────────────────────────────────────────
  if (hoverPos && selectedTower && state.status === 'playing') {
    const stats = TOWER_STATS[selectedTower];
    const pi = INSET;
    ctx.strokeStyle = canPlaceFlag ? stats.color : '#ef4444';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.strokeRect(hoverPos.x * CELL_SIZE + pi, hoverPos.y * CELL_SIZE + pi, stats.width * CELL_SIZE - pi * 2, stats.height * CELL_SIZE - pi * 2);
    if (canPlaceFlag) {
      ctx.fillStyle = stats.color;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(hoverPos.x * CELL_SIZE + pi, hoverPos.y * CELL_SIZE + pi, stats.width * CELL_SIZE - pi * 2, stats.height * CELL_SIZE - pi * 2);
    }
    ctx.globalAlpha = 1;
  }

  // ── Rotation knob ─────────────────────────────────────────────────────────
  if (rotatingTowerId) {
    const tower = state.towerMap.get(rotatingTowerId);
    if (tower) {
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
    }
  }

  // ── Enemies (type-specific visuals) ─────────────────────────────────────────
  for (const e of state.enemies) {
    const r = e.radius;
    const eColor = e.color;
    const fillAlpha = 'rgba(' + hexToRgb(eColor) + ',0.2)';

    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.enemyType === 'scout') {
      // Small fast triangle with speed trail
      ctx.rotate(e.heading + Math.PI / 2);
      ctx.strokeStyle = eColor; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(-r * 0.7, r * 0.5); ctx.lineTo(r * 0.7, r * 0.5); ctx.closePath();
      ctx.fillStyle = fillAlpha; ctx.fill(); ctx.stroke();
      // Speed trail
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = eColor; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, r * 0.5); ctx.lineTo(-r * 0.2, r * 1.5);
      ctx.moveTo(r * 0.4, r * 0.5); ctx.lineTo(r * 0.2, r * 1.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (e.enemyType === 'grunt') {
      // Standard triangle (like the old enemy)
      ctx.rotate(e.heading + Math.PI / 2);
      ctx.strokeStyle = eColor; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(-r * 0.87, r * 0.5); ctx.lineTo(r * 0.87, r * 0.5); ctx.closePath();
      ctx.fillStyle = fillAlpha; ctx.fill(); ctx.stroke();
      ctx.fillStyle = eColor;
      ctx.beginPath(); ctx.arc(0, 0, 2, 0, TWO_PI); ctx.fill();
    } else if (e.enemyType === 'tank') {
      // Large circle with armor ring
      ctx.strokeStyle = eColor; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI); ctx.stroke();
      ctx.fillStyle = fillAlpha; ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI); ctx.fill();
      // Inner armor ring
      ctx.strokeStyle = eColor; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, TWO_PI); ctx.stroke();
      ctx.fillStyle = eColor;
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, TWO_PI); ctx.fill();
    } else if (e.enemyType === 'saboteur') {
      // Diamond shape with spark effect
      ctx.rotate(e.heading);
      ctx.strokeStyle = eColor; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.6, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.6, 0); ctx.closePath();
      ctx.fillStyle = fillAlpha; ctx.fill(); ctx.stroke();
      // Sparks
      const sparkT = now / 150;
      ctx.lineWidth = 1;
      for (let s = 0; s < 3; s++) {
        const sa = (s / 3) * TWO_PI + sparkT;
        const sd = r * 0.8 + Math.sin(sparkT + s * 2) * 2;
        const spOp = 0.3 + 0.3 * Math.sin(sparkT * 2 + s);
        if (spOp < 0.1) continue;
        ctx.strokeStyle = `rgba(${hexToRgb(eColor)},${spOp})`;
        ctx.beginPath();
        ctx.moveTo(Math.cos(sa) * sd - 1, Math.sin(sa) * sd - 1);
        ctx.lineTo(Math.cos(sa) * sd + 1, Math.sin(sa) * sd + 1);
        ctx.stroke();
      }
    } else if (e.enemyType === 'overlord') {
      // Large circle with pulsing red aura
      const pulse = 0.1 + 0.08 * Math.sin(now / 200);
      const auraR = r * 1.4;
      const grd = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, auraR);
      grd.addColorStop(0, `rgba(239,68,68,0)`);
      grd.addColorStop(1, `rgba(239,68,68,${pulse})`);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(0, 0, auraR, 0, TWO_PI); ctx.fill();

      // Main body
      ctx.strokeStyle = eColor; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI); ctx.stroke();
      ctx.fillStyle = 'rgba(239,68,68,0.25)';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI); ctx.fill();

      // Inner cross pattern
      ctx.strokeStyle = eColor; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0);
      ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, r * 0.5);
      ctx.stroke();

      // Shield ring if active
      if (e.shieldAbsorb > 0) {
        const shieldRatio = e.shieldAbsorb / e.maxShieldAbsorb;
        ctx.strokeStyle = `rgba(255,255,255,${0.3 + 0.4 * shieldRatio})`;
        ctx.lineWidth = 2 * shieldRatio + 0.5;
        ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, TWO_PI * shieldRatio); ctx.stroke();
      }
    }

    ctx.restore();

    // HP bar
    if (e.hp < e.maxHp) {
      const barW = Math.max(20, r * 2.5);
      ctx.fillStyle = HP_BG; ctx.fillRect(e.x - barW / 2, e.y - r - 7, barW, 3);
      ctx.fillStyle = HP_FG; ctx.fillRect(e.x - barW / 2, e.y - r - 7, barW * (e.hp / e.maxHp), 3);
    }
    // Shield bar for overlord
    if (e.shieldAbsorb > 0 && e.maxShieldAbsorb > 0) {
      const barW = Math.max(20, r * 2.5);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(e.x - barW / 2, e.y - r - 11, barW, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(e.x - barW / 2, e.y - r - 11, barW * (e.shieldAbsorb / e.maxShieldAbsorb), 2);
    }
  }

  // ── Projectiles ───────────────────────────────────────────────────────────
  if (state.projectiles.length) {
    for (const p of state.projectiles) {
      const color = p.color ?? PROJ_CLR;
      const sz = p.size ?? 3;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, TWO_PI); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // ── Chain Lightning ─────────────────────────────────────────────────────
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

  // ── Particles ─────────────────────────────────────────────────────────────
  for (const p of state.particles) {
    ctx.globalAlpha = 1 - p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TWO_PI); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── Hit effects (expanding ring flash) ──────────────────────────────────
  for (const h of state.hitEffects) {
    const t = h.life / h.maxLife;
    const alpha = 1 - t;
    const r = h.radius * (0.5 + t * 1.5);
    // Outer ring
    ctx.strokeStyle = h.color;
    ctx.lineWidth = 2 * (1 - t);
    ctx.globalAlpha = alpha * 0.8;
    ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, TWO_PI); ctx.stroke();
    // Inner flash
    ctx.fillStyle = h.color;
    ctx.globalAlpha = alpha * 0.3;
    ctx.beginPath(); ctx.arc(h.x, h.y, r * 0.4, 0, TWO_PI); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── Shield break effects ──────────────────────────────────────────────
  for (const sb of state.shieldBreakEffects) {
    const t = sb.life / sb.maxLife;
    const alpha = (1 - t) * 0.9;
    // Expanding shatter ring
    ctx.strokeStyle = `rgba(34,211,238,${alpha * 0.5})`;
    ctx.lineWidth = 3 * (1 - t);
    ctx.beginPath(); ctx.arc(sb.x, sb.y, sb.radius + sb.life * 100, 0, TWO_PI); ctx.stroke();
    // Flying fragments
    for (const f of sb.fragments) {
      const fx = sb.x + Math.cos(f.angle) * (sb.radius + f.dist);
      const fy = sb.y + Math.sin(f.angle) * (sb.radius + f.dist);
      ctx.fillStyle = `rgba(34,211,238,${alpha})`;
      ctx.beginPath(); ctx.arc(fx, fy, f.size * (1 - t * 0.5), 0, TWO_PI); ctx.fill();
    }
    // Flash at center
    if (t < 0.2) {
      const flashOp = (1 - t / 0.2) * 0.2;
      ctx.fillStyle = `rgba(34,211,238,${flashOp})`;
      ctx.beginPath(); ctx.arc(sb.x, sb.y, sb.radius * (1 + t * 2), 0, TWO_PI); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // ── End camera transform ──────────────────────────────────────────────────
  ctx.restore();
};

const drawPowerArc = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, maxPower: number, storedPower: number, color = PULSE_CLR) => {
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

const drawRangeCircle = (ctx: CanvasRenderingContext2D, cx: number, cy: number, range: number, strokeOp: number, fillOp: number) => {
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

const drawBarrel = (ctx: CanvasRenderingContext2D, cx: number, cy: number, localAngle: number, r: number, barrelLen: number, tColor: string, lineWidth: number, startFrac: number, muzzleR: number) => {
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

// ── Tower detail drawing (called within rotation transform) ──────────────────
function drawTowerDetails(
  ctx: CanvasRenderingContext2D, t: Tower,
  px: number, py: number, tw: number, th: number, cx: number, cy: number,
  tColor: string, inset: number,
) {
  if (t.type === 'core') {
    const R = Math.min(tw, th);
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R / 3 - 2, 0, TWO_PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R / 5, 0, TWO_PI); ctx.stroke();

    const gs = 3;
    const margin = Math.max(15, R * 0.125);
    const inner = R - inset * 2 - margin * 2;
    const gap = Math.max(2.5, inner * 0.065);
    const cell = (inner - gap * (gs - 1)) / gs;
    const tot = gs * cell + (gs - 1) * gap;
    const sx = cx - tot / 2, sy = cy - tot / 2;

    for (let row = 0; row < gs; row++) for (let col = 0; col < gs; col++) {
      const idx = row * gs + col;
      const x = sx + col * (cell + gap);
      const y = sy + row * (cell + gap);
      if (idx < t.storedPower) {
        ctx.fillStyle = POWER_ON; ctx.shadowColor = POWER_ON; ctx.shadowBlur = 4;
      } else {
        ctx.fillStyle = POWER_OFF; ctx.shadowBlur = 0;
      }
      ctx.fillRect(x, y, cell, cell);
      ctx.shadowBlur = 0;
    }
  } else if (t.type === 'blaster') {
    const r = Math.min(tw, th) / 4 - 1;
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI); ctx.stroke();
    drawPowerArc(ctx, cx, cy, r, t.maxPower, t.storedPower);
    const localAngle = t.barrelAngle - t.rotation;
    const barrelLen = Math.min(tw, th) / 2 - inset + 6;
    drawBarrel(ctx, cx, cy, localAngle, r, barrelLen, tColor, 5, 0.3, 3.5);
  } else if (t.type === 'gatling') {
    const r = Math.min(tw, th) / 4 - 1;
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI); ctx.stroke();
    drawPowerArc(ctx, cx, cy, r, t.maxPower, t.storedPower);
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
    for (let b = -1; b <= 1; b++) {
      const offset = b * 3;
      const perpX = -Math.sin(localAngle) * offset;
      const perpY = Math.cos(localAngle) * offset;
      const sx = cx + perpX + Math.cos(localAngle) * r * 0.3;
      const sy = cy + perpY + Math.sin(localAngle) * r * 0.3;
      const ex = cx + perpX + Math.cos(localAngle) * barrelLen;
      const ey = cy + perpY + Math.sin(localAngle) * barrelLen;
      // Barrel color shifts toward red with heat
      const bColorR = Math.floor(245 + 10 * heat);
      const bColorG = Math.floor(158 * (1 - heat * 0.6));
      const bColorB = Math.floor(11 * (1 - heat));
      const barrelColor = heat > 0.1 ? `rgb(${bColorR},${bColorG},${bColorB})` : tColor;
      ctx.strokeStyle = barrelColor; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
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
  } else if (t.type === 'tesla') {
    const r1 = Math.min(tw, th) / 3; const r2 = Math.min(tw, th) / 5;
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r1, 0, TWO_PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r2, 0, TWO_PI); ctx.stroke();
    drawPowerArc(ctx, cx, cy, r1, t.maxPower, t.storedPower, tColor);
    const now = performance.now();
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
  } else if (t.type === 'generator') {
    const now = performance.now();
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
    const cc = t.maxPower;
    const cg = 2;
    const bw = (tw - inset * 2 - 2 - (cc - 1) * cg) / cc;
    const bh = th - inset * 2 - 4;
    for (let i = 0; i < cc; i++) {
      const bx = px + inset + 1 + i * (bw + cg);
      const by = py + inset + 2;
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
  } else if (t.type === 'target') {
    const r = Math.min(tw, th) / 2 - inset;
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TWO_PI); ctx.stroke();
    ctx.fillStyle = tColor;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.15, 0, TWO_PI); ctx.fill();
  } else if (t.type === 'shield') {
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    const r = Math.min(tw, th) / 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI * 0.8, Math.PI * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TWO_PI); ctx.stroke();
  } else if (t.type === 'bus') {
    // Bus 3×2: 3 inputs on top long edge, 3 outputs on bottom long edge
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, py + inset + 2);
    ctx.lineTo(cx, py + th - inset - 2);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const sx = px + tw * ((i * 2 + 1) / 6);
      ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, py + inset);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.arc(sx, py + inset + 2, 2, 0, TWO_PI);
      ctx.fill();
    }
    for (let i = 0; i < 3; i++) {
      const sx = px + tw * ((i * 2 + 1) / 6);
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sx, py + th - inset);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      const tipY = py + th - inset - 2;
      ctx.beginPath();
      ctx.moveTo(sx, tipY + 4); ctx.lineTo(sx - 3, tipY); ctx.lineTo(sx + 3, tipY); ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = tColor;
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TWO_PI); ctx.fill();
  }
}

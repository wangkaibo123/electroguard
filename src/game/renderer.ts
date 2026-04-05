import { GameState, Tower, TowerType, CELL_SIZE, HALF_CELL, TOWER_STATS } from './types';
import { getPortPos } from './engine';

const TWO_PI = Math.PI * 2;

// ── Blue palette ──────────────────────────────────────────────────────────────
const BG_DARK   = '#0a0e1a';
const BG_MID    = '#111827';
const BG_GRID   = 'rgba(140,180,255,0.04)';
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
const ENEMY_CLR = '#c084fc';
const PROJ_CLR  = '#fbbf24';
const KNOB_CLR  = '#fbbf24';
const UNPOWERED = '#4b5563';
const POWER_ON  = '#34d399';
const POWER_OFF = '#1e293b';

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

/** Seeded decorations so they don't flicker each frame */
let _decoCache: { x: number; y: number; type: number; rot: number; size: number; opacity: number }[] | null = null;
let _decoKey = '';

const getDecorations = (w: number, h: number) => {
  const key = `${w}x${h}`;
  if (_decoCache && _decoKey === key) return _decoCache;
  _decoKey = key;
  const seed = (n: number) => { let s = n; return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; }; };
  const rng = seed(42);
  const count = Math.floor((w * h) / 8000);
  _decoCache = [];
  for (let i = 0; i < count; i++) {
    _decoCache.push({
      x: rng() * w,
      y: rng() * h,
      type: Math.floor(rng() * 3),
      rot: rng() * TWO_PI,
      size: 3 + rng() * 6,
      opacity: 0.03 + rng() * 0.05,
    });
  }
  return _decoCache;
};

/** Find nearest shootable target for a blaster (enemies + target towers) */
const findBlasterTarget = (state: GameState, cx: number, cy: number, range: number): { x: number; y: number } | null => {
  let best: { x: number; y: number } | null = null;
  let bestD = range * range;
  for (const e of state.enemies) {
    const d = (e.x - cx) ** 2 + (e.y - cy) ** 2;
    if (d < bestD) { bestD = d; best = { x: e.x, y: e.y }; }
  }
  for (const t of state.towers) {
    if (t.type !== 'target') continue;
    const tx = (t.x + 0.5) * CELL_SIZE, ty = (t.y + 0.5) * CELL_SIZE;
    const d = (tx - cx) ** 2 + (ty - cy) ** 2;
    if (d < bestD) { bestD = d; best = { x: tx, y: ty }; }
  }
  return best;
};

export const renderGame = (
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
  hoverPos: { x: number; y: number } | null,
  selectedTower: TowerType | null,
  canPlaceFlag: boolean,
  draggedWireStart: { towerId: string; portId: string } | null,
  mousePixelPos: { x: number; y: number } | null,
  draggedWirePath: { x: number; y: number }[] | null = null,
  rotatingTowerId: string | null = null,
) => {
  // ── Background with radial vignette ────────────────────────────────────────
  const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
  grad.addColorStop(0, BG_MID);
  grad.addColorStop(1, BG_DARK);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // ── Scattered geometric decorations ────────────────────────────────────────
  const decos = getDecorations(width, height);
  for (const d of decos) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.strokeStyle = `rgba(140,180,255,${d.opacity})`;
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

  // ── Grid (very subtle) ─────────────────────────────────────────────────────
  ctx.beginPath();
  for (let i = 0; i <= width; i += CELL_SIZE) { ctx.moveTo(i, 0); ctx.lineTo(i, height); }
  for (let i = 0; i <= height; i += CELL_SIZE) { ctx.moveTo(0, i); ctx.lineTo(width, i); }
  ctx.strokeStyle = BG_GRID;
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── Wires ─────────────────────────────────────────────────────────────────
  ctx.lineWidth = 3;
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
    if (powered) { ctx.shadowColor = WIRE_ON; ctx.shadowBlur = 6; }
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
  if (draggedWireStart && mousePixelPos) {
    const t1 = state.towerMap.get(draggedWireStart.towerId);
    const p1 = t1?.ports.find(p => p.id === draggedWireStart.portId);
    if (t1 && p1) {
      const sp = getPortPos(t1, p1);
      ctx.strokeStyle = draggedWirePath ? 'rgba(96,165,250,0.8)' : 'rgba(239,68,68,0.8)';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      if (draggedWirePath) {
        for (const pt of draggedWirePath) ctx.lineTo(pt.x * CELL_SIZE + HALF_CELL, pt.y * CELL_SIZE + HALF_CELL);
      }
      ctx.lineTo(mousePixelPos.x, mousePixelPos.y);
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
    ctx.arc(pos.x, pos.y, 5, 0, TWO_PI);
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

  // ── Shields (below towers) ────────────────────────────────────────────────
  for (const t of state.towers) {
    if (t.maxShieldHp <= 0 || t.shieldHp <= 0) continue;
    const cx = (t.x + t.width / 2) * CELL_SIZE, cy = (t.y + t.height / 2) * CELL_SIZE;
    const op = 0.08 + 0.15 * (t.shieldHp / t.maxShieldHp);
    ctx.beginPath();
    ctx.arc(cx, cy, t.shieldRadius, 0, TWO_PI);
    ctx.fillStyle = `${SHIELD_CLR}${op})`;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `${SHIELD_CLR}${op + 0.3})`;
    ctx.stroke();
  }

  // ── Towers ────────────────────────────────────────────────────────────────
  const INSET = 4; // shrink towers visually
  for (const tower of state.towers) {
    const px = tower.x * CELL_SIZE, py = tower.y * CELL_SIZE;
    const tw = tower.width * CELL_SIZE, th = tower.height * CELL_SIZE;
    const cx = px + tw / 2, cy = py + th / 2;
    // For 1x1 towers use smaller inset
    const inset = (tower.width === 1 && tower.height === 1) ? 3 : INSET;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tower.rotation);
    ctx.translate(-cx, -cy);

    const tColor = (!tower.powered && tower.type !== 'core') ? UNPOWERED : TOWER_STATS[tower.type].color;

    // Outlined style: dark fill + colored border
    ctx.fillStyle = 'rgba(10,14,26,0.85)';
    ctx.fillRect(px + inset, py + inset, tw - inset * 2, th - inset * 2);
    ctx.strokeStyle = tColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + inset, py + inset, tw - inset * 2, th - inset * 2);

    drawTowerDetails(ctx, tower, px, py, tw, th, cx, cy, tColor, inset, state);

    // ── Ports (drawn inside rotation transform) ───────────────────────────
    ctx.lineWidth = 1;
    for (const port of tower.ports) {
      const pos = getPortPos(tower, port);
      const used = state.wires.some(w => w.startPortId === port.id || w.endPortId === port.id);

      if (port.portType === 'output') {
        ctx.fillStyle = used ? PORT_OUT_USED : PORT_OUT;
        const s = 5;
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
        ctx.stroke();
      } else {
        ctx.fillStyle = used ? PORT_IN_USED : PORT_IN;
        const s = 4;
        ctx.fillRect(pos.x - s, pos.y - s, s * 2, s * 2);
        ctx.strokeStyle = BG_DARK;
        ctx.strokeRect(pos.x - s, pos.y - s, s * 2, s * 2);
      }
    }

    ctx.restore();

    // Bars (not rotated)
    if (tower.maxShieldHp > 0 && tower.shieldHp < tower.maxShieldHp) {
      ctx.fillStyle = '#164e63'; ctx.fillRect(px, py - 10, tw, 3);
      ctx.fillStyle = '#22d3ee'; ctx.fillRect(px, py - 10, tw * (tower.shieldHp / tower.maxShieldHp), 3);
    }
    if (tower.hp < tower.maxHp) {
      ctx.fillStyle = HP_BG; ctx.fillRect(px, py - 5, tw, 3);
      ctx.fillStyle = HP_FG; ctx.fillRect(px, py - 5, tw * (tower.hp / tower.maxHp), 3);
    }
    if (tower.maxPower > 0 && tower.type !== 'core' && tower.type !== 'battery') {
      const ds = 4, sp = 2;
      const totalW = tower.maxPower * ds + (tower.maxPower - 1) * sp;
      const sx = px + tw / 2 - totalW / 2, sy = py + th - 7;
      for (let i = 0; i < tower.maxPower; i++) {
        ctx.fillStyle = i < tower.storedPower ? PULSE_CLR : POWER_OFF;
        ctx.beginPath();
        ctx.arc(sx + i * (ds + sp) + ds / 2, sy, ds / 2, 0, TWO_PI);
        ctx.fill();
      }
    }
  }

  // ── Placement preview ─────────────────────────────────────────────────────
  if (hoverPos && selectedTower && state.status === 'playing') {
    const stats = TOWER_STATS[selectedTower];
    ctx.strokeStyle = canPlaceFlag ? stats.color : '#ef4444';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.strokeRect(hoverPos.x * CELL_SIZE + 2, hoverPos.y * CELL_SIZE + 2, stats.width * CELL_SIZE - 4, stats.height * CELL_SIZE - 4);
    if (canPlaceFlag) {
      ctx.fillStyle = stats.color;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(hoverPos.x * CELL_SIZE + 2, hoverPos.y * CELL_SIZE + 2, stats.width * CELL_SIZE - 4, stats.height * CELL_SIZE - 4);
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

  // ── Enemies (rotated triangles facing movement direction) ─────────────────
  for (const e of state.enemies) {
    const r = CELL_SIZE / 3;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.heading + Math.PI / 2); // triangle points up by default, rotate to heading
    ctx.strokeStyle = ENEMY_CLR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(-r * 0.87, r * 0.5);
    ctx.lineTo(r * 0.87, r * 0.5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(192,132,252,0.2)';
    ctx.fill();
    ctx.stroke();
    // Inner dot
    ctx.fillStyle = ENEMY_CLR;
    ctx.beginPath(); ctx.arc(0, 0, 2, 0, TWO_PI); ctx.fill();
    ctx.restore();

    if (e.hp < e.maxHp) {
      ctx.fillStyle = HP_BG; ctx.fillRect(e.x - 10, e.y - r - 6, 20, 3);
      ctx.fillStyle = HP_FG; ctx.fillRect(e.x - 10, e.y - r - 6, 20 * (e.hp / e.maxHp), 3);
    }
  }

  // ── Projectiles ───────────────────────────────────────────────────────────
  if (state.projectiles.length) {
    ctx.fillStyle = PROJ_CLR;
    ctx.shadowColor = PROJ_CLR;
    ctx.shadowBlur = 6;
    for (const p of state.projectiles) { ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, TWO_PI); ctx.fill(); }
    ctx.shadowBlur = 0;
  }

  // ── Particles ─────────────────────────────────────────────────────────────
  for (const p of state.particles) {
    ctx.globalAlpha = 1 - p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TWO_PI); ctx.fill();
  }
  ctx.globalAlpha = 1;
};

// ── Tower detail drawing (called within rotation transform) ──────────────────

function drawTowerDetails(
  ctx: CanvasRenderingContext2D, t: Tower,
  px: number, py: number, tw: number, th: number, cx: number, cy: number,
  tColor: string, inset: number, state: GameState,
) {
  if (t.type === 'core') {
    // Concentric outlined circles
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(tw, th) / 3 - 2, 0, TWO_PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(tw, th) / 5, 0, TWO_PI); ctx.stroke();
    // Power grid (green like battery)
    const gs = 3, cw = 8, ch = 8, gap = 2;
    const totW = gs * cw + (gs - 1) * gap, totH = gs * ch + (gs - 1) * gap;
    const sx = cx - totW / 2, sy = cy - totH / 2;
    for (let r = 0; r < gs; r++) for (let c = 0; c < gs; c++) {
      const idx = r * gs + c;
      if (idx < t.storedPower) { ctx.fillStyle = POWER_ON; ctx.shadowColor = POWER_ON; ctx.shadowBlur = 4; }
      else { ctx.fillStyle = POWER_OFF; ctx.shadowBlur = 0; }
      ctx.fillRect(sx + c * (cw + gap), sy + r * (ch + gap), cw, ch);
      ctx.shadowBlur = 0;
    }
  } else if (t.type === 'blaster') {
    // Crosshair circle
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    const r = Math.min(tw, th) / 4 - 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI); ctx.stroke();
    // Barrel pointing toward nearest enemy
    const target = findBlasterTarget(state, cx, cy, 150);
    if (target && t.powered) {
      const barrelAngle = Math.atan2(target.y - cy, target.x - cx) - t.rotation;
      const barrelLen = Math.min(tw, th) / 2 - inset + 2;
      ctx.strokeStyle = tColor; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(barrelAngle) * barrelLen, cy + Math.sin(barrelAngle) * barrelLen);
      ctx.stroke();
      // Muzzle dot
      ctx.fillStyle = tColor;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(barrelAngle) * barrelLen, cy + Math.sin(barrelAngle) * barrelLen, 2.5, 0, TWO_PI);
      ctx.fill();
    } else {
      // Default crosshair lines when no target
      ctx.beginPath(); ctx.moveTo(cx - r - 3, cy); ctx.lineTo(cx + r + 3, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - r - 3); ctx.lineTo(cx, cy + r + 3); ctx.stroke();
    }
  } else if (t.type === 'generator') {
    // Lightning bolt outline
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    const s = Math.min(tw, th) * 0.25;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.1, cy - s); ctx.lineTo(cx - s * 0.4, cy + s * 0.1);
    ctx.lineTo(cx + s * 0.1, cy + s * 0.1); ctx.lineTo(cx - s * 0.1, cy + s);
    ctx.stroke();
  } else if (t.type === 'battery') {
    // Battery cells outlined
    const cc = 4, cg = 2, bw = (tw - inset * 2 - 2 - (cc - 1) * cg) / cc, bh = th - inset * 2 - 4;
    for (let i = 0; i < cc; i++) {
      if (i < t.storedPower) {
        ctx.fillStyle = POWER_ON; ctx.shadowColor = POWER_ON; ctx.shadowBlur = 3;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(px + inset + 1 + i * (bw + cg), py + inset + 2, bw, bh);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = tColor; ctx.lineWidth = 1;
      ctx.strokeRect(px + inset + 1 + i * (bw + cg), py + inset + 2, bw, bh);
      ctx.shadowBlur = 0;
    }
  } else if (t.type === 'target') {
    // Outlined bullseye
    const r = Math.min(tw, th) / 2 - inset;
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TWO_PI); ctx.stroke();
    ctx.fillStyle = tColor;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.15, 0, TWO_PI); ctx.fill();
  } else if (t.type === 'wall') {
    // Cross-hatch pattern
    ctx.strokeStyle = tColor; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + inset + 2, py + inset + 2); ctx.lineTo(px + tw - inset - 2, py + th - inset - 2);
    ctx.moveTo(px + tw - inset - 2, py + inset + 2); ctx.lineTo(px + inset + 2, py + th - inset - 2);
    ctx.stroke();
  } else if (t.type === 'shield') {
    // Shield arc
    ctx.strokeStyle = tColor; ctx.lineWidth = 1.5;
    const r = Math.min(tw, th) / 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI * 0.8, Math.PI * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TWO_PI); ctx.stroke();
  }
}

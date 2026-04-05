import { GameState, Tower, TowerType, CELL_SIZE, HALF_CELL, TOWER_STATS } from './types';
import { getPortPos } from './engine';

const TWO_PI = Math.PI * 2;

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
  // ── Background + Grid (single batched path) ──────────────────────────────
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, width, height);

  ctx.beginPath();
  for (let i = 0; i <= width; i += CELL_SIZE) { ctx.moveTo(i, 0); ctx.lineTo(i, height); }
  for (let i = 0; i <= height; i += CELL_SIZE) { ctx.moveTo(0, i); ctx.lineTo(width, i); }
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── Wires ─────────────────────────────────────────────────────────────────
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const wire of state.wires) {
    if (!wire.path.length) continue;
    const t1 = state.towerMap.get(wire.startTowerId);
    const t2 = state.towerMap.get(wire.endTowerId);
    const p1 = t1?.ports.find(p => p.id === wire.startPortId);
    const p2 = t2?.ports.find(p => p.id === wire.endPortId);
    if (!t1 || !p1 || !t2 || !p2) continue;

    ctx.strokeStyle = (t1.powered || t2.powered) ? '#3b82f6' : '#4b5563';
    ctx.beginPath();
    const sp = getPortPos(t1, p1);
    ctx.moveTo(sp.x, sp.y);
    for (const pt of wire.path) ctx.lineTo(pt.x * CELL_SIZE + HALF_CELL, pt.y * CELL_SIZE + HALF_CELL);
    const ep = getPortPos(t2, p2);
    ctx.lineTo(ep.x, ep.y);
    ctx.stroke();
  }

  // ── Dragged wire preview ──────────────────────────────────────────────────
  if (draggedWireStart && mousePixelPos) {
    const t1 = state.towerMap.get(draggedWireStart.towerId);
    const p1 = t1?.ports.find(p => p.id === draggedWireStart.portId);
    if (t1 && p1) {
      const sp = getPortPos(t1, p1);
      ctx.strokeStyle = draggedWirePath ? 'rgba(59,130,246,0.8)' : 'rgba(239,68,68,0.8)';
      ctx.lineWidth = 4;
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
  ctx.fillStyle = '#60a5fa';
  ctx.shadowColor = '#60a5fa';
  ctx.shadowBlur = 15;
  for (const p of state.pulses) {
    const pos = posOnPath(p.path, p.progress);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 6, 0, TWO_PI);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // ── Wire HP bars ──────────────────────────────────────────────────────────
  for (const wire of state.wires) {
    if (wire.hp >= wire.maxHp || !wire.path.length) continue;
    const mid = wire.path[(wire.path.length >> 1)];
    const px = mid.x * CELL_SIZE, py = mid.y * CELL_SIZE;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(px + 2, py - 6, CELL_SIZE - 4, 4);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(px + 2, py - 6, (CELL_SIZE - 4) * (wire.hp / wire.maxHp), 4);
  }

  // ── Shields (below towers) ────────────────────────────────────────────────
  for (const t of state.towers) {
    if (t.maxShieldHp <= 0 || t.shieldHp <= 0) continue;
    const cx = (t.x + t.width / 2) * CELL_SIZE, cy = (t.y + t.height / 2) * CELL_SIZE;
    const op = 0.1 + 0.2 * (t.shieldHp / t.maxShieldHp);
    ctx.beginPath();
    ctx.arc(cx, cy, t.shieldRadius, 0, TWO_PI);
    ctx.fillStyle = `rgba(6,182,212,${op})`;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(6,182,212,${op + 0.4})`;
    ctx.stroke();
  }

  // ── Towers ────────────────────────────────────────────────────────────────
  for (const tower of state.towers) {
    const px = tower.x * CELL_SIZE, py = tower.y * CELL_SIZE;
    const tw = tower.width * CELL_SIZE, th = tower.height * CELL_SIZE;
    const cx = px + tw / 2, cy = py + th / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tower.rotation);
    ctx.translate(-cx, -cy);

    ctx.fillStyle = (!tower.powered && tower.type !== 'core') ? '#4b5563' : TOWER_STATS[tower.type].color;
    ctx.fillRect(px + 2, py + 2, tw - 4, th - 4);

    drawTowerDetails(ctx, tower, px, py, tw, th, cx, cy);
    ctx.restore();

    // Bars (not rotated)
    if (tower.maxShieldHp > 0 && tower.shieldHp < tower.maxShieldHp) {
      ctx.fillStyle = '#164e63'; ctx.fillRect(px, py - 12, tw, 4);
      ctx.fillStyle = '#06b6d4'; ctx.fillRect(px, py - 12, tw * (tower.shieldHp / tower.maxShieldHp), 4);
    }
    if (tower.hp < tower.maxHp) {
      ctx.fillStyle = '#ef4444'; ctx.fillRect(px, py - 6, tw, 4);
      ctx.fillStyle = '#22c55e'; ctx.fillRect(px, py - 6, tw * (tower.hp / tower.maxHp), 4);
    }
    if (tower.maxPower > 0 && tower.type !== 'core' && tower.type !== 'battery') {
      const ds = 4, sp = 2;
      const totalW = tower.maxPower * ds + (tower.maxPower - 1) * sp;
      const sx = px + tw / 2 - totalW / 2, sy = py + th - 8;
      for (let i = 0; i < tower.maxPower; i++) {
        ctx.fillStyle = i < tower.storedPower ? '#60a5fa' : '#1f2937';
        ctx.beginPath();
        ctx.arc(sx + i * (ds + sp) + ds / 2, sy, ds / 2, 0, TWO_PI);
        ctx.fill();
      }
    }
  }

  // ── Ports ─────────────────────────────────────────────────────────────────
  ctx.lineWidth = 1.5;
  for (const tower of state.towers) {
    for (const port of tower.ports) {
      const pos = getPortPos(tower, port);
      const used = state.wires.some(w => w.startPortId === port.id || w.endPortId === port.id);

      if (port.portType === 'output') {
        ctx.fillStyle = used ? '#f59e0b' : '#d97706';
        const s = 6;
        ctx.beginPath();
        switch (port.direction) {
          case 'top':    ctx.moveTo(pos.x - s, pos.y + s / 2); ctx.lineTo(pos.x + s, pos.y + s / 2); ctx.lineTo(pos.x, pos.y - s); break;
          case 'bottom': ctx.moveTo(pos.x - s, pos.y - s / 2); ctx.lineTo(pos.x + s, pos.y - s / 2); ctx.lineTo(pos.x, pos.y + s); break;
          case 'left':   ctx.moveTo(pos.x + s / 2, pos.y - s); ctx.lineTo(pos.x + s / 2, pos.y + s); ctx.lineTo(pos.x - s, pos.y); break;
          case 'right':  ctx.moveTo(pos.x - s / 2, pos.y - s); ctx.lineTo(pos.x - s / 2, pos.y + s); ctx.lineTo(pos.x + s, pos.y); break;
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1f2937';
        ctx.stroke();
      } else {
        ctx.fillStyle = used ? '#3b82f6' : '#6b7280';
        const s = 5;
        ctx.fillRect(pos.x - s, pos.y - s, s * 2, s * 2);
        ctx.strokeStyle = '#1f2937';
        ctx.strokeRect(pos.x - s, pos.y - s, s * 2, s * 2);
      }
    }
  }

  // ── Placement preview ─────────────────────────────────────────────────────
  if (hoverPos && selectedTower && state.status === 'playing') {
    const stats = TOWER_STATS[selectedTower];
    ctx.fillStyle = canPlaceFlag ? stats.color : '#ef4444';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(hoverPos.x * CELL_SIZE + 2, hoverPos.y * CELL_SIZE + 2, stats.width * CELL_SIZE - 4, stats.height * CELL_SIZE - 4);
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

      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(tpx - 2, tpy - 2, ttw + 4, tth + 4);
      ctx.setLineDash([]);

      // Snap guides
      ctx.fillStyle = 'rgba(251,191,36,0.25)';
      for (let i = 0; i < 4; i++) {
        const sa = i * Math.PI / 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(tcx + Math.cos(sa) * kd, tcy + Math.sin(sa) * kd, 4, 0, TWO_PI);
        ctx.fill();
      }

      ctx.strokeStyle = 'rgba(251,191,36,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tcx, tcy); ctx.lineTo(kx, ky); ctx.stroke();

      ctx.fillStyle = '#fbbf24'; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(kx, ky, 8, 0, TWO_PI); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#111827';
      ctx.beginPath(); ctx.arc(kx, ky, 4, 0, TWO_PI); ctx.fill();
    }
  }

  // ── Enemies ───────────────────────────────────────────────────────────────
  for (const e of state.enemies) {
    ctx.fillStyle = '#a855f7';
    ctx.beginPath(); ctx.arc(e.x, e.y, CELL_SIZE / 3, 0, TWO_PI); ctx.fill();
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(e.x - 4, e.y - 2, 3, 0, TWO_PI); ctx.arc(e.x + 4, e.y - 2, 3, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(e.x - 4, e.y - 2, 1.5, 0, TWO_PI); ctx.arc(e.x + 4, e.y - 2, 1.5, 0, TWO_PI); ctx.fill();
    if (e.hp < e.maxHp) {
      ctx.fillStyle = '#ef4444'; ctx.fillRect(e.x - 10, e.y - 15, 20, 3);
      ctx.fillStyle = '#22c55e'; ctx.fillRect(e.x - 10, e.y - 15, 20 * (e.hp / e.maxHp), 3);
    }
  }

  // ── Projectiles ───────────────────────────────────────────────────────────
  if (state.projectiles.length) {
    ctx.fillStyle = '#fbbf24';
    for (const p of state.projectiles) { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TWO_PI); ctx.fill(); }
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
) {
  if (t.type === 'core') {
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(tw, th) / 3, 0, TWO_PI); ctx.fill();
    const gs = 3, cw = 10, ch = 10, gap = 2;
    const totW = gs * cw + (gs - 1) * gap, totH = gs * ch + (gs - 1) * gap;
    const sx = cx - totW / 2, sy = cy - totH / 2;
    for (let r = 0; r < gs; r++) for (let c = 0; c < gs; c++) {
      const idx = r * gs + c;
      if (idx < t.storedPower) { ctx.fillStyle = '#93c5fd'; ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 6; }
      else { ctx.fillStyle = '#1e3a5f'; ctx.shadowBlur = 0; }
      ctx.fillRect(sx + c * (cw + gap), sy + r * (ch + gap), cw, ch);
      ctx.shadowBlur = 0;
    }
  } else if (t.type === 'blaster') {
    ctx.fillStyle = '#111827';
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(tw, th) / 4, 0, TWO_PI); ctx.fill();
  } else if (t.type === 'generator') {
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(px + 6, py + 6, tw - 12, th - 12);
  } else if (t.type === 'battery') {
    ctx.fillStyle = '#111827'; ctx.fillRect(px + 3, py + 3, tw - 6, th - 6);
    const cc = 4, cg = 2, bw = (tw - 8 - (cc - 1) * cg) / cc, bh = th - 10;
    for (let i = 0; i < cc; i++) {
      if (i < t.storedPower) { ctx.fillStyle = '#34d399'; ctx.shadowColor = '#34d399'; ctx.shadowBlur = 4; }
      else { ctx.fillStyle = '#1f2937'; ctx.shadowBlur = 0; }
      ctx.fillRect(px + 4 + i * (bw + cg), py + 5, bw, bh);
      ctx.shadowBlur = 0;
    }
  }
}

import { GameState } from '../types';
import { TWO_PI, hexToRgb, HP_BG, HP_FG } from './constants';

export const drawEnemies = (ctx: CanvasRenderingContext2D, state: GameState, now: number) => {
  for (const e of state.enemies) {
    const r = e.radius;
    const eColor = e.color;
    const fillAlpha = 'rgba(' + hexToRgb(eColor) + ',0.2)';

    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.enemyType === 'scout') {
      ctx.rotate(e.heading + Math.PI / 2);
      ctx.strokeStyle = eColor; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(-r * 0.7, r * 0.5); ctx.lineTo(r * 0.7, r * 0.5); ctx.closePath();
      ctx.fillStyle = fillAlpha; ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = eColor; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, r * 0.5); ctx.lineTo(-r * 0.2, r * 1.5);
      ctx.moveTo(r * 0.4, r * 0.5); ctx.lineTo(r * 0.2, r * 1.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (e.enemyType === 'grunt') {
      ctx.rotate(e.heading + Math.PI / 2);
      ctx.strokeStyle = eColor; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(-r * 0.87, r * 0.5); ctx.lineTo(r * 0.87, r * 0.5); ctx.closePath();
      ctx.fillStyle = fillAlpha; ctx.fill(); ctx.stroke();
      ctx.fillStyle = eColor;
      ctx.beginPath(); ctx.arc(0, 0, 2, 0, TWO_PI); ctx.fill();
    } else if (e.enemyType === 'tank') {
      ctx.strokeStyle = eColor; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI); ctx.stroke();
      ctx.fillStyle = fillAlpha; ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI); ctx.fill();
      ctx.strokeStyle = eColor; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, TWO_PI); ctx.stroke();
      ctx.fillStyle = eColor;
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, TWO_PI); ctx.fill();
    } else if (e.enemyType === 'saboteur') {
      ctx.rotate(e.heading);
      ctx.strokeStyle = eColor; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.6, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.6, 0); ctx.closePath();
      ctx.fillStyle = fillAlpha; ctx.fill(); ctx.stroke();
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
      // Movement wake
      ctx.rotate(e.heading);
      const wakePulse = 0.12 + 0.08 * Math.sin(now / 160);
      ctx.strokeStyle = `rgba(248,113,113,${wakePulse})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 10]);
      ctx.beginPath();
      ctx.moveTo(-r * 1.9, -r * 0.45); ctx.lineTo(-r * 3.1, -r * 0.65);
      ctx.moveTo(-r * 2, 0); ctx.lineTo(-r * 3.4, 0);
      ctx.moveTo(-r * 1.9, r * 0.45); ctx.lineTo(-r * 3.1, r * 0.65);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.rotate(-e.heading);

      // Rotating crown segments
      const crownR = r * 1.5;
      const crownSegs = 8;
      ctx.lineWidth = 2;
      for (let s = 0; s < crownSegs; s++) {
        const baseA = (s / crownSegs) * TWO_PI + now / 1000;
        const segOp = 0.15 + 0.1 * Math.sin(now / 300 + s);
        ctx.strokeStyle = `rgba(239,68,68,${segOp})`;
        ctx.beginPath();
        ctx.arc(0, 0, crownR, baseA, baseA + TWO_PI / crownSegs * 0.6);
        ctx.stroke();
      }

      // Large pulsing aura
      const pulse = 0.12 + 0.1 * Math.sin(now / 200);
      const auraR = r * 1.7;
      const grd = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, auraR);
      grd.addColorStop(0, 'rgba(239,68,68,0)');
      grd.addColorStop(0.6, `rgba(239,68,68,${pulse * 0.5})`);
      grd.addColorStop(1, `rgba(239,68,68,${pulse})`);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(0, 0, auraR, 0, TWO_PI); ctx.fill();

      // Ground pulse ring
      const groundPulse = 0.08 + 0.05 * Math.sin(now / 400);
      ctx.strokeStyle = `rgba(239,68,68,${groundPulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, TWO_PI); ctx.stroke();

      // Main body with gradient fill
      const bodyGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      bodyGrd.addColorStop(0, 'rgba(239,68,68,0.4)');
      bodyGrd.addColorStop(0.7, 'rgba(239,68,68,0.25)');
      bodyGrd.addColorStop(1, 'rgba(239,68,68,0.15)');
      ctx.fillStyle = bodyGrd;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI); ctx.fill();
      ctx.strokeStyle = eColor; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI); ctx.stroke();

      // Inner ring
      ctx.strokeStyle = eColor; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, TWO_PI); ctx.stroke();

      // Cross + diagonal pattern
      ctx.strokeStyle = eColor; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, 0); ctx.lineTo(r * 0.45, 0);
      ctx.moveTo(0, -r * 0.45); ctx.lineTo(0, r * 0.45);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.3); ctx.lineTo(r * 0.3, r * 0.3);
      ctx.moveTo(r * 0.3, -r * 0.3); ctx.lineTo(-r * 0.3, r * 0.3);
      ctx.stroke();

      // Energy arcs between body and crown
      ctx.lineWidth = 1;
      for (let a = 0; a < 4; a++) {
        const arcAngle = (a / 4) * TWO_PI + now / 600;
        const arcOp = 0.2 + 0.15 * Math.sin(now / 200 + a * 1.5);
        ctx.strokeStyle = `rgba(255,100,100,${arcOp})`;
        const sx = Math.cos(arcAngle) * r;
        const sy = Math.sin(arcAngle) * r;
        const ex = Math.cos(arcAngle + 0.2) * crownR;
        const ey = Math.sin(arcAngle + 0.2) * crownR;
        const midX = (sx + ex) / 2 + Math.sin(now / 150 + a) * 4;
        const midY = (sy + ey) / 2 + Math.cos(now / 150 + a) * 4;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(midX, midY); ctx.lineTo(ex, ey); ctx.stroke();
      }

      // Center energy core
      const coreR = 4 + Math.sin(now / 150);
      ctx.fillStyle = '#ff6666';
      ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(0, 0, coreR, 0, TWO_PI); ctx.fill();
      ctx.shadowBlur = 0;

      // Shield ring if active
      if (e.shieldAbsorb > 0) {
        const shieldRatio = e.shieldAbsorb / e.maxShieldAbsorb;
        ctx.strokeStyle = `rgba(255,255,255,${0.3 + 0.4 * shieldRatio})`;
        ctx.lineWidth = 2 * shieldRatio + 0.5;
        ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, TWO_PI * shieldRatio); ctx.stroke();
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
};

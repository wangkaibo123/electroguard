import { GameState } from '../types';
import { getPortPos, isPortAccessible } from '../engine';
import { BG_DARK, PORT_OUT, PORT_OUT_USED, PORT_IN, PORT_IN_USED, portOutward } from './constants';

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



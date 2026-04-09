import { CELL_SIZE } from '../types';

export const TWO_PI = Math.PI * 2;

// ── Blue palette ──────────────────────────────────────────────────────────────
export const BG_DARK   = '#0a0e1a';
export const BG_MID    = '#111827';
export const BG_GRID   = 'rgba(140,180,255,0.04)';
export const MAP_BORDER = 'rgba(96,165,250,0.35)';
export const WIRE_ON   = '#60a5fa';
export const WIRE_OFF  = '#374151';
export const PULSE_CLR = '#93c5fd';
export const PORT_OUT  = '#fbbf24';
export const PORT_OUT_USED = '#fcd34d';
export const PORT_IN   = '#34d399';
export const PORT_IN_USED  = '#6ee7b7';
export const HP_BG     = '#1e293b';
export const HP_FG     = '#22c55e';
export const SHIELD_CLR = 'rgba(34,211,238,';
export const PROJ_CLR  = '#fbbf24';
export const KNOB_CLR  = '#fbbf24';
export const UNPOWERED = '#4b5563';
export const POWER_ON  = '#34d399';
export const POWER_OFF = '#1e293b';

export const WIRE_LINE_WIDTH = 5.5;
export const INSET = 6;

export const PORT_OUTWARD = 4;
export const portOutward = (dir: string): { x: number; y: number } => {
  switch (dir) {
    case 'top':    return { x: 0, y: -PORT_OUTWARD };
    case 'bottom': return { x: 0, y: PORT_OUTWARD };
    case 'left':   return { x: -PORT_OUTWARD, y: 0 };
    default:       return { x: PORT_OUTWARD, y: 0 };
  }
};

/** Convert hex color to "r,g,b" string for use in rgba() */
export const hexToRgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

/** Interpolate position along a polyline at `dist` pixels from the start. */
export const posOnPath = (path: { x: number; y: number }[], dist: number) => {
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

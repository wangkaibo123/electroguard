import { TWO_PI } from './constants';

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

export const updateAndDrawDecorations = (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => {
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

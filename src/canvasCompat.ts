type RoundRectTarget = {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  closePath(): void;
};

const normalizeRadius = (radius: number | DOMPointInit | Iterable<number | DOMPointInit> | undefined) => {
  const fallback = { tl: 0, tr: 0, br: 0, bl: 0 };
  if (radius == null) return fallback;

  const radiusValue = Array.isArray(radius) ? radius[0] : radius;
  const numericRadius = typeof radiusValue === 'number'
    ? radiusValue
    : Math.max(radiusValue.x ?? 0, radiusValue.y ?? 0);

  const r = Math.max(0, Number.isFinite(numericRadius) ? numericRadius : 0);
  return { tl: r, tr: r, br: r, bl: r };
};

const addRoundRectPath = (
  target: RoundRectTarget,
  x: number,
  y: number,
  width: number,
  height: number,
  radius?: number | DOMPointInit | Iterable<number | DOMPointInit>,
) => {
  const maxRadius = Math.max(0, Math.min(Math.abs(width), Math.abs(height)) / 2);
  const radii = normalizeRadius(radius);
  const tl = Math.min(radii.tl, maxRadius);
  const tr = Math.min(radii.tr, maxRadius);
  const br = Math.min(radii.br, maxRadius);
  const bl = Math.min(radii.bl, maxRadius);
  const right = x + width;
  const bottom = y + height;

  target.moveTo(x + tl, y);
  target.lineTo(right - tr, y);
  target.quadraticCurveTo(right, y, right, y + tr);
  target.lineTo(right, bottom - br);
  target.quadraticCurveTo(right, bottom, right - br, bottom);
  target.lineTo(x + bl, bottom);
  target.quadraticCurveTo(x, bottom, x, bottom - bl);
  target.lineTo(x, y + tl);
  target.quadraticCurveTo(x, y, x + tl, y);
  target.closePath();
};

const installCanvasCompat = () => {
  if (typeof CanvasRenderingContext2D !== 'undefined') {
    const ctxProto = CanvasRenderingContext2D.prototype;

    if (typeof ctxProto.roundRect !== 'function') {
      ctxProto.roundRect = function roundRectCompat(x, y, width, height, radius) {
        addRoundRectPath(this, x, y, width, height, radius);
      };
    }

    if (typeof ctxProto.ellipse !== 'function') {
      ctxProto.ellipse = function ellipseCompat(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise) {
        this.save();
        this.translate(x, y);
        this.rotate(rotation);
        this.scale(radiusX, radiusY);
        this.arc(0, 0, 1, startAngle, endAngle, counterclockwise);
        this.restore();
      };
    }
  }

  if (typeof Path2D !== 'undefined' && typeof Path2D.prototype.roundRect !== 'function') {
    Path2D.prototype.roundRect = function roundRectCompat(x, y, width, height, radius) {
      addRoundRectPath(this, x, y, width, height, radius);
    };
  }
};

installCanvasCompat();

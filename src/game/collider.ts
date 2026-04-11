// ── Collider component ──────────────────────────────────────────────────────
//  A small, data-driven collision shape attached to every Tower and Enemy.
//  All shapes are stored in *local* space, centered on the owner. Geometry
//  queries (e.g. closest point) live in this file so callers don't need to
//  branch on entity / tower type.

import { getLinearTowerBodyAspectRatio, getLinearTowerBodyCrossSpan } from './linearTowerGeometry';
import { Collider, Tower, Enemy, TowerType, CELL_SIZE } from './types';

// Inset (px) shaved off the cell bounding box to match the visible body.
// Mirrors INSET in render/constants.ts.
const VISUAL_INSET = 6;
const TINY_INSET = 5; // for 1×1 towers (no current ones, kept for parity)

/** Build the collider for a tower of the given type and current size. */
export const makeTowerCollider = (
  type: TowerType, widthCells: number, heightCells: number, linearLandscape?: boolean,
): Collider => {
  const tw = widthCells * CELL_SIZE;
  const th = heightCells * CELL_SIZE;
  const inset = (widthCells === 1 && heightCells === 1) ? TINY_INSET : VISUAL_INSET;

  switch (type) {
    case 'blaster':
      // Filled circle, slightly smaller than the inset square (matches drawTowers).
      return { shape: 'circle', radius: Math.min(tw, th) / 2 - inset - 3 };

    case 'tesla':
      // Hexagon — approximated by its circumscribed circle.
      return { shape: 'circle', radius: Math.min(tw, th) / 2 - inset };

    case 'sniper':
      // Diamond inscribed in the inset rect.
      return { shape: 'diamond', halfW: tw / 2 - inset, halfH: th / 2 - inset };

    case 'battery':
    case 'bus': {
      // Linear body — narrower than the cell bounding box.
      const isLandscape = linearLandscape ?? tw >= th;
      const aspectRatio = getLinearTowerBodyAspectRatio(type);
      const bw = isLandscape ? tw : getLinearTowerBodyCrossSpan(th, tw, aspectRatio);
      const bh = isLandscape ? getLinearTowerBodyCrossSpan(tw, th, aspectRatio) : th;
      return { shape: 'rect', halfW: bw / 2 - inset, halfH: bh / 2 - inset };
    }

    default:
      // gatling (rounded rect), generator, shield, core: plain inset AABB.
      return { shape: 'rect', halfW: tw / 2 - inset, halfH: th / 2 - inset };
  }
};

/** Build the collider for an enemy of the given visual radius. */
export const makeEnemyCollider = (radius: number): Collider => ({
  shape: 'circle',
  radius,
});

/**
 * Closest point on `collider` (centered at center{X,Y}) to the query point.
 * If the query lies inside the collider, the query point itself is returned.
 */
export const closestPointOnCollider = (
  collider: Collider,
  centerX: number, centerY: number,
  queryX: number, queryY: number,
): { x: number; y: number } => {
  const dx = queryX - centerX;
  const dy = queryY - centerY;

  switch (collider.shape) {
    case 'circle': {
      const r = collider.radius;
      const dist = Math.hypot(dx, dy);
      if (dist === 0) return { x: centerX, y: centerY };
      if (dist <= r) return { x: queryX, y: queryY };
      return { x: centerX + (dx / dist) * r, y: centerY + (dy / dist) * r };
    }

    case 'rect': {
      const cx = Math.max(-collider.halfW, Math.min(dx, collider.halfW));
      const cy = Math.max(-collider.halfH, Math.min(dy, collider.halfH));
      return { x: centerX + cx, y: centerY + cy };
    }

    case 'diamond': {
      const { halfW, halfH } = collider;
      if (Math.abs(dx) / halfW + Math.abs(dy) / halfH <= 1) return { x: queryX, y: queryY };
      // Project onto the edge in the same quadrant as (dx, dy).
      const sx = dx >= 0 ? 1 : -1;
      const sy = dy >= 0 ? 1 : -1;
      const v1x = sx * halfW, v1y = 0;
      const v2x = 0,           v2y = sy * halfH;
      const edx = v2x - v1x, edy = v2y - v1y;
      const denom = edx * edx + edy * edy;
      const t = denom > 0
        ? Math.max(0, Math.min(1, ((dx - v1x) * edx + (dy - v1y) * edy) / denom))
        : 0;
      return { x: centerX + v1x + edx * t, y: centerY + v1y + edy * t };
    }
  }
};

// ── Convenience wrappers for the two entity kinds ───────────────────────────

/** World-space center of a tower (its geometric midpoint). */
export const getTowerCenter = (tower: Tower): { x: number; y: number } => ({
  x: (tower.x + tower.width / 2) * CELL_SIZE,
  y: (tower.y + tower.height / 2) * CELL_SIZE,
});

/** Closest point on the tower's collider to a world-space query point. */
export const closestPointOnTower = (
  tower: Tower, queryX: number, queryY: number,
): { x: number; y: number } => {
  const c = getTowerCenter(tower);
  return closestPointOnCollider(tower.collider, c.x, c.y, queryX, queryY);
};

/** Closest point on the enemy's collider to a world-space query point. */
export const closestPointOnEnemy = (
  enemy: Enemy, queryX: number, queryY: number,
): { x: number; y: number } =>
  closestPointOnCollider(enemy.collider, enemy.x, enemy.y, queryX, queryY);

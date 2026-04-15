import { CANVAS_HEIGHT, CANVAS_WIDTH, CELL_SIZE, Camera, GameState, VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from './types';
import { GLOBAL_CONFIG } from './config';

export type ViewportSize = { width: number; height: number };

export const createInitialCamera = (): Camera => {
  const initialMinZoom = Math.max(VIEWPORT_WIDTH / CANVAS_WIDTH, VIEWPORT_HEIGHT / CANVAS_HEIGHT);
  const initialViewW = VIEWPORT_WIDTH / initialMinZoom;
  const initialViewH = VIEWPORT_HEIGHT / initialMinZoom;

  return {
    x: Math.max(0, (CANVAS_WIDTH - initialViewW) / 2),
    y: Math.max(0, (CANVAS_HEIGHT - initialViewH) / 2),
    zoom: initialMinZoom,
  };
};

export const getMinZoom = (viewport: ViewportSize) =>
  Math.max(viewport.width / CANVAS_WIDTH, viewport.height / CANVAS_HEIGHT);

export const clampCamera = (cam: Camera, viewport: ViewportSize) => {
  const viewW = viewport.width / cam.zoom;
  const viewH = viewport.height / cam.zoom;
  const maxX = Math.max(0, CANVAS_WIDTH - viewW);
  const maxY = Math.max(0, CANVAS_HEIGHT - viewH);
  cam.x = Math.max(0, Math.min(cam.x, maxX));
  cam.y = Math.max(0, Math.min(cam.y, maxY));
};

export const centerCameraOnCore = (state: GameState, cam: Camera, viewport: ViewportSize) => {
  const core = state.towers.find(tw => tw.type === 'core');
  if (!core) return;

  const cx = (core.x + core.width / 2) * CELL_SIZE;
  const cy = (core.y + core.height / 2) * CELL_SIZE;
  const minZoom = getMinZoom(viewport);
  cam.zoom = Math.max(minZoom, Math.min(GLOBAL_CONFIG.maxZoom, 1.0));
  cam.x = cx - (viewport.width / cam.zoom) / 2;
  cam.y = cy - (viewport.height / cam.zoom) / 2;
  clampCamera(cam, viewport);
};

export const screenToWorld = (cam: Camera, sx: number, sy: number) => ({
  wx: sx / cam.zoom + cam.x,
  wy: sy / cam.zoom + cam.y,
});

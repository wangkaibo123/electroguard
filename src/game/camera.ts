import { CELL_SIZE, Camera, GameState, VIEWPORT_HEIGHT, VIEWPORT_WIDTH, getCanvasHeight, getCanvasWidth } from './types';
import { GLOBAL_CONFIG } from './config';

export type ViewportSize = { width: number; height: number };

export const createInitialCamera = (): Camera => {
  const initialCanvasWidth = GLOBAL_CONFIG.initialGridWidth * CELL_SIZE;
  const initialCanvasHeight = GLOBAL_CONFIG.initialGridHeight * CELL_SIZE;
  const initialMinZoom = Math.max(VIEWPORT_WIDTH / initialCanvasWidth, VIEWPORT_HEIGHT / initialCanvasHeight);
  const initialViewW = VIEWPORT_WIDTH / initialMinZoom;
  const initialViewH = VIEWPORT_HEIGHT / initialMinZoom;

  return {
    x: Math.max(0, (initialCanvasWidth - initialViewW) / 2),
    y: Math.max(0, (initialCanvasHeight - initialViewH) / 2),
    zoom: initialMinZoom,
  };
};

export const getMinZoom = (viewport: ViewportSize, state?: GameState) => {
  const canvasWidth = state ? getCanvasWidth(state) : GLOBAL_CONFIG.initialGridWidth * CELL_SIZE;
  const canvasHeight = state ? getCanvasHeight(state) : GLOBAL_CONFIG.initialGridHeight * CELL_SIZE;
  return Math.max(viewport.width / canvasWidth, viewport.height / canvasHeight);
};

export const clampCamera = (cam: Camera, viewport: ViewportSize, state?: GameState) => {
  const canvasWidth = state ? getCanvasWidth(state) : GLOBAL_CONFIG.initialGridWidth * CELL_SIZE;
  const canvasHeight = state ? getCanvasHeight(state) : GLOBAL_CONFIG.initialGridHeight * CELL_SIZE;
  const viewW = viewport.width / cam.zoom;
  const viewH = viewport.height / cam.zoom;
  const maxX = Math.max(0, canvasWidth - viewW);
  const maxY = Math.max(0, canvasHeight - viewH);
  cam.x = Math.max(0, Math.min(cam.x, maxX));
  cam.y = Math.max(0, Math.min(cam.y, maxY));
};

export const centerCameraOnCore = (state: GameState, cam: Camera, viewport: ViewportSize) => {
  const core = state.towers.find(tw => tw.type === 'core');
  if (!core) return;

  const cx = (core.x + core.width / 2) * CELL_SIZE;
  const cy = (core.y + core.height / 2) * CELL_SIZE;
  const minZoom = getMinZoom(viewport, state);
  cam.zoom = Math.max(minZoom, Math.min(GLOBAL_CONFIG.maxZoom, 1.0));
  cam.x = cx - (viewport.width / cam.zoom) / 2;
  cam.y = cy - (viewport.height / cam.zoom) / 2;
  clampCamera(cam, viewport, state);
};

export const screenToWorld = (cam: Camera, sx: number, sy: number) => ({
  wx: sx / cam.zoom + cam.x,
  wy: sy / cam.zoom + cam.y,
});

export const BATTERY_BODY_ASPECT_RATIO = 48 / 28;
export const BUS_BODY_ASPECT_RATIO = 2;
export const LINEAR_TOWER_VISUAL_INSET = 6;

export const getLinearTowerBodyAspectRatio = (type: string): number =>
  type === 'battery' ? BATTERY_BODY_ASPECT_RATIO : BUS_BODY_ASPECT_RATIO;

export const getLinearTowerBodyCrossSpan = (
  longSpan: number,
  crossSpan: number,
  aspectRatio: number,
): number => {
  const visibleLong = Math.max(0, longSpan - LINEAR_TOWER_VISUAL_INSET * 2);
  const visibleCross = visibleLong / aspectRatio;
  return Math.min(crossSpan, visibleCross + LINEAR_TOWER_VISUAL_INSET * 2);
};

export const getLinearTowerBodyRect = (
  px: number, py: number, tw: number, th: number, isLandscape: boolean, aspectRatio: number,
) => {
  if (isLandscape) {
    const bodyH = getLinearTowerBodyCrossSpan(tw, th, aspectRatio);
    return {
      isLandscape,
      x: px,
      y: py + (th - bodyH) / 2,
      width: tw,
      height: bodyH,
    };
  }

  const bodyW = getLinearTowerBodyCrossSpan(th, tw, aspectRatio);
  return {
    isLandscape,
    x: px + (tw - bodyW) / 2,
    y: py,
    width: bodyW,
    height: th,
  };
};

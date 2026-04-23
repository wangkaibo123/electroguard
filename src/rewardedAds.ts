type TapRewardedVideoAdCloseResult = {
  isEnded?: boolean;
};

type TapRewardedVideoAd = {
  show: () => Promise<void>;
  load?: () => Promise<void>;
  onLoad?: (callback: () => void) => void;
  onError?: (callback: (error: unknown) => void) => void;
  onClose?: (callback: (result?: TapRewardedVideoAdCloseResult) => void) => void;
};

type TapBannerAdStyle = {
  left: number;
  top: number;
  width: number;
  height: number;
  realWidth?: number;
  realHeight?: number;
};

type TapBannerAd = {
  style: TapBannerAdStyle;
  show: () => Promise<void>;
  hide: () => void;
  destroy: () => void;
  onResize?: (callback: (size: { width?: number; height?: number }) => void) => void;
  offResize?: (callback: (size: { width?: number; height?: number }) => void) => void;
  onError?: (callback: (error: unknown) => void) => void;
};

type TapApi = {
  createRewardedVideoAd?: (options: { adUnitId: string }) => TapRewardedVideoAd;
  createBannerAd?: (options: {
    adUnitId: string;
    adIntervals?: number;
    style: TapBannerAdStyle;
  }) => TapBannerAd;
  getSystemInfoSync?: () => {
    screenWidth?: number;
    screenHeight?: number;
    windowWidth?: number;
    windowHeight?: number;
    safeArea?: {
      bottom?: number;
    };
  };
};

const getTapApi = () => (window as typeof window & { tap?: TapApi }).tap;
const BANNER_DEFAULT_HEIGHT = 50;
const BANNER_MAX_WIDTH = 360;
const BANNER_MIN_WIDTH = 300;

export const getTapTapRewardedAdUnitId = () => {
  const hostWindow = window as typeof window & {
    __TAPTAP_REWARDED_AD_UNIT_ID__?: string;
  };
  const viteEnv = (import.meta as ImportMeta & {
    env?: { VITE_TAPTAP_REWARDED_AD_UNIT_ID?: string };
  }).env;

  return (
    hostWindow.__TAPTAP_REWARDED_AD_UNIT_ID__ ||
    viteEnv?.VITE_TAPTAP_REWARDED_AD_UNIT_ID ||
    ''
  );
};

export const getTapTapBannerAdUnitId = () => {
  const hostWindow = window as typeof window & {
    __TAPTAP_BANNER_AD_UNIT_ID__?: string;
  };
  const viteEnv = (import.meta as ImportMeta & {
    env?: { VITE_TAPTAP_BANNER_AD_UNIT_ID?: string };
  }).env;

  return (
    hostWindow.__TAPTAP_BANNER_AD_UNIT_ID__ ||
    viteEnv?.VITE_TAPTAP_BANNER_AD_UNIT_ID ||
    ''
  );
};

let rewardedVideoAd: TapRewardedVideoAd | null = null;
let pendingResolve: ((watchedToEnd: boolean) => void) | null = null;
let pauseBannerAd: TapBannerAd | null = null;
let pauseBannerResizeListener: ((size: { width?: number; height?: number }) => void) | null = null;

const getRewardedVideoAd = () => {
  if (rewardedVideoAd) return rewardedVideoAd;

  const tap = getTapApi();
  const adUnitId = getTapTapRewardedAdUnitId();
  if (!tap?.createRewardedVideoAd || !adUnitId) return null;

  rewardedVideoAd = tap.createRewardedVideoAd({ adUnitId });
  rewardedVideoAd.onError?.((error) => {
    console.warn('TapTap rewarded video ad error', error);
  });
  rewardedVideoAd.onClose?.((result) => {
    pendingResolve?.(Boolean(result?.isEnded));
    pendingResolve = null;
  });

  return rewardedVideoAd;
};

export const canUseTapTapRewardedAd = () =>
  Boolean(getTapApi()?.createRewardedVideoAd && getTapTapRewardedAdUnitId());

export const showTapTapRewardedAd = async () => {
  const ad = getRewardedVideoAd();
  if (!ad || pendingResolve) return false;

  return new Promise<boolean>((resolve) => {
    pendingResolve = resolve;

    const showAd = async () => {
      try {
        await ad.show();
      } catch {
        if (!ad.load) {
          pendingResolve = null;
          resolve(false);
          return;
        }

        try {
          await ad.load();
          await ad.show();
        } catch {
          pendingResolve = null;
          resolve(false);
        }
      }
    };

    void showAd();
  });
};

const getTapViewport = () => {
  const tap = getTapApi();

  try {
    const systemInfo = tap?.getSystemInfoSync?.();
    const width = systemInfo?.screenWidth ?? systemInfo?.windowWidth ?? window.innerWidth;
    const height = systemInfo?.screenHeight ?? systemInfo?.windowHeight ?? window.innerHeight;
    const safeBottom =
      typeof systemInfo?.screenHeight === 'number' &&
      typeof systemInfo.safeArea?.bottom === 'number'
        ? Math.max(0, systemInfo.screenHeight - systemInfo.safeArea.bottom)
        : 0;

    return { width, height, safeBottom };
  } catch {
    return { width: window.innerWidth, height: window.innerHeight, safeBottom: 0 };
  }
};

const getPauseBannerStyle = (realHeight?: number): TapBannerAdStyle => {
  const viewport = getTapViewport();
  const width = Math.min(viewport.width, Math.max(BANNER_MIN_WIDTH, Math.min(BANNER_MAX_WIDTH, viewport.width)));
  const height = realHeight ?? BANNER_DEFAULT_HEIGHT;

  return {
    left: Math.max(0, Math.round((viewport.width - width) / 2)),
    top: Math.max(0, Math.round(viewport.height - height - viewport.safeBottom)),
    width: Math.round(width),
    height: Math.round(height),
  };
};

const positionTapTapPauseBannerAd = () => {
  if (!pauseBannerAd) return;

  const style = getPauseBannerStyle(pauseBannerAd.style.realHeight);
  pauseBannerAd.style.left = style.left;
  pauseBannerAd.style.top = style.top;
  pauseBannerAd.style.width = style.width;
  pauseBannerAd.style.height = style.height;
};

const getTapTapPauseBannerAd = () => {
  if (pauseBannerAd) return pauseBannerAd;

  const tap = getTapApi();
  const adUnitId = getTapTapBannerAdUnitId();
  if (!tap?.createBannerAd || !adUnitId) return null;

  pauseBannerAd = tap.createBannerAd({
    adUnitId,
    adIntervals: 30,
    style: getPauseBannerStyle(),
  });
  pauseBannerAd.onError?.((error) => {
    console.warn('TapTap banner ad error', error);
  });
  pauseBannerResizeListener = (size) => {
    if (!pauseBannerAd) return;
    pauseBannerAd.style.realWidth = size.width ?? pauseBannerAd.style.realWidth;
    pauseBannerAd.style.realHeight = size.height ?? pauseBannerAd.style.realHeight;
  };
  pauseBannerAd.onResize?.(pauseBannerResizeListener);

  return pauseBannerAd;
};

export const canUseTapTapBannerAd = () =>
  Boolean(getTapApi()?.createBannerAd && getTapTapBannerAdUnitId());

export const showTapTapPauseBannerAd = async () => {
  const ad = getTapTapPauseBannerAd();
  if (!ad) return false;

  positionTapTapPauseBannerAd();

  try {
    await ad.show();
    return true;
  } catch (error) {
    console.warn('TapTap banner ad show failed', error);
    return false;
  }
};

export const hideTapTapPauseBannerAd = () => {
  try {
    pauseBannerAd?.hide();
  } catch {
    // Ignore native ad teardown errors when the page is changing state.
  }
};

export const refreshTapTapPauseBannerAdPosition = () => {
  positionTapTapPauseBannerAd();
};

export const destroyTapTapPauseBannerAd = () => {
  if (!pauseBannerAd) return;

  try {
    if (pauseBannerResizeListener) {
      pauseBannerAd.offResize?.(pauseBannerResizeListener);
    }
    pauseBannerAd.destroy();
  } catch {
    // Ignore native ad teardown errors when the page is closing.
  } finally {
    pauseBannerAd = null;
    pauseBannerResizeListener = null;
  }
};

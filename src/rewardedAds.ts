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

type TapApi = {
  createRewardedVideoAd?: (options: { adUnitId: string }) => TapRewardedVideoAd;
};

const getTapApi = () => (window as typeof window & { tap?: TapApi }).tap;

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

let rewardedVideoAd: TapRewardedVideoAd | null = null;
let pendingResolve: ((watchedToEnd: boolean) => void) | null = null;

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

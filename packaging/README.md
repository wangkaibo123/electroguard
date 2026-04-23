# Packaging

This directory keeps generated upload packages and platform-specific packaging helpers out of the project root.

## TapTap

Run:

```bash
npm run package:taptap
```

Set the rewarded video ad unit id before packaging:

```bash
TAPTAP_REWARDED_AD_UNIT_ID=your-ad-unit-id npm run package:taptap
```

The packaging helper also reads `.env.local`, so this project can keep both
TapTap ad unit ids there:

```bash
VITE_TAPTAP_REWARDED_AD_UNIT_ID=your-rewarded-ad-unit-id
VITE_TAPTAP_BANNER_AD_UNIT_ID=your-banner-ad-unit-id
```

Outputs:

- `packaging/taptap/electroguard-h5-taptap.zip`
- `packaging/taptap/tap_upload/electroguard-h5/`

The TapTap zip keeps `index.html` inside a single top-level folder and inlines compatibility CSS for TapTap's H5 preview WebView.

## Generic H5

The generic package is stored at:

- `packaging/h5/electroguard-h5.zip`

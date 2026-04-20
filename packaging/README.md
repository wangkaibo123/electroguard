# Packaging

This directory keeps generated upload packages and platform-specific packaging helpers out of the project root.

## TapTap

Run:

```bash
npm run package:taptap
```

Outputs:

- `packaging/taptap/electroguard-h5-taptap.zip`
- `packaging/taptap/tap_upload/electroguard-h5/`

The TapTap zip keeps `index.html` inside a single top-level folder and inlines compatibility CSS for TapTap's H5 preview WebView.

## Generic H5

The generic package is stored at:

- `packaging/h5/electroguard-h5.zip`

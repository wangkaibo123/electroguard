import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { Features, transform } from 'lightningcss';

const rootDir = process.cwd();
const loadEnvFile = (fileName) => {
  const envPath = join(rootDir, fileName);
  if (!existsSync(envPath)) return;

  const envText = readFileSync(envPath, 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    if (!key || process.env[key] != null) continue;

    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
  }
};

loadEnvFile('.env');
loadEnvFile('.env.local');

const distDir = join(rootDir, 'dist');
const outputDir = join(rootDir, 'packaging', 'taptap');
const workDir = join(outputDir, 'tap_upload');
const packageDirName = 'electroguard-h5';
const packageDir = join(workDir, packageDirName);
const zipPath = join(outputDir, 'electroguard-h5-taptap.zip');
const rewardedAdUnitId =
  process.env.TAPTAP_REWARDED_AD_UNIT_ID ||
  process.env.VITE_TAPTAP_REWARDED_AD_UNIT_ID ||
  '';
const bannerAdUnitId =
  process.env.TAPTAP_BANNER_AD_UNIT_ID ||
  process.env.VITE_TAPTAP_BANNER_AD_UNIT_ID ||
  '';

const findAsset = (ext) => {
  const assetsDir = join(packageDir, 'assets');
  return readdirSync(assetsDir).find((name) => name.endsWith(ext));
};

const unwrapLayerRules = (css) => {
  let output = '';
  let index = 0;

  while (index < css.length) {
    if (!css.startsWith('@layer', index)) {
      output += css[index];
      index += 1;
      continue;
    }

    const nextBrace = css.indexOf('{', index);
    const nextSemi = css.indexOf(';', index);
    if (nextSemi !== -1 && (nextBrace === -1 || nextSemi < nextBrace)) {
      index = nextSemi + 1;
      continue;
    }
    if (nextBrace === -1) {
      break;
    }

    let depth = 1;
    let cursor = nextBrace + 1;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === '{') depth += 1;
      if (css[cursor] === '}') depth -= 1;
      cursor += 1;
    }

    output += css.slice(nextBrace + 1, cursor - 1);
    index = cursor;
  }

  return output;
};

const removeAtRuleBlocks = (css, ruleName) => {
  let output = '';
  let index = 0;

  while (index < css.length) {
    if (!css.startsWith(ruleName, index)) {
      output += css[index];
      index += 1;
      continue;
    }

    const nextBrace = css.indexOf('{', index);
    const nextSemi = css.indexOf(';', index);
    if (nextSemi !== -1 && (nextBrace === -1 || nextSemi < nextBrace)) {
      index = nextSemi + 1;
      continue;
    }
    if (nextBrace === -1) break;

    let depth = 1;
    let cursor = nextBrace + 1;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === '{') depth += 1;
      if (css[cursor] === '}') depth -= 1;
      cursor += 1;
    }

    index = cursor;
  }

  return output;
};

const toLegacyColor = (color) => {
  try {
    const result = transform({
      filename: 'color.css',
      code: Buffer.from(`.x{color:${color}}`),
      minify: true,
      include: Features.Colors,
    });
    const css = result.code.toString();
    return css.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/)?.[0] ?? null;
  } catch {
    return null;
  }
};

const replaceModernColors = (css) =>
  css.replace(/oklch\([^)]+\)/g, (color) => toLegacyColor(color) ?? color);

const buildFallbackVariables = (css) => {
  const declarations = [];
  const seen = new Set();
  const colorVarPattern = /(--color-[\w-]+):\s*(oklch\([^)]+\)|#[0-9a-fA-F]{3,8});/g;

  for (const match of css.matchAll(colorVarPattern)) {
    const [, name, value] = match;
    if (seen.has(name)) continue;
    seen.add(name);

    const fallback = value.startsWith('#') ? value : toLegacyColor(value);
    if (fallback) declarations.push(`${name}:${fallback}`);
  }

  return declarations.length > 0 ? `:root{${declarations.join(';')}}\n` : '';
};

const injectHeadAsset = (html, assetHtml) => {
  if (html.includes(assetHtml)) return html;
  const scriptIndex = html.indexOf('    <script ');
  if (scriptIndex !== -1) {
    return `${html.slice(0, scriptIndex)}${assetHtml}\n${html.slice(scriptIndex)}`;
  }

  return html.replace('</head>', `${assetHtml}\n  </head>`);
};

const writeCompatCss = () => {
  const htmlPath = join(packageDir, 'index.html');
  const cssFile = findAsset('.css');
  if (!cssFile) throw new Error('CSS asset not found in dist/assets.');

  const cssPath = join(packageDir, 'assets', cssFile);
  const sourceCss = readFileSync(cssPath, 'utf8');
  const legacyCss = removeAtRuleBlocks(
    removeAtRuleBlocks(
      replaceModernColors(unwrapLayerRules(sourceCss)).replace(/ in oklab/g, ''),
      '@supports',
    ),
    '@property',
  );
  const compatCss = [
    buildFallbackVariables(sourceCss),
    legacyCss,
    `
html,body,#root{width:100%;height:100%;overflow:hidden;background:#030712;}
body{position:fixed;inset:0;}
.app-shell{width:100%;height:100vh;height:100dvh;}
.-translate-x-1\\/2{transform:translateX(-50%);}
.-translate-y-1\\/2{transform:translateY(-50%);}
.-translate-x-1\\/2.-translate-y-1\\/2{transform:translate(-50%,-50%);}
.translate-x-0{transform:translateX(0);}
.translate-x-8{transform:translateX(2rem);}
.translate-y-full{transform:translateY(100%);}
.scale-90{transform:scale(.9);}
.active\\:scale-95:active{transform:scale(.95);}
.-translate-x-1\\/2.active\\:scale-95:active{transform:translateX(-50%) scale(.95);}
.-translate-y-1\\/2.active\\:scale-95:active{transform:translateY(-50%) scale(.95);}
.-translate-x-1\\/2.-translate-y-1\\/2.active\\:scale-95:active{transform:translate(-50%,-50%) scale(.95);}
`,
  ].join('\n');

  writeFileSync(cssPath, compatCss);

  let html = readFileSync(htmlPath, 'utf8');
  html = html.replace(/ crossorigin/g, '');

  html = html.replace(
    /\s*<link rel="stylesheet"[^>]*href="\.\/assets\/[^"]+\.css"[^>]*>/,
    '',
  );
  html = injectHeadAsset(html, `    <link rel="stylesheet" href="./assets/${cssFile}">`);
  html = injectHeadAsset(html, `    <script>window.__TAPTAP_PACKAGE__=true;</script>`);
  html = injectHeadAsset(
    html,
    `    <script>window.__TAPTAP_REWARDED_AD_UNIT_ID__=${JSON.stringify(rewardedAdUnitId)};</script>`,
  );
  html = injectHeadAsset(
    html,
    `    <script>window.__TAPTAP_BANNER_AD_UNIT_ID__=${JSON.stringify(bannerAdUnitId)};</script>`,
  );
  html = injectHeadAsset(
    html,
    `    <style id="tap-h5-compat-css" data-build="tap-h5-css-dual">\n${compatCss}\n    </style>`,
  );

  writeFileSync(htmlPath, html);
};

const createZip = () => {
  try {
    execFileSync('zip', ['-r', zipPath, packageDirName], {
      cwd: workDir,
      stdio: 'inherit',
    });
    return;
  } catch (error) {
    if (process.platform !== 'win32') throw error;
  }

  const psQuote = (value) => `'${value.replace(/'/g, "''")}'`;
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      [
        'Add-Type -AssemblyName System.IO.Compression.FileSystem;',
        `[System.IO.Compression.ZipFile]::CreateFromDirectory(${psQuote(workDir)}, ${psQuote(zipPath)});`,
      ].join(' '),
    ],
    { stdio: 'inherit' },
  );
};

if (!existsSync(distDir)) {
  throw new Error('dist directory does not exist. Run npm run build first.');
}

rmSync(workDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(packageDir, { recursive: true });
cpSync(distDir, packageDir, { recursive: true });

writeCompatCss();

createZip();

console.log(`TapTap package written to ${zipPath}`);

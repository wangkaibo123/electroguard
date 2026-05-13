import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const rootDir = process.cwd();
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
const cargoBin = join(homedir(), '.cargo', 'bin');
const command = join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'tauri.cmd' : 'tauri');
const env = {
  ...process.env,
  [pathKey]: `${cargoBin}${process.platform === 'win32' ? ';' : ':'}${process.env[pathKey] ?? ''}`,
};
const androidTargets = (process.env.TAURI_ANDROID_TARGETS ?? 'aarch64')
  .split(/[,\s]+/)
  .map((target) => target.trim())
  .filter(Boolean);
const targetLabel =
  androidTargets.length === 1 && androidTargets[0] === 'aarch64' ? 'arm64' : androidTargets.join('-');

const androidOutputDir = join(
  rootDir,
  'src-tauri',
  'gen',
  'android',
  'app',
  'build',
  'outputs',
  'apk',
);
const uploadDir = join(rootDir, 'packaging', 'taptap', 'android_upload');

const findApks = (dir) => {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) return findApks(entryPath);
    return entry.isFile() && entry.name.endsWith('.apk') ? [entryPath] : [];
  });
};

const buildArgs = ['android', 'build', '--apk', '--ci'];
if (androidTargets.length > 0) {
  buildArgs.push('--target', ...androidTargets);
}

try {
  execFileSync(command, buildArgs, {
    cwd: rootDir,
    env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
} catch {
  console.error(
    'Tauri Android build failed. Check that Android SDK/NDK are installed and ANDROID_HOME/NDK_HOME are set.',
  );
  process.exit(1);
}

const newestApk = findApks(androidOutputDir)
  .map((path) => ({ path, mtimeMs: statSync(path).mtimeMs }))
  .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];

if (!newestApk) {
  throw new Error(`Tauri Android APK not found under ${androidOutputDir}.`);
}

mkdirSync(uploadDir, { recursive: true });

for (const fileName of readdirSync(uploadDir)) {
  if (fileName.endsWith('.apk')) {
    rmSync(join(uploadDir, fileName), { force: true });
  }
}

const signedState = newestApk.path.includes('unsigned') ? 'unsigned' : 'signed';
const outputName = `electroguard-tauri-${targetLabel}-v${packageJson.version}-${signedState}.apk`;
const outputPath = join(uploadDir, outputName);

copyFileSync(newestApk.path, outputPath);

console.log(`Tauri Android APK copied from ${newestApk.path}`);
console.log(`TapTap Android APK written to ${outputPath}`);

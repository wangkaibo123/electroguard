import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const releaseDir = join(rootDir, 'src-tauri', 'target', 'release');
const exeName = 'electroguard.exe';
const exePath = join(releaseDir, exeName);
const outputDir = join(rootDir, 'packaging', 'taptap');
const workDir = join(outputDir, 'windows_upload');
const packageDirName = 'Electroguard';
const packageDir = join(workDir, packageDirName);
const zipPath = join(outputDir, 'electroguard-windows-taptap.zip');

if (!existsSync(exePath)) {
  throw new Error(`Windows executable not found at ${exePath}. Run npm run build:windows first.`);
}

rmSync(workDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(packageDir, { recursive: true });

const copyIfExists = (name) => {
  const source = join(releaseDir, name);
  if (existsSync(source)) {
    cpSync(source, join(packageDir, name), { recursive: statSync(source).isDirectory() });
  }
};

copyIfExists(exeName);
copyIfExists('WebView2Loader.dll');
copyIfExists('resources');

for (const fileName of readdirSync(releaseDir)) {
  if (fileName.endsWith('.dll')) {
    copyIfExists(fileName);
  }
}

const createZip = () => {
  const packageEntries = readdirSync(packageDir);

  try {
    execFileSync('zip', ['-r', zipPath, ...packageEntries], {
      cwd: packageDir,
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
        `[System.IO.Compression.ZipFile]::CreateFromDirectory(${psQuote(packageDir)}, ${psQuote(zipPath)});`,
      ].join(' '),
    ],
    { stdio: 'inherit' },
  );
};

createZip();

console.log(`TapTap Windows package written to ${zipPath}`);

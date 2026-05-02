import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

const rootDir = process.cwd();
const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
const cargoBin = join(homedir(), '.cargo', 'bin');
const command = join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'tauri.cmd' : 'tauri');
const env = {
  ...process.env,
  [pathKey]: `${cargoBin}${process.platform === 'win32' ? ';' : ':'}${process.env[pathKey] ?? ''}`,
};

execFileSync(command, ['build', '--no-bundle'], {
  cwd: rootDir,
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

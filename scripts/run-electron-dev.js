const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWin = process.platform === 'win32';
const projectRoot = path.resolve(__dirname, '..');

// Prefer the real Electron binary exported by the package to avoid PATH issues on Windows
let electronPath;
try {
  electronPath = require('electron');
} catch {
  const localBin = path.join(projectRoot, 'node_modules', '.bin');
  const fallback = path.join(localBin, isWin ? 'electron.cmd' : 'electron');
  electronPath = fs.existsSync(fallback) ? fallback : isWin ? 'electron.cmd' : 'electron';
}

const args = ['./app'];
const env = {
  ...process.env,
  EXELEARNING_DEBUG_MODE: process.env.EXELEARNING_DEBUG_MODE || '1',
};

const child = spawn(electronPath, args, {
  stdio: 'inherit',
  env,
  cwd: projectRoot,
  shell: isWin && String(electronPath).toLowerCase().endsWith('.cmd'),
});

child.on('error', (err) => {
  console.error('Failed to launch Electron:', err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

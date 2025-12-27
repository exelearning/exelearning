// scripts/setup-local.js
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const isCleanMode = process.argv.includes('--clean');

if (isCleanMode) {
  console.log('Cleaning local environment...');
} else {
  console.log('Setting up local environment...');
}

const dataDir = path.join(__dirname, '..', 'data');

// Cross-platform function to kill process on port
function killPort(port) {
  const isWindows = process.platform === 'win32';
  try {
    if (isWindows) {
      // Windows: find PID and kill
      const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      const lines = result.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(`Killed process on port ${port} (PID: ${pid})`);
        }
      }
    } else {
      // Unix/Mac: use lsof to find and kill
      const result = execSync(`lsof -ti:${port}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      const pids = result.trim().split('\n').filter(Boolean);
      for (const pid of pids) {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        console.log(`Killed process on port ${port} (PID: ${pid})`);
      }
    }
  } catch {
    // No process found on port, or command failed - that's fine
  }
}

// Clean mode: delete database and data files for fresh start
if (isCleanMode) {
  const dbPath = path.join(dataDir, 'exelearning.db');
  const dirsToClean = ['assets', 'tmp', 'dist', 'chunks'];

  // Delete database
  if (fs.existsSync(dbPath)) {
    console.log('Deleting database: data/exelearning.db');
    fs.removeSync(dbPath);
  }

  // Delete data subdirectories
  for (const dir of dirsToClean) {
    const dirPath = path.join(dataDir, dir);
    if (fs.existsSync(dirPath)) {
      console.log(`Deleting directory: data/${dir}/`);
      fs.removeSync(dirPath);
    }
  }

  // Kill any process on port 8080
  killPort(8080);

  console.log('Local environment cleaned. Run "make up-local" for fresh start.');
  process.exit(0);
}

// 1. Copy .env if it doesn't exist (replaces check-env from Makefile)
const envPath = path.join(__dirname, '..', '.env');
const envDistPath = path.join(__dirname, '..', '.env.dist');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envDistPath)) {
    console.log('Creating .env from .env.dist...');
    fs.copySync(envDistPath, envPath);
  } else {
    console.warn('.env.dist not found, skipping .env creation');
  }
}

// 2. Create data directory for SQLite
// Assuming SQLite by default for local
if (!fs.existsSync(dataDir)) {
  console.log(`Creating data directory at: ${dataDir}`);
  fs.ensureDirSync(dataDir);
}

// 3. Cache cleanup (optional)
const cacheDir = path.join(__dirname, '..', 'dist', '.cache');
if (fs.existsSync(cacheDir)) {
  fs.removeSync(cacheDir);
}

// 4. Kill any process on port 8080 before starting
killPort(8080);

console.log('Local setup complete.');

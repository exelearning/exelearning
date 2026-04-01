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

/**
 * Remove a file with retry logic for Windows file locking.
 * On Windows, file handles may take a moment to release after a process is killed.
 * This provides a small safety net (not the primary fix — killing the server first is).
 */
function removeWithRetry(filePath, label, maxRetries = 5, delayMs = 500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.removeSync(filePath);
      return;
    } catch (err) {
      const isLocked = err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES';
      if (isLocked && attempt < maxRetries) {
        console.log(`  ${label} is locked, retrying (${attempt}/${maxRetries})...`);
        execSync(`${process.platform === 'win32' ? 'ping -n' : 'sleep'} ${Math.ceil(delayMs / 1000)}`, { stdio: 'ignore' });
      } else {
        throw err;
      }
    }
  }
}

// Clean mode: delete database and data files for fresh start
if (isCleanMode) {
  const dbPath = path.join(dataDir, 'exelearning.db');
  const dbWalPath = dbPath + '-wal';
  const dbShmPath = dbPath + '-shm';
  const dirsToClean = ['assets', 'tmp', 'dist', 'chunks'];

  // Kill the dev server FIRST so it releases the SQLite file handle
  killPort(8080);

  // Delete database and its WAL/SHM companion files
  for (const file of [dbPath, dbWalPath, dbShmPath]) {
    if (fs.existsSync(file)) {
      const label = path.basename(file);
      console.log(`Deleting database file: data/${label}`);
      removeWithRetry(file, label);
    }
  }

  // Delete data subdirectories
  for (const dir of dirsToClean) {
    const dirPath = path.join(dataDir, dir);
    if (fs.existsSync(dirPath)) {
      console.log(`Deleting directory: data/${dir}/`);
      fs.removeSync(dirPath);
    }
  }

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

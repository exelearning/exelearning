// scripts/setup-local.js
const fs = require('fs-extra');
const path = require('path');

console.log('Setting up local environment...');

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
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  console.log(`Creating data directory at: ${dataDir}`);
  fs.ensureDirSync(dataDir);
}

// 3. Cache cleanup (optional)
const cacheDir = path.join(__dirname, '..', 'dist', '.cache');
if (fs.existsSync(cacheDir)) {
  fs.removeSync(cacheDir);
}

console.log('Local setup complete.');

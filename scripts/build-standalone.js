#!/usr/bin/env node
/**
 * Platform-aware standalone build script.
 * Detects the current platform and compiles the appropriate Bun executable(s).
 *
 * - macOS: Builds both arm64 and x64 for universal app support
 * - Windows: Builds x64 .exe only
 * - Linux: Builds x64 only
 */

const { execSync } = require('child_process');
const platform = process.platform;

console.log(`[build-standalone] Detected platform: ${platform}`);

try {
  if (platform === 'darwin') {
    // macOS: build both arm64 and x64 for universal app
    console.log('[build-standalone] Building for macOS (arm64 + x64)...');
    execSync(
      'bun build src/index.ts --compile --target=bun-darwin-arm64 --outfile dist/exelearning-server-arm64',
      { stdio: 'inherit' }
    );
    execSync(
      'bun build src/index.ts --compile --target=bun-darwin-x64 --outfile dist/exelearning-server-x64',
      { stdio: 'inherit' }
    );
    console.log('[build-standalone] macOS builds complete.');
  } else if (platform === 'win32') {
    // Windows: build x64 only
    console.log('[build-standalone] Building for Windows (x64)...');
    execSync(
      'bun build src/index.ts --compile --target=bun-windows-x64 --outfile dist/exelearning-server.exe',
      { stdio: 'inherit' }
    );
    console.log('[build-standalone] Windows build complete.');
  } else {
    // Linux and others: build x64 only
    console.log('[build-standalone] Building for Linux (x64)...');
    execSync(
      'bun build src/index.ts --compile --target=bun-linux-x64 --outfile dist/exelearning-server-linux',
      { stdio: 'inherit' }
    );
    console.log('[build-standalone] Linux build complete.');
  }
} catch (error) {
  console.error('[build-standalone] Build failed:', error.message);
  process.exit(1);
}

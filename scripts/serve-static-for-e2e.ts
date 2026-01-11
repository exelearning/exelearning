/**
 * E2E Static Server Script
 *
 * Builds the static bundle and serves it for E2E testing.
 * Used by Playwright's webServer configuration for static mode tests.
 */
import { $ } from 'bun';

const PORT = process.env.PORT || '8080';

console.log('[E2E Static] Building static bundle...');

// Build static distribution
try {
    await $`bun run build:static`.quiet();
    console.log('[E2E Static] Build completed successfully');
} catch (error) {
    console.error('[E2E Static] Build failed:', error);
    process.exit(1);
}

console.log(`[E2E Static] Starting server on port ${PORT}...`);

// Serve static files with SPA mode (-s flag)
const proc = Bun.spawn(['bunx', 'serve', 'dist/static', '-p', PORT, '-s'], {
    stdout: 'inherit',
    stderr: 'inherit',
});

// Keep process running
await proc.exited;

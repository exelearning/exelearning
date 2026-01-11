import { test as base } from '@playwright/test';

/**
 * Mode Detection Fixture for E2E Tests
 *
 * Detects whether tests are running against server mode or static mode
 * and provides helpers to skip server-only tests in static mode.
 */

/**
 * Detect if running in static mode based on project name or environment
 */
export function isStaticMode(): boolean {
    return process.env.E2E_MODE === 'static' || (process.env.PLAYWRIGHT_PROJECT?.includes('static') ?? false);
}

// Cache the result since environment doesn't change during test run
const _isStatic = isStaticMode();

/**
 * Helper to skip entire describe blocks in static mode.
 * Call at the top of a describe block to skip all tests in it.
 *
 * IMPORTANT: This uses test.skip.beforeEach to skip all tests in the block.
 * The test.describe.configure({ mode: 'skip' }) approach doesn't work reliably
 * with extended test fixtures.
 *
 * @example
 * import { test, serverOnly } from '../fixtures/mode.fixture';
 *
 * test.describe('Collaborative Editing', () => {
 *     serverOnly(); // Skips entire suite in static mode
 *     test('should sync changes', async ({ page }) => { ... });
 * });
 */
export function serverOnly(): void {
    if (_isStatic) {
        // Use beforeEach to skip all tests in this describe block
        // This is more reliable than test.describe.configure({ mode: 'skip' })
        base.beforeEach(async ({}, testInfo) => {
            testInfo.skip(true, 'Requires server - skipped in static mode');
        });
    }
}

/**
 * Extended test fixture that provides mode detection.
 *
 * @example
 * test('should share project', async ({ page, isStaticMode }) => {
 *     test.skip(isStaticMode, 'Sharing requires server');
 *     // ...
 * });
 */
export const test = base.extend<{ isStaticMode: boolean }>({
    isStaticMode: async ({}, use) => {
        await use(isStaticMode());
    },
});

export { expect } from '@playwright/test';

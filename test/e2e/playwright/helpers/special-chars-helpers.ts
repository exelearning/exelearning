/**
 * Special Characters Helpers for E2E Tests
 *
 * Minimal utilities for testing with special characters, unicode, and edge cases in filenames.
 * This module provides only:
 * - Real image data from fixtures for creating test files programmatically
 * - Function to create test files with arbitrary unicode names
 * - Test filename patterns organized by category
 * - Unique filename generator
 *
 * For file manager operations (upload, select, rename, delete, folder operations),
 * use file-manager-helpers.ts instead.
 *
 * @example
 * ```typescript
 * import { createTestFileWithName, getUniqueTestFilename, TEST_FILENAME_PATTERNS } from '../helpers/special-chars-helpers';
 *
 * test('test unicode filename', async ({ page }) => {
 *     const filename = getUniqueTestFilename('日本語ファイル.jpg');
 *     await createTestFileWithName(page, filename);
 * });
 * ```
 */

import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════════════════════
// FIXTURE IMAGE DATA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cache for fixture image data (loaded once per test run)
 */
let FIXTURE_IMAGE_BYTES: Uint8Array | null = null;

/**
 * Get real image bytes from the fixture file.
 * Uses sample-2.jpg which is a proper-sized image that generates thumbnails correctly.
 * Cached after first read for performance.
 */
function getFixtureImageBytes(): Uint8Array {
    if (!FIXTURE_IMAGE_BYTES) {
        const fixturePath = path.join(process.cwd(), 'test/fixtures/sample-2.jpg');
        FIXTURE_IMAGE_BYTES = new Uint8Array(fs.readFileSync(fixturePath));
    }
    return FIXTURE_IMAGE_BYTES;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FILE CREATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a test file programmatically with an arbitrary filename.
 * This is necessary because filesystem operations can't reliably handle
 * all unicode characters in filenames on all platforms.
 *
 * Uses real image data from test/fixtures/sample-2.jpg to ensure proper
 * thumbnail generation in the file manager (1x1 pixel images don't generate
 * proper thumbnails).
 *
 * The file is stored in `window.__testFile` and can be used with DataTransfer API.
 *
 * @param page - Playwright page
 * @param filename - The filename to use (can contain any unicode characters)
 * @param mimeType - Optional MIME type (defaults to image/jpeg since we use a JPG fixture)
 */
export async function createTestFileWithName(page: Page, filename: string, mimeType?: string): Promise<void> {
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const detectedMime = mimeType || (ext === 'png' ? 'image/png' : 'image/jpeg');

    // Get real image bytes from fixture
    const imageBytes = getFixtureImageBytes();

    // Convert Uint8Array to regular array for serialization to browser context
    const bytesArray = Array.from(imageBytes);

    await page.evaluate(
        ({ fname, mime, bytes }) => {
            const array = new Uint8Array(bytes);
            const blob = new Blob([array], { type: mime });
            (window as any).__testFile = new File([blob], fname, { type: mime });
        },
        { fname: filename, mime: detectedMime, bytes: bytesArray },
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FILENAME PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Common test filename patterns organized by category.
 * Use these for comprehensive testing of special character handling.
 */
export const TEST_FILENAME_PATTERNS = {
    spanish: ['archivo_espanol.jpg', 'cafe_nono.jpg'],
    chinese: ['中文文件.jpg'],
    japanese: ['日本語ファイル.jpg'],
    korean: ['한국어파일.jpg'],
    emoji: ['party.jpg', 'folder.jpg'], // Simplified - emojis often cause issues
    spaces: ['file with spaces.jpg', 'multiple   spaces.jpg'],
    symbols: ['file_at_domain.jpg', 'price_100.jpg', '50_discount.jpg'],
    quotes: ['file_apostrophe.jpg', 'file_quotes.jpg'],
    dots: ['multiple.dots.file.jpg'],
    diacritics: ['tschuss.jpg', 'naive.jpg', 'resume.jpg'],
    cyrillic: ['privet.jpg'],
    arabic: ['marhaba.jpg'],
    mixed: ['Test_日本語_file.jpg', 'archivo_中文.jpg'],
};

/**
 * Get a unique test filename for a pattern to avoid collisions.
 *
 * @param baseName - Base filename
 * @returns Unique filename with timestamp
 */
export function getUniqueTestFilename(baseName: string): string {
    const ext = baseName.split('.').pop() || 'jpg';
    const name = baseName.replace(/\.[^.]+$/, '');
    return `${name}_${Date.now()}.${ext}`;
}

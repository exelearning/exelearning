/**
 * Canonical ID generator for navigation entities (pages, blocks, iDevices).
 *
 * Format: `<prefix>-<base36 timestamp>-<base36 random>` (e.g. `page-mp0fppw7-8djmx3rm8`).
 * Single source of truth — see issue exelearning/exelearning#1782.
 *
 * NOTE: do NOT use this for project/session IDs (use src/utils/id-generator.util.ts)
 * or SCORM/manifest IDs (use src/shared/export/exporters/BaseExporter.generateId).
 *
 * Browser mirrors of this function live in:
 *   - public/app/yjs/YjsStructureBinding.js
 *   - public/app/yjs/ComponentImporter.js
 *   - public/app/yjs/YjsProjectManagerMixin.js (as `generateCanonicalId`)
 * Keep them byte-equivalent until those files can import this module directly.
 *
 * @param prefix Non-empty prefix tag (e.g. `'page'`, `'block'`, `'idevice'`).
 * @returns Unique string ID combining a base36 timestamp and a 9-char random suffix.
 * @throws {Error} When `prefix` is empty.
 */
export function generateId(prefix: string): string {
    if (!prefix) {
        throw new Error('generateId: prefix is required');
    }
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    return `${prefix}-${timestamp}-${random}`;
}

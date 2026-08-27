/**
 * Tests for the mod_exelearning serving model helper
 * (test/e2e/playwright/helpers/moodle-serving-model.ts).
 *
 * The helper itself lives with the Playwright specs that drive it, but everything it
 * does to bytes — resolving the plugin's runtime pair, rewriting the served HTML the
 * way the plugin's injector does — is plain Node code, so it is pinned here under
 * `bun test` where CI runs it on every push.
 */
import { describe, it, expect, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
    PLUGIN_RUNTIME_FILES,
    PLUGIN_SCORM_ASSETS_ENV,
    resolvePluginScormAssets,
} from '../e2e/playwright/helpers/moodle-serving-model';

describe('moodle-serving-model', () => {
    const tempDirs: string[] = [];

    function makeAssetsDir(files: readonly string[]): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-scorm-assets-'));
        tempDirs.push(dir);
        for (const name of files) {
            fs.writeFileSync(path.join(dir, name), `// ${name}\n`);
        }
        return dir;
    }

    afterEach(() => {
        for (const dir of tempDirs.splice(0)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    describe('resolvePluginScormAssets', () => {
        it('names the environment variable when no directory is configured', () => {
            expect(() => resolvePluginScormAssets(undefined)).toThrow(PLUGIN_SCORM_ASSETS_ENV);
            expect(() => resolvePluginScormAssets('')).toThrow(PLUGIN_SCORM_ASSETS_ENV);
        });

        it('names the missing runtime file when the directory is incomplete', () => {
            const dir = makeAssetsDir(['SCORM_API_wrapper.js']);
            expect(() => resolvePluginScormAssets(dir)).toThrow(path.join(dir, 'SCOFunctions.js'));
        });

        it('returns the directory when both runtime files are present', () => {
            const dir = makeAssetsDir(PLUGIN_RUNTIME_FILES);
            expect(resolvePluginScormAssets(dir)).toBe(dir);
        });
    });
});

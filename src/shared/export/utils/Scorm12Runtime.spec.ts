import { describe, expect, it } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { createHash } from 'crypto';
import {
    SCORM12_VENDOR_WRAPPER_PATH,
    SCORM12_RUNTIME_LAYER_PATHS,
    SCORM12_RUNTIME_SOURCE_PATHS,
    buildScorm12RuntimeFiles,
    resolveScorm12RuntimeVersion,
    SCORM12_RUNTIME_VERSION_TAG,
} from './Scorm12Runtime';

/**
 * SHA-256 of the vendored upstream pipwerks wrapper, as recorded in
 * THIRD-PARTY-NOTICES.md (pipwerks/scorm-api-wrapper @ 82e455b4032e,
 * src/JavaScript/SCORM_API_wrapper.js, v1.1.20180906). The file must never
 * be edited locally.
 */
const VENDORED_PIPWERKS_SHA256 = 'f2a558ba284edbc6842edf51678df1f7e3e05cbf09ec00bc6dd5988b6caa2e78';

const SCORM_DIR = path.join(process.cwd(), 'public', 'app', 'common', 'scorm');

function syntheticSources(): Map<string, Uint8Array> {
    const sources = new Map<string, Uint8Array>();
    for (const sourcePath of SCORM12_RUNTIME_SOURCE_PATHS) {
        sources.set(sourcePath, new TextEncoder().encode(`/* ${sourcePath} */`));
    }
    return sources;
}

describe('Scorm12Runtime', () => {
    describe('version stamp', () => {
        it('records the eXeLearning version that produced the runtime', () => {
            const files = buildScorm12RuntimeFiles(syntheticSources(), '4.1.0');
            const text = String(files.get('SCOFunctions.js'));

            expect(text).toContain(`${SCORM12_RUNTIME_VERSION_TAG}: 4.1.0`);
            expect(text).toContain('ns.runtimeVersion = "4.1.0"');
        });

        it('says so explicitly when the caller has no version, rather than omitting it', () => {
            // A consumer must be able to tell "this runtime is not stamped" from "this
            // runtime predates stamping"; a missing line looks like the second.
            const text = String(buildScorm12RuntimeFiles(syntheticSources()).get('SCOFunctions.js'));

            expect(text).toContain(`${SCORM12_RUNTIME_VERSION_TAG}: unknown`);
            expect(text).toContain('ns.runtimeVersion = "unknown"');
        });

        it('treats a blank version as no version', () => {
            const text = String(buildScorm12RuntimeFiles(syntheticSources(), '   ').get('SCOFunctions.js'));

            expect(text).toContain(`${SCORM12_RUNTIME_VERSION_TAG}: unknown`);
        });

        it('falls back to the version the running application publishes', () => {
            // The browser has no caller that knows the release: the exporter runs inside
            // the application, which already publishes its own version. Without this the
            // package a user exports from the editor is stamped "unknown", which is the
            // one place the stamp needed to work.
            const scope = globalThis as { eXeLearning?: { version?: string } };
            const previous = scope.eXeLearning;
            scope.eXeLearning = { version: '4.2.0' };
            try {
                const text = String(buildScorm12RuntimeFiles(syntheticSources()).get('SCOFunctions.js'));

                expect(text).toContain(`${SCORM12_RUNTIME_VERSION_TAG}: 4.2.0`);
                expect(text).toContain('ns.runtimeVersion = "4.2.0"');
            } finally {
                if (previous === undefined) {
                    delete scope.eXeLearning;
                } else {
                    scope.eXeLearning = previous;
                }
            }
        });

        it('prefers what the caller passed over what the application publishes', () => {
            const scope = globalThis as { eXeLearning?: { version?: string } };
            const previous = scope.eXeLearning;
            scope.eXeLearning = { version: '4.2.0' };
            try {
                expect(resolveScorm12RuntimeVersion('4.1.0')).toBe('4.1.0');
            } finally {
                if (previous === undefined) {
                    delete scope.eXeLearning;
                } else {
                    scope.eXeLearning = previous;
                }
            }
        });

        it('ignores an application version that is blank or not a string', () => {
            const scope = globalThis as { eXeLearning?: { version?: unknown } };
            const previous = scope.eXeLearning;
            try {
                scope.eXeLearning = { version: '   ' };
                expect(resolveScorm12RuntimeVersion()).toBe('unknown');

                scope.eXeLearning = { version: 42 };
                expect(resolveScorm12RuntimeVersion()).toBe('unknown');

                scope.eXeLearning = {};
                expect(resolveScorm12RuntimeVersion()).toBe('unknown');
            } finally {
                if (previous === undefined) {
                    delete (scope as { eXeLearning?: unknown }).eXeLearning;
                } else {
                    scope.eXeLearning = previous;
                }
            }
        });

        it('puts the stamp after the layers, so it cannot be shadowed by one of them', () => {
            const text = String(buildScorm12RuntimeFiles(syntheticSources(), '4.1.0').get('SCOFunctions.js'));

            expect(text.indexOf('/* ==== runtime-version ==== */')).toBeGreaterThan(
                text.indexOf('/* ==== exe-scorm12-adapter.js ==== */'),
            );
        });
    });

    describe('buildScorm12RuntimeFiles', () => {
        it('produces exactly the two frozen package filenames', () => {
            const files = buildScorm12RuntimeFiles(syntheticSources());

            expect(Array.from(files.keys())).toEqual(['SCORM_API_wrapper.js', 'SCOFunctions.js']);
        });

        it('passes the vendored wrapper through untouched (byte-identical)', () => {
            const sources = syntheticSources();
            const wrapperBytes = sources.get(SCORM12_VENDOR_WRAPPER_PATH);

            const files = buildScorm12RuntimeFiles(sources);

            // Same object reference: no re-encoding, no modification.
            expect(files.get('SCORM_API_wrapper.js')).toBe(wrapperBytes);
        });

        it('concatenates the runtime layers in load order with an AGPL banner', () => {
            const files = buildScorm12RuntimeFiles(syntheticSources());

            const scoFunctions = files.get('SCOFunctions.js') as string;
            expect(scoFunctions).toContain('SPDX-License-Identifier: AGPL-3.0-or-later');
            let previousIndex = -1;
            for (const layerPath of SCORM12_RUNTIME_LAYER_PATHS) {
                const layerName = layerPath.split('/').pop() as string;
                const index = scoFunctions.indexOf(`/* ==== ${layerName} ==== */`);
                expect(index).toBeGreaterThan(previousIndex);
                previousIndex = index;
            }
        });

        it('throws naming every missing source file', () => {
            const sources = syntheticSources();
            sources.delete(SCORM12_VENDOR_WRAPPER_PATH);
            sources.delete('scorm12/exe-scorm12-adapter.js');

            expect(() => buildScorm12RuntimeFiles(sources)).toThrow(
                /scorm12\/vendor\/pipwerks\/SCORM_API_wrapper\.js.*scorm12\/exe-scorm12-adapter\.js/,
            );
        });

        it('throws on an empty source map', () => {
            expect(() => buildScorm12RuntimeFiles(new Map())).toThrow('SCORM 1.2 runtime files are missing');
        });
    });

    describe('repository source files (integration)', () => {
        it('every runtime source file exists on disk', async () => {
            for (const sourcePath of SCORM12_RUNTIME_SOURCE_PATHS) {
                const fullPath = path.join(SCORM_DIR, ...sourcePath.split('/'));
                expect(await fs.pathExists(fullPath)).toBe(true);
            }
        });

        it('the vendored pipwerks wrapper matches the recorded upstream hash', async () => {
            const fullPath = path.join(SCORM_DIR, ...SCORM12_VENDOR_WRAPPER_PATH.split('/'));
            const content = await fs.readFile(fullPath);

            const hash = createHash('sha256').update(content).digest('hex');
            expect(hash).toBe(VENDORED_PIPWERKS_SHA256);
        });

        it('the vendored wrapper keeps its MIT license header', async () => {
            const fullPath = path.join(SCORM_DIR, ...SCORM12_VENDOR_WRAPPER_PATH.split('/'));
            const content = await fs.readFile(fullPath, 'utf8');

            expect(content).toContain('pipwerks SCORM Wrapper for JavaScript');
            expect(content).toContain('MIT-style license');
        });

        it('assembles the real files into a runtime with the full legacy contract', async () => {
            const sources = new Map<string, Uint8Array>();
            for (const sourcePath of SCORM12_RUNTIME_SOURCE_PATHS) {
                const fullPath = path.join(SCORM_DIR, ...sourcePath.split('/'));
                sources.set(sourcePath, await fs.readFile(fullPath));
            }

            const files = buildScorm12RuntimeFiles(sources);
            const scoFunctions = files.get('SCOFunctions.js') as string;

            // The globals every exported SCORM 1.2 page may call
            // (doc/development/scorm12-runtime-contract.md).
            for (const globalName of [
                'loadPage',
                'unloadPage',
                'doQuit',
                'doBack',
                'doContinue',
                'startTimer',
                'computeTime',
                'goBack',
                'goForward',
                'setComplete',
                'setIncomplete',
                'setScore',
            ]) {
                expect(scoFunctions).toContain(`global.${globalName}`);
            }
            expect(scoFunctions).toContain('global.scorm = facade');
            // No unload/beforeunload reliance in the new runtime.
            expect(scoFunctions).not.toContain("addEventListener('unload'");
            expect(scoFunctions).not.toContain("addEventListener('beforeunload'");
            expect(scoFunctions).toContain("addEventListener('pagehide'");
        });
    });
});

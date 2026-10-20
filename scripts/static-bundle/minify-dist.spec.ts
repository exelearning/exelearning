import { describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { MINIFY_DIRS, MINIFY_FILES, isMinifiableJs, minifyDistJs, minifyJsSource } from './minify-dist';

const projectRoot = path.resolve(import.meta.dir, '../..');

describe('isMinifiableJs', () => {
    it('accepts own-code files in the allowlisted dirs and file list', () => {
        expect(isMinifiableJs('app/yjs/AssetManager.js')).toBe(true);
        expect(isMinifiableJs('app/core/RuntimeConfig.js')).toBe(true);

        expect(isMinifiableJs('app/common/common_edition.js')).toBe(true);
    });

    it('never touches bundles, already-minified files, vendored trees or export-copied libraries', () => {
        expect(isMinifiableJs('app/app.bundle.js')).toBe(false);
        expect(isMinifiableJs('app/yjs/exporters.bundle.js')).toBe(false);
        expect(isMinifiableJs('app/common/exe_tooltips/jquery.qtip.min.js')).toBe(false);
        // vendored trees
        expect(isMinifiableJs('app/common/exe_math/tex-mml-svg.js')).toBe(false);
        expect(isMinifiableJs('app/common/mermaid/mermaid.js')).toBe(false);
        expect(isMinifiableJs('app/common/mindmaps/min/js/script.js')).toBe(false);
        // byte-identity contract (vendored pipwerks SCORM)
        expect(isMinifiableJs('app/common/scorm/SCORM_API_wrapper.js')).toBe(false);
        // export-copied libraries must stay byte-identical between modes
        expect(isMinifiableJs('app/common/common.js')).toBe(false);
        expect(isMinifiableJs('app/common/i18n/common_i18n.es.js')).toBe(false);
        expect(isMinifiableJs('app/common/common_i18n.js')).toBe(false);
        expect(isMinifiableJs('app/common/exe_export.js')).toBe(false);
        expect(isMinifiableJs('app/common/exe_effects/exe_effects.js')).toBe(false);
        // non-js
        expect(isMinifiableJs('app/yjs/README.md')).toBe(false);
    });

    it('the allowlists point at real files (must not go stale)', () => {
        for (const rel of MINIFY_FILES) {
            expect(fs.existsSync(path.join(projectRoot, 'public', rel)), `missing in public/: ${rel}`).toBe(true);
        }
        for (const dir of MINIFY_DIRS) {
            expect(fs.existsSync(path.join(projectRoot, 'public', dir)), `missing in public/: ${dir}`).toBe(true);
        }
    });
});

describe('minifyJsSource', () => {
    it('preserves top-level bindings that classic scripts expose as globals', async () => {
        const source = [
            'class AssetManager {',
            '    constructor() { this.longDescriptiveName = 42; }',
            '}',
            'function helperFunction(value) { return value + 1; }',
            'window.AssetManager = AssetManager;',
            'window.helperFunction = helperFunction;',
        ].join('\n');

        const minified = await minifyJsSource(source);

        expect(minified.length).toBeLessThan(source.length);
        // Top-level names survive (esbuild transform does not rename them),
        // so sibling classic scripts keep seeing the same globals.
        expect(minified).toContain('AssetManager');
        expect(minified).toContain('helperFunction');
        expect(minified).toContain('window.AssetManager');
    });

    it('keeps ES module syntax intact', async () => {
        const source = "import { convertDate } from './app_date_conversion.js';\nexport function fmt(d) { return convertDate(d); }\n";
        const minified = await minifyJsSource(source);
        expect(minified).toContain("import");
        expect(minified).toContain('./app_date_conversion.js');
        expect(minified).toContain('export');
    });

    it('never grows a file', async () => {
        const tiny = 'x=1';
        expect((await minifyJsSource(tiny)).length).toBeLessThanOrEqual(tiny.length);
    });
});

describe('minifyDistJs', () => {
    it('minifies eligible files in place and reports sizes', async () => {
        const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'exe-minify-dist-'));
        try {
            fs.mkdirSync(path.join(dist, 'app/yjs'), { recursive: true });
            fs.mkdirSync(path.join(dist, 'app/common/exe_math'), { recursive: true });
            const own = '// comment\nclass Thing {\n    method() { return 1; }\n}\nwindow.Thing = Thing;\n';
            const vendor = '// vendored\nvar untouched = 1;\n';
            fs.writeFileSync(path.join(dist, 'app/yjs/Thing.js'), own);
            fs.writeFileSync(path.join(dist, 'app/common/exe_math/vendor.js'), vendor);
            for (const rel of MINIFY_FILES) {
                fs.mkdirSync(path.dirname(path.join(dist, rel)), { recursive: true });
                fs.writeFileSync(path.join(dist, rel), 'var a = 1;\n');
            }

            const stats = await minifyDistJs(dist);

            expect(stats.files).toBeGreaterThanOrEqual(1 + MINIFY_FILES.length);
            expect(stats.after).toBeLessThan(stats.before);
            expect(fs.readFileSync(path.join(dist, 'app/yjs/Thing.js'), 'utf-8')).not.toContain('// comment');
            expect(fs.readFileSync(path.join(dist, 'app/common/exe_math/vendor.js'), 'utf-8')).toBe(vendor);
        } finally {
            fs.rmSync(dist, { recursive: true, force: true });
        }
    });

    it('fails loudly when an allowlisted file is missing from the dist', async () => {
        const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'exe-minify-dist-'));
        try {
            await expect(minifyDistJs(dist)).rejects.toThrow(/stale MINIFY_FILES/);
        } finally {
            fs.rmSync(dist, { recursive: true, force: true });
        }
    });
});

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { stripSourceMapReferences, stripSourceMappingUrl } from './strip-source-map-refs';

describe('stripSourceMappingUrl', () => {
    it('removes a JavaScript source map reference', () => {
        expect(stripSourceMappingUrl('console.log("test");\n//# sourceMappingURL=app.min.js.map')).toBe(
            'console.log("test");\n',
        );
    });

    it('removes a CSS source map reference', () => {
        expect(stripSourceMappingUrl('.foo{display:block}\n/*# sourceMappingURL=app.min.css.map */')).toBe(
            '.foo{display:block}\n',
        );
    });

    // Regression guard: `$` without the `m` flag anchors to the absolute end of
    // the string, so an end-anchored matcher misses every file that ends with a
    // newline — which is how most of the vendored bundles are written.
    it('removes a reference when the file ends with a trailing newline', () => {
        expect(stripSourceMappingUrl('console.log("test");\n//# sourceMappingURL=app.min.js.map\n')).not.toContain(
            'sourceMappingURL',
        );
    });

    it('removes a reference written with the legacy //@ syntax', () => {
        expect(stripSourceMappingUrl('console.log("test");\n//@ sourceMappingURL=app.min.js.map')).not.toContain(
            'sourceMappingURL',
        );
    });

    it('removes an inline data-URI source map', () => {
        const inline = '.foo{display:block}\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozfQ== */';
        expect(stripSourceMappingUrl(inline)).not.toContain('sourceMappingURL');
    });

    it('leaves files without a source map reference unchanged', () => {
        const content = 'console.log("test");';
        expect(stripSourceMappingUrl(content)).toBe(content);
    });

    it('leaves an unrelated mention of the word in code untouched', () => {
        const content = 'const key = "sourceMappingURL";\n';
        expect(stripSourceMappingUrl(content)).toBe(content);
    });
});

describe('stripSourceMapReferences', () => {
    let distDir: string;

    beforeEach(() => {
        distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exe-strip-dist-'));
        fs.mkdirSync(path.join(distDir, 'libs'));
        fs.writeFileSync(path.join(distDir, 'libs', 'a.min.js'), 'a();\n//# sourceMappingURL=a.min.js.map\n');
        fs.writeFileSync(path.join(distDir, 'libs', 'a.min.css'), '.a{}\n/*# sourceMappingURL=a.min.css.map */');
        fs.writeFileSync(path.join(distDir, 'libs', 'clean.js'), 'b();\n');
        fs.writeFileSync(path.join(distDir, 'notes.md'), '//# sourceMappingURL=ignored.map\n');
    });

    afterEach(() => {
        fs.rmSync(distDir, { recursive: true, force: true });
    });

    it('strips references from every js/css file it finds, recursively', () => {
        const stats = stripSourceMapReferences(distDir);

        expect(stats.files).toBe(2);
        expect(stats.bytes).toBeGreaterThan(0);
        expect(fs.readFileSync(path.join(distDir, 'libs', 'a.min.js'), 'utf-8')).not.toContain('sourceMappingURL');
        expect(fs.readFileSync(path.join(distDir, 'libs', 'a.min.css'), 'utf-8')).not.toContain('sourceMappingURL');
    });

    it('leaves non-rewritable file types alone', () => {
        stripSourceMapReferences(distDir);

        expect(fs.readFileSync(path.join(distDir, 'notes.md'), 'utf-8')).toContain('sourceMappingURL');
    });

    it('does not rewrite files that carry no reference', () => {
        const before = fs.statSync(path.join(distDir, 'libs', 'clean.js')).mtimeMs;
        stripSourceMapReferences(distDir);

        expect(fs.statSync(path.join(distDir, 'libs', 'clean.js')).mtimeMs).toBe(before);
    });

    it('no-ops on a missing directory', () => {
        expect(stripSourceMapReferences(path.join(distDir, 'absent'))).toEqual({ files: 0, bytes: 0 });
    });
});

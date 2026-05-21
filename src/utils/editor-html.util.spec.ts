import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { rewriteCodemagicAssetPaths } from './editor-html.util';

// Minimal slice of codemagic.html: the document-relative tags the handler rewrites.
const SAMPLE_HTML = [
    '<link rel="stylesheet" href="includes/codemagic.css" />',
    '<link rel="stylesheet" href="includes/codemirror/codemirror.css" />',
    '<script type="text/javascript" src="includes/codemirror/codemirror.js"></script>',
    '<script type="text/javascript" src="includes/codemagic.js"></script>',
    '<img src="images/icons/undo.png" alt="Undo" />',
].join('\n');

describe('rewriteCodemagicAssetPaths', () => {
    let originalBasePath: string | undefined;

    beforeAll(() => {
        originalBasePath = process.env.BASE_PATH;
    });

    afterAll(() => {
        if (originalBasePath !== undefined) {
            process.env.BASE_PATH = originalBasePath;
        } else {
            delete process.env.BASE_PATH;
        }
    });

    beforeEach(() => {
        delete process.env.BASE_PATH;
    });

    afterEach(() => {
        delete process.env.BASE_PATH;
    });

    describe('with BASE_PATH set (subdirectory deploy behind a reverse proxy)', () => {
        const BASE = '/aplicaciones/medusa/exelearning';

        beforeEach(() => {
            process.env.BASE_PATH = BASE;
        });

        it('prefixes includes/ asset paths with BASE_PATH', () => {
            const out = rewriteCodemagicAssetPaths(SAMPLE_HTML);
            expect(out).toContain(`href="${BASE}/api/codemagic-editor/includes/codemagic.css"`);
            expect(out).toContain(`href="${BASE}/api/codemagic-editor/includes/codemirror/codemirror.css"`);
            expect(out).toContain(`src="${BASE}/api/codemagic-editor/includes/codemirror/codemirror.js"`);
            expect(out).toContain(`src="${BASE}/api/codemagic-editor/includes/codemagic.js"`);
        });

        it('prefixes images/ asset paths with BASE_PATH', () => {
            const out = rewriteCodemagicAssetPaths(SAMPLE_HTML);
            expect(out).toContain(`src="${BASE}/api/codemagic-editor/images/icons/undo.png"`);
        });

        it('never emits a bare-absolute /api/codemagic-editor path', () => {
            const out = rewriteCodemagicAssetPaths(SAMPLE_HTML);
            expect(out).not.toMatch(/(?:src|href)="\/api\/codemagic-editor\//);
        });
    });

    describe('without BASE_PATH (flat dev / root deploy)', () => {
        it('rewrites to bare-absolute paths (back-compat)', () => {
            const out = rewriteCodemagicAssetPaths(SAMPLE_HTML);
            expect(out).toContain('href="/api/codemagic-editor/includes/codemagic.css"');
            expect(out).toContain('src="/api/codemagic-editor/includes/codemagic.js"');
            expect(out).toContain('src="/api/codemagic-editor/images/icons/undo.png"');
        });

        it('leaves no unresolved document-relative includes/ or images/ references', () => {
            const out = rewriteCodemagicAssetPaths(SAMPLE_HTML);
            expect(out).not.toMatch(/(?:src|href)="includes\//);
            expect(out).not.toMatch(/src="images\//);
        });
    });
});

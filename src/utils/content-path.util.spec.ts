import { describe, expect, it } from 'bun:test';
import { contentTypeFor, normalizeContentPath } from './content-path.util';

describe('normalizeContentPath', () => {
    it('maps the empty path and bare slashes to index.html', () => {
        expect(normalizeContentPath('')).toBe('index.html');
        expect(normalizeContentPath('/')).toBe('index.html');
        expect(normalizeContentPath('///')).toBe('index.html');
    });

    it('strips query strings and fragments before resolving', () => {
        expect(normalizeContentPath('index.html?exe-teacher=1')).toBe('index.html');
        expect(normalizeContentPath('html/page.html#section')).toBe('html/page.html');
        expect(normalizeContentPath('a.css?v=1#x')).toBe('a.css');
    });

    it('strips leading slashes and normalizes interior dot segments', () => {
        expect(normalizeContentPath('/theme/style.css')).toBe('theme/style.css');
        expect(normalizeContentPath('a/b/../c.html')).toBe('a/c.html');
        expect(normalizeContentPath('./index.html')).toBe('index.html');
    });

    it('rejects traversal that escapes the root', () => {
        expect(normalizeContentPath('..')).toBeNull();
        expect(normalizeContentPath('../secret')).toBeNull();
        expect(normalizeContentPath('a/../../secret')).toBeNull();
        expect(normalizeContentPath('a/b/../../../etc/passwd')).toBeNull();
    });

    it('rejects encoded traversal and malformed encodings', () => {
        expect(normalizeContentPath('%2e%2e%2fsecret')).toBeNull();
        expect(normalizeContentPath('a%2f..%2f..%2fsecret')).toBeNull();
        expect(normalizeContentPath('%ZZ')).toBeNull();
    });

    it('rejects NUL bytes and absolute paths', () => {
        expect(normalizeContentPath('a\0b')).toBeNull();
        expect(normalizeContentPath('%00')).toBeNull();
        // Leading slashes are stripped as web-root-relative, so only a path that
        // remains absolute after normalization is rejected.
        expect(normalizeContentPath('..%2fsecret')).toBeNull();
    });

    it('decodes percent-encoded segments that stay inside the root', () => {
        expect(normalizeContentPath('content/resources/my%20file.png')).toBe('content/resources/my file.png');
    });
});

describe('contentTypeFor', () => {
    it('returns charset-tagged types for textual content', () => {
        expect(contentTypeFor('index.html')).toBe('text/html; charset=utf-8');
        expect(contentTypeFor('theme/style.css')).toBe('text/css; charset=utf-8');
        expect(contentTypeFor('libs/app.js')).toBe('application/javascript; charset=utf-8');
        expect(contentTypeFor('libs/app.mjs')).toBe('application/javascript; charset=utf-8');
        expect(contentTypeFor('data/search_index.json')).toBe('application/json; charset=utf-8');
        expect(contentTypeFor('img/logo.svg')).toBe('image/svg+xml; charset=utf-8');
        expect(contentTypeFor('content/content.xml')).toBe('application/xml; charset=utf-8');
    });

    it('returns bare types for binary content', () => {
        expect(contentTypeFor('img/logo.png')).toBe('image/png');
        expect(contentTypeFor('fonts/font.woff2')).toBe('font/woff2');
        expect(contentTypeFor('media/video.mp4')).toBe('video/mp4');
        expect(contentTypeFor('doc.pdf')).toBe('application/pdf');
    });

    it('is case-insensitive on extensions and defaults to octet-stream', () => {
        expect(contentTypeFor('IMG/LOGO.PNG')).toBe('image/png');
        expect(contentTypeFor('file.unknownext')).toBe('application/octet-stream');
        expect(contentTypeFor('no-extension')).toBe('application/octet-stream');
    });
});

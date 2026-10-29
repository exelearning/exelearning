import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const os = require('os');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveZipEntryPath, extractZipEntries } = require('./zip-extract');

const bytes = (s: string) => new TextEncoder().encode(s);

describe('zip-extract', () => {
    describe('resolveZipEntryPath', () => {
        it('resolves normal entries inside the destination', () => {
            expect(resolveZipEntryPath('/out', 'index.html')).toBe(path.resolve('/out', 'index.html'));
            expect(resolveZipEntryPath('/out', 'content/css/base.css')).toBe(
                path.resolve('/out', 'content/css/base.css'),
            );
            expect(resolveZipEntryPath('/out', 'libs/')).toBe(path.resolve('/out', 'libs'));
        });

        it('allows names that merely contain dots', () => {
            expect(resolveZipEntryPath('/out', 'a..b/file..txt')).toBe(path.resolve('/out', 'a..b/file..txt'));
        });

        it('rejects parent-directory traversal', () => {
            expect(() => resolveZipEntryPath('/out', '../evil.txt')).toThrow(/Unsafe ZIP entry/);
            expect(() => resolveZipEntryPath('/out', 'a/../../evil.txt')).toThrow(/Unsafe ZIP entry/);
        });

        it('rejects backslash traversal on every platform', () => {
            expect(() => resolveZipEntryPath('/out', '..\\evil.txt')).toThrow(/Unsafe ZIP entry/);
        });

        it('rejects absolute entry names', () => {
            expect(() => resolveZipEntryPath('/out', '/etc/evil')).toThrow(/Unsafe ZIP entry/);
        });

        it('rejects entries resolving to the destination itself and NUL bytes', () => {
            expect(() => resolveZipEntryPath('/out', 'a/..')).toThrow(/Unsafe ZIP entry/);
            expect(() => resolveZipEntryPath('/out', 'a\0b')).toThrow(/Unsafe ZIP entry/);
        });

        it('rejects Windows drive-letter and UNC names', () => {
            const win = path.win32;
            expect(resolveZipEntryPath('D:\\out', 'content/a.css', win)).toBe('D:\\out\\content\\a.css');
            expect(() => resolveZipEntryPath('D:\\out', 'C:/Windows/evil.dll', win)).toThrow(/Unsafe ZIP entry/);
            expect(() => resolveZipEntryPath('D:\\out', 'C:evil.dll', win)).toThrow(/Unsafe ZIP entry/);
            expect(() => resolveZipEntryPath('D:\\out', '\\\\host\\share\\evil', win)).toThrow(/Unsafe ZIP entry/);
            expect(() => resolveZipEntryPath('D:\\out', '..\\evil.dll', win)).toThrow(/Unsafe ZIP entry/);
        });
    });

    describe('extractZipEntries', () => {
        let root: string;
        let dest: string;

        beforeEach(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'exe-zip-extract-'));
            dest = path.join(root, 'dest');
            fs.mkdirSync(dest);
        });

        afterEach(() => {
            fs.rmSync(root, { recursive: true, force: true });
        });

        it('writes files and directories inside the destination', () => {
            extractZipEntries(
                { 'index.html': bytes('<html>'), 'libs/': new Uint8Array(), 'content/css/base.css': bytes('a{}') },
                dest,
            );
            expect(fs.readFileSync(path.join(dest, 'index.html'), 'utf8')).toBe('<html>');
            expect(fs.statSync(path.join(dest, 'libs')).isDirectory()).toBe(true);
            expect(fs.readFileSync(path.join(dest, 'content/css/base.css'), 'utf8')).toBe('a{}');
        });

        it('overwrites existing files', () => {
            fs.writeFileSync(path.join(dest, 'index.html'), 'old');
            extractZipEntries({ 'index.html': bytes('new') }, dest);
            expect(fs.readFileSync(path.join(dest, 'index.html'), 'utf8')).toBe('new');
        });

        it('writes nothing when any entry escapes the destination', () => {
            expect(() =>
                extractZipEntries({ 'index.html': bytes('ok'), '../escaped.txt': bytes('evil') }, dest),
            ).toThrow(/Unsafe ZIP entry/);
            expect(fs.existsSync(path.join(root, 'escaped.txt'))).toBe(false);
            expect(fs.existsSync(path.join(dest, 'index.html'))).toBe(false);
        });
    });
});

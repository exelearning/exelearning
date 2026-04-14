import { describe, expect, it } from 'bun:test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
    getExt,
    ensureExt,
    proposeSavePath,
    getDialogFilterForExt,
    resolveEffectiveSaveName,
    splitSavePath,
    DEFAULT_EXTENSION,
} = require('./save-utils');

describe('save-utils', () => {
    describe('getExt', () => {
        it('returns lowercase extension for a simple name', () => {
            expect(getExt('project.ELPX')).toBe('.elpx');
        });

        it('returns lowercase extension for a full path', () => {
            expect(getExt('/tmp/nested/dir/file.Zip')).toBe('.zip');
        });

        it('returns null when there is no extension', () => {
            expect(getExt('noextension')).toBeNull();
        });

        it('returns null for nullish input', () => {
            expect(getExt(null)).toBeNull();
            expect(getExt(undefined)).toBeNull();
            expect(getExt('')).toBeNull();
        });
    });

    describe('ensureExt', () => {
        it('returns the path unchanged if it already has an extension', () => {
            expect(ensureExt('/a/b/file.elpx', 'fallback.zip')).toBe('/a/b/file.elpx');
        });

        it('appends inferred extension from the suggested name when missing', () => {
            expect(ensureExt('/a/b/file', 'saved.zip')).toBe('/a/b/file.zip');
        });

        it('returns the path unchanged when both the path and the suggested name lack an extension', () => {
            expect(ensureExt('/a/b/file', 'also-no-ext')).toBe('/a/b/file');
        });

        it('returns nullish input untouched', () => {
            expect(ensureExt('', 'x.elpx')).toBe('');
            expect(ensureExt(null as unknown as string, 'x.elpx')).toBeNull();
        });
    });

    describe('getDialogFilterForExt', () => {
        it('returns a named filter for known extensions', () => {
            expect(getDialogFilterForExt('.elpx')).toEqual({ name: 'eXeLearning project', extensions: ['elpx'] });
            expect(getDialogFilterForExt('.zip')).toEqual({ name: 'ZIP archive', extensions: ['zip'] });
            expect(getDialogFilterForExt('.epub')).toEqual({ name: 'EPUB', extensions: ['epub'] });
            expect(getDialogFilterForExt('.xml')).toEqual({ name: 'XML document', extensions: ['xml'] });
            expect(getDialogFilterForExt('.csv')).toEqual({ name: 'CSV file', extensions: ['csv'] });
            expect(getDialogFilterForExt('.idevice')).toEqual({ name: 'eXeLearning iDevice', extensions: ['idevice'] });
            expect(getDialogFilterForExt('.block')).toEqual({ name: 'eXeLearning block', extensions: ['block'] });
        });

        it('falls back to a generic filter for unknown but non-empty extensions', () => {
            expect(getDialogFilterForExt('.foo')).toEqual({ name: 'FOO file', extensions: ['foo'] });
        });

        it('returns null when the extension is empty or nullish', () => {
            expect(getDialogFilterForExt('')).toBeNull();
            expect(getDialogFilterForExt(null)).toBeNull();
            expect(getDialogFilterForExt(undefined)).toBeNull();
        });
    });

    describe('proposeSavePath', () => {
        it('joins a provided directory with an effective name keeping its extension', () => {
            expect(proposeSavePath('/tmp/dir', 'course.elpx')).toBe('/tmp/dir/course.elpx');
        });

        it('defaults the extension to .elpx when the effective name has none', () => {
            expect(proposeSavePath('/tmp/dir', 'untitled')).toBe(`/tmp/dir/untitled${DEFAULT_EXTENSION}`);
        });

        it('falls back to "document" when there is no effective name', () => {
            expect(proposeSavePath('/tmp/dir', null)).toBe(`/tmp/dir/document${DEFAULT_EXTENSION}`);
        });

        it('falls back to effective name when an unexpected error occurs', () => {
            // Forces the internal try/catch by passing a bad type.
            const result = proposeSavePath({} as unknown as string, 'broken.elpx');
            expect(typeof result).toBe('string');
            expect(result.endsWith('broken.elpx')).toBe(true);
        });
    });

    describe('resolveEffectiveSaveName — regression #1666', () => {
        it('returns the stored name when the user has already chosen one and the extension matches (beta4 behaviour)', () => {
            // Regression scenario reported in issue #1666: on subsequent saves
            // the dialog must default to the previously chosen file name.
            expect(resolveEffectiveSaveName('fresh-project.elpx', 'user_chose.elpx')).toBe('user_chose.elpx');
        });

        it('returns the suggested name when there is no stored name yet (first save)', () => {
            expect(resolveEffectiveSaveName('fresh-project.elpx', null)).toBe('fresh-project.elpx');
        });

        it('prefers the suggested name when the extension differs (different export target)', () => {
            // Saving the project as .elpx stored "my_course.elpx". Now the user
            // exports the same project as .zip — we must NOT reuse "my_course.elpx".
            expect(resolveEffectiveSaveName('export.zip', 'my_course.elpx')).toBe('export.zip');
        });

        it('returns the stored name when no suggested name is provided', () => {
            expect(resolveEffectiveSaveName(null, 'user_chose.elpx')).toBe('user_chose.elpx');
        });

        it('returns null when both inputs are missing', () => {
            expect(resolveEffectiveSaveName(null, null)).toBeNull();
            expect(resolveEffectiveSaveName(undefined, undefined)).toBeNull();
            expect(resolveEffectiveSaveName('', '')).toBeNull();
        });

        it('treats a suggested name without an extension as compatible with any stored extension', () => {
            // Callers occasionally pass a bare project title — do not throw it away.
            expect(resolveEffectiveSaveName('Course Title', 'user_chose.elpx')).toBe('user_chose.elpx');
        });

        it('is case-insensitive when comparing extensions', () => {
            expect(resolveEffectiveSaveName('fresh.ELPX', 'user_chose.elpx')).toBe('user_chose.elpx');
            expect(resolveEffectiveSaveName('fresh.elpx', 'user_chose.ELPX')).toBe('user_chose.ELPX');
        });
    });

    describe('splitSavePath — regression PR #1670 review', () => {
        it('splits a POSIX path into dir and basename', () => {
            expect(splitSavePath('/home/user/docs/first.elpx')).toEqual({
                dir: '/home/user/docs',
                name: 'first.elpx',
            });
        });

        it('splits a Windows-style path into dir and basename', () => {
            const result = splitSavePath('C:\\Users\\me\\Documents\\second.elpx');
            expect(result).not.toBeNull();
            expect(result.name).toBe('second.elpx');
            // path.dirname behaviour on POSIX treats the full string as one segment,
            // but we still want the basename to survive so the dialog can pre-fill it.
            expect(typeof result.dir).toBe('string');
        });

        it('returns null for nullish / invalid input', () => {
            expect(splitSavePath(null)).toBeNull();
            expect(splitSavePath(undefined)).toBeNull();
            expect(splitSavePath('')).toBeNull();
            expect(splitSavePath(42 as unknown as string)).toBeNull();
        });

        it('handles a bare file name (no directory component)', () => {
            const result = splitSavePath('bare.elpx');
            expect(result).not.toBeNull();
            expect(result.name).toBe('bare.elpx');
        });
    });

    describe('Scenario from PR #1670 review (ignaciogros)', () => {
        // These scenarios exercise the pure name-resolution layer against the
        // three user flows called out in the review:
        //   1. Open a file -> save must pre-fill with that file's name.
        //   2. New project -> save must pre-fill with the project title, not a stale name.
        //   3. Save A then open B -> save must pre-fill B's name, never A's.

        it('(1) opening a file seeds the stored name so the next save pre-fills it', () => {
            const opened = splitSavePath('/docs/my-course.elpx');
            expect(opened).not.toBeNull();
            // Caller persists opened.name; promptSave then resolves with it.
            expect(resolveEffectiveSaveName('Untitled.elpx', opened.name)).toBe('my-course.elpx');
        });

        it('(2) new project clears the stored name so promptSave uses the project title', () => {
            // After "new project", caller must clear storedName; promptSave then
            // falls back to the freshly suggested project-title-based name.
            expect(resolveEffectiveSaveName('Brand New Project.elpx', null)).toBe('Brand New Project.elpx');
        });

        it('(3) opening B after saving A does not leak A.elpx into the dialog', () => {
            // The caller must overwrite the stored name with B's name on open,
            // so the resolver reports B even when "A.elpx" was the last value it saw.
            const openedB = splitSavePath('/docs/B.elpx');
            expect(openedB).not.toBeNull();
            // storedName after opening B is "B.elpx", not "A.elpx".
            expect(resolveEffectiveSaveName('Untitled.elpx', openedB.name)).toBe('B.elpx');
        });
    });
});

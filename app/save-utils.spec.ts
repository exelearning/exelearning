import { describe, expect, it } from 'bun:test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
    getExt,
    ensureExt,
    proposeSavePath,
    getDialogFilterForExt,
    resolveEffectiveSaveName,
    splitSavePath,
    pickStoredSaveInfo,
    clearSavedNameCache,
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

    describe('pickStoredSaveInfo — regression PR #1670 (2nd review)', () => {
        it('global slot wins over the per-project cache when it has a name', () => {
            // Exact bug reported by @ignaciogros: save A, then open B — the
            // dialog must propose B, even though perKey still contains A.
            const perKey = { dir: '/docs', name: 'A.elpx' };
            const globalInfo = { dir: '/elsewhere', name: 'B.elpx' };
            expect(pickStoredSaveInfo(perKey, globalInfo)).toEqual({
                dir: '/elsewhere',
                name: 'B.elpx',
            });
        });

        it('falls back to perKey when the global slot is empty', () => {
            // Repeated saves of the same project must still prefill the
            // previously chosen name when nothing else touched the global slot.
            const perKey = { dir: '/docs', name: 'A.elpx' };
            const globalInfo = { dir: null, name: null };
            expect(pickStoredSaveInfo(perKey, globalInfo)).toEqual({
                dir: '/docs',
                name: 'A.elpx',
            });
        });

        it('returns nulls when both slots are empty', () => {
            expect(pickStoredSaveInfo({ dir: null, name: null }, { dir: null, name: null })).toEqual({
                dir: null,
                name: null,
            });
            expect(pickStoredSaveInfo(null, null)).toEqual({ dir: null, name: null });
            expect(pickStoredSaveInfo(undefined, undefined)).toEqual({ dir: null, name: null });
        });

        it('mixes dir and name from the two slots when only one side is populated', () => {
            // setSavedPath only seeds the global slot; the per-project cache
            // may still hold the directory from a previous save. That's fine
            // — we prefer the global name (fresh) and keep the per-key dir
            // only when the global slot has none.
            expect(pickStoredSaveInfo({ dir: '/docs', name: 'A.elpx' }, { dir: null, name: 'B.elpx' })).toEqual({
                dir: '/docs',
                name: 'B.elpx',
            });
        });
    });

    describe('clearSavedNameCache — regression PR #1670 (2nd review)', () => {
        it('wipes the per-project name map in place', () => {
            const settings = {
                lastSaveDir: { 'uuid-a': '/docs', 'uuid-b': '/elsewhere' },
                lastSaveName: { 'uuid-a': 'A.elpx', 'uuid-b': 'B.elpx' },
                currentFileSave: { dir: '/docs', name: 'A.elpx' },
            };
            const ret = clearSavedNameCache(settings);
            expect(ret).toBe(settings); // mutates in place
            expect(settings.lastSaveName).toEqual({});
            // Must NOT touch the directory cache — we still want to remember
            // where the user last saved things.
            expect(settings.lastSaveDir).toEqual({ 'uuid-a': '/docs', 'uuid-b': '/elsewhere' });
            // Must NOT remove the global slot on its own — that's the
            // caller's responsibility (clearCurrentFileSaveInfo does both).
            expect(settings.currentFileSave).toEqual({ dir: '/docs', name: 'A.elpx' });
        });

        it('is a no-op when there is no per-project name cache to clear', () => {
            const settings = { lastSaveDir: { a: '/x' } } as Record<string, unknown>;
            expect(() => clearSavedNameCache(settings)).not.toThrow();
            expect(settings.lastSaveName).toBeUndefined();
        });

        it('tolerates nullish input', () => {
            expect(() => clearSavedNameCache(null)).not.toThrow();
            expect(() => clearSavedNameCache(undefined)).not.toThrow();
        });
    });

    describe('Scenario from PR #1670 (2nd review, ignaciogros)', () => {
        // These scenarios simulate the real Electron flow against the pure
        // state helpers, so every assertion maps directly to a click in the
        // desktop app:
        //
        //   save A  →  clicks Save, types A.elpx
        //   save   =  applySave(settings, key, dir, name)   (main.js:save handler)
        //   open B  →  File > Open, picks B.elpx
        //   open   =  applySetCurrentFile(settings, dir, name)  (setSavedPath IPC)
        //   new    →  File > New
        //   new    =  applyClear(settings)                   (clearSavedPath IPC)

        const applySave = (settings: Record<string, unknown>, key: string, dir: string, name: string) => {
            // Mirrors the fixed order in main.js: global slot first (wipes the
            // stale per-key cache), then repopulate the current project's slot.
            clearSavedNameCache(settings);
            (settings as { currentFileSave?: unknown }).currentFileSave = { dir, name };
            const s = settings as {
                lastSaveDir?: Record<string, string>;
                lastSaveName?: Record<string, string>;
            };
            s.lastSaveDir = s.lastSaveDir || {};
            s.lastSaveDir[key] = dir;
            s.lastSaveName = s.lastSaveName || {};
            s.lastSaveName[key] = name;
        };

        const applySetCurrentFile = (settings: Record<string, unknown>, dir: string, name: string) => {
            clearSavedNameCache(settings);
            (settings as { currentFileSave?: unknown }).currentFileSave = { dir, name };
        };

        const applyClear = (settings: Record<string, unknown>) => {
            clearSavedNameCache(settings);
            delete (settings as { currentFileSave?: unknown }).currentFileSave;
        };

        const readStored = (settings: Record<string, unknown>, key: string) => {
            const s = settings as {
                lastSaveDir?: Record<string, string>;
                lastSaveName?: Record<string, string>;
                currentFileSave?: { dir?: string | null; name?: string | null };
            };
            return pickStoredSaveInfo(
                { dir: s.lastSaveDir?.[key] || null, name: s.lastSaveName?.[key] || null },
                { dir: s.currentFileSave?.dir || null, name: s.currentFileSave?.name || null },
            );
        };

        it('save A → open B → Save dialog pre-fills B.elpx, never A.elpx', () => {
            // The user's exact complaint: "I save a file and then open another
            // one, and it remembers the name of the first saved file, making
            // it easy to overwrite it unintentionally."
            const settings: Record<string, unknown> = {};
            applySave(settings, 'uuid-a', '/docs', 'A.elpx');
            applySetCurrentFile(settings, '/elsewhere', 'B.elpx');
            expect(readStored(settings, 'uuid-a').name).toBe('B.elpx');
            expect(readStored(settings, 'uuid-a').dir).toBe('/elsewhere');
        });

        it('save documento-sin-titulo-1.elpx → File > New → Save dialog does NOT pre-fill that name', () => {
            // Ignacio's latest repro: the fallback key 'default' was leaking
            // the previous file name across `location.reload()`, because
            // clearCurrentFileSaveInfo only cleared the global slot and left
            // `lastSaveName['default']` untouched.
            const settings: Record<string, unknown> = {};
            applySave(settings, 'default', '/docs', 'documento-sin-titulo-1.elpx');
            // File > New. transitionToProject clears, then location.reload()
            // re-enters the app with the same 'default' key (no project id yet).
            applyClear(settings);
            expect(readStored(settings, 'default').name).toBeNull();
        });

        it('save A → File > New → save B → File > New → dialog is empty again (no cross-session leak)', () => {
            // Belt-and-braces: two back-to-back new projects should never
            // resurrect a name from the first one.
            const settings: Record<string, unknown> = {};
            applySave(settings, 'default', '/docs', 'A.elpx');
            applyClear(settings);
            applySave(settings, 'default', '/docs', 'B.elpx');
            applyClear(settings);
            expect(readStored(settings, 'default').name).toBeNull();
        });

        it('save A → save A again uses A.elpx (no regression on the happy path)', () => {
            // The whole point of PR #1670 round 1 was that repeated saves of
            // the same project prefill the chosen name. Make sure the round-2
            // fix doesn't undo that.
            const settings: Record<string, unknown> = {};
            applySave(settings, 'uuid-a', '/docs', 'A.elpx');
            expect(readStored(settings, 'uuid-a').name).toBe('A.elpx');
        });
    });
});

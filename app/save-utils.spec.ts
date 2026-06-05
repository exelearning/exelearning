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
    resolveSaveDir,
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
            const result = proposeSavePath({} as unknown as string, 'broken.elpx');
            expect(typeof result).toBe('string');
            expect(result.endsWith('broken.elpx')).toBe(true);
        });
    });

    describe('resolveEffectiveSaveName', () => {
        it('returns the stored name when extensions match', () => {
            expect(resolveEffectiveSaveName('fresh-project.elpx', 'user_chose.elpx')).toBe('user_chose.elpx');
        });

        it('returns the suggested name when there is no stored name', () => {
            expect(resolveEffectiveSaveName('fresh-project.elpx', null)).toBe('fresh-project.elpx');
        });

        it('prefers the suggested name when extensions differ (cross-format export)', () => {
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

        it('treats an extensionless suggestedName as compatible with any stored extension', () => {
            expect(resolveEffectiveSaveName('Course Title', 'user_chose.elpx')).toBe('user_chose.elpx');
        });

        it('compares extensions case-insensitively', () => {
            expect(resolveEffectiveSaveName('fresh.ELPX', 'user_chose.elpx')).toBe('user_chose.elpx');
            expect(resolveEffectiveSaveName('fresh.elpx', 'user_chose.ELPX')).toBe('user_chose.ELPX');
        });
    });

    describe('splitSavePath', () => {
        it('splits a POSIX path into dir and basename', () => {
            expect(splitSavePath('/home/user/docs/first.elpx')).toEqual({
                dir: '/home/user/docs',
                name: 'first.elpx',
            });
        });

        it('splits a Windows-style path into dir and basename', () => {
            expect(splitSavePath('C:\\Users\\me\\Documents\\second.elpx')).toEqual({
                dir: 'C:/Users/me/Documents',
                name: 'second.elpx',
            });
        });

        it('returns null for nullish / invalid input', () => {
            expect(splitSavePath(null)).toBeNull();
            expect(splitSavePath(undefined)).toBeNull();
            expect(splitSavePath('')).toBeNull();
            expect(splitSavePath(42 as unknown as string)).toBeNull();
        });

        it('handles a bare file name (no directory component)', () => {
            expect(splitSavePath('bare.elpx')).toEqual({ dir: '', name: 'bare.elpx' });
        });
    });

    describe('pickStoredSaveInfo', () => {
        it('prefers the global slot over the per-project cache', () => {
            expect(
                pickStoredSaveInfo(
                    { dir: '/docs', name: 'A.elpx' },
                    { dir: '/elsewhere', name: 'B.elpx' },
                ),
            ).toEqual({ dir: '/elsewhere', name: 'B.elpx' });
        });

        it('falls back to perKey when the global slot is empty', () => {
            expect(
                pickStoredSaveInfo({ dir: '/docs', name: 'A.elpx' }, { dir: null, name: null }),
            ).toEqual({ dir: '/docs', name: 'A.elpx' });
        });

        it('returns nulls when both slots are empty', () => {
            expect(pickStoredSaveInfo({ dir: null, name: null }, { dir: null, name: null })).toEqual({
                dir: null,
                name: null,
            });
            expect(pickStoredSaveInfo(null, null)).toEqual({ dir: null, name: null });
            expect(pickStoredSaveInfo(undefined, undefined)).toEqual({ dir: null, name: null });
        });

        it('mixes dir and name across slots when only one side has each', () => {
            expect(
                pickStoredSaveInfo({ dir: '/docs', name: 'A.elpx' }, { dir: null, name: 'B.elpx' }),
            ).toEqual({ dir: '/docs', name: 'B.elpx' });
        });
    });

    describe('resolveSaveDir', () => {
        it('prefers the global slot directory over the per-project cache', () => {
            expect(
                resolveSaveDir(
                    { dir: '/perKey', name: 'A.elpx' },
                    { dir: '/global', name: 'B.elpx' },
                    '/lastUsed',
                ),
            ).toBe('/global');
        });

        it('falls back to the per-project cache when the global slot has no directory', () => {
            expect(
                resolveSaveDir(
                    { dir: '/perKey', name: 'A.elpx' },
                    { dir: null, name: null },
                    '/lastUsed',
                ),
            ).toBe('/perKey');
        });

        it('falls back to lastUsedDir when neither perKey nor global has a directory', () => {
            expect(
                resolveSaveDir(
                    { dir: null, name: null },
                    { dir: null, name: null },
                    '/Users/me/Desktop',
                ),
            ).toBe('/Users/me/Desktop');
        });

        it('returns null when nothing is known', () => {
            expect(resolveSaveDir(null, null, null)).toBeNull();
        });

        it('ignores empty or non-string lastUsedDir', () => {
            expect(resolveSaveDir(null, null, '')).toBeNull();
            expect(resolveSaveDir(null, null, undefined)).toBeNull();
            expect(resolveSaveDir(null, null, 42 as unknown as string)).toBeNull();
        });

        it('never shadows an explicit per-project or global directory', () => {
            expect(
                resolveSaveDir(
                    { dir: '/Downloads', name: 'A.elpx' },
                    { dir: null, name: null },
                    '/Desktop',
                ),
            ).toBe('/Downloads');
        });
    });

    describe('clearSavedNameCache', () => {
        it('wipes the per-project name map without touching directories or the global slot', () => {
            const settings = {
                lastSaveDir: { 'uuid-a': '/docs', 'uuid-b': '/elsewhere' },
                lastSaveName: { 'uuid-a': 'A.elpx', 'uuid-b': 'B.elpx' },
                currentFileSave: { dir: '/docs', name: 'A.elpx' },
            };
            const ret = clearSavedNameCache(settings);
            expect(ret).toBe(settings);
            expect(settings.lastSaveName).toEqual({});
            expect(settings.lastSaveDir).toEqual({ 'uuid-a': '/docs', 'uuid-b': '/elsewhere' });
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

    // End-to-end simulation of the real Electron save/open/new flow against
    // the pure state helpers. Each applyX() mirrors a specific user gesture:
    //   applySave — Save dialog OK'd with { key, dir, name }
    //   applySetCurrentFile — File > Open (setSavedPath IPC)
    //   applyClear — File > New (clearSavedPath IPC)
    //   applyStartup — app process (re)launches with no argv/open-file
    //                  (same clear as File > New, mirrors the call added
    //                   in app.whenReady for issue #1666 follow-up)
    describe('save/open/new flow', () => {
        const applySave = (
            settings: Record<string, unknown>,
            key: string,
            dir: string,
            name: string,
        ) => {
            clearSavedNameCache(settings);
            (settings as { currentFileSave?: unknown }).currentFileSave = { dir, name };
            const s = settings as {
                lastSaveDir?: Record<string, string>;
                lastSaveName?: Record<string, string>;
                lastUsedDir?: string;
            };
            s.lastSaveDir = s.lastSaveDir || {};
            s.lastSaveDir[key] = dir;
            s.lastSaveName = s.lastSaveName || {};
            s.lastSaveName[key] = name;
            if (dir) s.lastUsedDir = dir;
        };

        const applySetCurrentFile = (settings: Record<string, unknown>, dir: string, name: string) => {
            clearSavedNameCache(settings);
            (settings as { currentFileSave?: unknown }).currentFileSave = { dir, name };
            if (dir) (settings as { lastUsedDir?: string }).lastUsedDir = dir;
        };

        const applyClear = (settings: Record<string, unknown>) => {
            // lastUsedDir must survive File > New — that's what makes folder
            // memory persistent across new projects.
            clearSavedNameCache(settings);
            delete (settings as { currentFileSave?: unknown }).currentFileSave;
        };

        // Mirrors app.whenReady()'s clearCurrentFileSaveInfo() call: on a
        // fresh launch the window has no file associated with it yet, so
        // the window-scoped slot must be wiped. Directory memory stays so
        // the Save dialog still opens at the last folder the user chose.
        const applyStartup = (settings: Record<string, unknown>) => {
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

        const readSaveDir = (settings: Record<string, unknown>, key: string) => {
            const s = settings as {
                lastSaveDir?: Record<string, string>;
                lastSaveName?: Record<string, string>;
                currentFileSave?: { dir?: string | null; name?: string | null };
                lastUsedDir?: string;
            };
            return resolveSaveDir(
                { dir: s.lastSaveDir?.[key] || null, name: s.lastSaveName?.[key] || null },
                { dir: s.currentFileSave?.dir || null, name: s.currentFileSave?.name || null },
                s.lastUsedDir || null,
            );
        };

        it('save A → open B: the Save dialog pre-fills B, never A', () => {
            const settings: Record<string, unknown> = {};
            applySave(settings, 'uuid-a', '/docs', 'A.elpx');
            applySetCurrentFile(settings, '/elsewhere', 'B.elpx');
            expect(readStored(settings, 'uuid-a')).toEqual({ dir: '/elsewhere', name: 'B.elpx' });
        });

        it('save → File > New: the name cache on the fallback "default" key is not leaked after reload', () => {
            const settings: Record<string, unknown> = {};
            applySave(settings, 'default', '/docs', 'documento-sin-titulo-1.elpx');
            applyClear(settings);
            expect(readStored(settings, 'default').name).toBeNull();
        });

        it('save A → New → save B → New: two back-to-back new projects never resurrect A', () => {
            const settings: Record<string, unknown> = {};
            applySave(settings, 'default', '/docs', 'A.elpx');
            applyClear(settings);
            applySave(settings, 'default', '/docs', 'B.elpx');
            applyClear(settings);
            expect(readStored(settings, 'default').name).toBeNull();
        });

        it('save A → save A again keeps pre-filling A (happy path)', () => {
            const settings: Record<string, unknown> = {};
            applySave(settings, 'uuid-a', '/docs', 'A.elpx');
            expect(readStored(settings, 'uuid-a').name).toBe('A.elpx');
        });

        it('save on /Desktop → File > New: Save for a fresh project still defaults to /Desktop', () => {
            const settings: Record<string, unknown> = {};
            applySave(settings, 'uuid-a', '/Users/me/Desktop', 'A.elpx');
            applyClear(settings);
            expect(readSaveDir(settings, 'fresh-uuid')).toBe('/Users/me/Desktop');
        });

        it('open /Desktop/B.elpx then a pathless setSavedPath: lastUsedDir still holds /Desktop', () => {
            // Reproduces the projectManager clobber: the import flow calls
            // setSavedPath(file.name) with only the basename after the
            // Electron file picker already seeded the full path. lastUsedDir
            // preserves the dir so the Save dialog still finds /Desktop.
            const settings: Record<string, unknown> = {};
            applySetCurrentFile(settings, '/Users/me/Desktop', 'B.elpx');
            applySetCurrentFile(settings, '', 'B.elpx');
            expect(readSaveDir(settings, 'fresh-uuid')).toBe('/Users/me/Desktop');
        });

        it('lastUsedDir survives File > New', () => {
            const settings: Record<string, unknown> = { lastUsedDir: '/Users/me/Desktop' };
            applyClear(settings);
            expect((settings as { lastUsedDir?: string }).lastUsedDir).toBe('/Users/me/Desktop');
        });

        it('two saves in different folders: lastUsedDir tracks the most recent one', () => {
            const settings: Record<string, unknown> = {};
            applySave(settings, 'uuid-a', '/Users/me/Desktop', 'A.elpx');
            applySave(settings, 'uuid-b', '/Users/me/Downloads', 'B.elpx');
            applyClear(settings);
            expect(readSaveDir(settings, 'fresh-uuid')).toBe('/Users/me/Downloads');
        });

        // Regression: issue #1666 follow-up. The first fix cleared the slot
        // on File > New / File > Open, but a save → quit → relaunch cycle
        // left the stale filename on disk, so the next Save dialog still
        // pre-filled with "documento-sin-titulo-a.elpx" even after the user
        // renamed the project to "Documento sin título 001".
        it('save → quit → relaunch: the dialog follows the renamed title, not the stale file', () => {
            const settings: Record<string, unknown> = {};
            applySave(settings, 'uuid-a', '/Users/me/Desktop', 'documento-sin-titulo-a.elpx');
            // App quit + fresh relaunch. settings.json is read back, then
            // applyStartup wipes the window-scoped slot and the per-project
            // name cache. The directory memory survives.
            applyStartup(settings);
            // When the user hits Save after renaming, the dialog sees no
            // storedName and falls back to the suggestedName derived from
            // the new title — which is what the user expects.
            const stored = readStored(settings, 'uuid-a');
            expect(stored.name).toBeNull();
            expect(resolveEffectiveSaveName('documento-sin-titulo-001.elpx', stored.name)).toBe(
                'documento-sin-titulo-001.elpx',
            );
            // Folder still remembered so the dialog opens at /Desktop.
            expect(readSaveDir(settings, 'uuid-a')).toBe('/Users/me/Desktop');
        });

        it('save → quit → relaunch without renaming: Save still works (title-derived name), folder preserved', () => {
            const settings: Record<string, unknown> = {};
            applySave(settings, 'uuid-a', '/Users/me/Desktop', 'my-course.elpx');
            applyStartup(settings);
            const stored = readStored(settings, 'uuid-a');
            // Title didn't change, so the suggestedName still sanitises to
            // the same name — the dialog proposes it just like before.
            expect(resolveEffectiveSaveName('my-course.elpx', stored.name)).toBe('my-course.elpx');
            expect(readSaveDir(settings, 'uuid-a')).toBe('/Users/me/Desktop');
        });

        it('relaunch preserves lastUsedDir so a brand-new project still defaults to the last folder', () => {
            const settings: Record<string, unknown> = {};
            applySave(settings, 'uuid-a', '/Users/me/Desktop', 'A.elpx');
            applyStartup(settings);
            // Different UUID (new project created after relaunch): the
            // per-project cache has no entry for it, but lastUsedDir does.
            expect(readSaveDir(settings, 'fresh-uuid-after-restart')).toBe('/Users/me/Desktop');
        });

        it('relaunch with argv file: setSavedPath re-seeds the slot after the startup clear', () => {
            const settings: Record<string, unknown> = {};
            applySave(settings, 'uuid-a', '/Users/me/Desktop', 'A.elpx');
            applyStartup(settings);
            // Simulate the renderer's openFileFromPath → setSavedPath(filePath)
            // after reading the file handed in on argv or 'open-file'.
            applySetCurrentFile(settings, '/Users/me/Desktop', 'A.elpx');
            const stored = readStored(settings, 'uuid-a');
            expect(stored).toEqual({ dir: '/Users/me/Desktop', name: 'A.elpx' });
        });
    });
});

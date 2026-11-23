import { describe, expect, it, mock } from 'bun:test';
import * as os from 'os';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
    MAX_RECENT_FILES,
    addRecentFile,
    describeRecentFiles,
    findRecentFile,
    reopenRecentFile,
} = require('./recent-files');

const root = path.resolve(os.tmpdir(), 'recent-files-spec');
const home = path.join(root, 'home');
const file = (...parts: string[]) => path.join(home, ...parts);

describe('recent-files', () => {
    describe('addRecentFile', () => {
        it('puts the newest file first', () => {
            let list = addRecentFile([], file('a.elpx'), 1);
            list = addRecentFile(list, file('b.elpx'), 2);

            expect(list).toEqual([
                { path: file('b.elpx'), openedAt: 2 },
                { path: file('a.elpx'), openedAt: 1 },
            ]);
        });

        it('moves a file opened again to the top instead of repeating it', () => {
            let list = addRecentFile([], file('a.elpx'), 1);
            list = addRecentFile(list, file('b.elpx'), 2);
            list = addRecentFile(list, file('docs', '..', 'a.elpx'), 3);

            expect(list.map((entry: { path: string }) => entry.path)).toEqual([file('a.elpx'), file('b.elpx')]);
            expect(list[0].openedAt).toBe(3);
        });

        it('keeps only the newest ten', () => {
            let list: unknown[] = [];
            for (let i = 0; i < MAX_RECENT_FILES + 5; i++) list = addRecentFile(list, file(`p${i}.elpx`), i);

            expect(list).toHaveLength(MAX_RECENT_FILES);
            expect((list[0] as { path: string }).path).toBe(file(`p${MAX_RECENT_FILES + 4}.elpx`));
        });

        it('ignores a bare file name, which could not be reopened', () => {
            const list = addRecentFile([], file('a.elpx'), 1);

            expect(addRecentFile(list, 'project.elpx', 2)).toEqual(list);
            expect(addRecentFile(list, undefined, 2)).toEqual(list);
        });

        it('stamps the entry with the current time by default', () => {
            const before = Date.now();
            const [entry] = addRecentFile([], file('a.elpx'));
            expect(entry.openedAt).toBeGreaterThanOrEqual(before);
        });

        it('recovers from a damaged stored list', () => {
            expect(addRecentFile('nonsense', file('a.elpx'), 1)).toHaveLength(1);
            expect(addRecentFile([null, { path: 7 }, { path: 'relative.elpx' }], file('a.elpx'), 1)).toHaveLength(1);
        });
    });

    describe('describeRecentFiles', () => {
        const list = [
            { path: file('Documents', 'water.elpx'), openedAt: 2 },
            { path: path.join(root, 'usb', 'lab.elp'), openedAt: 1 },
        ];

        it('gives the name, a readable folder and an id to open it by', () => {
            const described = describeRecentFiles(list, { exists: () => true, home });

            expect(described).toHaveLength(2);
            expect(described[0]).toEqual({
                id: expect.stringMatching(/^[0-9a-f]{16}$/),
                name: 'water.elpx',
                folder: `~${path.sep}Documents`,
                openedAt: 2,
            });
            expect(described[1].folder).toBe(path.join(root, 'usb'));
        });

        it('shows the home folder itself as ~', () => {
            const [entry] = describeRecentFiles([{ path: file('a.elpx'), openedAt: 1 }], { exists: () => true, home });
            expect(entry.folder).toBe('~');
        });

        it('leaves out files that are no longer there', () => {
            const described = describeRecentFiles(list, { exists: (p: string) => p.endsWith('lab.elp'), home });
            expect(described.map((entry: { name: string }) => entry.name)).toEqual(['lab.elp']);
        });

        it('checks the real disk and home directory by default', () => {
            expect(describeRecentFiles(list)).toEqual([]);
            expect(describeRecentFiles(undefined)).toEqual([]);
        });
    });

    describe('findRecentFile', () => {
        const list = [{ path: file('a.elpx'), openedAt: 1 }];

        it('resolves an id handed out by describeRecentFiles', () => {
            const [{ id }] = describeRecentFiles(list, { exists: () => true, home });
            expect(findRecentFile(list, id)).toBe(file('a.elpx'));
        });

        it('rejects anything that is not such an id, including a path', () => {
            expect(findRecentFile(list, file('a.elpx'))).toBeNull();
            expect(findRecentFile(list, '0000000000000000')).toBeNull();
            expect(findRecentFile(list, '')).toBeNull();
            expect(findRecentFile(list, undefined)).toBeNull();
        });
    });

    describe('reopenRecentFile', () => {
        const list = [{ path: file('a.elpx'), openedAt: 1 }];
        const [{ id }] = describeRecentFiles(list, { exists: () => true, home });

        function fakeWebContents() {
            const listeners: Record<string, () => void> = {};
            return {
                listeners,
                reload: mock(() => {}),
                once: mock((event: string, listener: () => void) => {
                    listeners[event] = listener;
                }),
            };
        }

        function deps(overrides = {}) {
            return {
                list,
                exists: () => true,
                hasUnsavedChanges: mock(async () => false),
                confirmDiscard: mock(async () => true),
                setPending: mock((_filePath: string) => {}),
                ...overrides,
            };
        }

        it('reloads and hands the file only to the document loaded by the reload', async () => {
            const wc = fakeWebContents();
            const d = deps();

            expect(await reopenRecentFile(wc, id, d)).toBe(true);

            expect(wc.reload).toHaveBeenCalledTimes(1);
            // Nothing is pending while the page that asked is still there.
            expect(d.setPending).not.toHaveBeenCalled();
            wc.listeners['did-navigate']();
            expect(d.setPending).toHaveBeenCalledWith(file('a.elpx'));
        });

        it('asks before discarding unsaved changes and stays when the author cancels', async () => {
            const wc = fakeWebContents();
            const d = deps({ hasUnsavedChanges: mock(async () => true), confirmDiscard: mock(async () => false) });

            expect(await reopenRecentFile(wc, id, d)).toBe(false);

            expect(d.confirmDiscard).toHaveBeenCalledTimes(1);
            expect(wc.reload).not.toHaveBeenCalled();
            expect(wc.once).not.toHaveBeenCalled();
        });

        it('reloads when the author chooses to discard the changes', async () => {
            const wc = fakeWebContents();
            const d = deps({ hasUnsavedChanges: mock(async () => true) });

            expect(await reopenRecentFile(wc, id, d)).toBe(true);
            expect(wc.reload).toHaveBeenCalledTimes(1);
        });

        it('does not ask when there is nothing to lose', async () => {
            const d = deps();
            await reopenRecentFile(fakeWebContents(), id, d);
            expect(d.confirmDiscard).not.toHaveBeenCalled();
        });

        it('refuses an unknown id or a file that is gone, before asking anything', async () => {
            const wc = fakeWebContents();
            const d = deps({ exists: () => false });

            expect(await reopenRecentFile(wc, id, d)).toBe(false);
            expect(await reopenRecentFile(wc, file('a.elpx'), deps())).toBe(false);
            expect(d.hasUnsavedChanges).not.toHaveBeenCalled();
            expect(wc.reload).not.toHaveBeenCalled();
        });
    });
});

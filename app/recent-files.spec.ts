import { describe, expect, it } from 'bun:test';
import * as os from 'os';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MAX_RECENT_FILES, addRecentFile, describeRecentFiles, findRecentFile } = require('./recent-files');

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
});

import { createOnlineAdapter, initStartPage } from './startPage.js';

const strings = {
    untitled: 'Untitled',
    ownedByYou: 'Owned by you',
    sharedBy: 'Shared by %s',
    tabRecent: 'Recent',
    tabMine: 'My projects',
    tabShared: 'Shared with me',
    title: 'Create a project or open one to get started',
    newProject: 'New project',
};

const jsonResponse = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });

const project = (odeId, title, updatedAt, role = 'owner', ownerEmail = null) => ({
    odeId,
    title,
    updatedAt,
    role,
    ownerEmail,
});

describe('online start page', () => {
    let fetchImpl;
    let navigate;
    let storeFile;
    let adapter;

    beforeEach(() => {
        fetchImpl = vi.fn();
        navigate = vi.fn();
        storeFile = vi.fn().mockResolvedValue(undefined);
        adapter = createOnlineAdapter({ basePath: '/exe', strings, fetchImpl, navigate, storeFile });
    });

    afterEach(() => {
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    describe('loadItems', () => {
        it('splits the projects into recent, mine and shared, newest first', async () => {
            fetchImpl.mockResolvedValue(
                jsonResponse({
                    odeFiles: {
                        odeFilesSync: [
                            project('old', 'Old', '2026-01-01T00:00:00Z'),
                            project('shared', 'Team unit', '2026-03-01T00:00:00Z', 'editor', 'ana@example.org'),
                            project('new', '', '2026-05-01T00:00:00Z'),
                        ],
                    },
                }),
            );

            const items = await adapter.loadItems();

            expect(fetchImpl).toHaveBeenCalledWith('/exe/api/projects/user/list', { credentials: 'include' });
            expect(items.recent.map((item) => item.id)).toEqual(['new', 'shared', 'old']);
            expect(items.mine.map((item) => item.id)).toEqual(['new', 'old']);
            expect(items.shared).toEqual([
                expect.objectContaining({ id: 'shared', title: 'Team unit', meta: 'Shared by ana@example.org' }),
            ]);
            expect(items.recent[0]).toEqual(expect.objectContaining({ title: 'Untitled', meta: 'Owned by you' }));
        });

        it('keeps only the eight most recent in the recent list', async () => {
            const many = Array.from({ length: 12 }, (_unused, i) =>
                project(`p${i}`, `P${i}`, new Date(2026, 0, i + 1).toISOString()),
            );
            fetchImpl.mockResolvedValue(jsonResponse({ odeFiles: { odeFilesSync: many } }));

            const items = await adapter.loadItems();

            expect(items.recent).toHaveLength(8);
            expect(items.recent[0].id).toBe('p11');
            expect(items.mine).toHaveLength(12);
        });

        it('copes with an empty answer and a shared project without an owner e-mail', async () => {
            fetchImpl.mockResolvedValueOnce(jsonResponse({}));
            expect(await adapter.loadItems()).toEqual({ recent: [], mine: [], shared: [] });

            fetchImpl.mockResolvedValueOnce(
                jsonResponse({ odeFiles: { odeFilesSync: [project('s', 'S', '2026-01-01T00:00:00Z', 'editor')] } }),
            );
            expect((await adapter.loadItems()).shared[0].meta).toBe('Shared by ');
        });

        it('fails when the server refuses', async () => {
            fetchImpl.mockResolvedValue(jsonResponse({}, false, 500));
            await expect(adapter.loadItems()).rejects.toThrow('500');
        });
    });

    it('creates a project only when New project is chosen, then opens it', async () => {
        fetchImpl.mockResolvedValue(jsonResponse({ uuid: 'abc-123' }));

        await adapter.onNew();

        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe('/exe/api/project/create-quick');
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toEqual({ title: 'Untitled' });
        expect(navigate).toHaveBeenCalledWith('/exe/workarea?project=abc-123&new=1');
    });

    it('does not navigate when the project cannot be created', async () => {
        fetchImpl.mockResolvedValue(jsonResponse({}, false, 401));

        await expect(adapter.onNew()).rejects.toThrow('401');
        expect(navigate).not.toHaveBeenCalled();
    });

    it('opens an existing project without creating anything', () => {
        adapter.onOpenItem({ id: 'abc 123' });

        expect(fetchImpl).not.toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledWith('/exe/workarea?project=abc%20123');
    });

    it('stores a local file, creates a project named after it and asks the workarea to import it', async () => {
        fetchImpl.mockResolvedValue(jsonResponse({ uuid: 'new-1' }));
        const file = new File(['x'], 'Water cycle.elpx');

        await adapter.onOpenFile(file);

        expect(storeFile).toHaveBeenCalledWith(file);
        expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ title: 'Water cycle' });
        expect(navigate).toHaveBeenCalledWith('/exe/workarea?project=new-1&new=1&pendingImport=1');
    });

    it('falls back to the untitled name for a file that is only an extension', async () => {
        fetchImpl.mockResolvedValue(jsonResponse({ uuid: 'new-2' }));

        await adapter.onOpenFile(new File(['x'], '.zip'));

        expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ title: 'Untitled' });
    });

    it('creates nothing when the file cannot be stored', async () => {
        storeFile.mockRejectedValue(new Error('quota'));

        await expect(adapter.onOpenFile(new File(['x'], 'a.elpx'))).rejects.toThrow('quota');
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    describe('initStartPage', () => {
        it('does nothing on a document without the placeholder', () => {
            expect(initStartPage()).toBeNull();
        });

        it('mounts the page with three lists and a search field', async () => {
            const globalFetch = vi.fn().mockResolvedValue(jsonResponse({ odeFiles: { odeFilesSync: [] } }));
            vi.stubGlobal('fetch', globalFetch);
            const host = document.createElement('div');
            host.id = 'exe-start-root';
            host.dataset.config = JSON.stringify({ basePath: '/exe', locale: 'es', strings });
            document.body.appendChild(host);

            const screen = initStartPage();
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(host.querySelector('section.exe-start--page')).not.toBeNull();
            expect([...host.querySelectorAll('.exe-start__tab')].map((tab) => tab.textContent)).toEqual([
                'Recent',
                'My projects',
                'Shared with me',
            ]);
            expect(host.querySelector('.exe-start__search')).not.toBeNull();
            expect(globalFetch).toHaveBeenCalledWith('/exe/api/projects/user/list', { credentials: 'include' });
            screen.destroy();
            vi.unstubAllGlobals();
        });

        it('tolerates a placeholder without configuration', () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
            const host = document.createElement('div');
            host.id = 'exe-start-root';
            document.body.appendChild(host);

            const screen = initStartPage();

            expect(host.querySelector('.exe-start')).not.toBeNull();
            screen.destroy();
            vi.unstubAllGlobals();
        });
    });
});

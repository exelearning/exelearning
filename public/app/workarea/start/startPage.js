/**
 * Online start page: shown at /workarea when no project was asked for.
 *
 * Nothing is created on the server until the author chooses, so opening the
 * application and picking an existing project leaves no empty draft behind.
 */
import StartScreen from './startScreen.js';
import { storePendingImport } from '../project/pendingImport.js';

const RECENT_LIMIT = 8;

/**
 * @param {Object} options
 * @param {string} options.basePath
 * @param {Record<string, string>} options.strings
 * @param {typeof fetch} [options.fetchImpl]
 * @param {(url: string) => void} [options.navigate]
 * @param {(file: File) => Promise<void>} [options.storeFile]
 */
export function createOnlineAdapter({
    basePath,
    strings,
    fetchImpl = (...args) => fetch(...args),
    navigate = (url) => window.location.assign(url),
    storeFile = storePendingImport,
}) {
    const createProject = async (title) => {
        const response = await fetchImpl(`${basePath}/api/project/create-quick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ title }),
        });
        if (!response.ok) throw new Error(`Failed to create project: ${response.status}`);
        const data = await response.json();
        return encodeURIComponent(data.uuid);
    };

    return {
        async loadItems() {
            const response = await fetchImpl(`${basePath}/api/projects/user/list`, { credentials: 'include' });
            if (!response.ok) throw new Error(`Failed to list projects: ${response.status}`);
            const data = await response.json();
            const all = (data?.odeFiles?.odeFilesSync || [])
                .map((project) => {
                    const owned = project.role === 'owner';
                    return {
                        id: project.odeId,
                        title: project.title || strings.untitled,
                        meta: owned ? strings.ownedByYou : strings.sharedBy.replace('%s', project.ownerEmail || ''),
                        when: project.updatedAt,
                        owned,
                    };
                })
                .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
            return {
                recent: all.slice(0, RECENT_LIMIT),
                mine: all.filter((item) => item.owned),
                shared: all.filter((item) => !item.owned),
            };
        },

        async onNew() {
            const uuid = await createProject(strings.untitled);
            navigate(`${basePath}/workarea?project=${uuid}&new=1`);
        },

        onOpenItem(item) {
            navigate(`${basePath}/workarea?project=${encodeURIComponent(item.id)}`);
        },

        // The workarea reads the file back after the navigation and imports it
        // into the project created here (the same bridge File > Open uses).
        async onOpenFile(file) {
            await storeFile(file);
            const title = file.name.replace(/\.(elpx|elp|zip)$/i, '') || strings.untitled;
            const uuid = await createProject(title);
            navigate(`${basePath}/workarea?project=${uuid}&new=1&pendingImport=1`);
        },
    };
}

/**
 * Mount the start page into its placeholder, if the document has one.
 * @param {Document} [doc]
 * @returns {StartScreen|null}
 */
export function initStartPage(doc = document) {
    const host = doc.getElementById('exe-start-root');
    if (!host) return null;
    const config = JSON.parse(host.dataset.config || '{}');
    const strings = config.strings || {};
    const adapter = createOnlineAdapter({ basePath: config.basePath || '', strings });
    const screen = new StartScreen({
        strings,
        modal: false,
        locale: config.locale,
        search: true,
        tabs: [
            { id: 'recent', label: strings.tabRecent },
            { id: 'mine', label: strings.tabMine },
            { id: 'shared', label: strings.tabShared },
        ],
        ...adapter,
    });
    screen.mount(host);
    return screen;
}

initStartPage();

import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

test('startup preserves current resource cache entries across reloads', async ({
    authenticatedPage,
    createProject,
}) => {
    const page = authenticatedPage;
    const projectId = await createProject(page, 'Resource cache persistence');
    await gotoWorkarea(page, projectId);

    const versions = await page.evaluate(async () => {
        const exe = (window as any).eXeLearning;
        const { resourceCache: cache, resourceFetcher: fetcher } = exe.app.project._yjsBridge;
        const version = exe.version || 'v0.0.0';
        const hash = fetcher.bundleManifest?.libs?.hash;
        const libs = hash ? `${version}-${hash.substring(0, 8)}` : version;
        const theme = `${version}-1712345678`;
        const files = new Map([['cache-test.js', new Blob(['persisted resource'])]]);
        await cache.set('libs', 'base', libs, files);
        await cache.set('theme', 'cache-test-site', theme, files);
        await cache.set('theme', 'cache-test-plain', version, files);
        await cache.set('libs', 'cache-test-old', 'obsolete-abcdef12', files);
        return { libs, theme, version };
    });

    await page.reload();
    await waitForAppReady(page);

    const cached = await page.evaluate(async ({ libs, theme, version }) => {
        const { resourceCache: cache, resourceFetcher: fetcher } = (window as any).eXeLearning.app.project._yjsBridge;
        const libraries = await cache.get('libs', 'base', libs);
        const siteTheme = await cache.get('theme', 'cache-test-site', theme);
        const plainTheme = await cache.get('theme', 'cache-test-plain', version);
        const fetchedLibraries = await fetcher.fetchBaseLibraries();
        return {
            libraries: await libraries?.get('cache-test.js')?.text(),
            siteTheme: await siteTheme?.get('cache-test.js')?.text(),
            plainTheme: await plainTheme?.get('cache-test.js')?.text(),
            fetchedLibraries: await fetchedLibraries.get('cache-test.js')?.text(),
            old: await cache.has('libs', 'cache-test-old', 'obsolete-abcdef12'),
        };
    }, versions);

    expect(cached).toEqual({
        libraries: 'persisted resource',
        siteTheme: 'persisted resource',
        plainTheme: 'persisted resource',
        fetchedLibraries: 'persisted resource',
        old: false,
    });
});

test('startup keeps only the newest cache entry per resource', async ({ authenticatedPage, createProject }) => {
    const page = authenticatedPage;
    const projectId = await createProject(page, 'Resource cache pruning');
    await gotoWorkarea(page, projectId);

    // Seed several generations of the same resources with explicit timestamps, as
    // repeated site-theme uploads and libs rebuilds would produce over time.
    const version = await page.evaluate(async () => {
        const exe = (window as any).eXeLearning;
        const cache = exe.app.project._yjsBridge.resourceCache;
        const appVersion = exe.version || 'v0.0.0';

        const seed = (type: string, name: string, suffix: string, cachedAt: number) =>
            new Promise((resolve, reject) => {
                const store = cache.db.transaction(['resources'], 'readwrite').objectStore('resources');
                const resourceVersion = `${appVersion}-${suffix}`;
                const request = store.put({
                    key: `${type}:${name}:${resourceVersion}`,
                    type,
                    name,
                    version: resourceVersion,
                    files: [{ path: 'cache-test.js', blob: new Blob([suffix]) }],
                    cachedAt,
                });
                request.onsuccess = () => resolve(null);
                request.onerror = () => reject(request.error);
            });

        await seed('theme', 'prune-test-site', '1712000000', 1000);
        await seed('theme', 'prune-test-site', '1712500000', 2000);
        await seed('theme', 'prune-test-site', '1712999999', 3000);
        await seed('libs', 'prune-test-base', 'aaaaaaaa', 1000);
        await seed('libs', 'prune-test-base', 'bbbbbbbb', 2000);
        await seed('theme', 'prune-test-other', '1712000000', 1000);

        return appVersion;
    });

    await page.reload();
    await waitForAppReady(page);

    const survivors = await page.evaluate(async appVersion => {
        const cache = (window as any).eXeLearning.app.project._yjsBridge.resourceCache;
        const read = async (type: string, name: string, suffix: string) => {
            const files = await cache.get(type, name, `${appVersion}-${suffix}`);
            return (await files?.get('cache-test.js')?.text()) ?? null;
        };
        return {
            themeOldest: await read('theme', 'prune-test-site', '1712000000'),
            themeMiddle: await read('theme', 'prune-test-site', '1712500000'),
            themeNewest: await read('theme', 'prune-test-site', '1712999999'),
            libsOlder: await read('libs', 'prune-test-base', 'aaaaaaaa'),
            libsNewest: await read('libs', 'prune-test-base', 'bbbbbbbb'),
            otherTheme: await read('theme', 'prune-test-other', '1712000000'),
        };
    }, version);

    expect(survivors).toEqual({
        themeOldest: null,
        themeMiddle: null,
        themeNewest: '1712999999',
        libsOlder: null,
        libsNewest: 'bbbbbbbb',
        otherTheme: '1712000000',
    });
});

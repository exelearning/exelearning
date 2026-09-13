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

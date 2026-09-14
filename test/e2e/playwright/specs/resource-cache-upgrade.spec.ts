import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';

// Use a real HTTP server: page.route() disables the browser cache and would
// hide the upgrade regression in #2390. Each test owns its server and IndexedDB.
for (const staticMode of [false, true]) {
    test(`resource upgrade bypasses old HTTP responses (${staticMode ? 'static' : 'server'})`, async ({ page }) => {
        let release = 'old';
        const requests: string[] = [];
        const source = 'app/common/exe_export.js';
        const bundlePath = '/api/resources/bundle/libs';
        const assetPath = staticMode ? `/${source}` : bundlePath;
        const manifestPath = staticMode ? '/bundles/manifest.json' : '/api/resources/bundle/manifest';
        const runtime = () => `window.$exeExport = { release: '${release}' };`;
        const server = createServer((req, res) => {
            const url = new URL(req.url!, 'http://localhost');
            requests.push(req.url!);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            if (url.pathname === manifestPath) {
                res.setHeader('Content-Type', 'application/json');
                res.end(
                    JSON.stringify({
                        libs: { hash: `${release}-hash` },
                        staticFiles: { libs: [{ s: source, t: 'exe_export.js' }] },
                    }),
                );
            } else if (url.pathname === assetPath) {
                res.end(staticMode ? runtime() : Buffer.from(zipSync({ 'exe_export.js': strToU8(runtime()) })));
            } else if (url.pathname === '/api/themes/installed') {
                res.end('{"themes":[]}');
            } else {
                res.setHeader('Content-Type', 'text/html');
                res.end('<!doctype html><title>Resource cache upgrade</title>');
            }
        });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        const address = server.address() as { port: number };
        try {
            await page.goto(`http://127.0.0.1:${address.port}/`);
            await page.evaluate(() => {
                (window as any).Logger = { log() {} };
            });
            for (const file of [
                'public/libs/fflate/fflate.umd.js',
                'public/app/yjs/ResourceCache.js',
                'public/app/yjs/ResourceFetcher.js',
            ]) {
                await page.addScriptTag({ content: readFileSync(path.resolve(file), 'utf8') });
            }
            // Prime the same unversioned URLs used before this fix, including
            // the static manifest. Nothing clears the HTTP cache afterwards.
            await page.evaluate(
                async paths => {
                    for (const url of paths) await (await fetch(url)).arrayBuffer();
                },
                [manifestPath, assetPath],
            );
            release = 'new';
            const requestsBefore = requests.filter(url => url === assetPath).length;
            await page.evaluate(async url => {
                await (await fetch(url)).arrayBuffer();
            }, assetPath);
            expect(requests.filter(url => url === assetPath)).toHaveLength(requestsBefore);

            const result = await page.evaluate(async isStatic => {
                const w = window as any;
                w.eXeLearning = { version: 'v4.0.4', app: { capabilities: { storage: { remote: !isStatic } } } };
                const cache = new w.ResourceCache();
                await cache.init();
                const fetcher = new w.ResourceFetcher();
                await fetcher.init(cache);
                const files = await fetcher.fetchBaseLibraries();
                const text = await files.get('exe_export.js').text();
                const persisted = await cache.get('libs', 'base', 'v4.0.4-new-hash');
                const persistedText = await persisted?.get('exe_export.js').text();
                cache.db.close();
                return { text, persistedText };
            }, staticMode);
            expect(result.text).toContain("release: 'new'");
            expect(result.persistedText).toBe(result.text);
            expect(requests).toContain(`${assetPath}?v=${staticMode ? 'v4.0.4' : 'new-hash'}`);
        } finally {
            server.closeAllConnections();
            await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
        }
    });
}

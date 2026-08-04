/**
 * Static distribution build orchestrator.
 *
 * This is the effectful CLI half of the static build: it wipes and repopulates
 * the output directory, copies hundreds of megabytes out of public/, and gzips
 * the bundled JSON datasets in place. All of the logic it drives — version
 * resolution, translation/iDevice/theme discovery, template rendering, the copy
 * and compression primitives — lives in ../build-static-bundle.ts and is unit
 * tested there.
 *
 * Kept in its own module so the tested library is not dominated by an
 * orchestrator that can only be meaningfully verified by running a real build
 * (see the static E2E suite and the static-release workflow).
 *
 * Entry point remains `bun scripts/build-static-bundle.ts`.
 */

import fs from 'fs';
import path from 'path';

import {
    COMPRESS_JSON_DIRS,
    buildApiParameters,
    buildIdevicesList,
    buildThemesList,
    compressJsonInDir,
    copyDirRecursive,
    generatePwaManifest,
    generateServiceWorker,
    generateStaticHtml,
    getBuildHash,
    getBuildVersion,
    loadAllTranslations,
    outputDir,
    projectRoot,
} from '../build-static-bundle';

/**
 * Main build function
 */
export async function buildStaticBundle() {
    const buildVersion = getBuildVersion();
    const buildHash = getBuildHash();

    console.log('='.repeat(60));
    console.log('Building Static Distribution');
    console.log(`Version: ${buildVersion} (${buildHash})`);
    console.log('='.repeat(60));

    // Clean output directory (retry for Windows EBUSY locks)
    if (fs.existsSync(outputDir)) {
        let lastError: unknown;
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                fs.rmSync(outputDir, { recursive: true, force: true });
                lastError = undefined;
                break;
            } catch (err: unknown) {
                lastError = err;
                const code = (err as NodeJS.ErrnoException).code;
                if (code !== 'EBUSY' && code !== 'EPERM' && code !== 'ENOTEMPTY') throw err;
                // Wait and retry: another process (Explorer, AV) may be scanning the dir
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (globalThis as any).Bun?.sleepSync(attempt * 200);
            }
        }
        if (lastError) throw lastError;
    }
    fs.mkdirSync(outputDir, { recursive: true });

    // 1. Load and serialize API data
    console.log('\n1. Loading API data...');
    const apiParameters = buildApiParameters();
    const translations = loadAllTranslations();
    const idevices = buildIdevicesList();
    const themes = buildThemesList();

    // Read existing bundle manifest
    const bundleManifestPath = path.join(projectRoot, 'public/bundles/manifest.json');
    let bundleManifest = null;
    if (fs.existsSync(bundleManifestPath)) {
        bundleManifest = JSON.parse(fs.readFileSync(bundleManifestPath, 'utf-8'));
    }

    const bundleData = {
        version: buildVersion,
        builtAt: new Date().toISOString(),
        parameters: apiParameters,
        translations,
        idevices,
        themes,
        bundleManifest,
    };

    // Write bundle.json
    const dataDir = path.join(outputDir, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'bundle.json'), JSON.stringify(bundleData, null, 2));
    console.log('  Created data/bundle.json');

    // 2. Generate static HTML
    console.log('\n2. Generating static HTML...');
    const staticHtml = generateStaticHtml(bundleData);
    fs.writeFileSync(path.join(outputDir, 'index.html'), staticHtml);
    console.log('  Created index.html');

    // 3. Generate PWA files
    console.log('\n3. Generating PWA files...');
    fs.writeFileSync(path.join(outputDir, 'manifest.json'), generatePwaManifest());
    fs.writeFileSync(path.join(outputDir, 'service-worker.js'), generateServiceWorker());
    console.log('  Created manifest.json');
    console.log('  Created service-worker.js');

    // 4. Copy static assets
    console.log('\n4. Copying static assets...');

    // Copy app folder
    copyDirRecursive(path.join(projectRoot, 'public/app'), path.join(outputDir, 'app'), ['test', 'spec']);
    console.log('  Copied app/');

    // Copy libs folder
    copyDirRecursive(path.join(projectRoot, 'public/libs'), path.join(outputDir, 'libs'));

    console.log('  Copied libs/');

    // Copy style folder
    copyDirRecursive(path.join(projectRoot, 'public/style'), path.join(outputDir, 'style'));
    console.log('  Copied style/');

    // Copy bundles folder (pre-built resource ZIPs)
    copyDirRecursive(path.join(projectRoot, 'public/bundles'), path.join(outputDir, 'bundles'));
    console.log('  Copied bundles/');

    // Copy files/perm (themes, iDevices, favicon)
    copyDirRecursive(path.join(projectRoot, 'public/files/perm'), path.join(outputDir, 'files/perm'));
    console.log('  Copied files/perm/');

    // Gzip large iDevice JSON datasets in place (browser decompresses on the fly).
    let totalOrig = 0;
    let totalGz = 0;
    let totalCount = 0;
    for (const relDir of COMPRESS_JSON_DIRS) {
        const absDir = path.join(outputDir, relDir);
        const stats = compressJsonInDir(absDir);
        if (stats.count === 0) {
            throw new Error(
                `Compression guard failed: no .json files found under ${relDir}. ` +
                `Update COMPRESS_JSON_DIRS in build-static-bundle.ts or restore the data.`,
            );
        }
        const pct = stats.origTotal > 0
            ? Math.round((1 - stats.gzTotal / stats.origTotal) * 100)
            : 0;
        console.log(
            `  Gzipped ${stats.count} file(s) in ${relDir}: ` +
            `${(stats.origTotal / 1024 / 1024).toFixed(2)} MB → ` +
            `${(stats.gzTotal / 1024 / 1024).toFixed(2)} MB (-${pct}%)`,
        );
        totalCount += stats.count;
        totalOrig += stats.origTotal;
        totalGz += stats.gzTotal;
    }
    if (totalCount > 0) {
        const pct = Math.round((1 - totalGz / totalOrig) * 100);
        console.log(
            `  Total: ${totalCount} JSON file(s) compressed, ` +
            `${(totalOrig / 1024 / 1024).toFixed(2)} MB → ` +
            `${(totalGz / 1024 / 1024).toFixed(2)} MB (-${pct}%)`,
        );
    }

    // Copy images folder (default-avatar.svg, logo.svg, etc.)
    copyDirRecursive(path.join(projectRoot, 'public/images'), path.join(outputDir, 'images'));
    console.log('  Copied images/');

    // Copy exelearning.png to root
    const exelearningPng = path.join(projectRoot, 'public/exelearning.png');
    if (fs.existsSync(exelearningPng)) {
        fs.copyFileSync(exelearningPng, path.join(outputDir, 'exelearning.png'));
        console.log('  Copied exelearning.png');
    }

    // Copy favicon.ico
    const faviconIco = path.join(projectRoot, 'public/favicon.ico');
    if (fs.existsSync(faviconIco)) {
        fs.copyFileSync(faviconIco, path.join(outputDir, 'favicon.ico'));
        console.log('  Copied favicon.ico');
    }

    // Copy CHANGELOG.md
    const changelogMd = path.join(projectRoot, 'public/CHANGELOG.md');
    if (fs.existsSync(changelogMd)) {
        fs.copyFileSync(changelogMd, path.join(outputDir, 'CHANGELOG.md'));
        console.log('  Copied CHANGELOG.md');
    }

    // Copy preview-sw.js (Service Worker for preview panel)
    const previewSwJs = path.join(projectRoot, 'public/preview-sw.js');
    if (fs.existsSync(previewSwJs)) {
        fs.copyFileSync(previewSwJs, path.join(outputDir, 'preview-sw.js'));
        console.log('  Copied preview-sw.js');
    }

    console.log('\n' + '='.repeat(60));
    console.log('Static distribution built successfully!');
    console.log(`Output: ${outputDir}`);
    console.log('='.repeat(60));
}

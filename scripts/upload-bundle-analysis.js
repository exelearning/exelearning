/**
 * Upload bundle analysis to Codecov
 *
 * This script uploads bundle size information for app.bundle.js and exporters.bundle.js
 * to Codecov's Bundle Analysis feature.
 *
 * Usage: CODECOV_TOKEN=xxx node scripts/upload-bundle-analysis.js
 */

const { createAndUploadReport } = require('@codecov/bundle-analyzer');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function uploadBundles() {
    const token = process.env.CODECOV_TOKEN;

    if (!token) {
        console.log('CODECOV_TOKEN not set, skipping bundle analysis upload');
        return;
    }

    // Create temp directories for clean bundle analysis
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-analysis-'));
    const appBundleDir = path.join(tempDir, 'app-bundle');
    const exportersBundleDir = path.join(tempDir, 'exporters-bundle');

    fs.mkdirSync(appBundleDir);
    fs.mkdirSync(exportersBundleDir);

    // Copy bundle files to temp directories
    fs.copyFileSync('./public/app/app.bundle.js', path.join(appBundleDir, 'app.bundle.js'));
    fs.copyFileSync(
        './public/app/yjs/exporters.bundle.js',
        path.join(exportersBundleDir, 'exporters.bundle.js'),
    );

    try {
        // Upload app bundle
        console.log('Uploading app-bundle analysis...');
        await createAndUploadReport(
            [appBundleDir],
            {
                uploadToken: token,
                bundleName: 'app-bundle',
                enableBundleAnalysis: true,
            },
            {},
        );

        // Upload exporters bundle
        console.log('Uploading exporters-bundle analysis...');
        await createAndUploadReport(
            [exportersBundleDir],
            {
                uploadToken: token,
                bundleName: 'exporters-bundle',
                enableBundleAnalysis: true,
            },
            {},
        );

        console.log('Bundle analysis upload complete!');
    } finally {
        // Cleanup temp directories
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

uploadBundles().catch((error) => {
    console.error('Bundle analysis upload failed:', error);
    process.exit(1);
});

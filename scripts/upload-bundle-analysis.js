/**
 * Upload bundle analysis to Codecov
 *
 * This script uploads bundle size information for app.bundle.js and exporters.bundle.js
 * to Codecov's Bundle Analysis feature.
 *
 * Usage: CODECOV_TOKEN=xxx node scripts/upload-bundle-analysis.js
 */

const { createAndUploadReport } = require('@codecov/bundle-analyzer');

async function uploadBundles() {
    const token = process.env.CODECOV_TOKEN;

    if (!token) {
        console.log('CODECOV_TOKEN not set, skipping bundle analysis upload');
        return;
    }

    // Upload app bundle (analyze public/app/, include only app.bundle.js)
    console.log('Uploading app-bundle analysis...');
    await createAndUploadReport(
        ['./public/app'],
        {
            uploadToken: token,
            bundleName: 'app-bundle',
            enableBundleAnalysis: true,
        },
        {
            ignorePatterns: ['**/*', '!app.bundle.js'],
        },
    );

    // Upload exporters bundle (analyze public/app/yjs/, include only exporters.bundle.js)
    console.log('Uploading exporters-bundle analysis...');
    await createAndUploadReport(
        ['./public/app/yjs'],
        {
            uploadToken: token,
            bundleName: 'exporters-bundle',
            enableBundleAnalysis: true,
        },
        {
            ignorePatterns: ['**/*', '!exporters.bundle.js'],
        },
    );

    console.log('Bundle analysis upload complete!');
}

uploadBundles().catch((error) => {
    console.error('Bundle analysis upload failed:', error);
    process.exit(1);
});

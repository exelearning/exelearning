require('dotenv').config();
const { notarize } = require('electron-notarize');

let stapleApp = null;
// Try to load stapleApp if available (optional).
try {
  // @electron/notarize provides stapleApp; require it if present.
  // If not present, stapling will be skipped gracefully.
  // eslint-disable-next-line global-require
  ({ stapleApp } = require('@electron/notarize'));
} catch (e) {
  // ignore - stapling is optional
}

/**
 * Submit a signed macOS .app bundle for Apple notarization.
 *
 * This hook runs only for macOS builds. It validates required environment
 * variables (APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD or APPLE_APP_PASSWORD,
 * and APPLE_TEAM_ID) and respects SKIP_NOTARIZE.
 *
 * If stapling support is available (stapleApp), it will attempt to staple
 * the notarization ticket to the .app after a successful request.
 *
 * @param {Object} context - electron-builder hook context
 */
exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir, packager } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  if (process.env.SKIP_NOTARIZE === '1') {
    console.warn('⚠️  SKIP_NOTARIZE is set — skipping notarization.');
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword =
    process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_APP_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;
  const ascProvider = process.env.APPLE_ASC_PROVIDER;
  const tool = process.env.NOTARIZE_TOOL || 'notarytool';

  if (!appleId || !appleIdPassword || !teamId) {
    console.warn(
      '⚠️  Notarization credentials missing (APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD or APPLE_APP_PASSWORD, APPLE_TEAM_ID). Skipping notarization.'
    );
    return;
  }

  const appName = packager && packager.appInfo
    ? packager.appInfo.productFilename
    : (context.packager && context.packager.appInfo
      ? context.packager.appInfo.productFilename
      : null);
  const appBundleId = packager && packager.appInfo
    ? packager.appInfo.appId
    : (context.packager && context.packager.appInfo
      ? context.packager.appInfo.appId
      : null);

  if (!appName || !appBundleId) {
    console.warn('⚠️  Could not determine app name or bundle id from packager. Skipping notarization.');
    return;
  }

  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`🔐 Submitting ${appName} for Apple notarization using ${tool}...`);

  try {
    await notarize({
      tool,
      teamId,
      appBundleId,
      appPath,
      appleId,
      appleIdPassword,
      ascProvider,
    });

    console.log(`✅ Notarization request submitted successfully for ${appName}.`);

    if (typeof stapleApp === 'function') {
      try {
        console.log(`📎 Stapling ticket to ${appName}.app...`);
        await stapleApp(appPath);
        console.log(`✅ Stapled notarization ticket to ${appName}.app.`);
      } catch (stapleErr) {
        console.warn('⚠️  Stapling failed (continuing).', stapleErr);
      }
    } else {
      console.log('ℹ️  stapleApp not available; skipping stapling step.');
    }
  } catch (error) {
    console.error('❌ Notarization failed:', error);
    throw error;
  }
};

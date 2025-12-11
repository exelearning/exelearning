// packaging/afterPack.js
// Removes unused macOS locales to shrink the bundle.

const fs = require('fs');
const path = require('path');

/**
 * Remove locale folders from a Resources path, keeping only the ones listed.
 * This targets folders ending with ".lproj".
 *
 * @param {string} resourcesPath - Path to Resources directory to clean.
 * @param {string[]} keepLocales - Array of locale folder names to keep (e.g. ['en.lproj', 'es.lproj']).
 */
function removeUnusedLocales(resourcesPath, keepLocales = ['en.lproj', 'es.lproj']) {
  try {
    if (!fs.existsSync(resourcesPath)) {
      console.log(`[afterPack] locales: resources path not found: ${resourcesPath}`);
      return;
    }

    const entries = fs.readdirSync(resourcesPath);
    for (const entry of entries) {
      if (entry.endsWith('.lproj') && !keepLocales.includes(entry)) {
        const full = path.join(resourcesPath, entry);
        try {
          fs.rmSync(full, { recursive: true, force: true });
          console.log(`[afterPack] locales: removed ${entry}`);
        } catch (rmErr) {
          console.warn(`[afterPack] locales: failed to remove ${entry}`, rmErr);
        }
      }
    }
  } catch (err) {
    console.warn('[afterPack] locales: unexpected error while cleaning locales', err);
  }
}

module.exports = async (context) => {
  if (context.electronPlatformName !== 'darwin') return;

  // Determine the app bundle name from packager info.
  const appName = `${context.packager.appInfo.productFilename}.app`;

  // Typical location of Electron Framework resources inside the app bundle.
  // Keep this exact path as in your build.js snippet.
  const resourcesPath = path.join(
    context.appOutDir,
    appName,
    'Contents',
    'Frameworks',
    'Electron Framework.framework',
    'Versions',
    'Current',
    'Resources'
  );

  // Keep only English and Spanish .lproj folders for faster sign.
  const keepLocales = ['en.lproj', 'es.lproj'];

  removeUnusedLocales(resourcesPath, keepLocales);

  // If you also want to try alternate locations for Resources (some builds differ),
  // uncomment and adapt the following examples:
  //
  // const altResources = path.join(context.appOutDir, appName, 'Contents', 'Resources');
  // removeUnusedLocales(altResources, keepLocales);
};

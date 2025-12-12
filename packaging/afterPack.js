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

/**
 * Remove the wrong-architecture server executable for universal app support.
 * When building for arm64, remove the x64 server; when building for x64, remove the arm64 server.
 * This prevents electron-builder from failing when merging into a universal binary.
 *
 * @param {string} resourcesPath - Path to Resources directory.
 * @param {string} arch - Current build architecture ('arm64', 'x64', or 'universal').
 */
function removeWrongArchServer(resourcesPath, arch) {
  console.log(`[afterPack] server: checking arch=${arch}, resourcesPath=${resourcesPath}`);
  const distPath = path.join(resourcesPath, 'dist');
  if (!fs.existsSync(distPath)) {
    console.log(`[afterPack] server: dist path not found: ${distPath}`);
    return;
  }

  // List all files in dist for debugging
  try {
    const files = fs.readdirSync(distPath);
    console.log(`[afterPack] server: files in dist: ${files.filter(f => f.includes('server')).join(', ')}`);
  } catch (e) {}

  // Note: We keep both server executables in both builds.
  // The singleArchFiles config in package.json tells electron-builder's
  // universal merger to NOT try to merge these files (they're arch-specific).
  // At runtime, main.js selects the correct one based on process.arch.
  console.log(`[afterPack] server: arch=${arch}, keeping both server executables (singleArchFiles handles merging)`);
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

  // Remove wrong-architecture server executable for universal app support
  const appResourcesPath = path.join(context.appOutDir, appName, 'Contents', 'Resources');
  removeWrongArchServer(appResourcesPath, context.arch);

  // If you also want to try alternate locations for Resources (some builds differ),
  // uncomment and adapt the following examples:
  //
  // const altResources = path.join(context.appOutDir, appName, 'Contents', 'Resources');
  // removeUnusedLocales(altResources, keepLocales);
};

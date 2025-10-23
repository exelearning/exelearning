// packaging/afterPack.js
// Put one PHP at Contents/Resources/php/mac/php in each partial (x64/arm64)
// so @electron/universal can lipo them. Do not touch the final universal pass.
// Additionally, on the final macOS pass remove unnecessary .lproj locales,
// keeping only English and Spanish to reduce bundle size.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Remove a file or directory tree (best-effort).
 * @param {string} p - Path to remove.
 */
function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (e) {
    // ignore errors: best-effort cleanup
  }
}

/**
 * Ensure the given path is executable (best-effort).
 * @param {string} p - Path to make executable.
 */
function ensureExec(p) {
  try {
    fs.chmodSync(p, 0o755);
  } catch (e) {
    // ignore permission errors
  }
}

/**
 * Remove macOS quarantine attributes recursively (best-effort).
 * @param {string} p - Path to de-quarantine.
 */
function dequarantine(p) {
  try {
    execFileSync('xattr', ['-cr', p], { stdio: 'ignore' });
  } catch (e) {
    // ignore xattr errors
  }
}

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

  const out = context.appOutDir || '';
  const isX64 = /mac-universal-x64-temp/i.test(out);
  const isARM64 = /mac-universal-arm64-temp/i.test(out);

  // 1) Handle partial passes (x64 / arm64) to stage a php binary for lipo.
  if (isX64 || isARM64) {
    const appName = `${context.packager.appInfo.productFilename}.app`;
    const resources = path.join(context.appOutDir, appName, 'Contents', 'Resources');
    const macRoot = path.join(resources, 'php', 'mac');

    const arch = isARM64 ? 'arm64' : 'x64';
    const src = path.join(macRoot, arch, 'php');
    const dst = path.join(macRoot, 'php');

    if (fs.existsSync(src)) {
      try {
        // copyFileSync expects file -> file
        fs.copyFileSync(src, dst);
        ensureExec(dst);
        dequarantine(dst);
        // remove arch folders -> both partials will have the SAME set of Mach-O
        rmrf(path.join(macRoot, 'arm64'));
        rmrf(path.join(macRoot, 'x64'));
        console.log(`[afterPack] ${arch}: staged ${dst} and removed arch folders`);
      } catch (copyErr) {
        console.warn(`[afterPack] ${arch}: error staging php from ${src} to ${dst}`, copyErr);
      }
    } else {
      console.log(`[afterPack] ${arch}: php not found at ${src}`);
    }

    // Do not run final-universal-only operations during partial passes.
    return;
  }

  // 2) Final universal pass: remove unneeded locales to shrink bundle.
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

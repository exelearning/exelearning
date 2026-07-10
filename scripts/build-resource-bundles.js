#!/usr/bin/env node
/**
 * Build script for resource bundles
 *
 * Generates ZIP bundles for static resources (themes, iDevices, libraries)
 * to be fetched in a single request during export.
 *
 * Output structure:
 *   public/bundles/
 *   ├── themes/
 *   │   ├── base.zip
 *   │   ├── flux.zip
 *   │   └── ...
 *   ├── idevices.zip        # All base iDevices
 *   ├── libs.zip            # Base libraries
 *   └── manifest.json       # Bundle metadata with hashes
 *
 * Note: Files are stored without version in path. The version is used as a
 * virtual cache buster in URLs only (controlled by APP_VERSION env var).
 *
 * Usage:
 *   bun scripts/build-resource-bundles.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { strToU8, zipSync } = require('fflate');
// Single source of truth for the exporter's library lists (bun transpiles the
// TS import). BASE_LIBRARIES is the always-included set; LIBRARY_PATTERNS is
// the content-detected set. Reusing them here keeps the preview fixed-resource
// manifest from drifting against what the exporters actually reference.
const { BASE_LIBRARIES, LIBRARY_PATTERNS } = require('../src/shared/export/constants.ts');

const projectRoot = path.resolve(__dirname, '..');

// Read version from package.json (stored in manifest for reference)
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
const buildVersion = `v${packageJson.version}`;

// Paths - bundles stored without version (version is virtual cache buster in URLs)
const THEMES_BASE_PATH = path.join(projectRoot, 'public/files/perm/themes/base');
const IDEVICES_BASE_PATH = path.join(projectRoot, 'public/files/perm/idevices/base');
const LIBS_PATH = path.join(projectRoot, 'public/libs');
const COMMON_PATH = path.join(projectRoot, 'public/app/common');
const OUTPUT_PATH = path.join(projectRoot, 'public/bundles');

// Base libraries to include (matching resources.ts)
// Content-specific libraries (exe_lightbox, exe_tooltips, exe_effects, jquery-ui, etc.)
// are detected and fetched on-demand via LibraryDetector, NOT included in base bundle
const BASE_LIBS = [
  { src: 'libs/jquery/jquery.min.js', dest: 'jquery/jquery.min.js' },
  { src: 'libs/bootstrap/bootstrap.bundle.min.js', dest: 'bootstrap/bootstrap.bundle.min.js' },
  { src: 'libs/bootstrap/bootstrap.min.css', dest: 'bootstrap/bootstrap.min.css' },
  { src: 'libs/bootstrap/bootstrap.bundle.min.js.map', dest: 'bootstrap/bootstrap.bundle.min.js.map' },
  { src: 'libs/bootstrap/bootstrap.min.css.map', dest: 'bootstrap/bootstrap.min.css.map' },
  { src: 'app/common/common.js', dest: 'common.js' },
  { src: 'app/common/common_i18n.js', dest: 'common_i18n.js' },
  { src: 'app/common/exe_export.js', dest: 'exe_export.js' },
  // External-media bridge (opaque-iframe YouTube/Vimeo support); policy loads first
  { src: 'app/common/exe_media_bridge/exe_media_policy.js', dest: 'exe_media_bridge/exe_media_policy.js' },
  { src: 'app/common/exe_media_bridge/exe_media_bridge.js', dest: 'exe_media_bridge/exe_media_bridge.js' },
  // Favicon (from public/ root)
  { src: 'favicon.ico', dest: 'favicon.ico' },
];

/**
 * Calculate SHA-256 hash of a buffer
 */
function calculateHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Recursively scan directory for files
 */
function scanDirectory(dirPath, basePath = '') {
  const files = [];

  if (!fs.existsSync(dirPath)) {
    return files;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      files.push(...scanDirectory(fullPath, relativePath));
    } else if (entry.isFile()) {
      files.push({ fullPath, relativePath });
    }
  }

  return files;
}

/**
 * Create ZIP from file list
 */
function createZip(files) {
  const zipData = {};

  for (const { fullPath, relativePath } of files) {
    try {
      const content = fs.readFileSync(fullPath);
      zipData[relativePath] = content;
    } catch (e) {
      console.warn(`  Warning: Could not read ${fullPath}`);
    }
  }

  return zipSync(zipData, { level: 6 });
}

/**
 * Build theme bundles
 */
function buildThemeBundles(manifest) {
  console.log('\nBuilding theme bundles...');

  const themesOutputPath = path.join(OUTPUT_PATH, 'themes');
  fs.mkdirSync(themesOutputPath, { recursive: true });

  if (!fs.existsSync(THEMES_BASE_PATH)) {
    console.log('  No base themes directory found, skipping');
    return;
  }

  const themes = fs.readdirSync(THEMES_BASE_PATH, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name);

  manifest.themes = {};

  for (const themeName of themes) {
    const themePath = path.join(THEMES_BASE_PATH, themeName);
    const files = scanDirectory(themePath);

    if (files.length === 0) {
      console.log(`  ${themeName}: No files, skipping`);
      continue;
    }

    const zipBuffer = createZip(files);
    const outputFile = path.join(themesOutputPath, `${themeName}.zip`);
    fs.writeFileSync(outputFile, zipBuffer);

    manifest.themes[themeName] = {
      files: files.length,
      size: zipBuffer.length,
      hash: calculateHash(zipBuffer),
    };

    console.log(`  ${themeName}: ${files.length} files, ${(zipBuffer.length / 1024).toFixed(1)} KB`);
  }
}

/**
 * Build iDevices bundle (all base iDevices in one ZIP)
 */
function buildIdevicesBundle(manifest) {
  console.log('\nBuilding iDevices bundle...');

  if (!fs.existsSync(IDEVICES_BASE_PATH)) {
    console.log('  No base iDevices directory found, skipping');
    return;
  }

  const idevices = fs.readdirSync(IDEVICES_BASE_PATH, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name);

  const allFiles = [];
  manifest.idevices = {};

  for (const ideviceName of idevices) {
    const exportPath = path.join(IDEVICES_BASE_PATH, ideviceName, 'export');

    if (!fs.existsSync(exportPath)) {
      continue;
    }

    const files = scanDirectory(exportPath);

    for (const file of files) {
      // Prefix with iDevice name for export structure
      allFiles.push({
        fullPath: file.fullPath,
        relativePath: `${ideviceName}/${file.relativePath}`,
      });
    }

    manifest.idevices[ideviceName] = files.length;
  }

  if (allFiles.length === 0) {
    console.log('  No iDevice export files found, skipping');
    return;
  }

  const zipBuffer = createZip(allFiles);
  const outputFile = path.join(OUTPUT_PATH, 'idevices.zip');
  fs.writeFileSync(outputFile, zipBuffer);

  manifest.idevicesBundle = {
    count: Object.keys(manifest.idevices).length,
    files: allFiles.length,
    size: zipBuffer.length,
    hash: calculateHash(zipBuffer),
  };

  console.log(`  ${Object.keys(manifest.idevices).length} iDevices, ${allFiles.length} files, ${(zipBuffer.length / 1024).toFixed(1)} KB`);
}

/**
 * Build libraries bundle
 */
function buildLibsBundle(manifest) {
  console.log('\nBuilding libraries bundle...');

  const files = [];

  for (const lib of BASE_LIBS) {
    const fullPath = path.join(projectRoot, 'public', lib.src);

    if (fs.existsSync(fullPath)) {
      files.push({ fullPath, relativePath: lib.dest });
    } else {
      console.warn(`  Warning: ${lib.src} not found`);
    }
  }

  if (files.length === 0) {
    console.log('  No library files found, skipping');
    return;
  }

  const zipBuffer = createZip(files);
  const outputFile = path.join(OUTPUT_PATH, 'libs.zip');
  fs.writeFileSync(outputFile, zipBuffer);

  manifest.libs = {
    files: files.length,
    size: zipBuffer.length,
    hash: calculateHash(zipBuffer),
  };

  console.log(`  ${files.length} files, ${(zipBuffer.length / 1024).toFixed(1)} KB`);
}

/**
 * Build common libraries (exe_effects, exe_media, etc.)
 */
function buildCommonLibsBundle(manifest) {
  console.log('\nBuilding common libraries bundle...');

  const commonLibs = [
    'exe_effects',
    'exe_media',
    'exe_highlighter',
    'exe_tooltips',
    'exe_lightbox',
    'exe_powered_logo',
    'exe_elpx_download',
    'exe_math',      // MathJax (only included when addMathJax=true or LaTeX detected)
    'exe_atools',    // Accessibility toolbar (only included when addAccessibilityToolbar=true)
  ];

  const allFiles = [];

  for (const libName of commonLibs) {
    // Some libraries live in public/libs/ (e.g. exe_atools, exe_elpx_download),
    // others in public/app/common/. Try COMMON_PATH first, then LIBS_PATH.
    let libPath = path.join(COMMON_PATH, libName);
    if (!fs.existsSync(libPath)) {
      libPath = path.join(LIBS_PATH, libName);
    }

    if (!fs.existsSync(libPath)) {
      console.warn(`  WARNING: library '${libName}' not found in common or libs directories`);
      continue;
    }

    const files = scanDirectory(libPath);

    for (const file of files) {
      allFiles.push({
        fullPath: file.fullPath,
        relativePath: `${libName}/${file.relativePath}`,
      });
    }
  }

  if (allFiles.length === 0) {
    console.log('  No common library files found, skipping');
    return;
  }

  const zipBuffer = createZip(allFiles);
  const outputFile = path.join(OUTPUT_PATH, 'common.zip');
  fs.writeFileSync(outputFile, zipBuffer);

  manifest.common = {
    files: allFiles.length,
    size: zipBuffer.length,
    hash: calculateHash(zipBuffer),
  };

  console.log(`  ${allFiles.length} files, ${(zipBuffer.length / 1024).toFixed(1)} KB`);
}

/**
 * Build content CSS bundle
 * Files are stored with content/css/ prefix to match what exporters expect
 */
function buildContentCssBundle(manifest) {
  console.log('\nBuilding content CSS bundle...');

  const cssPath = path.join(projectRoot, 'public/style/workarea');

  if (!fs.existsSync(cssPath)) {
    console.log('  No content CSS directory found, skipping');
    return;
  }

  const scannedFiles = scanDirectory(cssPath)
    .filter(f => f.relativePath.endsWith('.css'));

  if (scannedFiles.length === 0) {
    console.log('  No CSS files found, skipping');
    return;
  }

  // Add content/css/ prefix to match what exporters expect (ElpxExporter, Html5Exporter, etc.)
  const files = scannedFiles.map(f => ({
    fullPath: f.fullPath,
    relativePath: `content/css/${f.relativePath}`,
  }));

  const zipBuffer = createZip(files);
  const outputFile = path.join(OUTPUT_PATH, 'content-css.zip');
  fs.writeFileSync(outputFile, zipBuffer);

  manifest.contentCss = {
    files: files.length,
    size: zipBuffer.length,
    hash: calculateHash(zipBuffer),
  };

  console.log(`  ${files.length} files, ${(zipBuffer.length / 1024).toFixed(1)} KB`);
}

/**
 * Preview fixed-resource manifest (serving contract v2).
 *
 * Emitted as public/bundles/preview-fixed-resources.json, this manifest is the
 * ONLY authority for what the preview serving route may resolve outside a
 * session (doc/development/preview-serving-contract.md, "The fixed-resource
 * manifest"). It enumerates base (repo-shipped) resources exclusively — site
 * or user themes and user-installed iDevices must never be listed.
 *
 * fixedResourceId grammar (matches the paths the exporter emits in preview
 * output, so client-emitted ids and this manifest agree by construction):
 *   libs/{libPath}                 BASE_LIBS / BASE_LIBRARIES / LIBRARY_PATTERNS files
 *                                  (export path `libs/…` in Html5Exporter)
 *   libs/pdfjs/{file}              PDF.js runtime (public/libs/pdfjs)
 *   idevices/{type}/{file}         base iDevice export/ files; {type} is the
 *                                  normalized folder name the exporter uses
 *   theme:{name}/{relpath}         base theme files ({name}-qualified because the
 *                                  served path `theme/…` is theme-independent)
 *   content/css/base.css           public/style/workarea/base.css
 *   content/img/exe_powered_logo.png  the "powered by" logo
 *   fonts/global/{id}/{file}       bundled global fonts
 *
 * `path` values are relative to public/ (the distribution root). A host that
 * relocates files rewrites `path` in its manifest copy; ids must not change.
 */

/** Test-file filter mirroring FileSystemResourceProvider's export exclusions. */
function isTestFile(relativePath) {
  return relativePath.endsWith('.test.js') || relativePath.endsWith('.spec.js');
}

/**
 * Resolve a library file path (as listed in BASE_LIBRARIES / LIBRARY_PATTERNS)
 * to its location relative to public/. Mirrors the export pipeline's dual-root
 * resolution (FileSystemResourceProvider.fetchLibraryFiles): a few generated
 * commons live in app/common/ under a flat name; library directories live in
 * either app/common/ (exe_* runtimes) or libs/ (third-party). Existence decides
 * — no library name exists under both roots (warned about below if one ever
 * does).
 */
function resolveLibrarySource(libPath) {
  const commonFilesMapping = {
    'common_i18n.js': 'app/common/common_i18n.js',
    'common.js': 'app/common/common.js',
    'exe_export.js': 'app/common/exe_export.js',
  };
  if (commonFilesMapping[libPath]) return commonFilesMapping[libPath];
  const inCommon = `app/common/${libPath}`;
  const inLibs = `libs/${libPath}`;
  const commonExists = fs.existsSync(path.join(projectRoot, 'public', inCommon));
  const libsExists = fs.existsSync(path.join(projectRoot, 'public', inLibs));
  if (commonExists && libsExists) {
    console.warn(`  Warning: library path '${libPath}' exists under both app/common/ and libs/; using app/common/`);
  }
  if (commonExists) return inCommon;
  if (libsExists) return inLibs;
  return null;
}

/**
 * Build the preview fixed-resource manifest object from the public/ tree.
 * Pure enumeration (no writes); exported for the colocated spec.
 */
function buildPreviewFixedResourcesManifest() {
  const resources = {};

  /** Register `id` served from `relSource` (relative to public/); skip missing files. */
  const add = (id, relSource) => {
    const fullPath = path.join(projectRoot, 'public', relSource);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      console.warn(`  Warning: fixed resource '${id}' not found at public/${relSource}`);
      return;
    }
    if (!stat.isFile()) return;
    resources[id] = { path: relSource.split(path.sep).join('/'), size: stat.size };
  };

  /** Walk `relDir` (relative to public/) adding `${idPrefix}/{relpath}` entries. */
  const addTree = (idPrefix, relDir, { excludeTests = false, extensions = null } = {}) => {
    const files = scanDirectory(path.join(projectRoot, 'public', relDir));
    for (const { relativePath } of files) {
      if (excludeTests && isTestFile(relativePath)) continue;
      if (extensions && !extensions.includes(path.extname(relativePath).toLowerCase())) continue;
      add(`${idPrefix}/${relativePath}`, `${relDir}/${relativePath}`);
    }
  };

  // 1. Base libraries bundled into libs.zip (the script's own list).
  for (const lib of BASE_LIBS) {
    add(`libs/${lib.dest}`, lib.src);
  }

  // 2. The exporter's always-on library list (adds e.g. xapi/exe_xapi.js).
  for (const libPath of BASE_LIBRARIES) {
    const source = resolveLibrarySource(libPath);
    if (source) add(`libs/${libPath}`, source);
    else console.warn(`  Warning: base library '${libPath}' not found`);
  }

  // 3. Content-detected libraries (LIBRARY_PATTERNS). Directory-based patterns
  //    include their whole tree, exactly like fetchLibraryFiles() does.
  const libraryDirs = new Set();
  const libraryFiles = new Set();
  for (const pattern of LIBRARY_PATTERNS) {
    for (const file of pattern.files) {
      if (pattern.isDirectory) libraryDirs.add(file.split('/')[0]);
      else libraryFiles.add(file);
    }
  }
  for (const dirName of libraryDirs) {
    const source = resolveLibrarySource(dirName);
    if (source) addTree(`libs/${dirName}`, source, { excludeTests: true });
    else console.warn(`  Warning: library directory '${dirName}' not found`);
  }
  for (const libPath of libraryFiles) {
    if (libraryDirs.has(libPath.split('/')[0])) continue; // covered by the tree walk
    const source = resolveLibrarySource(libPath);
    if (source) add(`libs/${libPath}`, source);
    else console.warn(`  Warning: library file '${libPath}' not found`);
  }

  // 4. PDF.js (referenced by the preview's PDF embed decorator).
  addTree('libs/pdfjs', 'libs/pdfjs');

  // 5. Base iDevice export runtimes. Folder names ARE the normalized type
  //    names the exporter uses for its idevices/{type}/ output paths.
  const idevicesBase = path.join(projectRoot, 'public', 'files/perm/idevices/base');
  if (fs.existsSync(idevicesBase)) {
    for (const entry of fs.readdirSync(idevicesBase, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const exportDir = `files/perm/idevices/base/${entry.name}/export`;
      if (!fs.existsSync(path.join(projectRoot, 'public', exportDir))) continue;
      addTree(`idevices/${entry.name}`, exportDir, { excludeTests: true });
    }
  }

  // 6. Base themes. Ids are theme-qualified because the served path (theme/…)
  //    does not carry the theme name.
  const themesBase = path.join(projectRoot, 'public', 'files/perm/themes/base');
  if (fs.existsSync(themesBase)) {
    for (const entry of fs.readdirSync(themesBase, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      addTree(`theme:${entry.name}`, `files/perm/themes/base/${entry.name}`);
    }
  }

  // 7. Content CSS and the "powered by" logo (fixed export-path ids).
  add('content/css/base.css', 'style/workarea/base.css');
  add('content/img/exe_powered_logo.png', 'app/common/exe_powered_logo/exe_powered_logo.png');

  // 8. Global fonts (same extension filter as fetchGlobalFontFiles).
  const fontsBase = path.join(projectRoot, 'public', 'files/perm/fonts/global');
  if (fs.existsSync(fontsBase)) {
    for (const entry of fs.readdirSync(fontsBase, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      addTree(`fonts/global/${entry.name}`, `files/perm/fonts/global/${entry.name}`, {
        extensions: ['.woff', '.woff2', '.ttf', '.txt'],
      });
    }
  }

  return { schemaVersion: 1, buildVersion, resources };
}

/**
 * Build the preview fixed-resource manifest file
 */
function buildPreviewFixedResources(manifest) {
  console.log('\nBuilding preview fixed-resource manifest...');

  const fixedManifest = buildPreviewFixedResourcesManifest();
  const outputFile = path.join(OUTPUT_PATH, 'preview-fixed-resources.json');
  fs.writeFileSync(outputFile, JSON.stringify(fixedManifest, null, 2));

  const count = Object.keys(fixedManifest.resources).length;
  manifest.previewFixedResources = { files: count };
  console.log(`  ${count} fixed resources`);
}

/**
 * Main build function
 */
function build() {
  console.log(`Building resource bundles (build version: ${buildVersion})...`);

  // Clean output directory (but preserve any existing themes subdirectory marker)
  if (fs.existsSync(OUTPUT_PATH)) {
    fs.rmSync(OUTPUT_PATH, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_PATH, { recursive: true });

  const manifest = {
    buildVersion, // Version at build time (for reference)
    builtAt: new Date().toISOString(),
  };

  // Build all bundles
  buildThemeBundles(manifest);
  buildIdevicesBundle(manifest);
  buildLibsBundle(manifest);
  buildCommonLibsBundle(manifest);
  buildContentCssBundle(manifest);
  buildPreviewFixedResources(manifest);

  // Write manifest
  const manifestPath = path.join(OUTPUT_PATH, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\nManifest written to ${manifestPath}`);
  console.log('\nResource bundles built successfully!');
}

// Run build only when executed directly (the spec imports the functions above).
if (require.main === module) {
  build();
}

module.exports = { buildPreviewFixedResourcesManifest };

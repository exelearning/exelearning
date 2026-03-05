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

  // Write manifest
  const manifestPath = path.join(OUTPUT_PATH, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\nManifest written to ${manifestPath}`);
  console.log('\nResource bundles built successfully!');
}

// Run build
build();

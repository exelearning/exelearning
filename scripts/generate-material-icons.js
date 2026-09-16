#!/usr/bin/env node

/**
 * Generate the vendored Material Symbols assets from the npm package.
 *
 * eXeLearning ships the Material icon set as a SINGLE sprite
 * (`public/libs/material-icons/material-icons.svg`) plus a name catalog
 * (`public/app/workarea/project/idevices/content/materialIconCatalog.js`).
 * The loose per-icon SVG files were removed: shipping ~3,800 tiny files
 * bloated the static editor bundle (and the repo) for no benefit, since the
 * editor renders icons from the sprite and the export pipeline extracts only
 * the icons a project actually uses (see src/shared/material-icons/spriteParser.ts).
 *
 * Run this only when bumping the icon set:
 *   1. bun add -D @material-symbols/svg-400   (or `make deps`)
 *   2. node scripts/generate-material-icons.js
 *
 * Source: @material-symbols/svg-400/outlined, filled variant (`*-fill.svg`),
 * weight 400. Filenames are converted kebab-case -> snake_case.
 */

const fs = require('node:fs/promises');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'node_modules', '@material-symbols', 'svg-400', 'outlined');
const spriteFile = path.join(repoRoot, 'public', 'libs', 'material-icons', 'material-icons.svg');
const catalogFile = path.join(
    repoRoot,
    'public',
    'app',
    'workarea',
    'project',
    'idevices',
    'content',
    'materialIconCatalog.js',
);

function extractSvgParts(svgContent, iconName) {
    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/i);
    if (!viewBoxMatch) {
        throw new Error(`Missing viewBox in ${iconName}`);
    }
    const bodyMatch = svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    if (!bodyMatch) {
        throw new Error(`Invalid SVG structure in ${iconName}`);
    }
    return { viewBox: viewBoxMatch[1], body: bodyMatch[1].trim() };
}

async function generate() {
    let entries;
    try {
        entries = await fs.readdir(sourceDir, { withFileTypes: true });
    } catch (error) {
        throw new Error(
            `Material Symbols package not found at ${sourceDir}.\n` +
                'Install it first: `bun add -D @material-symbols/svg-400` (or run `make deps`).\n' +
                `Original error: ${error.message}`,
        );
    }

    const svgFiles = entries
        .filter(entry => entry.isFile() && entry.name.endsWith('-fill.svg'))
        .map(entry => entry.name)
        .sort((a, b) => a.localeCompare(b));

    if (svgFiles.length === 0) {
        throw new Error(`No "*-fill.svg" icons found in ${sourceDir}`);
    }

    const names = [];
    const symbols = [];

    for (const fileName of svgFiles) {
        // Material Symbols filenames are kebab-case (e.g. "arrow-back-fill.svg").
        const baseName = path.basename(fileName, '.svg').replace(/-fill$/, '');
        const iconName = baseName.replace(/-/g, '_');
        const svgContent = await fs.readFile(path.join(sourceDir, fileName), 'utf8');
        const { viewBox, body } = extractSvgParts(svgContent, fileName);
        names.push(iconName);
        symbols.push(`<symbol id="${iconName}" viewBox="${viewBox}">\n${body}\n</symbol>`);
    }

    const sprite = [
        '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">',
        symbols.join('\n'),
        '</svg>',
        '',
    ].join('\n');

    const catalog = `export const MATERIAL_ICON_CATALOG = [\n${names.map(name => `    "${name}",`).join('\n')}\n];\n`;

    await fs.writeFile(spriteFile, sprite, 'utf8');
    await fs.writeFile(catalogFile, catalog, 'utf8');

    console.log(`Generated sprite (${names.length} icons): ${spriteFile}`);
    console.log(`Generated catalog (${names.length} icons): ${catalogFile}`);
}

generate().catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
});

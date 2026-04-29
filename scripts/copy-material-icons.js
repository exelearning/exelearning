#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'node_modules', '@material-symbols', 'svg-400', 'outlined');
const targetDir = path.join(repoRoot, 'public', 'libs', 'material-icons', 'icons');

async function copyMaterialIcons() {
    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true });

    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    const svgFiles = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('-fill.svg'))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

    let copied = 0;
    for (const fileName of svgFiles) {
        // Material Symbols filenames use kebab-case already (e.g., "arrow-back.svg")
        // Convert to snake_case for consistency with Material Icons conventions
        const baseName = path.basename(fileName, '.svg').replace(/-fill$/, '');
        const snakeName = baseName.replace(/-/g, '_');
        const targetName = `${snakeName}.svg`;

        await fs.copyFile(path.join(sourceDir, fileName), path.join(targetDir, targetName));
        copied++;
    }

    console.log(`Copied ${copied} filled Material Icons to ${targetDir}`);
}

copyMaterialIcons().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

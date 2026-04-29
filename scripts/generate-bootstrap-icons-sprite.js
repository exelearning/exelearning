#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const iconsDir = path.join(repoRoot, 'public', 'libs', 'bootstrap-icons', 'icons');
const outputFile = path.join(repoRoot, 'public', 'libs', 'bootstrap-icons', 'bootstrap-icons.svg');

function extractSvgParts(svgContent, iconName) {
    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/i);
    if (!viewBoxMatch) {
        throw new Error(`Missing viewBox in ${iconName}.svg`);
    }

    const bodyMatch = svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    if (!bodyMatch) {
        throw new Error(`Invalid SVG structure in ${iconName}.svg`);
    }

    return {
        viewBox: viewBoxMatch[1],
        body: bodyMatch[1].trim(),
    };
}

async function buildSprite() {
    const entries = await fs.readdir(iconsDir, { withFileTypes: true });
    const iconFiles = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.svg'))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

    const symbols = [];

    for (const fileName of iconFiles) {
        const iconName = path.basename(fileName, '.svg');
        const svgContent = await fs.readFile(path.join(iconsDir, fileName), 'utf8');
        const { viewBox, body } = extractSvgParts(svgContent, iconName);
        symbols.push(`<symbol id="${iconName}" viewBox="${viewBox}">\n${body}\n</symbol>`);
    }

    const sprite = [
        '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">',
        symbols.join('\n'),
        '</svg>',
        '',
    ].join('\n');

    await fs.writeFile(outputFile, sprite, 'utf8');
    console.log(`Generated ${outputFile} with ${iconFiles.length} icons.`);
}

buildSprite().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

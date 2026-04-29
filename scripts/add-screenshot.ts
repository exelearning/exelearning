#!/usr/bin/env bun
/**
 * add-screenshot.ts — add a placeholder `screenshot.png` to an `.elpx`.
 *
 * v4 packages are expected to ship a 1280×720 PNG thumbnail at the ZIP
 * root. Older fixtures and round-tripped conversions often lack one. This
 * script reads the project title from `content.xml` (`<key>pp_title</key>`)
 * and writes a generated thumbnail with that title, leaving every other
 * file in the package untouched.
 *
 * Usage:
 *   bun run scripts/add-screenshot.ts <input.elpx> [output.elpx] [--force]
 *
 * If `output` is omitted, the script writes to `<input>` in place.
 * Pass `--force` to regenerate the thumbnail even when one already exists.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { unzipSync, zipSync } from 'fflate';

const WIDTH = 1280;
const HEIGHT = 720;

function extractTitle(contentXml: string, fallback: string): string {
    const m = contentXml.match(/<key>pp_title<\/key>\s*<value>([^<]*)<\/value>/);
    if (m && m[1]?.trim()) return m[1].trim();
    return fallback;
}

function wrapTitle(title: string, maxLineLength: number): string[] {
    const words = title.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        if (!current) {
            current = word;
        } else if ((current + ' ' + word).length <= maxLineLength) {
            current += ' ' + word;
        } else {
            lines.push(current);
            current = word;
        }
    }
    if (current) lines.push(current);
    return lines.slice(0, 3); // cap at 3 lines
}

function renderPng(title: string): Buffer {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // Background — eXeLearning brand-ish gradient
    const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    grad.addColorStop(0, '#1565c0');
    grad.addColorStop(1, '#0d47a1');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Decorative top stripe
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, 0, WIDTH, 80);

    // Bottom band with eXeLearning attribution
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, HEIGHT - 80, WIDTH, 80);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '24px sans-serif';
    ctx.fillText('eXeLearning project', WIDTH / 2, HEIGHT - 40);

    // Title (wrapped)
    const lines = wrapTitle(title, 32);
    const fontSize = lines.length === 1 ? 80 : lines.length === 2 ? 64 : 52;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    const lineHeight = fontSize * 1.25;
    const totalHeight = lines.length * lineHeight;
    const startY = HEIGHT / 2 - totalHeight / 2 + lineHeight / 2;
    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], WIDTH / 2, startY + i * lineHeight);
    }

    return canvas.toBuffer('image/png');
}

async function processFile(inputPath: string, outputPath: string, force: boolean): Promise<void> {
    const inputBuf = await fs.readFile(inputPath);
    const unzipped = unzipSync(new Uint8Array(inputBuf));

    if (!unzipped['content.xml']) {
        throw new Error(`Not a valid .elpx (no content.xml): ${inputPath}`);
    }

    if (unzipped['screenshot.png'] && !force) {
        console.log(`${path.basename(inputPath)}: already has screenshot.png, skipping (use --force to regenerate)`);
        if (inputPath !== outputPath) {
            await fs.copyFile(inputPath, outputPath);
        }
        return;
    }

    const fallbackTitle = path.basename(inputPath, path.extname(inputPath));
    const contentXml = new TextDecoder('utf-8').decode(unzipped['content.xml']);
    const title = extractTitle(contentXml, fallbackTitle);

    const png = renderPng(title);

    const newZip: Record<string, Uint8Array> = {};
    for (const [p, data] of Object.entries(unzipped)) {
        if (p.endsWith('/')) continue;
        if (p === 'screenshot.png') continue; // dropped; replaced below
        newZip[p] = data;
    }
    newZip['screenshot.png'] = new Uint8Array(png);

    const out = zipSync(newZip, { level: 6 });
    await fs.writeFile(outputPath, out);

    console.log(`${path.basename(inputPath)}: added screenshot.png (${png.length} bytes, title: "${title}")`);
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    if (argv.length < 1) {
        console.error('Usage: bun run scripts/add-screenshot.ts <input.elpx> [output.elpx] [--force]');
        process.exit(1);
    }

    const force = argv.includes('--force');
    const positional = argv.filter(a => !a.startsWith('--'));
    const input = positional[0];
    const output = positional[1] ?? input;

    const inputAbs = path.resolve(input);
    const outputAbs = path.resolve(output);

    if (!(await fs.stat(inputAbs).catch(() => null))) {
        console.error(`Input file not found: ${inputAbs}`);
        process.exit(1);
    }

    const useTemp = inputAbs === outputAbs;
    const stageOut = useTemp ? `${outputAbs}.screenshot.tmp` : outputAbs;

    await processFile(inputAbs, stageOut, force);

    if (useTemp) {
        await fs.rename(stageOut, outputAbs);
    }
}

main().catch(err => {
    console.error(`add-screenshot failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
});

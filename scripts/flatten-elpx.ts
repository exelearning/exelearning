#!/usr/bin/env bun
/**
 * flatten-elpx.ts — collapse legacy v3 UUID subfolders inside `.elpx`
 * `content/resources/`.
 *
 * eXeLearning supports two folder shapes inside `content/resources/`:
 *
 *   1. Legacy v3 UUID subfolders, named after an ODE identifier
 *      `YYYYMMDDHHmmss` + 6 uppercase alphanumeric chars (regex
 *      `^[0-9]{14}[A-Z0-9]{6}$`). These were an artefact of the v3
 *      exporter and offer no information beyond the random ID. Modern
 *      v4 exports do not produce them; round-tripped files often still
 *      carry them.
 *   2. User-organised folders such as `photos/`, `vacation/`, or
 *      `lesson-1/handouts/`. The file-manager UI lets authors create
 *      these and the asset record stores them as `folderPath` so the
 *      same structure can be re-applied on every export
 *      (`BaseExporter.addAssetsToZipWithResourcePath` →
 *      `content/resources/<folderPath>/<filename>`).
 *
 * This script flattens **only** the legacy UUID subfolders. User folders
 * are preserved verbatim. Inside the UUID-only group it also
 * deduplicates byte-identical files, resolves name conflicts with `_2`,
 * `_3` suffixes, and rewrites every reference inside the textual files
 * of the package (`content.xml`, `index.html`, `html/*.html`).
 *
 * Usage:
 *   bun run scripts/flatten-elpx.ts <input.elpx> [output.elpx]
 *
 * If `output` is omitted, the script writes to `<input>` (in-place).
 *
 * Mirrors the logic of the standalone elpx-flattener web tool
 * (https://github.com/erseco/elpx-flattener), with the additional
 * safeguard that user-created folders survive untouched.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync, zipSync, type Unzipped } from 'fflate';

interface RenameEntry {
    oldPath: string;
    newName: string;
}

interface FlattenStats {
    resourceFiles: number;
    duplicates: number;
    conflicts: number;
    referencesUpdated: number;
}

function sha256(data: Uint8Array): string {
    return createHash('sha256').update(data).digest('hex');
}

function getFileName(p: string): string {
    return p.split('/').pop() ?? p;
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Classify ZIP entries and build the rename map.
 *
 * Returns:
 *   - renameMap: original ZIP path → new filename (without folder)
 *   - filesToUpdate: paths whose textual content references the old paths
 *   - stats: counts for reporting
 */
/**
 * The ODE identifier pattern used by legacy v3 exports as a per-asset
 * subfolder name. Matches exactly 14 digits followed by exactly 6
 * uppercase alphanumeric characters (e.g. `20251009090601DKVACR`).
 *
 * We only collapse subfolders whose immediate name matches this pattern.
 * User-organised folders (`photos`, `lesson-1`, …) never match it and
 * are therefore preserved.
 */
const ODE_ID_FOLDER = /^[0-9]{14}[A-Z0-9]{6}$/;

function analyze(unzipped: Unzipped): {
    renameMap: Map<string, string>;
    filesToUpdate: string[];
    stats: FlattenStats;
} {
    // Match `content/resources/<segment>/<rest>` where `<segment>` is the
    // first directory level. We only flatten this entry when `<segment>`
    // matches the ODE-ID pattern. The captured `<rest>` (everything after
    // the UUID folder) is preserved verbatim, so a hypothetical
    // `content/resources/<UUID>/photos/sub.jpg` correctly normalises to
    // `content/resources/photos/sub.jpg`.
    const firstLevelSubfolder = /^content\/resources\/([^/]+)\/(.+)$/;

    // Use the post-UUID path (the "rest") as the deduplication key so two
    // copies of `<UUID-A>/photos/x.jpg` and `<UUID-B>/photos/x.jpg` collide
    // on the same target `photos/x.jpg`.
    const filesByTarget = new Map<string, { path: string; hash: string }[]>();
    const filesToUpdate: string[] = [];
    const renameMap = new Map<string, string>();

    let resourceFiles = 0;
    let duplicates = 0;
    let conflicts = 0;

    for (const [p, data] of Object.entries(unzipped)) {
        if (p.endsWith('/')) continue;

        if (p === 'content.xml' || p === 'index.html') {
            filesToUpdate.push(p);
            continue;
        }
        if (p.startsWith('html/') && p.endsWith('.html')) {
            filesToUpdate.push(p);
            continue;
        }

        const m = p.match(firstLevelSubfolder);
        if (!m) continue;

        const firstSegment = m[1];
        if (!ODE_ID_FOLDER.test(firstSegment)) {
            // User-organised folder: leave it alone.
            continue;
        }

        const rest = m[2]; // everything after the UUID folder
        resourceFiles++;
        const hash = sha256(data);
        if (!filesByTarget.has(rest)) filesByTarget.set(rest, []);
        filesByTarget.get(rest)!.push({ path: p, hash });
    }

    for (const [target, files] of filesByTarget) {
        if (files.length === 1) {
            renameMap.set(files[0].path, target);
            continue;
        }

        // Group by hash to spot duplicates vs conflicts
        const byHash = new Map<string, string[]>();
        for (const f of files) {
            if (!byHash.has(f.hash)) byHash.set(f.hash, []);
            byHash.get(f.hash)!.push(f.path);
        }

        if (byHash.size === 1) {
            // All identical — pure duplicates
            duplicates += files.length - 1;
            for (const f of files) renameMap.set(f.path, target);
        } else {
            // Real conflict: same target path, different content. Suffix
            // the basename portion only; preserve the directory parts.
            conflicts++;
            const slash = target.lastIndexOf('/');
            const dir = slash >= 0 ? target.slice(0, slash + 1) : '';
            const base = slash >= 0 ? target.slice(slash + 1) : target;
            let suffix = 1;
            for (const [, paths] of byHash) {
                let newName: string;
                if (suffix === 1) {
                    newName = target;
                } else {
                    const dot = base.lastIndexOf('.');
                    const newBase =
                        dot > 0 ? `${base.slice(0, dot)}_${suffix}${base.slice(dot)}` : `${base}_${suffix}`;
                    newName = `${dir}${newBase}`;
                }
                for (const p of paths) renameMap.set(p, newName);
                suffix++;
            }
        }
    }

    return {
        renameMap,
        filesToUpdate,
        stats: { resourceFiles, duplicates, conflicts, referencesUpdated: 0 },
    };
}

/**
 * Apply renames to the textual content of `content.xml` / HTML files.
 *
 * Replaces every form an asset reference can take:
 *   - `resources/<oldFolder>/<oldName>`
 *   - URI-encoded variants
 *   - `<oldFolder>/<oldName>` (folder + filename without leading `resources/`)
 *
 * Longest-first ordering avoids partial overlap.
 */
function updateReferences(content: string, renameMap: Map<string, string>): { content: string; replacements: number } {
    const replacements: { from: string; to: string }[] = [];

    for (const [oldPath, newTarget] of renameMap) {
        // oldPath is like `content/resources/<UUID>/<rest>`
        // newTarget is like `<rest>` (the post-UUID path)
        const rel = oldPath.replace(/^content\//, ''); // resources/<UUID>/<rest>
        const parts = rel.split('/');
        if (parts.length < 3) continue;
        const folder = parts[1]; // the UUID
        const oldRest = parts.slice(2).join('/');

        const newRel = `resources/${newTarget}`;
        const oldRel = `resources/${folder}/${oldRest}`;

        replacements.push({ from: oldRel, to: newRel });
        replacements.push({ from: encodeURIComponent(oldRel), to: encodeURIComponent(newRel) });
        replacements.push({
            from: `resources/${encodeURIComponent(folder)}/${oldRest}`,
            to: newRel,
        });
        // Folder + rest without `resources/` prefix (XML form
        // `{{context_path}}/<UUID>/<rest>` becomes `{{context_path}}/<rest>`).
        replacements.push({ from: `${folder}/${oldRest}`, to: newTarget });
    }

    // Longest first to prevent partial overlap mistakes
    replacements.sort((a, b) => b.from.length - a.from.length);

    let updated = content;
    let count = 0;
    for (const { from, to } of replacements) {
        if (from === to) continue;
        const before = updated;
        updated = updated.split(from).join(to);
        if (updated !== before) count++;
    }

    return { content: updated, replacements: count };
}

async function flattenFile(inputPath: string, outputPath: string): Promise<FlattenStats> {
    const inputBuf = await fs.readFile(inputPath);
    const unzipped = unzipSync(new Uint8Array(inputBuf));

    if (!unzipped['content.xml']) {
        throw new Error(`Not a valid .elpx (no content.xml): ${inputPath}`);
    }

    const { renameMap, filesToUpdate, stats } = analyze(unzipped);

    if (renameMap.size === 0) {
        // Nothing to flatten
        if (inputPath !== outputPath) {
            await fs.copyFile(inputPath, outputPath);
        }
        return stats;
    }

    const newZip: Record<string, Uint8Array> = {};
    const addedResources = new Set<string>();
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();
    let referencesUpdated = 0;

    for (const [p, data] of Object.entries(unzipped)) {
        if (p.endsWith('/')) continue;

        if (renameMap.has(p)) {
            const newName = renameMap.get(p)!;
            const newPath = `content/resources/${newName}`;
            if (!addedResources.has(newName)) {
                newZip[newPath] = data;
                addedResources.add(newName);
            }
            continue;
        }

        if (filesToUpdate.includes(p)) {
            const text = decoder.decode(data);
            const { content: updated, replacements } = updateReferences(text, renameMap);
            referencesUpdated += replacements;
            newZip[p] = encoder.encode(updated);
            continue;
        }

        // Drop empty UUID subfolder entries left over from the v3 layout —
        // their files have all been hoisted to `content/resources/` above.
        if (/^content\/resources\/[^/]+\/$/.test(p)) continue;

        newZip[p] = data;
    }

    const out = zipSync(newZip, { level: 6 });
    await fs.writeFile(outputPath, out);

    stats.referencesUpdated = referencesUpdated;
    return stats;
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    if (argv.length < 1) {
        console.error('Usage: bun run scripts/flatten-elpx.ts <input.elpx> [output.elpx]');
        process.exit(1);
    }

    const input = argv[0];
    const output = argv[1] ?? argv[0]; // default in-place

    const inputAbs = path.resolve(input);
    const outputAbs = path.resolve(output);

    if (!(await fs.stat(inputAbs).catch(() => null))) {
        console.error(`Input file not found: ${inputAbs}`);
        process.exit(1);
    }

    // For in-place writes, stage to a sibling temp file then rename
    const useTemp = inputAbs === outputAbs;
    const stageOut = useTemp ? `${outputAbs}.flatten.tmp` : outputAbs;

    const stats = await flattenFile(inputAbs, stageOut);

    if (useTemp) {
        await fs.rename(stageOut, outputAbs);
    }

    const fileLabel = path.basename(inputAbs);
    console.log(
        `${fileLabel}: ${stats.resourceFiles} subfolder files, ${stats.duplicates} duplicates merged, ` +
            `${stats.conflicts} conflicts resolved, ${stats.referencesUpdated} reference patterns updated`,
    );
}

main().catch(err => {
    console.error(`flatten-elpx failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
});

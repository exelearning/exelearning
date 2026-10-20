#!/usr/bin/env bun
/**
 * Build the grading catalogue and its packages for the live-Moodle lanes.
 *
 * The lanes under `test/e2e/playwright/specs-moodle/` replay the declared scenarios
 * (test/helpers/grading-scenarios.ts) against a real Moodle. Each one reads its inputs
 * from an audit root:
 *
 *   <root>/scenarios/catalogue.json                     the declared scenarios
 *   <root>/packages/<producer>/manifest-<producer>.json head, digests, page lists
 *   <root>/packages/<producer>/<id>-<producer>-<fmt>.zip one package per scenario+format
 *
 * Before this script those three things had no producer in the repository, so the
 * matrix / oracle / serving-matrix / exelearning-matrix lanes could not be run from a
 * clean clone (audit N-13, harness-2310 §9). This builds them with the SAME production
 * exporters the integration spec uses — `buildGradingStructure()` via
 * `createGradingDocument()`, then `Scorm12Exporter` / `Html5Exporter` / `ElpxExporter`
 * with `FileSystemResourceProvider` + `FflateZipProvider` — so the packages a lane
 * grades are exactly what the CLI exporters produce, not a fixture.
 *
 * One zip is written per SCENARIO, named `<scenarioId>-<producer>-<format>.zip`, because
 * that is how every lane addresses a package. Scenarios that share a package (M3 and its
 * control M3C) get identical bytes under their own names; the export runs once per
 * distinct `ProjectSpec`.
 *
 * NOT produced here: the `allidevices-{main,2209,2209fix}-*.zip` packages the
 * `all-idevices-*.spec.ts` lanes consume. Those come from a real 33-iDevice project
 * exported by each revision's own exporter, not from a spec this repository declares —
 * see test/e2e/moodle/README.md.
 *
 * Usage:
 *   bun run scripts/build-grading-catalogue.ts [--root=DIR] [--producer=LABEL] [--formats=scorm12,html5,elpx]
 *
 * Defaults: root = $AUDIT_ROOT or `test-results/moodle-harness` (what the lanes default
 * to), producer = $AUDIT_CATALOGUE_PRODUCER or `local`, formats = all three.
 */
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
    ElpxExporter,
    FflateZipProvider,
    FileSystemAssetProvider,
    FileSystemResourceProvider,
    Html5Exporter,
    Scorm12Exporter,
    unzipSync,
} from '../src/shared/export';
import { createGradingDocument, type ProjectSpec } from '../test/helpers/grading-fixtures';
import {
    CATALOGUE_VERSION,
    GRADING_SCENARIOS,
    cataloguePath,
    gradingPackages,
    manifestPath,
    packageFileName,
} from '../test/helpers/grading-scenarios';

/** The export formats this producer can build, mapped to their exporter class. */
const EXPORTERS = {
    scorm12: Scorm12Exporter,
    html5: Html5Exporter,
    elpx: ElpxExporter,
} as const;

/** A format name the producer knows how to build. */
export type CatalogueFormat = keyof typeof EXPORTERS;

/** Every format, in a stable order. */
export const ALL_FORMATS: CatalogueFormat[] = ['scorm12', 'html5', 'elpx'];

/** The two runtime files a SCORM 1.2 package carries, whose digests a lane records. */
const SCORM12_RUNTIME_FILES = ['libs/SCORM_API_wrapper.js', 'libs/SCOFunctions.js'];

/** One built package: the zip bytes, its digest, its pages and any runtime digests. */
interface BuiltFormat {
    bytes: Uint8Array;
    sha256: string;
    pages: { file: string }[];
    runtimeSha256?: Record<string, string>;
}

/** What one scenario's manifest entry carries, per format. */
interface ManifestPackage {
    file: string;
    sha256: string;
    pages: { file: string }[];
    runtimeSha256?: Record<string, string>;
}

/** The manifest a producer writes; the shape the live lanes read. */
export interface CatalogueManifest {
    producer: string;
    head: string;
    worktreeDirty: boolean;
    generatedAt: string;
    scenarios: { id: string; title: string; packages: Record<string, ManifestPackage> }[];
}

/** Hex SHA-256 of some bytes. */
function sha256Hex(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

/** The package's page files, index.html first, in the order the exporter wrote them. */
function pagesOf(files: Record<string, Uint8Array>): { file: string }[] {
    const names = Object.keys(files).filter(
        name => name === 'index.html' || (name.startsWith('html/') && name.endsWith('.html')),
    );
    names.sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : 0));
    return names.map(file => ({ file }));
}

/**
 * Export one spec in one format with the production exporter.
 *
 * @param spec the project to export
 * @param format which exporter to run
 * @param workDir a scratch directory for the extracted-assets provider
 * @returns the zip bytes, its digest, its pages and (for scorm12) its runtime digests
 */
export async function buildFormat(spec: ProjectSpec, format: CatalogueFormat, workDir: string): Promise<BuiltFormat> {
    const extracted = path.join(workDir, 'extracted');
    fs.mkdirSync(extracted, { recursive: true });

    const Exporter = EXPORTERS[format];
    const document = createGradingDocument(spec, extracted);
    const exporter = new Exporter(
        document,
        new FileSystemResourceProvider(path.join(process.cwd(), 'public')),
        new FileSystemAssetProvider(extracted),
        new FflateZipProvider(),
    );
    const result = await exporter.export();
    if (!result.success || !result.data) {
        throw new Error(`${format} export failed for ${spec.odeId ?? spec.title}: ${result.error ?? 'unknown error'}`);
    }

    const bytes = result.data as unknown as Uint8Array;
    const files = unzipSync(bytes) as unknown as Record<string, Uint8Array>;

    const built: BuiltFormat = { bytes, sha256: sha256Hex(bytes), pages: pagesOf(files) };
    if (format === 'scorm12') {
        const runtimeSha256: Record<string, string> = {};
        for (const name of SCORM12_RUNTIME_FILES) {
            if (files[name]) runtimeSha256[name] = sha256Hex(files[name]);
        }
        built.runtimeSha256 = runtimeSha256;
    }
    return built;
}

/** The current checkout, for the manifest's provenance. */
function gitProvenance(): { head: string; worktreeDirty: boolean } {
    try {
        const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
        const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
        return { head, worktreeDirty: status.length > 0 };
    } catch {
        return { head: 'unknown', worktreeDirty: false };
    }
}

/** Options for {@link buildCatalogue}. */
export interface BuildCatalogueOptions {
    /** The audit root to write under. */
    root: string;
    /** The producer label (which revision built the packages). */
    producer: string;
    /** Which formats to build; defaults to all three. */
    formats?: CatalogueFormat[];
    /** A scratch directory for intermediate export assets; defaults under the root. */
    workDir?: string;
    /** Where progress is reported; defaults to console.log. Pass a no-op to silence. */
    log?: (message: string) => void;
}

/** What {@link buildCatalogue} wrote. */
export interface BuildCatalogueResult {
    cataloguePath: string;
    manifestPath: string;
    manifest: CatalogueManifest;
    /** Every zip written, absolute paths. */
    zips: string[];
}

/**
 * Build the catalogue, the packages and the manifest under an audit root.
 *
 * @returns the paths written and the manifest, so a test can assert on them
 */
export async function buildCatalogue(options: BuildCatalogueOptions): Promise<BuildCatalogueResult> {
    const formats = options.formats ?? ALL_FORMATS;
    const log = options.log ?? ((message: string) => console.log(message));
    const root = path.resolve(options.root);
    const producer = options.producer;
    const workDir = options.workDir ?? path.join(root, '.work', producer);

    const packageDir = path.join(root, 'packages', producer);
    fs.mkdirSync(packageDir, { recursive: true });
    fs.mkdirSync(path.dirname(cataloguePath(root)), { recursive: true });

    // Export once per DISTINCT package (spec), then write it under every scenario that
    // uses it — M3 and M3C share a spec object and therefore the same bytes.
    const builtBySpec = new Map<ProjectSpec, Partial<Record<CatalogueFormat, BuiltFormat>>>();
    for (const pkg of gradingPackages()) {
        const perFormat: Partial<Record<CatalogueFormat, BuiltFormat>> = {};
        for (const format of formats) {
            log(`building ${pkg.id} (${format})`);
            perFormat[format] = await buildFormat(pkg.spec, format, path.join(workDir, `${pkg.id}-${format}`));
        }
        builtBySpec.set(pkg.spec, perFormat);
    }

    const provenance = gitProvenance();
    const manifest: CatalogueManifest = {
        producer,
        head: provenance.head,
        worktreeDirty: provenance.worktreeDirty,
        generatedAt: new Date().toISOString(),
        scenarios: [],
    };

    const zips: string[] = [];
    for (const scenario of GRADING_SCENARIOS) {
        const built = builtBySpec.get(scenario.spec);
        if (!built) throw new Error(`no built package for scenario ${scenario.id}`);
        const packages: Record<string, ManifestPackage> = {};
        for (const format of formats) {
            const one = built[format];
            if (!one) continue;
            const file = packageFileName(scenario.id, producer, format);
            fs.writeFileSync(path.join(packageDir, file), Buffer.from(one.bytes));
            zips.push(path.join(packageDir, file));
            packages[format] = {
                file,
                sha256: one.sha256,
                pages: one.pages,
                ...(one.runtimeSha256 ? { runtimeSha256: one.runtimeSha256 } : {}),
            };
        }
        manifest.scenarios.push({ id: scenario.id, title: scenario.title, packages });
    }

    const manifestFile = manifestPath(root, producer);
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

    const catalogueFile = cataloguePath(root);
    fs.writeFileSync(
        catalogueFile,
        `${JSON.stringify(
            {
                catalogueVersion: CATALOGUE_VERSION,
                generatedFrom: {
                    head: provenance.head,
                    worktreeDirty: provenance.worktreeDirty,
                    generatedAt: manifest.generatedAt,
                },
                scenarios: GRADING_SCENARIOS,
            },
            null,
            2,
        )}\n`,
    );

    // The scratch directory is only needed while exporting.
    fs.rmSync(workDir, { recursive: true, force: true });

    return { cataloguePath: catalogueFile, manifestPath: manifestFile, manifest, zips };
}

/** Parse `--key=value` arguments into a record. */
export function parseArgs(argv: string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const arg of argv) {
        const match = /^--([^=]+)=(.*)$/.exec(arg);
        if (match) out[match[1]] = match[2];
    }
    return out;
}

/** Resolve the formats named on the command line, or all of them. */
export function resolveFormats(value: string | undefined): CatalogueFormat[] {
    if (!value) return ALL_FORMATS;
    const requested = value.split(',').filter(Boolean);
    for (const format of requested) {
        if (!(format in EXPORTERS)) {
            throw new Error(`unknown format '${format}' — one of ${ALL_FORMATS.join(', ')}`);
        }
    }
    return requested as CatalogueFormat[];
}

if (import.meta.main) {
    const args = parseArgs(process.argv.slice(2));
    const root = args.root ?? process.env.AUDIT_ROOT ?? path.resolve('test-results/moodle-harness');
    const producer = args.producer ?? process.env.AUDIT_CATALOGUE_PRODUCER ?? 'local';
    const formats = resolveFormats(args.formats);

    const result = await buildCatalogue({ root, producer, formats });
    console.log(
        `Wrote ${result.zips.length} package(s) for producer '${producer}' under ${path.dirname(result.manifestPath)}`,
    );
    console.log(`Catalogue: ${result.cataloguePath}`);
    console.log(`Manifest:  ${result.manifestPath}`);
}

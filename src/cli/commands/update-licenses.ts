/**
 * Update Licenses Command
 * Scans npm/bun packages and updates the public/libs/README.md file
 * with current license and copyright information.
 *
 * Usage: bun cli update-licenses [options]
 * Options:
 *   --dry-run     Show what would be written without modifying files
 *   --check       Fail if the committed file is not what this command would write
 *   --json        Output package info as JSON (for debugging)
 */
import { getBoolean, hasHelp, parseArgs } from '../utils/args';
import { colors, error, EXIT_CODES, info, success, warning } from '../utils/output';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = process.cwd();
const README_PATH = path.join(PROJECT_ROOT, 'public', 'libs', 'README.md');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');
const NODE_MODULES_PATH = path.join(PROJECT_ROOT, 'node_modules');

/** A hand-recorded attribution. `license` is only needed when the package cannot be read here. */
export interface AttributionOverride {
    copyright: string;
    /** Set only for packages this machine can never install; otherwise package.json wins. */
    license?: string;
}

/**
 * Attributions that cannot be derived from package metadata on this machine.
 *
 * Two causes, both of which leave the generator with nothing to read:
 *
 * - The package ships no `author`/`maintainers` field, and either no LICENSE file or a
 *   verbatim license text with no copyright line. The MathJax font packages are published
 *   by the MathJax Consortium (see the `@mathjax/src` package, whose maintainers field
 *   states it explicitly) from the shared MathJax-fonts repository, under Apache-2.0.
 * - The package declares an `os`/`cpu` that excludes this platform, so `bun install` skips
 *   it and no run here can ever read it. `@codecov/bundle-analyzer` is linux/darwin only.
 *   Recording it here is what makes the generated file identical on every OS. Reading the
 *   entry back out of our own output instead would make `--check` self-referential on the
 *   one platform that cannot verify it: a stale or hand-edited line would pass forever.
 *
 * An entry stays reviewable in the diff, which a carry-over from the output never is.
 *
 * Null-prototype on purpose: the key is an arbitrary package name off package.json, and a
 * plain object would answer `constructor` or `toString` with an inherited Object.prototype
 * member -- a function where a copyright holder is expected.
 */
export const COPYRIGHT_OVERRIDES: Record<string, AttributionOverride> = Object.assign(Object.create(null), {
    // linux/darwin only: never installed on Windows, so the license comes from here too.
    '@codecov/bundle-analyzer': { copyright: 'Codecov', license: 'MIT' },
    // Icon set authored by Google (see the package README and
    // https://github.com/google/material-design-icons); repackaged for npm by Ravindra Marella.
    '@material-symbols/svg-400': { copyright: 'Google LLC' },
    '@mathjax/mathjax-dsfont-font-extension': { copyright: 'MathJax Consortium' },
    '@mathjax/mathjax-mhchem-font-extension': { copyright: 'MathJax Consortium' },
    '@mathjax/mathjax-newcm-font': { copyright: 'MathJax Consortium' },
    // pdf.js ships only the bare Apache-2.0 text, with no copyright line of its own.
    'pdfjs-dist': { copyright: 'Mozilla Foundation' },
}) as Record<string, AttributionOverride>;

/** Package metadata extracted from node_modules */
export interface PackageInfo {
    name: string;
    version: string;
    license: string;
    copyright: string;
}

export interface UpdateLicensesResult {
    success: boolean;
    message: string;
    packages?: PackageInfo[];
}

/** Dependencies for dependency injection in tests */
export interface UpdateLicensesDependencies {
    readFile: (path: string) => string;
    writeFile: (path: string, content: string) => void;
    existsSync: (path: string) => boolean;
    projectRoot: string;
}

const defaultDeps: UpdateLicensesDependencies = {
    readFile: (p: string) => fs.readFileSync(p, 'utf-8'),
    writeFile: (p: string, content: string) => fs.writeFileSync(p, content, 'utf-8'),
    existsSync: (p: string) => fs.existsSync(p),
    projectRoot: PROJECT_ROOT,
};

let deps = defaultDeps;

export function configure(newDeps: Partial<UpdateLicensesDependencies>): void {
    deps = { ...defaultDeps, ...newDeps };
}

export function resetDependencies(): void {
    deps = defaultDeps;
}

/**
 * Extract copyright from package.json author field
 * Handles string format "Name <email>" and object format { name, email }
 */
export function extractAuthorFromPackageJson(pkg: Record<string, unknown>): string | null {
    // Try author field first
    const author = pkg.author;
    if (author) {
        if (typeof author === 'string') {
            // Format: "Name <email>" or just "Name"
            const match = author.match(/^([^<(]+)/);
            if (match) {
                return match[1].trim();
            }
            return author.trim();
        }
        if (typeof author === 'object' && author !== null) {
            const authorObj = author as Record<string, unknown>;
            if (typeof authorObj.name === 'string') {
                return authorObj.name;
            }
        }
    }

    // Try maintainers or contributors
    const maintainers = pkg.maintainers || pkg.contributors;
    if (Array.isArray(maintainers) && maintainers.length > 0) {
        const names: string[] = [];
        for (const m of maintainers.slice(0, 3)) {
            // Limit to 3 contributors
            if (typeof m === 'string') {
                const match = m.match(/^([^<(]+)/);
                if (match) names.push(match[1].trim());
            } else if (typeof m === 'object' && m !== null && typeof (m as Record<string, unknown>).name === 'string') {
                names.push((m as Record<string, unknown>).name as string);
            }
        }
        if (names.length > 0) {
            return names.join(', ');
        }
    }

    return null;
}

/**
 * Matches the standard license boilerplate that says "copyright" without naming a holder.
 *
 * Each word is one a license template puts immediately after "Copyright", so the capture
 * starts with it and what follows is a clause rather than a person:
 *
 * - `owner`   -- Apache-2.0 definitions ("the copyright owner or entity authorized by")
 * - `holders` -- the MIT liability clause ("COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM")
 * - `notice`  -- "copyright notice and this permission notice shall be included"
 * - `[`       -- the unfilled `Copyright [yyyy] [name of copyright owner]` placeholder
 *
 * The plural is not optional: `holder\b` does not match `HOLDERS`, the form the MIT text uses,
 * so `minimist` was attributed to "HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER...".
 */
const BOILERPLATE_COPYRIGHT = /^(?:(?:owner|holder|notice)s?\b|\[)/i;

/**
 * Boilerplate that only a year-less capture can start with.
 *
 * "Grant of Copyright License. Subject to the terms and conditions of" is Apache-2.0 section
 * 2, and it is what `pdfjs-dist`, `@material-symbols/svg-400` and `@mathjax/src` would each be
 * attributed to without this. It is kept apart from BOILERPLATE_COPYRIGHT because a holder
 * legitimately *can* be named "License ..." after a year, and no license template writes a
 * four-digit year in front of its own prose -- so the word is only evidence of boilerplate
 * where no year was matched.
 *
 * Both guards matter for release metadata: generation and `--check` run the same extraction,
 * so a wrong holder is not just written, it is then confirmed as correct forever.
 */
const BOILERPLATE_YEARLESS_COPYRIGHT = /^(?:licen[sc]es?|licensors?)\b/i;

/**
 * Extract copyright from LICENSE file content
 * Looks for patterns like "Copyright (c) YYYY Author" or "(c) YYYY Author"
 */
export function extractCopyrightFromLicense(content: string): string | null {
    // A year, a comma-separated enumeration ("2013, 2014, 2015"), or a range
    // ("2020-2023", "2019 - present", and the same with an en or em dash).
    const singleYear = String.raw`\d{4}`;
    const year =
        String.raw`${singleYear}(?:\s*,\s*${singleYear})*` +
        String.raw`(?:\s*[-\u2013\u2014]\s*(?:${singleYear}|present))?`;
    // What separates the year from the holder. `Copyright (c) 2015, Scott Motte` is the most
    // common BSD/MIT form and `2023. Foo` is not rare; without these the notice falls through
    // to the generic `Copyright (.+)` pattern, which keeps the year as part of the name.
    const yearSeparator = String.raw`\s*[,.]?\s+`;
    // Common copyright patterns - capture everything until newline, period, or end.
    // Global on purpose: an Apache-2.0 LICENSE states the boilerplate definition of the
    // "copyright owner" long before it names the real holder, so a rejected match must not
    // end the search for that pattern - the notice that matters is further down the file.
    const yearAnchored = [
        new RegExp(String.raw`Copyright\s*(?:\(c\)|©)?\s*${year}${yearSeparator}(.+)`, 'gi'),
        new RegExp(String.raw`\(c\)\s*${year}${yearSeparator}(.+)`, 'gi'),
        new RegExp(String.raw`©\s*${year}${yearSeparator}(.+)`, 'gi'),
    ];
    // Last resort for a notice that carries no year, and the only pattern the license prose
    // can reach: it takes the extra BOILERPLATE_YEARLESS_COPYRIGHT guard on top.
    const yearLess = /Copyright\s+(.+)/gi;

    for (const pattern of [...yearAnchored, yearLess]) {
        for (const match of content.matchAll(pattern)) {
            if (BOILERPLATE_COPYRIGHT.test(match[1])) {
                continue;
            }
            if (pattern === yearLess && BOILERPLATE_YEARLESS_COPYRIGHT.test(match[1])) {
                continue;
            }
            // Get first line only
            let author = match[1].split('\n')[0];
            // Clean up the result - remove "All rights reserved", email, etc.
            author = author
                .replace(/all rights reserved\.?/gi, '')
                .replace(/,?\s*as listed in:.*$/i, '') // Drop pointers to a contributors page
                .replace(/\s+https?:\/\/\S+/gi, '') // Drop trailing URLs
                .replace(/<[^>]+>/g, '') // Remove emails in <brackets>
                .replace(/\s*\([^)]*\)/g, '') // Remove parenthetical notes
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
            // Remove trailing punctuation
            author = author.replace(/[,.:;]+$/, '').trim();
            if (author) {
                return author;
            }
        }
    }

    return null;
}

/**
 * Get package information from node_modules
 */
export function getPackageInfo(packageName: string): PackageInfo | null {
    const packageDir = path.join(deps.projectRoot, 'node_modules', packageName);
    const packageJsonPath = path.join(packageDir, 'package.json');

    if (!deps.existsSync(packageJsonPath)) {
        return null;
    }

    try {
        const pkg = JSON.parse(deps.readFile(packageJsonPath)) as Record<string, unknown>;

        // Get version
        const version = typeof pkg.version === 'string' ? pkg.version : 'unknown';

        // Get license
        let license = 'Unknown';
        if (typeof pkg.license === 'string') {
            license = pkg.license;
        } else if (pkg.license && typeof (pkg.license as Record<string, unknown>).type === 'string') {
            license = (pkg.license as Record<string, unknown>).type as string;
        } else if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
            const first = pkg.licenses[0] as Record<string, unknown>;
            if (typeof first.type === 'string') {
                license = first.type;
            }
        }

        // Get copyright - manual overrides win over automatic extraction
        let copyright: string | null = COPYRIGHT_OVERRIDES[packageName]?.copyright ?? null;

        // Otherwise try package.json author first
        if (!copyright) {
            copyright = extractAuthorFromPackageJson(pkg);
        }

        // If no author in package.json, try LICENSE file
        if (!copyright) {
            const licenseFiles = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'LICENSE-MIT', 'LICENCE'];
            for (const licenseFile of licenseFiles) {
                const licensePath = path.join(packageDir, licenseFile);
                if (deps.existsSync(licensePath)) {
                    const licenseContent = deps.readFile(licensePath);
                    copyright = extractCopyrightFromLicense(licenseContent);
                    if (copyright) break;
                }
            }
        }

        // If still no copyright, try README
        if (!copyright) {
            const readmeFiles = ['README.md', 'README', 'readme.md', 'Readme.md'];
            for (const readmeFile of readmeFiles) {
                const readmePath = path.join(packageDir, readmeFile);
                if (deps.existsSync(readmePath)) {
                    const readmeContent = deps.readFile(readmePath);
                    copyright = extractCopyrightFromLicense(readmeContent);
                    if (copyright) break;
                }
            }
        }

        // Fallback
        if (!copyright) {
            copyright = 'Unknown';
        }

        return {
            name: packageName,
            version,
            license,
            copyright,
        };
    } catch {
        return null;
    }
}

/**
 * Get all dependencies from package.json
 */
export function getDependencies(): string[] {
    const packageJsonPath = path.join(deps.projectRoot, 'package.json');

    if (!deps.existsSync(packageJsonPath)) {
        throw new Error('package.json not found');
    }

    const pkg = JSON.parse(deps.readFile(packageJsonPath)) as Record<string, unknown>;
    const allDeps = new Set<string>();

    const dependencies = pkg.dependencies as Record<string, string> | undefined;
    const devDependencies = pkg.devDependencies as Record<string, string> | undefined;

    if (dependencies) {
        for (const dep of Object.keys(dependencies)) {
            allDeps.add(dep);
        }
    }

    if (devDependencies) {
        for (const dep of Object.keys(devDependencies)) {
            allDeps.add(dep);
        }
    }

    return Array.from(allDeps).sort();
}

/**
 * Generate the server-side packages markdown section
 */
export function generateServerSideSection(packages: PackageInfo[]): string {
    const lines: string[] = [
        '## Server-side packages',
        '',
        '*   Runtime: Bun',
        '    *   Copyright: Oven (Jarred Sumner)',
        '    *   License: MIT',
        '*   Framework: Elysia',
        '    *   Copyright: SaltyAom',
        '    *   License: MIT',
        '*   ORM: Kysely',
        '    *   Copyright: Sami Koskimäki',
        '    *   License: MIT',
    ];

    for (const pkg of packages) {
        lines.push(`*   Package: ${pkg.name}`);
        lines.push(`    *   Copyright: ${pkg.copyright}`);
        lines.push(`    *   License: ${pkg.license}`);
    }

    return lines.join('\n');
}

/**
 * The attribution for a dependency that is declared but absent from `node_modules`.
 *
 * `bun install` skips a package whose `os`/`cpu` excludes the current platform, so
 * `@codecov/bundle-analyzer` (linux/darwin only) is never installed on Windows. Dropping it
 * because this machine cannot see it would quietly shorten a legal attribution list, so the
 * hand-recorded entry stands in and the output is the same on every OS.
 *
 * Returns `null` when nothing is recorded: the caller must then refuse to write rather than
 * emit a short list.
 */
export function attributionFromOverride(packageName: string): PackageInfo | null {
    const override = COPYRIGHT_OVERRIDES[packageName];
    if (!override?.license) {
        return null;
    }

    return { name: packageName, version: 'unknown', copyright: override.copyright, license: override.license };
}

/**
 * Update the README file with new server-side packages section
 */
export function updateReadme(newServerSection: string, dryRun: boolean): { updated: boolean; content: string } {
    const readmePath = path.join(deps.projectRoot, 'public', 'libs', 'README.md');

    if (!deps.existsSync(readmePath)) {
        throw new Error('public/libs/README.md not found');
    }

    const currentContent = deps.readFile(readmePath);

    // Find the sections
    const serverSideStart = currentContent.indexOf('## Server-side packages');
    const clientSideStart = currentContent.indexOf('## Client-side libraries');

    if (serverSideStart === -1) {
        throw new Error('Could not find "## Server-side packages" section in README');
    }

    if (clientSideStart === -1) {
        throw new Error('Could not find "## Client-side libraries" section in README');
    }

    // Build new content
    const header = currentContent.substring(0, serverSideStart);
    const clientSideSection = currentContent.substring(clientSideStart);

    const newContent = `${header}${newServerSection}\n\n${clientSideSection}`;

    if (!dryRun) {
        deps.writeFile(readmePath, newContent);
    }

    return {
        updated: newContent !== currentContent,
        content: newContent,
    };
}

/**
 * Execute the update-licenses command
 */
export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
): Promise<UpdateLicensesResult> {
    const dryRun = getBoolean(flags, 'dry-run', false);
    const checkOnly = getBoolean(flags, 'check', false);
    const jsonOutput = getBoolean(flags, 'json', false);

    try {
        // Get all dependencies
        info('Reading package.json...');
        const dependencyNames = getDependencies();
        info(`Found ${dependencyNames.length} dependencies`);

        // Get package info for each dependency
        info('Scanning node_modules for package metadata...');
        const packages: PackageInfo[] = [];
        const carriedOver: string[] = [];
        const unresolved: string[] = [];

        for (const name of dependencyNames) {
            const pkgInfo = getPackageInfo(name);
            if (pkgInfo) {
                packages.push(pkgInfo);
                continue;
            }

            const recorded = attributionFromOverride(name);
            if (recorded) {
                packages.push(recorded);
                carriedOver.push(name);
                continue;
            }

            unresolved.push(name);
        }

        for (const name of carriedOver) {
            warning(`Could not read package: ${name} — using the attribution recorded in COPYRIGHT_OVERRIDES`);
        }

        // A declared dependency with no metadata and no recorded entry would silently
        // shorten a legal attribution list. Say so and write nothing.
        //
        // Both causes have to be named, because only one of them is fixable here: a
        // package whose `os`/`cpu` excludes this platform is skipped by every
        // `bun install` on this machine, so telling the operator to install again would
        // send them round a loop they cannot leave.
        if (unresolved.length > 0) {
            const plural = unresolved.length === 1 ? 'dependency' : 'dependencies';
            return {
                success: false,
                message:
                    `Cannot attribute ${unresolved.length} declared ${plural}: ${unresolved.join(', ')}. ` +
                    'Absent from node_modules, and COPYRIGHT_OVERRIDES records nothing to stand in, so the ' +
                    'generated list would be incomplete and nothing was written. Either the dependencies ' +
                    'are not installed here — run `make deps` — or the package declares an "os"/"cpu" that ' +
                    'excludes this platform, in which case no run on this machine can ever read it: add its ' +
                    'copyright and license to COPYRIGHT_OVERRIDES in src/cli/commands/update-licenses.ts, or ' +
                    'regenerate on a platform the package supports.',
            };
        }

        info(`Processed ${packages.length} packages (${carriedOver.length} carried over)`);

        // JSON output mode for debugging
        if (jsonOutput) {
            console.log(JSON.stringify(packages, null, 2));
            return {
                success: true,
                message: `Output ${packages.length} packages as JSON`,
                packages,
            };
        }

        // Generate new server-side section
        const serverSection = generateServerSideSection(packages);

        // Drift check for CI: report, never write.
        if (checkOnly) {
            const { updated } = updateReadme(serverSection, true);
            if (updated) {
                return {
                    success: false,
                    message:
                        'public/libs/README.md is not what update-licenses would generate. ' +
                        'Run `make update-licenses` and commit the result.',
                    packages,
                };
            }
            return {
                success: true,
                message: `public/libs/README.md is up to date (${packages.length} packages)`,
                packages,
            };
        }

        // Update README
        info(`${dryRun ? '[DRY RUN] Would update' : 'Updating'} public/libs/README.md...`);
        const result = updateReadme(serverSection, dryRun);

        if (dryRun) {
            if (result.updated) {
                info('Changes would be made to public/libs/README.md');
                info('Use without --dry-run to apply changes');
            } else {
                info('No changes needed - README is already up to date');
            }
        } else {
            if (result.updated) {
                info('Successfully updated public/libs/README.md');
            } else {
                info('No changes needed - README is already up to date');
            }
        }

        return {
            success: true,
            message: dryRun
                ? `[DRY RUN] Would update README with ${packages.length} packages`
                : `Updated README with ${packages.length} packages`,
            packages,
        };
    } catch (err) {
        return {
            success: false,
            message: err instanceof Error ? err.message : String(err),
        };
    }
}

export function printHelp(): void {
    console.log(`
${colors.bold('update-licenses')} - Update license information in public/libs/README.md

${colors.cyan('Usage:')}
  bun cli update-licenses [options]

${colors.cyan('Options:')}
  --dry-run     Show what would be written without modifying files
  --check       Fail if the committed file differs from what would be generated
  --json        Output package info as JSON (for debugging)
  -h, --help    Show this help message

${colors.cyan('Description:')}
  Scans package.json dependencies and reads metadata from node_modules
  to generate an updated "Server-side packages" section in public/libs/README.md.

  The command extracts:
  - Package name and version
  - License (from package.json)
  - Copyright/author (from package.json author, LICENSE file, or README)

  A declared dependency that is not in node_modules is attributed from
  COPYRIGHT_OVERRIDES - bun install skips packages whose "os" field excludes the
  current platform, and those must not vanish from a legal attribution list.
  Recording them in the source keeps the generated file identical on every OS.
  A dependency with neither metadata nor a recorded override aborts the run: an
  incomplete attribution file is never written.

${colors.cyan('Output format:')}
  *   Package: package-name
      *   Copyright: Author Name
      *   License: MIT

${colors.cyan('Examples:')}
  bun cli update-licenses                 # Update README with license info
  bun cli update-licenses --dry-run       # Preview changes without modifying
  bun cli update-licenses --json          # Output package data as JSON

${colors.cyan('Make command:')}
  make update-licenses                    # Run via Makefile
  make update-licenses DRY_RUN=1          # Dry run via Makefile
`);
}

/**
 * Run CLI when executed directly
 */
export async function runCli(
    argv: string[],
    customDeps?: Partial<UpdateLicensesDependencies>,
    exit: (code: number) => void = process.exit,
): Promise<void> {
    if (customDeps) {
        configure(customDeps);
    }

    const { positional, flags } = parseArgs(argv);

    if (hasHelp(flags)) {
        printHelp();
        exit(EXIT_CODES.SUCCESS);
        return;
    }

    const result = await execute(positional, flags);

    if (result.success) {
        success(result.message);
        exit(EXIT_CODES.SUCCESS);
    } else {
        error(result.message);
        exit(EXIT_CODES.FAILURE);
    }
}

// Allow running directly
if (import.meta.main) {
    runCli(process.argv).catch(err => {
        error(err instanceof Error ? err.message : String(err));
        process.exit(EXIT_CODES.FAILURE);
    });
}

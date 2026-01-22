/**
 * Update Licenses Command
 * Scans npm/bun packages and updates the public/libs/README.md file
 * with current license and copyright information.
 *
 * Usage: bun cli update-licenses [options]
 * Options:
 *   --dry-run     Show what would be written without modifying files
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
 * Extract copyright from LICENSE file content
 * Looks for patterns like "Copyright (c) YYYY Author" or "(c) YYYY Author"
 */
export function extractCopyrightFromLicense(content: string): string | null {
    // Common copyright patterns - capture everything until newline, period, or end
    const patterns = [
        /Copyright\s*(?:\(c\)|©)?\s*\d{4}(?:[,-]\d{4})?\s+(.+)/i,
        /\(c\)\s*\d{4}(?:[,-]\d{4})?\s+(.+)/i,
        /©\s*\d{4}(?:[,-]\d{4})?\s+(.+)/i,
        /Copyright\s+(.+)/i,
    ];

    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            // Get first line only
            let author = match[1].split('\n')[0];
            // Clean up the result - remove "All rights reserved", email, etc.
            author = author
                .replace(/all rights reserved\.?/gi, '')
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

        // Get copyright - try package.json author first
        let copyright = extractAuthorFromPackageJson(pkg);

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
    const jsonOutput = getBoolean(flags, 'json', false);

    try {
        // Get all dependencies
        info('Reading package.json...');
        const dependencyNames = getDependencies();
        info(`Found ${dependencyNames.length} dependencies`);

        // Get package info for each dependency
        info('Scanning node_modules for package metadata...');
        const packages: PackageInfo[] = [];
        let skipped = 0;

        for (const name of dependencyNames) {
            const pkgInfo = getPackageInfo(name);
            if (pkgInfo) {
                packages.push(pkgInfo);
            } else {
                skipped++;
                warning(`Could not read package: ${name}`);
            }
        }

        info(`Processed ${packages.length} packages (${skipped} skipped)`);

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
  --json        Output package info as JSON (for debugging)
  -h, --help    Show this help message

${colors.cyan('Description:')}
  Scans package.json dependencies and reads metadata from node_modules
  to generate an updated "Server-side packages" section in public/libs/README.md.

  The command extracts:
  - Package name and version
  - License (from package.json)
  - Copyright/author (from package.json author, LICENSE file, or README)

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

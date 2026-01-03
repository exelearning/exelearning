/**
 * Export test utilities
 * Provides functions for setting up and validating export tests
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import { ExportFormatType, ExportContext } from '../../src/services/export/interfaces';
import { ParsedOdeStructure } from '../../src/services/xml/interfaces';
import { createTempTestDir, cleanupTempTestDir } from './fixture-loader';

// Export fixtures directory
const EXPORT_FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'export');

/**
 * Test session configuration
 */
export interface TestSessionConfig {
    sessionId: string;
    sessionPath: string;
    exportDir: string;
    tempDir: string;
}

/**
 * Export fixture info
 */
export interface ExportFixtureInfo {
    name: string;
    basePath: string;
    formats: ExportFormatType[];
    hasWeb: boolean;
    hasPage: boolean;
    hasScorm: boolean;
    hasIms: boolean;
    hasEpub: boolean;
    hasElpx: boolean;
}

/**
 * Directory structure comparison result
 */
export interface DirectoryComparisonResult {
    match: boolean;
    missing: string[];
    extra: string[];
    different: string[];
}

/**
 * Setup a test session with temporary directories
 * @param prefix Optional prefix for temp directory
 * @returns Test session configuration
 */
export async function setupTestSession(prefix: string = 'export-test-'): Promise<TestSessionConfig> {
    const sessionId = uuidv4();
    const tempDir = await createTempTestDir(prefix);
    const sessionPath = path.join(tempDir, 'session');
    const exportDir = path.join(tempDir, 'export');

    await fs.ensureDir(sessionPath);
    await fs.ensureDir(exportDir);

    return {
        sessionId,
        sessionPath,
        exportDir,
        tempDir,
    };
}

/**
 * Cleanup test session directories
 * @param config Test session configuration
 */
export async function cleanupTestSession(config: TestSessionConfig): Promise<void> {
    await cleanupTempTestDir(config.tempDir);
}

/**
 * Get path to an export fixture
 * @param fixtureName Base fixture name (e.g., 'un-heroe-medieval-el-cid')
 * @param format Export format
 * @returns Path to the fixture directory
 */
export function getExportFixturePath(fixtureName: string, format: ExportFormatType): string {
    const suffixMap: Record<ExportFormatType, string> = {
        [ExportFormatType.HTML5]: '_web',
        [ExportFormatType.PAGE]: '_page',
        [ExportFormatType.SCORM12]: '_scorm',
        [ExportFormatType.IMS]: '_ims',
        [ExportFormatType.EPUB3]: '_epub',
        [ExportFormatType.ELPX]: '_elpx',
    };

    const suffix = suffixMap[format];
    return path.join(EXPORT_FIXTURES_DIR, fixtureName, `${fixtureName}${suffix}`);
}

/**
 * Check if an export fixture exists
 * @param fixtureName Base fixture name
 * @param format Export format
 */
export async function exportFixtureExists(fixtureName: string, format: ExportFormatType): Promise<boolean> {
    const fixturePath = getExportFixturePath(fixtureName, format);
    return fs.pathExists(fixturePath);
}

/**
 * Get list of all available export fixtures
 */
export async function getAvailableExportFixtures(): Promise<ExportFixtureInfo[]> {
    const fixtures: ExportFixtureInfo[] = [];

    if (!(await fs.pathExists(EXPORT_FIXTURES_DIR))) {
        return fixtures;
    }

    const dirs = await fs.readdir(EXPORT_FIXTURES_DIR);

    for (const dir of dirs) {
        const basePath = path.join(EXPORT_FIXTURES_DIR, dir);
        const stats = await fs.stat(basePath);

        if (!stats.isDirectory()) continue;

        const formats: ExportFormatType[] = [];
        const hasWeb = await fs.pathExists(path.join(basePath, `${dir}_web`));
        const hasPage = await fs.pathExists(path.join(basePath, `${dir}_page`));
        const hasScorm = await fs.pathExists(path.join(basePath, `${dir}_scorm`));
        const hasIms = await fs.pathExists(path.join(basePath, `${dir}_ims`));
        const hasEpub = await fs.pathExists(path.join(basePath, `${dir}_epub`));
        const hasElpx = await fs.pathExists(path.join(basePath, `${dir}_elpx`));

        if (hasWeb) formats.push(ExportFormatType.HTML5);
        if (hasPage) formats.push(ExportFormatType.PAGE);
        if (hasScorm) formats.push(ExportFormatType.SCORM12);
        if (hasIms) formats.push(ExportFormatType.IMS);
        if (hasEpub) formats.push(ExportFormatType.EPUB3);
        if (hasElpx) formats.push(ExportFormatType.ELPX);

        fixtures.push({
            name: dir,
            basePath,
            formats,
            hasWeb,
            hasPage,
            hasScorm,
            hasIms,
            hasEpub,
            hasElpx,
        });
    }

    return fixtures;
}

/**
 * Get all files in a directory recursively
 * @param dir Directory path
 * @param basePath Base path for relative paths
 * @returns Array of relative file paths
 */
export async function getDirectoryFiles(dir: string, basePath?: string): Promise<string[]> {
    const base = basePath || dir;
    const files: string[] = [];

    if (!(await fs.pathExists(dir))) {
        return files;
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(base, fullPath);

        if (entry.isDirectory()) {
            const subFiles = await getDirectoryFiles(fullPath, base);
            files.push(...subFiles);
        } else {
            files.push(relativePath);
        }
    }

    return files.sort();
}

/**
 * Compare directory structure between actual and expected
 * @param actualDir Actual export directory
 * @param expectedDir Expected fixture directory
 * @param options Comparison options
 * @returns Comparison result
 */
export async function compareDirectoryStructure(
    actualDir: string,
    expectedDir: string,
    options: {
        ignorePatterns?: RegExp[];
        compareContent?: boolean;
    } = {},
): Promise<DirectoryComparisonResult> {
    const { ignorePatterns = [], compareContent = false } = options;

    const actualFiles = await getDirectoryFiles(actualDir);
    const expectedFiles = await getDirectoryFiles(expectedDir);

    // Filter out ignored files
    const filterIgnored = (files: string[]) => files.filter(f => !ignorePatterns.some(pattern => pattern.test(f)));

    const filteredActual = filterIgnored(actualFiles);
    const filteredExpected = filterIgnored(expectedFiles);

    const actualSet = new Set(filteredActual);
    const expectedSet = new Set(filteredExpected);

    const missing = filteredExpected.filter(f => !actualSet.has(f));
    const extra = filteredActual.filter(f => !expectedSet.has(f));
    const different: string[] = [];

    if (compareContent) {
        const common = filteredActual.filter(f => expectedSet.has(f));

        for (const file of common) {
            const actualPath = path.join(actualDir, file);
            const expectedPath = path.join(expectedDir, file);

            const actualContent = await fs.readFile(actualPath);
            const expectedContent = await fs.readFile(expectedPath);

            if (!actualContent.equals(expectedContent)) {
                different.push(file);
            }
        }
    }

    return {
        match: missing.length === 0 && extra.length === 0 && different.length === 0,
        missing,
        extra,
        different,
    };
}

/**
 * Validate export structure has required files
 * @param exportDir Export directory path
 * @param format Export format
 * @returns Validation result
 */
export async function validateExportStructure(
    exportDir: string,
    format: ExportFormatType,
): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Common files that should exist
    const commonChecks: Record<ExportFormatType, string[]> = {
        [ExportFormatType.HTML5]: ['index.html'],
        [ExportFormatType.PAGE]: ['index.html'],
        [ExportFormatType.SCORM12]: ['index.html', 'imsmanifest.xml'],
        [ExportFormatType.IMS]: ['index.html', 'imsmanifest.xml'],
        [ExportFormatType.EPUB3]: ['mimetype', 'META-INF/container.xml', 'EPUB/package.opf'],
        [ExportFormatType.ELPX]: ['content.xml'],
    };

    const requiredFiles = commonChecks[format] || [];

    for (const file of requiredFiles) {
        const filePath = path.join(exportDir, file);
        if (!(await fs.pathExists(filePath))) {
            errors.push(`Missing required file: ${file}`);
        }
    }

    // Format-specific validations
    switch (format) {
        case ExportFormatType.SCORM12: {
            // Check for SCORM JS files
            const scormApiPath = path.join(exportDir, 'libs', 'SCORM_API_wrapper.js');
            const scoFunctionsPath = path.join(exportDir, 'libs', 'SCOFunctions.js');
            if (!(await fs.pathExists(scormApiPath))) {
                errors.push('Missing SCORM_API_wrapper.js in libs/');
            }
            if (!(await fs.pathExists(scoFunctionsPath))) {
                errors.push('Missing SCOFunctions.js in libs/');
            }
            break;
        }

        case ExportFormatType.EPUB3: {
            // Check mimetype content
            const mimetypePath = path.join(exportDir, 'mimetype');
            if (await fs.pathExists(mimetypePath)) {
                const content = await fs.readFile(mimetypePath, 'utf-8');
                if (content.trim() !== 'application/epub+zip') {
                    errors.push('Invalid mimetype content');
                }
            }
            break;
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Create a mock ExportContext for testing
 * @param overrides Partial context to override defaults
 * @returns Export context
 */
export function createMockExportContext(overrides: Partial<ExportContext> = {}): ExportContext {
    const defaultStructure: ParsedOdeStructure = {
        meta: {
            title: 'Test Project',
            language: 'en',
            author: 'Test Author',
            version: '4.0',
            exelearning_version: '4.0.0',
        },
        pages: [
            {
                id: 'page-1',
                title: 'First Page',
                parent_id: null,
                level: 0,
                position: 0,
                components: [],
            },
        ],
        navigation: {
            page: [],
        },
        raw: {
            ode: {},
        },
    };

    return {
        sessionId: uuidv4(),
        structure: defaultStructure,
        sessionPath: '/tmp/test-session',
        exportDir: '/tmp/test-export',
        options: {},
        ...overrides,
    };
}

/**
 * Copy export fixture to temp directory for modification
 * @param fixtureName Base fixture name
 * @param format Export format
 * @param destDir Destination directory
 */
export async function copyExportFixture(
    fixtureName: string,
    format: ExportFormatType,
    destDir: string,
): Promise<string> {
    const fixturePath = getExportFixturePath(fixtureName, format);
    await fs.copy(fixturePath, destDir);
    return destDir;
}

/**
 * Assert that HTML file contains expected elements
 * @param htmlPath Path to HTML file
 * @param expectedElements Array of strings/patterns to find in HTML
 */
export async function assertHtmlContains(
    htmlPath: string,
    expectedElements: (string | RegExp)[],
): Promise<{ found: boolean[]; missing: (string | RegExp)[] }> {
    const content = await fs.readFile(htmlPath, 'utf-8');
    const found: boolean[] = [];
    const missing: (string | RegExp)[] = [];

    for (const element of expectedElements) {
        if (typeof element === 'string') {
            const isFound = content.includes(element);
            found.push(isFound);
            if (!isFound) missing.push(element);
        } else {
            const isFound = element.test(content);
            found.push(isFound);
            if (!isFound) missing.push(element);
        }
    }

    return { found, missing };
}

/**
 * Wait for file to exist (useful for async operations)
 * @param filePath Path to file
 * @param timeout Timeout in ms
 * @param interval Check interval in ms
 */
export async function waitForFile(filePath: string, timeout: number = 5000, interval: number = 100): Promise<boolean> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        if (await fs.pathExists(filePath)) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    return false;
}

/**
 * Test fixture loader utilities
 * Provides functions to load ELP/ELPX fixtures for testing
 */

import * as path from 'path';
import * as fs from 'fs-extra';

// Fixture directory path
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

// Fixture metadata with expected properties
export interface FixtureInfo {
    name: string;
    path: string;
    size: number;
    category: 'small' | 'medium' | 'large';
    format: 'elp' | 'elpx';
    isLegacy: boolean; // Uses contentv3.xml instead of content.xml
}

// All available fixtures with their metadata
export const FIXTURES: Record<string, Omit<FixtureInfo, 'path' | 'size'>> = {
    'really-simple-test-project.elpx': {
        name: 'really-simple-test-project.elpx',
        category: 'small',
        format: 'elpx',
        isLegacy: false,
    },
    'basic-example.elp': {
        name: 'basic-example.elp',
        category: 'small',
        format: 'elp',
        isLegacy: false,
    },
    'encoding_test.elp': {
        name: 'encoding_test.elp',
        category: 'small',
        format: 'elp',
        isLegacy: false,
    },
    'old_tema-10-ejemplo.elp': {
        name: 'old_tema-10-ejemplo.elp',
        category: 'small',
        format: 'elp',
        isLegacy: true,
    },
    'latex.elp': {
        name: 'latex.elp',
        category: 'small',
        format: 'elp',
        isLegacy: true, // Has contentv3.xml, not content.xml
    },
    'un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion.elpx': {
        name: 'un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion.elpx',
        category: 'medium',
        format: 'elpx',
        isLegacy: false,
    },
    'old_elp_modelocrea.elp': {
        name: 'old_elp_modelocrea.elp',
        category: 'medium',
        format: 'elp',
        isLegacy: true,
    },
    'old_el_cid.elp': {
        name: 'old_el_cid.elp',
        category: 'medium',
        format: 'elp',
        isLegacy: true,
    },
    'old_elp_poder_conexiones.elp': {
        name: 'old_elp_poder_conexiones.elp',
        category: 'medium',
        format: 'elp',
        isLegacy: true,
    },
    'old_elp_nebrija.elp': {
        name: 'old_elp_nebrija.elp',
        category: 'large',
        format: 'elp',
        isLegacy: true,
    },
    'old_manual_exe29_compressed.elp': {
        name: 'old_manual_exe29_compressed.elp',
        category: 'large',
        format: 'elp',
        isLegacy: true,
    },
    'Manual de eXeLearning 3.0.elpx': {
        name: 'Manual de eXeLearning 3.0.elpx',
        category: 'large',
        format: 'elpx',
        isLegacy: false,
    },
};

/**
 * Get the path to the fixtures directory
 */
export function getFixturesDir(): string {
    return FIXTURES_DIR;
}

/**
 * Get the full path to a specific fixture
 * @param name Fixture filename
 */
export function getFixturePath(name: string): string {
    return path.join(FIXTURES_DIR, name);
}

/**
 * Check if a fixture file exists
 * @param name Fixture filename
 */
export async function fixtureExists(name: string): Promise<boolean> {
    return fs.pathExists(getFixturePath(name));
}

/**
 * Get fixture info including file size
 * @param name Fixture filename
 */
export async function getFixtureInfo(name: string): Promise<FixtureInfo | null> {
    const fixtureMeta = FIXTURES[name];
    if (!fixtureMeta) {
        return null;
    }

    const fixturePath = getFixturePath(name);
    if (!(await fs.pathExists(fixturePath))) {
        return null;
    }

    const stats = await fs.stat(fixturePath);

    return {
        ...fixtureMeta,
        path: fixturePath,
        size: stats.size,
    };
}

/**
 * Get all fixture names
 */
export function getAllFixtureNames(): string[] {
    return Object.keys(FIXTURES);
}

/**
 * Get small fixtures (< 1MB) - suitable for fast tests
 */
export function getSmallFixtureNames(): string[] {
    return Object.entries(FIXTURES)
        .filter(([_, info]) => info.category === 'small')
        .map(([name]) => name);
}

/**
 * Get medium fixtures (1-5MB)
 */
export function getMediumFixtureNames(): string[] {
    return Object.entries(FIXTURES)
        .filter(([_, info]) => info.category === 'medium')
        .map(([name]) => name);
}

/**
 * Get large fixtures (> 5MB) - suitable for slow test suite
 */
export function getLargeFixtureNames(): string[] {
    return Object.entries(FIXTURES)
        .filter(([_, info]) => info.category === 'large')
        .map(([name]) => name);
}

/**
 * Get legacy fixtures (contentv3.xml format)
 */
export function getLegacyFixtureNames(): string[] {
    return Object.entries(FIXTURES)
        .filter(([_, info]) => info.isLegacy)
        .map(([name]) => name);
}

/**
 * Get modern fixtures (content.xml format)
 */
export function getModernFixtureNames(): string[] {
    return Object.entries(FIXTURES)
        .filter(([_, info]) => !info.isLegacy)
        .map(([name]) => name);
}

/**
 * Get ELP fixtures
 */
export function getElpFixtureNames(): string[] {
    return Object.entries(FIXTURES)
        .filter(([_, info]) => info.format === 'elp')
        .map(([name]) => name);
}

/**
 * Get ELPX fixtures
 */
export function getElpxFixtureNames(): string[] {
    return Object.entries(FIXTURES)
        .filter(([_, info]) => info.format === 'elpx')
        .map(([name]) => name);
}

/**
 * Get fixtures suitable for quick unit tests (small modern fixtures)
 */
export function getQuickTestFixtureNames(): string[] {
    return Object.entries(FIXTURES)
        .filter(([_, info]) => info.category === 'small' && !info.isLegacy)
        .map(([name]) => name);
}

/**
 * Read fixture file contents as buffer
 * @param name Fixture filename
 */
export async function readFixture(name: string): Promise<Buffer> {
    const fixturePath = getFixturePath(name);
    return fs.readFile(fixturePath);
}

/**
 * Copy fixture to a temporary location
 * @param name Fixture filename
 * @param destDir Destination directory
 * @returns Path to the copied fixture
 */
export async function copyFixtureTo(name: string, destDir: string): Promise<string> {
    const fixturePath = getFixturePath(name);
    const destPath = path.join(destDir, name);
    await fs.copy(fixturePath, destPath);
    return destPath;
}

/**
 * Create a temporary directory for tests
 * @param prefix Directory prefix
 */
export async function createTempTestDir(prefix: string = 'test-'): Promise<string> {
    const tempBase = path.join(__dirname, '..', 'temp');
    await fs.ensureDir(tempBase);
    const tempDir = path.join(tempBase, `${prefix}${Date.now()}`);
    await fs.ensureDir(tempDir);
    return tempDir;
}

/**
 * Clean up temporary test directory
 * @param tempDir Directory to remove
 */
export async function cleanupTempTestDir(tempDir: string): Promise<void> {
    if (tempDir.includes('temp') && (await fs.pathExists(tempDir))) {
        await fs.remove(tempDir);
    }
}

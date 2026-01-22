/**
 * Tests for Update Licenses Command
 */
import { describe, it, expect, afterEach } from 'bun:test';
import {
    execute,
    printHelp,
    runCli,
    configure,
    resetDependencies,
    extractAuthorFromPackageJson,
    extractCopyrightFromLicense,
    getPackageInfo,
    getDependencies,
    generateServerSideSection,
    updateReadme,
    type UpdateLicensesDependencies,
    type PackageInfo,
} from './update-licenses';

describe('Update Licenses Command', () => {
    afterEach(() => {
        resetDependencies();
    });

    describe('extractAuthorFromPackageJson', () => {
        it('should extract author from string format', () => {
            const pkg = { author: 'John Doe <john@example.com>' };
            expect(extractAuthorFromPackageJson(pkg)).toBe('John Doe');
        });

        it('should extract author from string without email', () => {
            const pkg = { author: 'Jane Smith' };
            expect(extractAuthorFromPackageJson(pkg)).toBe('Jane Smith');
        });

        it('should extract author from object format', () => {
            const pkg = { author: { name: 'Bob Wilson', email: 'bob@example.com' } };
            expect(extractAuthorFromPackageJson(pkg)).toBe('Bob Wilson');
        });

        it('should extract from maintainers array', () => {
            const pkg = { maintainers: [{ name: 'Alice' }, { name: 'Bob' }] };
            expect(extractAuthorFromPackageJson(pkg)).toBe('Alice, Bob');
        });

        it('should extract from contributors array', () => {
            const pkg = { contributors: ['Alice <a@b.com>', 'Bob <b@c.com>'] };
            expect(extractAuthorFromPackageJson(pkg)).toBe('Alice, Bob');
        });

        it('should limit to 3 contributors', () => {
            const pkg = {
                contributors: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }],
            };
            expect(extractAuthorFromPackageJson(pkg)).toBe('A, B, C');
        });

        it('should return null when no author info found', () => {
            const pkg = { name: 'test-package' };
            expect(extractAuthorFromPackageJson(pkg)).toBeNull();
        });

        it('should handle empty maintainers array', () => {
            const pkg = { maintainers: [] };
            expect(extractAuthorFromPackageJson(pkg)).toBeNull();
        });
    });

    describe('extractCopyrightFromLicense', () => {
        it('should extract copyright with (c) format', () => {
            const content = 'Copyright (c) 2023 John Doe\n\nPermission is hereby granted...';
            expect(extractCopyrightFromLicense(content)).toBe('John Doe');
        });

        it('should extract copyright with year range', () => {
            const content = 'Copyright (c) 2020-2023 Jane Smith';
            expect(extractCopyrightFromLicense(content)).toBe('Jane Smith');
        });

        it('should extract copyright with © symbol', () => {
            const content = '© 2023 Acme Inc';
            expect(extractCopyrightFromLicense(content)).toBe('Acme Inc');
        });

        it('should extract copyright without year indicator', () => {
            const content = 'Copyright The Test Authors.';
            expect(extractCopyrightFromLicense(content)).toBe('The Test Authors');
        });

        it('should remove "All rights reserved"', () => {
            const content = 'Copyright (c) 2023 Test Corp. All rights reserved.';
            expect(extractCopyrightFromLicense(content)).toBe('Test Corp');
        });

        it('should remove email addresses', () => {
            const content = 'Copyright (c) 2023 John Doe <john@example.com>';
            expect(extractCopyrightFromLicense(content)).toBe('John Doe');
        });

        it('should return null when no copyright found', () => {
            const content = 'MIT License\n\nPermission is hereby granted...';
            expect(extractCopyrightFromLicense(content)).toBeNull();
        });
    });

    describe('getPackageInfo', () => {
        it('should return package info when package exists', () => {
            const mockFiles: Record<string, string> = {
                '/test/node_modules/test-pkg/package.json': JSON.stringify({
                    name: 'test-pkg',
                    version: '1.0.0',
                    license: 'MIT',
                    author: 'Test Author',
                }),
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
            });

            const info = getPackageInfo('test-pkg');
            expect(info).not.toBeNull();
            expect(info?.name).toBe('test-pkg');
            expect(info?.version).toBe('1.0.0');
            expect(info?.license).toBe('MIT');
            expect(info?.copyright).toBe('Test Author');
        });

        it('should return null for non-existent package', () => {
            configure({
                projectRoot: '/test',
                existsSync: () => false,
                readFile: () => '',
            });

            const info = getPackageInfo('non-existent');
            expect(info).toBeNull();
        });

        it('should fallback to LICENSE file for copyright', () => {
            const mockFiles: Record<string, string> = {
                '/test/node_modules/test-pkg/package.json': JSON.stringify({
                    name: 'test-pkg',
                    version: '2.0.0',
                    license: 'Apache-2.0',
                }),
                '/test/node_modules/test-pkg/LICENSE': 'Copyright (c) 2023 License Author\n\nLicense text...',
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
            });

            const info = getPackageInfo('test-pkg');
            expect(info?.copyright).toBe('License Author');
        });

        it('should handle license as object', () => {
            const mockFiles: Record<string, string> = {
                '/test/node_modules/test-pkg/package.json': JSON.stringify({
                    name: 'test-pkg',
                    version: '1.0.0',
                    license: { type: 'BSD-3-Clause', url: 'https://...' },
                    author: 'Test Author',
                }),
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
            });

            const info = getPackageInfo('test-pkg');
            expect(info?.license).toBe('BSD-3-Clause');
        });

        it('should handle licenses array', () => {
            const mockFiles: Record<string, string> = {
                '/test/node_modules/test-pkg/package.json': JSON.stringify({
                    name: 'test-pkg',
                    version: '1.0.0',
                    licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }],
                    author: 'Test Author',
                }),
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
            });

            const info = getPackageInfo('test-pkg');
            expect(info?.license).toBe('MIT');
        });

        it('should set unknown for missing license', () => {
            const mockFiles: Record<string, string> = {
                '/test/node_modules/test-pkg/package.json': JSON.stringify({
                    name: 'test-pkg',
                    version: '1.0.0',
                    author: 'Test Author',
                }),
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
            });

            const info = getPackageInfo('test-pkg');
            expect(info?.license).toBe('Unknown');
        });

        it('should set unknown for missing copyright', () => {
            const mockFiles: Record<string, string> = {
                '/test/node_modules/test-pkg/package.json': JSON.stringify({
                    name: 'test-pkg',
                    version: '1.0.0',
                    license: 'MIT',
                }),
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
            });

            const info = getPackageInfo('test-pkg');
            expect(info?.copyright).toBe('Unknown');
        });
    });

    describe('getDependencies', () => {
        it('should return sorted list of dependencies', () => {
            const mockFiles: Record<string, string> = {
                '/test/package.json': JSON.stringify({
                    dependencies: { zlib: '1.0.0', axios: '2.0.0' },
                    devDependencies: { jest: '3.0.0', babel: '4.0.0' },
                }),
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
            });

            const deps = getDependencies();
            expect(deps).toEqual(['axios', 'babel', 'jest', 'zlib']);
        });

        it('should handle missing dependencies sections', () => {
            const mockFiles: Record<string, string> = {
                '/test/package.json': JSON.stringify({ name: 'test' }),
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
            });

            const deps = getDependencies();
            expect(deps).toEqual([]);
        });

        it('should throw error when package.json not found', () => {
            configure({
                projectRoot: '/test',
                existsSync: () => false,
                readFile: () => '',
            });

            expect(() => getDependencies()).toThrow('package.json not found');
        });
    });

    describe('generateServerSideSection', () => {
        it('should generate correct markdown format', () => {
            const packages: PackageInfo[] = [
                { name: 'test-pkg', version: '1.0.0', license: 'MIT', copyright: 'Test Author' },
            ];

            const section = generateServerSideSection(packages);

            expect(section).toContain('## Server-side packages');
            expect(section).toContain('*   Runtime: Bun');
            expect(section).toContain('*   Framework: Elysia');
            expect(section).toContain('*   ORM: Kysely');
            expect(section).toContain('*   Package: test-pkg');
            expect(section).toContain('    *   Copyright: Test Author');
            expect(section).toContain('    *   License: MIT');
        });

        it('should handle multiple packages', () => {
            const packages: PackageInfo[] = [
                { name: 'pkg-a', version: '1.0.0', license: 'MIT', copyright: 'Author A' },
                { name: 'pkg-b', version: '2.0.0', license: 'Apache-2.0', copyright: 'Author B' },
            ];

            const section = generateServerSideSection(packages);

            expect(section).toContain('*   Package: pkg-a');
            expect(section).toContain('*   Package: pkg-b');
        });

        it('should handle empty packages array', () => {
            const section = generateServerSideSection([]);

            expect(section).toContain('## Server-side packages');
            expect(section).toContain('*   Runtime: Bun');
            expect(section).not.toContain('*   Package:');
        });
    });

    describe('updateReadme', () => {
        const existingReadme = `# THIRD PARTY CODE

## Server-side packages

*   Old package info

## Client-side libraries

*   Client lib info
`;

        it('should update server-side section', () => {
            let writtenContent = '';
            const mockFiles: Record<string, string> = {
                '/test/public/libs/README.md': existingReadme,
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
                writeFile: (p: string, content: string) => {
                    writtenContent = content;
                },
            });

            const newSection = `## Server-side packages

*   New package info`;

            const result = updateReadme(newSection, false);

            expect(result.updated).toBe(true);
            expect(writtenContent).toContain('*   New package info');
            expect(writtenContent).toContain('## Client-side libraries');
            expect(writtenContent).toContain('*   Client lib info');
        });

        it('should not write in dry-run mode', () => {
            let writeCount = 0;
            const mockFiles: Record<string, string> = {
                '/test/public/libs/README.md': existingReadme,
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
                writeFile: () => {
                    writeCount++;
                },
            });

            updateReadme('## Server-side packages\n\n*   New content', true);

            expect(writeCount).toBe(0);
        });

        it('should throw error when README not found', () => {
            configure({
                projectRoot: '/test',
                existsSync: () => false,
                readFile: () => '',
                writeFile: () => {},
            });

            expect(() => updateReadme('test', false)).toThrow('public/libs/README.md not found');
        });

        it('should throw error when server-side section not found', () => {
            const badReadme = '# README\n\n## Client-side libraries\n';
            configure({
                projectRoot: '/test',
                existsSync: () => true,
                readFile: () => badReadme,
                writeFile: () => {},
            });

            expect(() => updateReadme('test', false)).toThrow('Could not find "## Server-side packages"');
        });

        it('should throw error when client-side section not found', () => {
            const badReadme = '# README\n\n## Server-side packages\n';
            configure({
                projectRoot: '/test',
                existsSync: () => true,
                readFile: () => badReadme,
                writeFile: () => {},
            });

            expect(() => updateReadme('test', false)).toThrow('Could not find "## Client-side libraries"');
        });
    });

    describe('execute', () => {
        const mockPackageJson = JSON.stringify({
            dependencies: { 'test-dep': '1.0.0' },
            devDependencies: { 'test-dev-dep': '2.0.0' },
        });

        const mockReadme = `# THIRD PARTY CODE

## Server-side packages

*   Old content

## Client-side libraries

*   Client lib
`;

        it('should successfully update README', async () => {
            let writtenContent = '';
            const mockFiles: Record<string, string> = {
                '/test/package.json': mockPackageJson,
                '/test/node_modules/test-dep/package.json': JSON.stringify({
                    name: 'test-dep',
                    version: '1.0.0',
                    license: 'MIT',
                    author: 'Dep Author',
                }),
                '/test/node_modules/test-dev-dep/package.json': JSON.stringify({
                    name: 'test-dev-dep',
                    version: '2.0.0',
                    license: 'Apache-2.0',
                    author: 'Dev Author',
                }),
                '/test/public/libs/README.md': mockReadme,
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
                writeFile: (p: string, content: string) => {
                    writtenContent = content;
                },
            });

            const result = await execute([], {});

            expect(result.success).toBe(true);
            expect(result.packages).toHaveLength(2);
            expect(writtenContent).toContain('test-dep');
            expect(writtenContent).toContain('test-dev-dep');
        });

        it('should handle dry-run mode', async () => {
            let writeCount = 0;
            const mockFiles: Record<string, string> = {
                '/test/package.json': mockPackageJson,
                '/test/node_modules/test-dep/package.json': JSON.stringify({
                    name: 'test-dep',
                    version: '1.0.0',
                    license: 'MIT',
                    author: 'Author',
                }),
                '/test/node_modules/test-dev-dep/package.json': JSON.stringify({
                    name: 'test-dev-dep',
                    version: '2.0.0',
                    license: 'MIT',
                    author: 'Author',
                }),
                '/test/public/libs/README.md': mockReadme,
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
                writeFile: () => {
                    writeCount++;
                },
            });

            const result = await execute([], { 'dry-run': true });

            expect(result.success).toBe(true);
            expect(result.message).toContain('[DRY RUN]');
            expect(writeCount).toBe(0);
        });

        it('should output JSON when --json flag is set', async () => {
            const mockFiles: Record<string, string> = {
                '/test/package.json': JSON.stringify({ dependencies: { 'test-pkg': '1.0.0' } }),
                '/test/node_modules/test-pkg/package.json': JSON.stringify({
                    name: 'test-pkg',
                    version: '1.0.0',
                    license: 'MIT',
                    author: 'Test Author',
                }),
                '/test/public/libs/README.md': mockReadme,
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
                writeFile: () => {},
            });

            const result = await execute([], { json: true });

            expect(result.success).toBe(true);
            expect(result.message).toContain('JSON');
            expect(result.packages).toBeDefined();
        });

        it('should handle missing packages gracefully', async () => {
            const mockFiles: Record<string, string> = {
                '/test/package.json': JSON.stringify({
                    dependencies: { 'existing-pkg': '1.0.0', 'missing-pkg': '1.0.0' },
                }),
                '/test/node_modules/existing-pkg/package.json': JSON.stringify({
                    name: 'existing-pkg',
                    version: '1.0.0',
                    license: 'MIT',
                    author: 'Author',
                }),
                '/test/public/libs/README.md': mockReadme,
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
                writeFile: () => {},
            });

            const result = await execute([], {});

            expect(result.success).toBe(true);
            expect(result.packages).toHaveLength(1);
        });

        it('should return error when package.json not found', async () => {
            configure({
                projectRoot: '/test',
                existsSync: () => false,
                readFile: () => '',
                writeFile: () => {},
            });

            const result = await execute([], {});

            expect(result.success).toBe(false);
            expect(result.message).toContain('package.json not found');
        });
    });

    describe('printHelp', () => {
        it('should not throw and contain key sections', () => {
            const originalLog = console.log;
            let output = '';
            console.log = (msg: string) => {
                output += msg;
            };

            expect(() => printHelp()).not.toThrow();

            console.log = originalLog;

            expect(output).toContain('update-licenses');
            expect(output).toContain('--dry-run');
            expect(output).toContain('--json');
            expect(output).toContain('Examples');
        });
    });

    describe('runCli', () => {
        const mockFiles: Record<string, string> = {
            '/test/package.json': JSON.stringify({ dependencies: {} }),
            '/test/public/libs/README.md': `# THIRD PARTY CODE

## Server-side packages

*   Old

## Client-side libraries

*   Client
`,
        };

        const defaultDeps: Partial<UpdateLicensesDependencies> = {
            projectRoot: '/test',
            existsSync: (p: string) => p in mockFiles,
            readFile: (p: string) => mockFiles[p] || '',
            writeFile: () => {},
        };

        it('should show help when --help flag is passed', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', '--help'], defaultDeps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should show help when -h flag is passed', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', '-h'], defaultDeps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should exit with success on successful execution', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'update-licenses'], defaultDeps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should exit with success on dry run', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'update-licenses', '--dry-run'], defaultDeps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should exit with error when README not found', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            const badDeps: Partial<UpdateLicensesDependencies> = {
                projectRoot: '/test',
                existsSync: (p: string) => p === '/test/package.json',
                readFile: (p: string) => (p === '/test/package.json' ? JSON.stringify({ dependencies: {} }) : ''),
                writeFile: () => {},
            };

            await runCli(['bun', 'cli', 'update-licenses'], badDeps, mockExit);

            expect(exitCode).toBe(1);
        });
    });
});

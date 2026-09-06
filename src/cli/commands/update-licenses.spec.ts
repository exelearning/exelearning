/**
 * Tests for Update Licenses Command
 */
import { describe, it, expect, afterEach } from 'bun:test';
import * as path from 'path';
import {
    execute,
    printHelp,
    runCli,
    configure,
    resetDependencies,
    extractAuthorFromPackageJson,
    extractCopyrightFromLicense,
    getPackageInfo,
    COPYRIGHT_OVERRIDES,
    getDependencies,
    generateServerSideSection,
    parseRecordedPackages,
    updateReadme,
    type UpdateLicensesDependencies,
    type PackageInfo,
} from './update-licenses';

/**
 * Builds a mock path under the fake project root with the separator of the host OS.
 *
 * The command joins paths with `path.join`, so a mock key written with forward slashes
 * never matches on Windows and every lookup misses there.
 */
const at = (...parts: string[]): string => path.join('/test', ...parts);

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

        it('should ignore the Apache-2.0 boilerplate definition of "Licensor"', () => {
            const content = [
                '                                 Apache License',
                '                           Version 2.0, January 2004',
                '',
                '      "Licensor" shall mean the copyright owner or entity authorized by',
                '      the copyright owner that is granting the License.',
            ].join('\n');
            expect(extractCopyrightFromLicense(content)).toBeNull();
        });

        it('should ignore the unfilled Apache-2.0 copyright placeholder', () => {
            const content = 'Copyright [yyyy] [name of copyright owner]';
            expect(extractCopyrightFromLicense(content)).toBeNull();
        });

        it('should still extract a real holder from a filled Apache-2.0 notice', () => {
            const content = 'Copyright 2023 Acme Foundation\n\nLicensed under the Apache License...';
            expect(extractCopyrightFromLicense(content)).toBe('Acme Foundation');
        });

        it('should handle an open-ended year range and drop the contributors pointer', () => {
            const content =
                'Copyright 2019 - present Christopher J. Brody and other contributors, ' +
                'as listed in: https://github.com/xmldom/xmldom/graphs/contributors';
            expect(extractCopyrightFromLicense(content)).toBe('Christopher J. Brody and other contributors');
        });

        it('should keep looking past a boilerplate line for the real notice', () => {
            // A rejected match must not abandon the pattern that produced it: licences state
            // the definition of "copyright owner" before naming the holder, and the notice
            // that matters is the one further down.
            const content = [
                'Copyright (c) 2004 owner or entity authorized by the copyright owner',
                '',
                'Copyright (c) 2021 Real Holder',
            ].join('\n');
            expect(extractCopyrightFromLicense(content)).toBe('Real Holder');
        });

        it('should return null when no copyright found', () => {
            const content = 'MIT License\n\nPermission is hereby granted...';
            expect(extractCopyrightFromLicense(content)).toBeNull();
        });
    });

    describe('parseRecordedPackages', () => {
        it('should read back the package entries already in the generated section', () => {
            const readme = `# THIRD PARTY CODE

## Server-side packages

*   Runtime: Bun
    *   Copyright: Oven (Jarred Sumner)
    *   License: MIT
*   Package: @codecov/bundle-analyzer
    *   Copyright: Codecov
    *   License: MIT
*   Package: pdfjs-dist
    *   Copyright: Mozilla Foundation
    *   License: Apache-2.0

## Client-side libraries

*   Package: not-a-server-package
    *   Copyright: Nobody
    *   License: MIT
`;

            const recorded = parseRecordedPackages(readme);

            expect(recorded.size).toBe(2);
            expect(recorded.get('@codecov/bundle-analyzer')).toEqual({
                name: '@codecov/bundle-analyzer',
                version: 'unknown',
                copyright: 'Codecov',
                license: 'MIT',
            });
            expect(recorded.get('pdfjs-dist')?.license).toBe('Apache-2.0');
            // The client-side section is a separate list this command does not generate.
            expect(recorded.has('not-a-server-package')).toBe(false);
        });

        it('should return nothing when the section markers are absent', () => {
            expect(parseRecordedPackages('# THIRD PARTY CODE\n').size).toBe(0);
        });
    });

    describe('getPackageInfo', () => {
        it('should return package info when package exists', () => {
            const mockFiles: Record<string, string> = {
                [at('node_modules', 'test-pkg', 'package.json')]: JSON.stringify({
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

        it('should use the copyright override when the package has no metadata', () => {
            const name = '@mathjax/mathjax-newcm-font';
            const mockFiles: Record<string, string> = {
                [path.join('/test', 'node_modules', name, 'package.json')]: JSON.stringify({
                    name,
                    version: '4.1.3',
                    license: 'Apache-2.0',
                }),
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
            });

            const info = getPackageInfo(name);
            expect(info?.copyright).toBe('MathJax Consortium');
            expect(info?.license).toBe('Apache-2.0');
        });

        it('should prefer the copyright override over extracted metadata', () => {
            const name = '@mathjax/mathjax-dsfont-font-extension';
            const mockFiles: Record<string, string> = {
                [path.join('/test', 'node_modules', name, 'package.json')]: JSON.stringify({
                    name,
                    version: '4.1.3',
                    license: 'Apache-2.0',
                    author: 'Someone Else',
                }),
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
            });

            expect(getPackageInfo(name)?.copyright).toBe('MathJax Consortium');
        });

        it('should apply every declared override, whatever the package metadata says', () => {
            // Asserts the behaviour each entry buys rather than the literal table: a copy of
            // the constant in the spec only re-states the implementation, and passes for a
            // wrong holder as readily as a right one.
            expect(Object.keys(COPYRIGHT_OVERRIDES).length).toBeGreaterThan(0);

            for (const [name, holder] of Object.entries(COPYRIGHT_OVERRIDES)) {
                const mockFiles: Record<string, string> = {
                    [at('node_modules', name, 'package.json')]: JSON.stringify({
                        name,
                        version: '1.0.0',
                        license: 'Apache-2.0',
                        author: 'Whoever npm happens to list',
                    }),
                };

                configure({
                    projectRoot: '/test',
                    existsSync: (p: string) => p in mockFiles,
                    readFile: (p: string) => mockFiles[p] || '',
                });

                expect(getPackageInfo(name)?.copyright).toBe(holder);
            }
        });

        it('should not resolve an Object.prototype member as a copyright holder', () => {
            // The lookup key is an arbitrary package name off package.json. A package really
            // named "constructor" must fall through to its own metadata, not to a function.
            for (const name of ['constructor', 'toString', 'hasOwnProperty']) {
                const mockFiles: Record<string, string> = {
                    [at('node_modules', name, 'package.json')]: JSON.stringify({
                        name,
                        version: '1.0.0',
                        license: 'MIT',
                        author: 'Real Author',
                    }),
                };

                configure({
                    projectRoot: '/test',
                    existsSync: (p: string) => p in mockFiles,
                    readFile: (p: string) => mockFiles[p] || '',
                });

                expect(getPackageInfo(name)?.copyright).toBe('Real Author');
            }
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
                [at('node_modules', 'test-pkg', 'package.json')]: JSON.stringify({
                    name: 'test-pkg',
                    version: '2.0.0',
                    license: 'Apache-2.0',
                }),
                [at('node_modules', 'test-pkg', 'LICENSE')]: 'Copyright (c) 2023 License Author\n\nLicense text...',
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
                [at('node_modules', 'test-pkg', 'package.json')]: JSON.stringify({
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
                [at('node_modules', 'test-pkg', 'package.json')]: JSON.stringify({
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
                [at('node_modules', 'test-pkg', 'package.json')]: JSON.stringify({
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
                [at('node_modules', 'test-pkg', 'package.json')]: JSON.stringify({
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
                [at('package.json')]: JSON.stringify({
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
                [at('package.json')]: JSON.stringify({ name: 'test' }),
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
                [at('public', 'libs', 'README.md')]: existingReadme,
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
                [at('public', 'libs', 'README.md')]: existingReadme,
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
                [at('package.json')]: mockPackageJson,
                [at('node_modules', 'test-dep', 'package.json')]: JSON.stringify({
                    name: 'test-dep',
                    version: '1.0.0',
                    license: 'MIT',
                    author: 'Dep Author',
                }),
                [at('node_modules', 'test-dev-dep', 'package.json')]: JSON.stringify({
                    name: 'test-dev-dep',
                    version: '2.0.0',
                    license: 'Apache-2.0',
                    author: 'Dev Author',
                }),
                [at('public', 'libs', 'README.md')]: mockReadme,
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
                [at('package.json')]: mockPackageJson,
                [at('node_modules', 'test-dep', 'package.json')]: JSON.stringify({
                    name: 'test-dep',
                    version: '1.0.0',
                    license: 'MIT',
                    author: 'Author',
                }),
                [at('node_modules', 'test-dev-dep', 'package.json')]: JSON.stringify({
                    name: 'test-dev-dep',
                    version: '2.0.0',
                    license: 'MIT',
                    author: 'Author',
                }),
                [at('public', 'libs', 'README.md')]: mockReadme,
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
                [at('package.json')]: JSON.stringify({ dependencies: { 'test-pkg': '1.0.0' } }),
                [at('node_modules', 'test-pkg', 'package.json')]: JSON.stringify({
                    name: 'test-pkg',
                    version: '1.0.0',
                    license: 'MIT',
                    author: 'Test Author',
                }),
                [at('public', 'libs', 'README.md')]: mockReadme,
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

        it('should carry over the recorded attribution of a package it cannot read', async () => {
            // bun install skips a package whose "os" excludes the host, so a declared
            // dependency can be unreadable on one platform and readable on another. Its
            // attribution must survive a run on the platform that cannot see it.
            const readmeWithRecord = `# THIRD PARTY CODE

## Server-side packages

*   Package: platform-only-pkg
    *   Copyright: Someone Ltd
    *   License: MIT

## Client-side libraries

*   Client lib
`;
            let writtenContent = '';
            const mockFiles: Record<string, string> = {
                [at('package.json')]: JSON.stringify({
                    dependencies: { 'existing-pkg': '1.0.0', 'platform-only-pkg': '1.0.0' },
                }),
                [at('node_modules', 'existing-pkg', 'package.json')]: JSON.stringify({
                    name: 'existing-pkg',
                    version: '1.0.0',
                    license: 'MIT',
                    author: 'Author',
                }),
                [at('public', 'libs', 'README.md')]: readmeWithRecord,
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
                writeFile: (_p: string, content: string) => {
                    writtenContent = content;
                },
            });

            const result = await execute([], {});

            expect(result.success).toBe(true);
            expect(result.packages).toHaveLength(2);
            expect(writtenContent).toContain('*   Package: platform-only-pkg');
            expect(writtenContent).toContain('*   Copyright: Someone Ltd');
        });

        it('should refuse to write when a declared dependency has neither metadata nor a record', async () => {
            let writeCount = 0;
            const mockFiles: Record<string, string> = {
                [at('package.json')]: JSON.stringify({
                    dependencies: { 'existing-pkg': '1.0.0', 'never-seen-pkg': '1.0.0' },
                }),
                [at('node_modules', 'existing-pkg', 'package.json')]: JSON.stringify({
                    name: 'existing-pkg',
                    version: '1.0.0',
                    license: 'MIT',
                    author: 'Author',
                }),
                [at('public', 'libs', 'README.md')]: mockReadme,
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
                writeFile: () => {
                    writeCount++;
                },
            });

            const result = await execute([], {});

            expect(result.success).toBe(false);
            expect(result.message).toContain('never-seen-pkg');
            expect(writeCount).toBe(0);
        });

        it('should report drift with --check without writing', async () => {
            let writeCount = 0;
            const mockFiles: Record<string, string> = {
                [at('package.json')]: JSON.stringify({ dependencies: { 'existing-pkg': '1.0.0' } }),
                [at('node_modules', 'existing-pkg', 'package.json')]: JSON.stringify({
                    name: 'existing-pkg',
                    version: '1.0.0',
                    license: 'MIT',
                    author: 'Author',
                }),
                [at('public', 'libs', 'README.md')]: mockReadme,
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
                writeFile: () => {
                    writeCount++;
                },
            });

            const result = await execute([], { check: true });

            expect(result.success).toBe(false);
            expect(result.message).toContain('make update-licenses');
            expect(writeCount).toBe(0);
        });

        it('should pass --check when the recorded file already matches', async () => {
            const generated = generateServerSideSection([
                { name: 'existing-pkg', version: '1.0.0', license: 'MIT', copyright: 'Author' },
            ]);
            const inSyncReadme = `# THIRD PARTY CODE\n\n${generated}\n\n## Client-side libraries\n\n*   Client lib\n`;

            const mockFiles: Record<string, string> = {
                [at('package.json')]: JSON.stringify({ dependencies: { 'existing-pkg': '1.0.0' } }),
                [at('node_modules', 'existing-pkg', 'package.json')]: JSON.stringify({
                    name: 'existing-pkg',
                    version: '1.0.0',
                    license: 'MIT',
                    author: 'Author',
                }),
                [at('public', 'libs', 'README.md')]: inSyncReadme,
            };

            configure({
                projectRoot: '/test',
                existsSync: (p: string) => p in mockFiles,
                readFile: (p: string) => mockFiles[p] || '',
                writeFile: () => {},
            });

            const result = await execute([], { check: true });

            expect(result.success).toBe(true);
            expect(result.message).toContain('up to date');
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
            [at('package.json')]: JSON.stringify({ dependencies: {} }),
            [at('public', 'libs', 'README.md')]: `# THIRD PARTY CODE

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
                existsSync: (p: string) => p === at('package.json'),
                readFile: (p: string) => (p === at('package.json') ? JSON.stringify({ dependencies: {} }) : ''),
                writeFile: () => {},
            };

            await runCli(['bun', 'cli', 'update-licenses'], badDeps, mockExit);

            expect(exitCode).toBe(1);
        });
    });
});

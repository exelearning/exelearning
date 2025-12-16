/**
 * Tests for ODE XML Validator
 */
import { describe, it, expect } from 'bun:test';
import { validateOdeXml, formatValidationErrors } from './ode-xml-validator';

describe('ODE XML Validator', () => {
    describe('validateOdeXml', () => {
        it('should return valid for a minimal valid ODE structure', () => {
            const parsed = {
                ode: {
                    '@_xmlns': 'http://www.intef.es/xsd/ode',
                    '@_version': '2.0',
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: '20251216120000ABCDEF',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should return valid for legacy exe_document format (skips validation)', () => {
            const parsed = {
                exe_document: {
                    meta: { title: 'Test' },
                    navigation: {},
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(true);
        });

        it('should return valid for legacy instance format (skips validation)', () => {
            const parsed = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(true);
        });

        it('should return error for missing ode root element', () => {
            const parsed = {
                someOtherElement: {},
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].code).toBe('MISSING_ROOT');
        });

        it('should return error for missing odeNavStructures', () => {
            const parsed = {
                ode: {
                    '@_xmlns': 'http://www.intef.es/xsd/ode',
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'MISSING_NAV_STRUCTURES')).toBe(true);
        });

        it('should return error for empty odeNavStructures', () => {
            const parsed = {
                ode: {
                    odeNavStructures: {},
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'MISSING_NAV_STRUCTURE')).toBe(true);
        });

        it('should return error for page without required elements', () => {
            const parsed = {
                ode: {
                    odeNavStructures: {
                        odeNavStructure: {
                            // Missing odePageId, pageName, odeNavStructureOrder
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'MISSING_PAGE_ID')).toBe(true);
            expect(result.errors.some(e => e.code === 'MISSING_PAGE_NAME')).toBe(true);
            expect(result.errors.some(e => e.code === 'MISSING_NAV_ORDER')).toBe(true);
        });

        it('should return warning for invalid namespace', () => {
            const parsed = {
                ode: {
                    '@_xmlns': 'http://wrong.namespace.com',
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page1',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(true);
            expect(result.warnings.some(w => w.code === 'INVALID_NAMESPACE')).toBe(true);
        });

        it('should validate userPreferences key-value pairs', () => {
            const parsed = {
                ode: {
                    userPreferences: {
                        userPreference: {
                            key: 'theme',
                            value: 'base',
                        },
                    },
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page1',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(true);
        });

        it('should return error for userPreference without key', () => {
            const parsed = {
                ode: {
                    userPreferences: {
                        userPreference: {
                            // Missing key
                            value: 'base',
                        },
                    },
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page1',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'MISSING_KEY')).toBe(true);
        });

        it('should validate multiple pages', () => {
            const parsed = {
                ode: {
                    odeNavStructures: {
                        odeNavStructure: [
                            {
                                odePageId: 'page1',
                                odeParentPageId: '',
                                pageName: 'Home',
                                odeNavStructureOrder: 0,
                            },
                            {
                                odePageId: 'page2',
                                odeParentPageId: 'page1',
                                pageName: 'Child Page',
                                odeNavStructureOrder: 1,
                            },
                        ],
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(true);
        });

        it('should validate blocks (odePagStructures)', () => {
            const parsed = {
                ode: {
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page1',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                            odePagStructures: {
                                odePagStructure: {
                                    odePageId: 'page1',
                                    odeBlockId: 'block1',
                                    blockName: 'Block 1',
                                    odePagStructureOrder: 0,
                                },
                            },
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(true);
        });

        it('should return error for block without required elements', () => {
            const parsed = {
                ode: {
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page1',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                            odePagStructures: {
                                odePagStructure: {
                                    // Missing odePageId, odeBlockId, odePagStructureOrder
                                },
                            },
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'MISSING_BLOCK_PAGE_ID')).toBe(true);
            expect(result.errors.some(e => e.code === 'MISSING_BLOCK_ID')).toBe(true);
            expect(result.errors.some(e => e.code === 'MISSING_PAG_ORDER')).toBe(true);
        });

        it('should validate components (odeComponents)', () => {
            const parsed = {
                ode: {
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page1',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                            odePagStructures: {
                                odePagStructure: {
                                    odePageId: 'page1',
                                    odeBlockId: 'block1',
                                    blockName: 'Block 1',
                                    odePagStructureOrder: 0,
                                    odeComponents: {
                                        odeComponent: {
                                            odePageId: 'page1',
                                            odeBlockId: 'block1',
                                            odeIdeviceId: 'idevice1',
                                            odeIdeviceTypeName: 'text',
                                            htmlView: '<p>Hello</p>',
                                            odeComponentsOrder: 0,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(true);
        });

        it('should return error for component without required elements', () => {
            const parsed = {
                ode: {
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page1',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                            odePagStructures: {
                                odePagStructure: {
                                    odePageId: 'page1',
                                    odeBlockId: 'block1',
                                    blockName: 'Block 1',
                                    odePagStructureOrder: 0,
                                    odeComponents: {
                                        odeComponent: {
                                            // Missing all required elements
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'MISSING_COMP_PAGE_ID')).toBe(true);
            expect(result.errors.some(e => e.code === 'MISSING_COMP_BLOCK_ID')).toBe(true);
            expect(result.errors.some(e => e.code === 'MISSING_IDEVICE_ID')).toBe(true);
            expect(result.errors.some(e => e.code === 'MISSING_IDEVICE_TYPE')).toBe(true);
            expect(result.errors.some(e => e.code === 'MISSING_COMP_ORDER')).toBe(true);
        });

        it('should return warning for component without content', () => {
            const parsed = {
                ode: {
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page1',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                            odePagStructures: {
                                odePagStructure: {
                                    odePageId: 'page1',
                                    odeBlockId: 'block1',
                                    blockName: 'Block 1',
                                    odePagStructureOrder: 0,
                                    odeComponents: {
                                        odeComponent: {
                                            odePageId: 'page1',
                                            odeBlockId: 'block1',
                                            odeIdeviceId: 'idevice1',
                                            odeIdeviceTypeName: 'text',
                                            // Missing htmlView and jsonProperties
                                            odeComponentsOrder: 0,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(true);
            expect(result.warnings.some(w => w.code === 'NO_CONTENT')).toBe(true);
        });

        it('should return error for null input', () => {
            const result = validateOdeXml(null);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'INVALID_STRUCTURE')).toBe(true);
        });

        it('should return warning for invalid version type', () => {
            const parsed = {
                ode: {
                    '@_version': { invalid: 'object' }, // Not string or number
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page1',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(true);
            expect(result.warnings.some(w => w.code === 'INVALID_VERSION')).toBe(true);
        });

        it('should validate odeResources with odeResource entries', () => {
            const parsed = {
                ode: {
                    odeResources: {
                        odeResource: {
                            key: 'odeId',
                            value: '12345',
                        },
                    },
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page1',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(true);
        });

        it('should validate odeProperties with odeProperty entries', () => {
            const parsed = {
                ode: {
                    odeProperties: {
                        odeProperty: [
                            { key: 'title', value: 'Test' },
                            { key: 'author', value: 'Author' },
                        ],
                    },
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page1',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(true);
        });

        it('should return error for invalid key-value pair (not an object)', () => {
            const parsed = {
                ode: {
                    userPreferences: {
                        userPreference: 'not an object', // Should be object with key/value
                    },
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page1',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'INVALID_KEY_VALUE')).toBe(true);
        });

        it('should return error for missing value in key-value pair', () => {
            const parsed = {
                ode: {
                    odeResources: {
                        odeResource: {
                            key: 'someKey',
                            // Missing value
                        },
                    },
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page1',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'MISSING_VALUE')).toBe(true);
        });

        it('should return error for invalid odeNavStructures type', () => {
            const parsed = {
                ode: {
                    odeNavStructures: 'not an object',
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'INVALID_NAV_STRUCTURES')).toBe(true);
        });

        it('should return error for empty odeNavStructure array', () => {
            const parsed = {
                ode: {
                    odeNavStructures: {
                        odeNavStructure: [],
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'EMPTY_NAV_STRUCTURES')).toBe(true);
        });

        it('should return error for invalid odeNavStructure type', () => {
            const parsed = {
                ode: {
                    odeNavStructures: {
                        odeNavStructure: 'not an object',
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'INVALID_NAV_STRUCTURE')).toBe(true);
        });

        it('should return error for invalid odePagStructure type', () => {
            const parsed = {
                ode: {
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page1',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                            odePagStructures: {
                                odePagStructure: 'not an object',
                            },
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'INVALID_PAG_STRUCTURE')).toBe(true);
        });

        it('should return error for invalid odeComponent type', () => {
            const parsed = {
                ode: {
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page1',
                            odeParentPageId: '',
                            pageName: 'Home',
                            odeNavStructureOrder: 0,
                            odePagStructures: {
                                odePagStructure: {
                                    odePageId: 'page1',
                                    odeBlockId: 'block1',
                                    blockName: 'Block',
                                    odePagStructureOrder: 0,
                                    odeComponents: {
                                        odeComponent: 123, // not an object
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = validateOdeXml(parsed);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'INVALID_COMPONENT')).toBe(true);
        });
    });

    describe('formatValidationErrors', () => {
        it('should format valid result', () => {
            const result = {
                valid: true,
                errors: [],
                warnings: [],
            };

            const formatted = formatValidationErrors(result);
            expect(formatted).toContain('validation passed');
        });

        it('should format errors', () => {
            const result = {
                valid: false,
                errors: [
                    {
                        code: 'MISSING_ROOT',
                        message: 'Missing root element',
                        path: '/',
                        severity: 'error' as const,
                    },
                ],
                warnings: [],
            };

            const formatted = formatValidationErrors(result);
            expect(formatted).toContain('validation failed');
            expect(formatted).toContain('ERROR');
            expect(formatted).toContain('MISSING_ROOT');
        });

        it('should format warnings', () => {
            const result = {
                valid: true,
                errors: [],
                warnings: [
                    {
                        code: 'NO_CONTENT',
                        message: 'Component has no content',
                        path: '/ode/...',
                        severity: 'warning' as const,
                    },
                ],
            };

            const formatted = formatValidationErrors(result);
            expect(formatted).toContain('WARNING');
            expect(formatted).toContain('NO_CONTENT');
        });
    });
});

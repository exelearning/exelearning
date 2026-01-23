/**
 * Tests for Centralized Metadata Properties Configuration
 */

import { describe, it, expect } from 'bun:test';
import {
    METADATA_PROPERTIES,
    getPropertyConfig,
    getPropertyConfigByXmlKey,
    getXmlKeyForProperty,
    getInternalKeyForXmlKey,
    getDefaultValue,
    isExcludedFromXml,
    getExportableProperties,
    getPropertiesByCategory,
    isBooleanProperty,
    parsePropertyValue,
    valueToXmlString,
    buildXmlKeyToInternalKeyMap,
    buildInternalKeyToXmlKeyMap,
    buildPropertyKeyMap,
    type MetadataPropertyConfig,
} from './metadata-properties';

describe('metadata-properties', () => {
    describe('METADATA_PROPERTIES', () => {
        it('contains all expected core properties', () => {
            const coreProps = METADATA_PROPERTIES.filter(p => p.category === 'core');
            const coreKeys = coreProps.map(p => p.key);

            expect(coreKeys).toContain('title');
            expect(coreKeys).toContain('subtitle');
            expect(coreKeys).toContain('author');
            expect(coreKeys).toContain('description');
            expect(coreKeys).toContain('language');
            expect(coreKeys).toContain('license');
            expect(coreKeys).toContain('theme');
        });

        it('contains all expected export options', () => {
            const exportProps = METADATA_PROPERTIES.filter(p => p.category === 'export');
            const exportKeys = exportProps.map(p => p.key);

            expect(exportKeys).toContain('addExeLink');
            expect(exportKeys).toContain('addPagination');
            expect(exportKeys).toContain('addSearchBox');
            expect(exportKeys).toContain('addAccessibilityToolbar');
            expect(exportKeys).toContain('addMathJax');
            expect(exportKeys).toContain('exportSource');
            expect(exportKeys).toContain('globalFont');
        });

        it('contains all expected content properties', () => {
            const contentProps = METADATA_PROPERTIES.filter(p => p.category === 'content');
            const contentKeys = contentProps.map(p => p.key);

            expect(contentKeys).toContain('extraHeadContent');
            expect(contentKeys).toContain('footer');
        });

        it('contains internal properties marked as excluded', () => {
            const internalProps = METADATA_PROPERTIES.filter(p => p.category === 'internal');
            expect(internalProps.every(p => p.excludeFromXml === true)).toBe(true);
        });

        it('has unique keys for all properties', () => {
            const keys = METADATA_PROPERTIES.map(p => p.key);
            const uniqueKeys = new Set(keys);
            expect(uniqueKeys.size).toBe(keys.length);
        });

        it('has unique XML keys for all properties', () => {
            const xmlKeys = METADATA_PROPERTIES.map(p => p.xmlKey.toLowerCase());
            const uniqueXmlKeys = new Set(xmlKeys);
            expect(uniqueXmlKeys.size).toBe(xmlKeys.length);
        });
    });

    describe('getPropertyConfig', () => {
        it('returns config for existing property', () => {
            const config = getPropertyConfig('title');
            expect(config).toBeDefined();
            expect(config?.key).toBe('title');
            expect(config?.xmlKey).toBe('pp_title');
            expect(config?.type).toBe('string');
        });

        it('returns undefined for non-existing property', () => {
            const config = getPropertyConfig('nonexistent');
            expect(config).toBeUndefined();
        });

        it('returns correct config for boolean property', () => {
            const config = getPropertyConfig('addMathJax');
            expect(config).toBeDefined();
            expect(config?.type).toBe('boolean');
            expect(config?.defaultValue).toBe(false);
        });
    });

    describe('getPropertyConfigByXmlKey', () => {
        it('returns config for XML key with pp_ prefix', () => {
            const config = getPropertyConfigByXmlKey('pp_title');
            expect(config).toBeDefined();
            expect(config?.key).toBe('title');
        });

        it('returns config for XML key without pp_ prefix', () => {
            const config = getPropertyConfigByXmlKey('footer');
            expect(config).toBeDefined();
            expect(config?.key).toBe('footer');
        });

        it('is case-insensitive', () => {
            const config1 = getPropertyConfigByXmlKey('PP_TITLE');
            const config2 = getPropertyConfigByXmlKey('pp_title');
            expect(config1?.key).toBe(config2?.key);
        });

        it('returns undefined for non-existing XML key', () => {
            const config = getPropertyConfigByXmlKey('pp_nonexistent');
            expect(config).toBeUndefined();
        });
    });

    describe('getXmlKeyForProperty', () => {
        it('returns correct XML key for known property', () => {
            expect(getXmlKeyForProperty('language')).toBe('pp_lang');
            expect(getXmlKeyForProperty('exelearningVersion')).toBe('pp_exelearning_version');
            expect(getXmlKeyForProperty('footer')).toBe('footer');
            expect(getXmlKeyForProperty('exportSource')).toBe('exportSource');
        });

        it('returns pp_ prefixed key for unknown property', () => {
            expect(getXmlKeyForProperty('unknownProp')).toBe('pp_unknownProp');
        });
    });

    describe('getInternalKeyForXmlKey', () => {
        it('returns internal key for XML key', () => {
            expect(getInternalKeyForXmlKey('pp_lang')).toBe('language');
            expect(getInternalKeyForXmlKey('pp_exelearning_version')).toBe('exelearningVersion');
            expect(getInternalKeyForXmlKey('footer')).toBe('footer');
        });

        it('is case-insensitive', () => {
            expect(getInternalKeyForXmlKey('PP_LANG')).toBe('language');
            expect(getInternalKeyForXmlKey('PP_AddMathJax')).toBe('addMathJax');
        });

        it('returns undefined for unknown XML key', () => {
            expect(getInternalKeyForXmlKey('pp_unknown')).toBeUndefined();
        });
    });

    describe('getDefaultValue', () => {
        it('returns correct default for string properties', () => {
            expect(getDefaultValue('title')).toBe('eXeLearning');
            expect(getDefaultValue('language')).toBe('en');
            expect(getDefaultValue('theme')).toBe('base');
            expect(getDefaultValue('globalFont')).toBe('default');
        });

        it('returns correct default for boolean properties', () => {
            expect(getDefaultValue('addExeLink')).toBe(true);
            expect(getDefaultValue('addMathJax')).toBe(false);
            expect(getDefaultValue('exportSource')).toBe(true);
        });

        it('returns empty string for unknown property', () => {
            expect(getDefaultValue('unknown')).toBe('');
        });
    });

    describe('isExcludedFromXml', () => {
        it('returns true for internal properties', () => {
            expect(isExcludedFromXml('odeIdentifier')).toBe(true);
            expect(isExcludedFromXml('createdAt')).toBe(true);
            expect(isExcludedFromXml('modifiedAt')).toBe(true);
        });

        it('returns true for SCORM properties', () => {
            expect(isExcludedFromXml('scormIdentifier')).toBe(true);
            expect(isExcludedFromXml('masteryScore')).toBe(true);
        });

        it('returns false for exportable properties', () => {
            expect(isExcludedFromXml('title')).toBe(false);
            expect(isExcludedFromXml('addMathJax')).toBe(false);
            expect(isExcludedFromXml('footer')).toBe(false);
        });

        it('returns false for unknown property', () => {
            expect(isExcludedFromXml('unknown')).toBe(false);
        });
    });

    describe('getExportableProperties', () => {
        it('returns only non-excluded properties', () => {
            const exportable = getExportableProperties();
            expect(exportable.every(p => p.excludeFromXml !== true)).toBe(true);
        });

        it('does not include internal properties', () => {
            const exportable = getExportableProperties();
            const keys = exportable.map(p => p.key);
            expect(keys).not.toContain('odeIdentifier');
            expect(keys).not.toContain('createdAt');
            expect(keys).not.toContain('scormIdentifier');
        });

        it('includes all core and export properties', () => {
            const exportable = getExportableProperties();
            const keys = exportable.map(p => p.key);
            expect(keys).toContain('title');
            expect(keys).toContain('addMathJax');
            expect(keys).toContain('globalFont');
        });
    });

    describe('getPropertiesByCategory', () => {
        it('returns correct properties for core category', () => {
            const props = getPropertiesByCategory('core');
            expect(props.length).toBeGreaterThan(0);
            expect(props.every(p => p.category === 'core')).toBe(true);
        });

        it('returns correct properties for export category', () => {
            const props = getPropertiesByCategory('export');
            expect(props.length).toBeGreaterThan(0);
            expect(props.every(p => p.category === 'export')).toBe(true);
        });

        it('returns empty array for non-existing category', () => {
            const props = getPropertiesByCategory('nonexistent' as MetadataPropertyConfig['category']);
            expect(props).toEqual([]);
        });
    });

    describe('isBooleanProperty', () => {
        it('returns true for boolean properties', () => {
            expect(isBooleanProperty('addExeLink')).toBe(true);
            expect(isBooleanProperty('addMathJax')).toBe(true);
            expect(isBooleanProperty('exportSource')).toBe(true);
        });

        it('returns false for string properties', () => {
            expect(isBooleanProperty('title')).toBe(false);
            expect(isBooleanProperty('globalFont')).toBe(false);
            expect(isBooleanProperty('footer')).toBe(false);
        });

        it('returns false for unknown property', () => {
            expect(isBooleanProperty('unknown')).toBe(false);
        });
    });

    describe('parsePropertyValue', () => {
        describe('for boolean properties', () => {
            it('parses true string', () => {
                expect(parsePropertyValue('addMathJax', 'true')).toBe(true);
                expect(parsePropertyValue('addMathJax', 'TRUE')).toBe(true);
            });

            it('parses false string', () => {
                expect(parsePropertyValue('addMathJax', 'false')).toBe(false);
                expect(parsePropertyValue('addMathJax', 'FALSE')).toBe(false);
            });

            it('parses boolean values', () => {
                expect(parsePropertyValue('addMathJax', true)).toBe(true);
                expect(parsePropertyValue('addMathJax', false)).toBe(false);
            });

            it('returns default for undefined/null', () => {
                expect(parsePropertyValue('addMathJax', undefined)).toBe(false);
                expect(parsePropertyValue('addMathJax', null)).toBe(false);
                expect(parsePropertyValue('addExeLink', undefined)).toBe(true); // default is true
            });
        });

        describe('for string properties', () => {
            it('returns string value', () => {
                expect(parsePropertyValue('title', 'My Title')).toBe('My Title');
            });

            it('converts non-string to string', () => {
                expect(parsePropertyValue('title', 123)).toBe('123');
            });

            it('returns default for undefined/null', () => {
                expect(parsePropertyValue('title', undefined)).toBe('eXeLearning');
                expect(parsePropertyValue('language', null)).toBe('en');
            });
        });

        describe('for unknown properties', () => {
            it('treats as string', () => {
                expect(parsePropertyValue('unknown', 'value')).toBe('value');
                expect(parsePropertyValue('unknown', 123)).toBe('123');
            });
        });
    });

    describe('valueToXmlString', () => {
        it('converts boolean true to "true"', () => {
            expect(valueToXmlString('addMathJax', true)).toBe('true');
            expect(valueToXmlString('addMathJax', 'true')).toBe('true');
        });

        it('converts boolean false to "false"', () => {
            expect(valueToXmlString('addMathJax', false)).toBe('false');
            expect(valueToXmlString('addMathJax', 'false')).toBe('false');
        });

        it('converts string values as-is', () => {
            expect(valueToXmlString('title', 'My Title')).toBe('My Title');
        });

        it('handles null/undefined', () => {
            expect(valueToXmlString('title', null)).toBe('');
            expect(valueToXmlString('title', undefined)).toBe('');
        });
    });

    describe('buildXmlKeyToInternalKeyMap', () => {
        it('returns a map with all properties', () => {
            const map = buildXmlKeyToInternalKeyMap();
            expect(map.size).toBe(METADATA_PROPERTIES.length);
        });

        it('maps XML keys to internal keys (lowercase)', () => {
            const map = buildXmlKeyToInternalKeyMap();
            expect(map.get('pp_title')).toBe('title');
            expect(map.get('pp_lang')).toBe('language');
            expect(map.get('footer')).toBe('footer');
            expect(map.get('pp_addmathjax')).toBe('addMathJax');
        });
    });

    describe('buildInternalKeyToXmlKeyMap', () => {
        it('returns a map with all properties', () => {
            const map = buildInternalKeyToXmlKeyMap();
            expect(map.size).toBe(METADATA_PROPERTIES.length);
        });

        it('maps internal keys to XML keys', () => {
            const map = buildInternalKeyToXmlKeyMap();
            expect(map.get('title')).toBe('pp_title');
            expect(map.get('language')).toBe('pp_lang');
            expect(map.get('footer')).toBe('footer');
            expect(map.get('addMathJax')).toBe('pp_addMathJax');
        });
    });

    describe('buildPropertyKeyMap', () => {
        it('returns object compatible with YjsPropertiesBinding', () => {
            const map = buildPropertyKeyMap();

            // Check key format (XML key -> internal key)
            expect(map['pp_title']).toBe('title');
            expect(map['pp_lang']).toBe('language');
            expect(map['pp_addMathJax']).toBe('addMathJax');
            expect(map['footer']).toBe('footer');
            expect(map['exportSource']).toBe('exportSource');
        });

        it('does not include excluded properties', () => {
            const map = buildPropertyKeyMap();
            expect(map['odeIdentifier']).toBeUndefined();
            expect(map['createdAt']).toBeUndefined();
            expect(map['scormIdentifier']).toBeUndefined();
        });
    });

    describe('XML key naming conventions', () => {
        it('uses pp_ prefix for most properties', () => {
            const propsWithPpPrefix = METADATA_PROPERTIES.filter(p => p.xmlKey.startsWith('pp_') && !p.excludeFromXml);
            // Most exportable properties should have pp_ prefix
            expect(propsWithPpPrefix.length).toBeGreaterThan(15);
        });

        it('uses special names for language and exelearningVersion', () => {
            expect(getXmlKeyForProperty('language')).toBe('pp_lang');
            expect(getXmlKeyForProperty('exelearningVersion')).toBe('pp_exelearning_version');
        });

        it('uses no prefix for footer and exportSource (legacy compatibility)', () => {
            expect(getXmlKeyForProperty('footer')).toBe('footer');
            expect(getXmlKeyForProperty('exportSource')).toBe('exportSource');
        });
    });
});

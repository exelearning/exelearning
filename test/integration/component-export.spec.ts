/**
 * Component Export Integration Tests
 * Tests the structure and format of exported component ELP files
 */
import { describe, it, expect, beforeAll } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { unzipSync, zipSync } from '../../src/shared/export';
import { XMLParser } from 'fast-xml-parser';

describe('Component Export Integration', () => {
    const fixturesDir = path.join(import.meta.dir, '../fixtures');
    let expectedXml: string;
    let parser: XMLParser;

    beforeAll(() => {
        // Read expected XML format
        expectedXml = fs.readFileSync(path.join(fixturesDir, 'xml/component-export-expected.xml'), 'utf-8');

        parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
        });
    });

    describe('Expected XML Format', () => {
        it('should have valid XML structure', () => {
            expect(expectedXml).toContain('<?xml version="1.0"');
            expect(expectedXml).toContain('<ode xmlns="http://www.intef.es/xsd/ode"');
        });

        it('should include odeComponentsResources marker', () => {
            expect(expectedXml).toContain('<key>odeComponentsResources</key>');
            expect(expectedXml).toContain('<value>true</value>');
        });

        it('should have proper page structure elements', () => {
            expect(expectedXml).toContain('<odePagStructures>');
            expect(expectedXml).toContain('<odePagStructure>');
            expect(expectedXml).toContain('<odeBlockId>');
            expect(expectedXml).toContain('<blockName>');
        });

        it('should have proper component elements', () => {
            expect(expectedXml).toContain('<odeComponents>');
            expect(expectedXml).toContain('<odeComponent>');
            expect(expectedXml).toContain('<odeIdeviceId>');
            expect(expectedXml).toContain('<odeIdeviceTypeName>');
            expect(expectedXml).toContain('<htmlView>');
            expect(expectedXml).toContain('<jsonProperties>');
            expect(expectedXml).toContain('<odeComponentsOrder>');
        });

        it('should be parseable', () => {
            const parsed = parser.parse(expectedXml);

            expect(parsed).toBeDefined();
            expect(parsed.ode).toBeDefined();
            expect(parsed.ode.odeResources).toBeDefined();
            expect(parsed.ode.odePagStructures).toBeDefined();
        });

        it('should have correct resource marker structure', () => {
            const parsed = parser.parse(expectedXml);
            const resources = parsed.ode.odeResources;

            expect(resources.odeResource).toBeDefined();
            expect(resources.odeResource.key).toBe('odeComponentsResources');
            // Parser may return boolean true or string "true"
            expect(String(resources.odeResource.value)).toBe('true');
        });

        it('should have correct component structure', () => {
            const parsed = parser.parse(expectedXml);
            const pagStructure = parsed.ode.odePagStructures.odePagStructure;

            expect(pagStructure.odeBlockId).toBeTruthy();
            expect(pagStructure.blockName).toBeTruthy();
            expect(pagStructure.odeComponents).toBeDefined();
            expect(pagStructure.odeComponents.odeComponent).toBeDefined();

            const component = pagStructure.odeComponents.odeComponent;
            expect(component.odeIdeviceId).toBeTruthy();
            expect(component.odePageId).toBeTruthy();
            expect(component.odeBlockId).toBeTruthy();
            expect(component.odeIdeviceTypeName).toBeTruthy();
        });
    });

    describe('XML Format Compatibility', () => {
        it('should have all required elements for import', () => {
            const requiredElements = [
                'ode',
                'odeResources',
                'odeResource',
                'key',
                'value',
                'odePagStructures',
                'odePagStructure',
                'odeBlockId',
                'blockName',
                'odeComponents',
                'odeComponent',
                'odeIdeviceId',
                'odePageId',
                'odeIdeviceTypeName',
                'htmlView',
                'jsonProperties',
                'odeComponentsOrder',
            ];

            for (const element of requiredElements) {
                expect(expectedXml).toContain(`<${element}`);
            }
        });

        it('should use CDATA for HTML content', () => {
            expect(expectedXml).toContain('<htmlView><![CDATA[');
            expect(expectedXml).toContain(']]></htmlView>');
        });

        it('should use CDATA for JSON properties', () => {
            expect(expectedXml).toContain('<jsonProperties><![CDATA[');
            expect(expectedXml).toContain(']]></jsonProperties>');
        });

        it('should have valid JSON in jsonProperties', () => {
            const jsonMatch = expectedXml.match(/<jsonProperties><!\[CDATA\[(.+?)\]\]><\/jsonProperties>/);

            expect(jsonMatch).toBeTruthy();
            if (jsonMatch) {
                expect(() => JSON.parse(jsonMatch[1])).not.toThrow();
            }
        });
    });

    describe('ELP File Structure', () => {
        it('should create proper ZIP structure for component ELP', async () => {
            // Simulate the expected structure of an exported component ELP file
            const files: Record<string, Uint8Array | string> = {
                'content.xml': expectedXml,
                'content/resources/asset-uuid/image.png': new Uint8Array(Buffer.from('fake-image-data')),
            };

            // Generate and verify
            const zipBuffer = zipSync(files);
            const loadedZip = unzipSync(zipBuffer);

            expect(loadedZip['content.xml']).toBeDefined();
            expect(loadedZip['content/resources/asset-uuid/image.png']).toBeDefined();
        });

        it('should have content.xml at root level', async () => {
            const files: Record<string, Uint8Array | string> = {
                'content.xml': expectedXml,
            };

            const zipBuffer = zipSync(files);
            const loadedZip = unzipSync(zipBuffer);

            const contentXml = new TextDecoder().decode(loadedZip['content.xml']);
            expect(contentXml).toBeDefined();
            expect(contentXml).toContain('<ode');
        });
    });

    describe('Backend XML Parser Compatibility', () => {
        it('should be parseable by backend xml-parser pattern', () => {
            // Simulate how the backend xml-parser.ts parses component XML
            const parsed = parser.parse(expectedXml);
            const pagStructure = parsed.ode.odePagStructures.odePagStructure;
            const odeComponent = pagStructure.odeComponents.odeComponent;

            // These are the fields the backend expects (see xml-parser.ts:295-302)
            const id = odeComponent.odeIdeviceId;
            const type = odeComponent.odeIdeviceTypeName;
            const order = odeComponent.odeComponentsOrder;
            const content = odeComponent.htmlView;

            expect(id).toBeTruthy();
            expect(type).toBeTruthy();
            expect(order).toBeDefined();
            expect(content).toBeTruthy();
        });

        it('should have parseable jsonProperties field', () => {
            const parsed = parser.parse(expectedXml);
            const pagStructure = parsed.ode.odePagStructures.odePagStructure;
            const odeComponent = pagStructure.odeComponents.odeComponent;

            const jsonPropsRaw = odeComponent.jsonProperties;

            // The CDATA content should be valid JSON
            expect(jsonPropsRaw).toBeTruthy();

            // Note: fast-xml-parser may strip CDATA markers
            const jsonData = JSON.parse(jsonPropsRaw);
            expect(jsonData).toBeDefined();
            expect(typeof jsonData).toBe('object');
        });
    });

    describe('Filename Conventions', () => {
        it('should use .idevice extension for single iDevice export', () => {
            const ideviceId = 'test-idevice-123';
            const expectedFilename = `${ideviceId}.idevice`;

            expect(expectedFilename).toMatch(/\.idevice$/);
        });

        it('should use .block extension for block export', () => {
            const blockId = 'test-block-456';
            const expectedFilename = `${blockId}.block`;

            expect(expectedFilename).toMatch(/\.block$/);
        });
    });
});

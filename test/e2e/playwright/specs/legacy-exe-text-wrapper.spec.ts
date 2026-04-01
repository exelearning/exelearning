import { test, expect } from '../fixtures/auth.fixture';
import * as path from 'path';
import { gotoWorkarea, openElpFile, waitForAppReady } from '../helpers/workarea-helpers';

const LEGACY_ELP_FIXTURE = path.resolve(__dirname, '../../../fixtures/old_tema-10-ejemplo.elp');

test.describe('Legacy ELP Import - exe-text wrapper removal', () => {
    test.beforeEach(({}, testInfo) => {
        if (testInfo.project.name === 'static') {
            test.skip(true, 'Legacy ELP import tests run only in online mode');
        }
    });

    test('should remove legacy div.exe-text wrappers from imported html content', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Legacy exe-text unwrap test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await openElpFile(page, LEGACY_ELP_FIXTURE, 2);

        const analysis = await page.evaluate(() => {
            const classContainsLegacyExeText = (classValue: string): boolean => /(^|\s)exe-text(\s|$)/.test(classValue);

            const findTagEnd = (input: string, start: number): number => {
                let quote: '"' | "'" | null = null;
                for (let i = start; i < input.length; i += 1) {
                    const ch = input[i];

                    if (quote) {
                        if (ch === quote) {
                            quote = null;
                        }
                        continue;
                    }

                    if (ch === '"' || ch === "'") {
                        quote = ch;
                        continue;
                    }

                    if (ch === '>') {
                        return i;
                    }
                }

                return -1;
            };

            const listOpeningDivTags = (input: string): string[] => {
                const tags: string[] = [];
                let cursor = 0;

                while (cursor < input.length) {
                    const lt = input.indexOf('<', cursor);
                    if (lt === -1) {
                        break;
                    }

                    const tagEnd = findTagEnd(input, lt);
                    if (tagEnd === -1) {
                        break;
                    }

                    const rawTag = input.slice(lt, tagEnd + 1);
                    if (/^<\s*div\b/i.test(rawTag)) {
                        tags.push(rawTag);
                    }

                    cursor = tagEnd + 1;
                }

                return tags;
            };

            const findFirstOpeningDivTag = (input: string): string | null => {
                const firstNonSpace = input.search(/\S/);
                if (firstNonSpace === -1 || input[firstNonSpace] !== '<') {
                    return null;
                }

                const tagEnd = findTagEnd(input, firstNonSpace);
                if (tagEnd === -1) {
                    return null;
                }

                const rawTag = input.slice(firstNonSpace, tagEnd + 1);
                if (!/^<\s*div\b/i.test(rawTag)) {
                    return null;
                }

                return rawTag;
            };

            const listLegacyExeTextDivTags = (value: unknown): string[] => {
                if (typeof value !== 'string' || !value) {
                    return [];
                }

                const matches: string[] = [];
                const divTags = listOpeningDivTags(value);

                for (const tag of divTags) {
                    const classAttrMatch = tag.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
                    if (!classAttrMatch) {
                        continue;
                    }

                    const classValue = classAttrMatch[1] ?? classAttrMatch[2] ?? classAttrMatch[3] ?? '';
                    if (classContainsLegacyExeText(classValue)) {
                        matches.push(tag);
                    }
                }

                return matches;
            };

            const hasExeTextWrapper = (value: unknown): boolean => {
                if (typeof value !== 'string') {
                    return false;
                }

                const leadingDivTag = findFirstOpeningDivTag(value);
                if (!leadingDivTag) {
                    return false;
                }

                const classAttrMatch = leadingDivTag.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
                if (!classAttrMatch) {
                    return false;
                }

                const classValue = classAttrMatch[1] ?? classAttrMatch[2] ?? classAttrMatch[3] ?? '';
                return classContainsLegacyExeText(classValue);
            };

            const containsExeTextWrapper = (value: unknown): boolean => {
                if (typeof value !== 'string') {
                    return false;
                }

                return listLegacyExeTextDivTags(value).length > 0;
            };

            const parseJsonProperties = (raw: unknown): unknown => {
                if (typeof raw !== 'string') {
                    return raw;
                }

                try {
                    return JSON.parse(raw);
                } catch {
                    return raw;
                }
            };

            const collectStringValues = (value: unknown, out: string[]): void => {
                if (typeof value === 'string') {
                    out.push(value);
                    return;
                }

                if (Array.isArray(value)) {
                    for (const item of value) {
                        collectStringValues(item, out);
                    }
                    return;
                }

                if (value && typeof value === 'object') {
                    for (const item of Object.values(value as Record<string, unknown>)) {
                        collectStringValues(item, out);
                    }
                }
            };

            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const doc = bridge?.getDocumentManager?.()?.getDoc?.();
            if (!doc) {
                return {
                    error: 'Missing Y.Doc after import',
                    scannedBlocks: 0,
                    htmlViewChecks: 0,
                    jsonStringChecks: 0,
                    wrappedHtmlViewBlocks: [] as string[],
                    wrappedJsonBlocks: [] as string[],
                    containedHtmlViewBlocks: [] as string[],
                    containedJsonBlocks: [] as string[],
                };
            }

            const navigation = doc.getArray('navigation');
            const wrappedHtmlViewBlocks: string[] = [];
            const wrappedJsonBlocks: string[] = [];
            const containedHtmlViewBlocks: string[] = [];
            const containedJsonBlocks: string[] = [];
            let scannedBlocks = 0;
            let scannedComponents = 0;
            let htmlViewChecks = 0;
            let jsonStringChecks = 0;

            const walkBlocks = (blocks: any): void => {
                if (!blocks) {
                    return;
                }

                for (let i = 0; i < blocks.length; i += 1) {
                    const block = blocks.get(i);
                    if (!block) {
                        continue;
                    }

                    scannedBlocks += 1;

                    const blockId = String(block.get('blockId') || block.get('id') || `block-${i}`);
                    const ideviceType = String(block.get('iDevice') || block.get('type') || 'unknown');
                    const components = block.get('components');
                    if (!components || typeof components.length !== 'number') {
                        continue;
                    }

                    for (let j = 0; j < components.length; j += 1) {
                        const component = components.get(j);
                        if (!component) {
                            continue;
                        }

                        scannedComponents += 1;

                        const componentId = String(
                            component.get('id') || component.get('ideviceId') || `component-${j}`,
                        );
                        const componentType = String(component.get('type') || ideviceType || 'unknown');
                        const identity = `${componentType}::${blockId}::${componentId}`;

                        const htmlView = component.get('htmlView');
                        if (typeof htmlView === 'string') {
                            htmlViewChecks += 1;
                            if (hasExeTextWrapper(htmlView)) {
                                wrappedHtmlViewBlocks.push(identity);
                            }
                            if (containsExeTextWrapper(htmlView)) {
                                containedHtmlViewBlocks.push(identity);
                            }
                        }

                        const jsonRaw = component.get('jsonProperties');
                        const jsonProperties = parseJsonProperties(jsonRaw);
                        const jsonStrings: string[] = [];
                        collectStringValues(jsonProperties, jsonStrings);

                        for (const text of jsonStrings) {
                            jsonStringChecks += 1;
                            if (hasExeTextWrapper(text)) {
                                wrappedJsonBlocks.push(identity);
                                break;
                            }
                        }

                        for (const text of jsonStrings) {
                            if (containsExeTextWrapper(text)) {
                                containedJsonBlocks.push(identity);
                                break;
                            }
                        }
                    }
                }
            };

            const walkPages = (pages: any): void => {
                if (!pages) {
                    return;
                }

                for (let i = 0; i < pages.length; i += 1) {
                    const pageMap = pages.get(i);
                    if (!pageMap) {
                        continue;
                    }

                    walkBlocks(pageMap.get('blocks'));
                    walkPages(pageMap.get('children'));
                }
            };

            walkPages(navigation);

            return {
                scannedBlocks,
                scannedComponents,
                htmlViewChecks,
                jsonStringChecks,
                wrappedHtmlViewBlocks,
                wrappedJsonBlocks,
                containedHtmlViewBlocks,
                containedJsonBlocks,
            };
        });

        expect(analysis.error).toBeUndefined();
        expect(analysis.scannedBlocks).toBeGreaterThan(0);
        expect(analysis.scannedComponents).toBeGreaterThan(0);
        expect(analysis.htmlViewChecks + analysis.jsonStringChecks).toBeGreaterThan(0);
        expect(analysis.wrappedHtmlViewBlocks).toEqual([]);
        expect(analysis.wrappedJsonBlocks).toEqual([]);
        expect(analysis.containedHtmlViewBlocks).toEqual([]);
        expect(analysis.containedJsonBlocks).toEqual([]);
    });
});

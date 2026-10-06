import { describe, expect, it } from 'bun:test';
import { DOMParser } from '@xmldom/xmldom';

import { FileAttachHandler } from './FileAttachHandler';

/**
 * Create a dictionary element from a legacy XML fragment.
 */
function createDictionary(xml: string): Element {
    const parser = new DOMParser();
    return parser.parseFromString(xml, 'text/xml').documentElement;
}

describe('FileAttachHandler', () => {
    it('renders imported attachments before the iDevice is edited', () => {
        const handler = new FileAttachHandler();
        const dict = createDictionary(`
            <dictionary>
                <string role="key" value="introHTML"/>
                <instance class="TextAreaField">
                    <dictionary>
                        <string role="key" value="content_w_resourcePaths"/>
                        <unicode value="&lt;p&gt;Download the files.&lt;/p&gt;"/>
                    </dictionary>
                </instance>
                <string role="key" value="fileAttachmentFields"/>
                <list>
                    <instance class="FileField">
                        <dictionary>
                            <string role="key" value="fileResource"/>
                            <instance class="Resource">
                                <dictionary>
                                    <string role="key" value="_storageName"/>
                                    <string value="worksheet.odt"/>
                                </dictionary>
                            </instance>
                            <string role="key" value="fileDescription"/>
                            <instance class="TextField">
                                <dictionary>
                                    <string role="key" value="content"/>
                                    <string value="Editable worksheet"/>
                                </dictionary>
                            </instance>
                        </dictionary>
                    </instance>
                    <instance class="FileField">
                        <dictionary>
                            <string role="key" value="fileResource"/>
                            <instance class="Resource">
                                <dictionary>
                                    <string role="key" value="_storageName"/>
                                    <string value="worksheet.pdf"/>
                                </dictionary>
                            </instance>
                        </dictionary>
                    </instance>
                </list>
            </dictionary>
        `);

        const html = handler.extractHtmlView(dict);

        expect(html).toContain('<p>Download the files.</p>');
        expect(html.match(/class="fileAttachment-link"/g)).toHaveLength(2);
        expect(html).toContain('href="resources/worksheet.odt"');
        expect(html).toContain('href="resources/worksheet.pdf"');
        expect(html).toContain('Editable worksheet');
        expect(html).toContain('worksheet.pdf');
    });

    it('uses the display name when a legacy description is absent', () => {
        const handler = new FileAttachHandler();
        const dict = createDictionary(`
            <dictionary>
                <string role="key" value="fileAttachmentFields"/>
                <list>
                    <instance class="FileField">
                        <dictionary>
                            <string role="key" value="fileResource"/>
                            <instance class="Resource">
                                <dictionary>
                                    <string role="key" value="_storageName"/>
                                    <string value="document.pdf"/>
                                </dictionary>
                            </instance>
                            <string role="key" value="_displayName"/>
                            <string value="Readable document name"/>
                        </dictionary>
                    </instance>
                </list>
            </dictionary>
        `);

        const properties = handler.extractProperties(dict);
        const attachments = properties.attachments as Array<{ title: string }>;

        expect(attachments[0].title).toBe('Readable document name');
        expect(handler.extractHtmlView(dict)).toContain('Readable document name');
    });

    it('escapes attachment labels and attributes in the fallback view', () => {
        const handler = new FileAttachHandler();
        const dict = createDictionary(`
            <dictionary>
                <string role="key" value="fileAttachmentFields"/>
                <list>
                    <instance class="FileField">
                        <dictionary>
                            <string role="key" value="fileResource"/>
                            <instance class="Resource">
                                <dictionary>
                                    <string role="key" value="_storageName"/>
                                    <string value="report&amp;notes.pdf"/>
                                </dictionary>
                            </instance>
                            <string role="key" value="fileDescription"/>
                            <instance class="TextField">
                                <dictionary>
                                    <string role="key" value="content"/>
                                    <string value="Report &amp; &lt;notes&gt;"/>
                                </dictionary>
                            </instance>
                        </dictionary>
                    </instance>
                </list>
            </dictionary>
        `);

        const html = handler.extractHtmlView(dict);

        expect(html).toContain('Report &amp; &lt;notes&gt;');
        expect(html).toContain('href="resources/report&amp;notes.pdf"');
        expect(html).not.toContain('<notes>');
    });

    it('returns empty values for a missing dictionary', () => {
        const handler = new FileAttachHandler();
        const dict = null as unknown as Element;

        expect(handler.extractHtmlView(dict)).toBe('');
        expect(handler.extractProperties(dict)).toEqual({});
    });
});
